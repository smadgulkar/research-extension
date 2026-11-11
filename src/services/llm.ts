import type { Knowledge } from '../storage/db';
import type { LLMSettings, SummaryLength } from '@/types/models';
import { resolveGeminiModel } from './geminiModels';

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
    try {
      // Older settings may name a model Google has shut down; map it to its replacement.
      const model = resolveGeminiModel(this.settings.model);
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(this.settings.apiKey)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: prompt
                  }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.3,
              // Gemini 3 models think before answering, and thinking tokens count
              // against this limit, so 2048 could cut the JSON answer short.
              maxOutputTokens: 8192,
            }
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 429) {
          throw new Error(
            'Gemini rate limit reached. On the free tier, wait a minute and try again, or try tomorrow if the daily limit is used up.'
          );
        }
        throw new Error(`Gemini API error: ${errorData.error?.message || response.statusText}`);
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
    } catch (error) {
      console.error('Gemini API error:', error);
      throw error;
    }
  }

  async extractKnowledge(prompt: string): Promise<any> {
    const response = await this.analyze(prompt);
    try {
      // Handle case where response is wrapped in markdown code blocks
      let jsonStr = response;
      
      // Remove markdown code block formatting if present
      if (response.includes('```json')) {
        // More careful extraction of JSON content
        const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) {
          jsonStr = jsonMatch[1];
        } else {
          // Fallback to simple replacement
          jsonStr = response.replace(/```json\s*|\s*```/g, '');
        }
      } else if (response.includes('```')) {
        // More careful extraction for generic code blocks
        const jsonMatch = response.match(/```\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) {
          jsonStr = jsonMatch[1];
        } else {
          // Fallback to simple replacement
          jsonStr = response.replace(/```\s*|\s*```/g, '');
        }
      }
      
      // Trim whitespace
      jsonStr = jsonStr.trim();
      
      // Make sure the JSON is complete and valid
      // Check if it starts with [ and ends with ]
      if (jsonStr.startsWith('[') && !jsonStr.endsWith(']')) {
        // Find the last closing bracket
        const lastIndex = jsonStr.lastIndexOf(']');
        if (lastIndex > 0) {
          jsonStr = jsonStr.substring(0, lastIndex + 1);
        }
      }
      
      console.log('Cleaned JSON string:', jsonStr);
      
      // Try to parse the JSON
      try {
        return JSON.parse(jsonStr);
      } catch (parseError) {
        console.error('Initial parsing failed, trying to fix JSON:', parseError);
        
        // Try to fix common JSON issues
        // 1. Missing closing bracket
        if (jsonStr.startsWith('[') && !jsonStr.endsWith(']')) {
          jsonStr += ']';
        }
        
        // 2. Trailing comma
        jsonStr = jsonStr.replace(/,(\s*[\]}])/g, '$1');
        
        console.log('Fixed JSON string:', jsonStr);
        return JSON.parse(jsonStr);
      }
    } catch (error) {
      console.error('Error parsing knowledge extraction response:', error);
      console.error('Raw response:', response);
      return [];
    }
  }
}