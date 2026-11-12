import type { Knowledge } from '../storage/db';
import type { LLMSettings, SummaryLength } from '@/types/models';
import { resolveGeminiModel, GEMINI_PREFERRED_MODELS } from './geminiModels';

interface AnalysisResult {
  summary: string;
  keyPoints: string[];
  topics: string[];
  keywords: string[];
  sentiment: string;
  actionItems?: string[];
  importance?: 1 | 2 | 3 | 4 | 5;
  readingTime?: number;
}

interface KnowledgePoint {
  topic: string;
  content: string;
  confidence: number;
}

export class LLMService {
  private settings: LLMSettings;

  constructor(settings: LLMSettings) {
    this.settings = settings;
  }

  async analyze(prompt: string): Promise<string> {
    try {
      if (this.settings.provider === 'openai') {
        return await this.callOpenAI(prompt);
      } else if (this.settings.provider === 'anthropic') {
        return await this.callAnthropic(prompt);
      } else if (this.settings.provider === 'gemini') {
        return await this.callGemini(prompt);
      } else {
        throw new Error('Unsupported LLM provider');
      }
    } catch (error) {
      console.error('LLM analysis error:', error);
      throw error;
    }
  }

  private async callOpenAI(prompt: string): Promise<string> {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.settings.apiKey}`
        },
        body: JSON.stringify({
          model: this.settings.model || 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant that provides accurate, detailed responses based on the given knowledge base.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw error;
    }
  }

  private async callAnthropic(prompt: string): Promise<string> {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.settings.apiKey,
          'anthropic-version': '2023-06-01',
          // Required by Anthropic for requests made from a browser/extension context (CORS)
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: this.settings.model || 'claude-sonnet-5-5',
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Anthropic API error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return data.content[0].text;
    } catch (error) {
      console.error('Anthropic API error:', error);
      throw error;
    }
  }

  private async callGemini(prompt: string): Promise<string> {
    // Older settings may name a model Google has shut down; map it to its replacement.
    const chosen = resolveGeminiModel(this.settings.model);
    const models = geminiFallbackOrder(chosen);
    let lastError: Error | null = null;
    for (const model of models) {
      try {
        const text = await this.callGeminiModel(model, prompt);
        rememberGeminiFallback(chosen, model);
        return text;
      } catch (error) {
        lastError = error as Error;
        // Only move on when the model is busy or unavailable; a bad key or a
        // blocked prompt would fail the same way on every model.
        if (!(error instanceof GeminiUnavailableError)) throw error;
        console.warn(`Gemini ${model} unavailable, trying the next free model:`, (error as Error).message);
      }
    }
    if (lastError instanceof GeminiUnavailableError && lastError.status === 429) {
      throw new Error(
        'Gemini rate limit reached on every free model. Wait a minute and try again, or try tomorrow if the daily limit is used up.'
      );
    }
    throw new Error("Google's Gemini models are busy right now. Please try again in a minute.");
  }

  private async callGeminiModel(model: string, prompt: string): Promise<string> {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(this.settings.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            // Gemini 3 models think before answering, and thinking tokens count
            // against this limit, so 2048 could cut the JSON answer short.
            maxOutputTokens: 8192,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message: string = errorData.error?.message || response.statusText || `HTTP ${response.status}`;
      // 503 "high demand"/overloaded, 500, 429 per-model quota, 404 model gone.
      if ([404, 429, 500, 503, 504].includes(response.status) || /overloaded|high demand|unavailable/i.test(message)) {
        throw new GeminiUnavailableError(response.status, message);
      }
      throw new Error(`Gemini API error: ${message}`);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    // Join the answer parts, skipping any thought summaries.
    const text = (candidate?.content?.parts || [])
      .filter((part: any) => !part.thought && typeof part.text === 'string')
      .map((part: any) => part.text)
      .join('');
    if (!text) {
      const reason = data.promptFeedback?.blockReason || candidate?.finishReason || 'no text returned';
      throw new Error(`Gemini returned no answer (${reason}).`);
    }
    if (candidate?.finishReason === 'MAX_TOKENS') {
      console.warn('Gemini answer hit the output token limit and may be incomplete.');
    }
    return text;
  }
}

class GeminiUnavailableError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// When the chosen model is busy, later requests in the next few minutes go
// straight to the model that worked instead of waiting on the busy one again.
const FALLBACK_TTL_MS = 10 * 60 * 1000;
let geminiFallback: { from: string; to: string; until: number } | null = null;

function rememberGeminiFallback(chosen: string, used: string) {
  geminiFallback = chosen === used ? null : { from: chosen, to: used, until: Date.now() + FALLBACK_TTL_MS };
}

/** The chosen model first (or the one that worked recently), then the other free models. */
export function geminiFallbackOrder(chosen: string): string[] {
  const order = [chosen, ...GEMINI_PREFERRED_MODELS.filter((m) => m !== chosen)];
  if (geminiFallback && geminiFallback.from === chosen && geminiFallback.until > Date.now()) {
    return [geminiFallback.to, ...order.filter((m) => m !== geminiFallback!.to)];
  }
  return order;
}
