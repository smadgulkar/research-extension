import type { Knowledge } from '../storage/db';
import type { LLMSettings, SummaryLength } from '@/types/models';

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

  async analyze(content: string, title: string, summaryLength: SummaryLength = 'medium'): Promise<AnalysisResult> {
    const lengthInstructions = {
      short: "Provide a very concise summary in 2-3 sentences.",
      medium: "Provide a balanced summary in 4-6 sentences.",
      long: "Provide a comprehensive summary in 7-10 sentences."
    };
    
    const prompt = `
      Analyze the following web content:
      Title: ${title}
      Content: ${content}
      
      Provide the following:
      1. ${lengthInstructions[summaryLength]}
      2. Extract 3-5 key points from the content.
      3. Identify 3-7 relevant topics or categories.
      4. Determine the overall sentiment (positive, negative, neutral, or mixed).
      
      Format your response as JSON:
      {
        "summary": "The summary of the content",
        "keyPoints": ["Key point 1", "Key point 2", ...],
        "topics": ["Topic 1", "Topic 2", ...],
        "sentiment": "The overall sentiment"
      }
    `;

    try {
      switch (this.settings.provider.toLowerCase()) {
        case 'openai':
          return this.openAIAnalyze(prompt);
        case 'anthropic':
          return this.anthropicAnalyze(prompt);
        default:
          throw new Error(`Unsupported provider: ${this.settings.provider}`);
      }
    } catch (error) {
      console.error('Analysis error:', error);
      throw error;
    }
  }

  private async openAIAnalyze(prompt: string): Promise<AnalysisResult> {
    try {
      if (!this.settings.apiKey) {
        throw new Error('OpenAI API key is missing. Please add it in settings.');
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.settings.apiKey}`
        },
        body: JSON.stringify({
          model: this.settings.model,
          messages: [{
            role: 'system',
            content: 'You are a research assistant that analyzes web content and provides structured insights.'
          }, {
            role: 'user',
            content: prompt
          }],
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return JSON.parse(data.choices[0].message.content);
    } catch (error) {
      console.error('OpenAI analysis error:', error);
      throw error;
    }
  }

  private async anthropicAnalyze(prompt: string): Promise<AnalysisResult> {
    try {
      if (!this.settings.apiKey) {
        throw new Error('Anthropic API key is missing. Please add it in settings.');
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.settings.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: this.settings.model,
          max_tokens: 2000,
          messages: [{
            role: 'user',
            content: `${prompt}\n\nRespond only with valid JSON matching the specified structure.`
          }]
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Anthropic API error: ${error.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return JSON.parse(data.content[0].text);
    } catch (error) {
      console.error('Anthropic analysis error:', error);
      throw error;
    }
  }

  async extractKnowledge(prompt: string): Promise<KnowledgePoint[]> {
    const structuredPrompt = `
      Analyze the following content and extract key knowledge points:
      ${prompt}

      For each knowledge point:
      1. Identify the specific topic it belongs to
      2. Write a clear, concise statement of the knowledge
      3. Assign a confidence score (0.0-1.0) based on how clearly/directly this knowledge is stated

      Format your response as a JSON array of knowledge points:
      [
        {
          "topic": "specific topic area",
          "content": "clear knowledge statement",
          "confidence": 0.95
        }
      ]

      Ensure each knowledge point is:
      - Self-contained and meaningful on its own
      - Specific rather than general
      - Factual rather than subjective
      - Properly categorized by topic
    `;

    const response = await this.makeAPIRequest(structuredPrompt);
    try {
      const parsed = JSON.parse(response);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('Error parsing knowledge points:', error);
      return [];
    }
  }

  async findRelevantKnowledge(query: string, knowledge: Knowledge[]): Promise<Knowledge[]> {
    const prompt = `
      Query: "${query}"
      
      Task: Find the most relevant pieces of knowledge from the following collection.
      Consider:
      1. Direct relevance to the query topic
      2. Supporting or related information
      3. Context that helps understand the query better

      Knowledge Collection:
      ${JSON.stringify(knowledge, null, 2)}

      Return a JSON array of indices of the most relevant pieces, ordered by relevance (most relevant first).
      Example: [2, 5, 1] means knowledge pieces at indices 2, 5, and 1 are most relevant in that order.
    `;

    const response = await this.makeAPIRequest(prompt);
    try {
      const indices = JSON.parse(response);
      if (!Array.isArray(indices)) throw new Error('Expected array of indices');
      return indices
        .map((i: number) => knowledge[i])
        .filter((k): k is Knowledge => k !== undefined);
    } catch (error) {
      console.error('Error finding relevant knowledge:', error);
      return [];
    }
  }

  async synthesizeAnswer(query: string, relevantKnowledge: Knowledge[]): Promise<string> {
    const prompt = `
      Query: "${query}"

      Using ONLY the following knowledge pieces, synthesize a comprehensive answer:
      ${JSON.stringify(relevantKnowledge, null, 2)}

      Guidelines:
      1. Focus on directly answering the query
      2. Integrate information from multiple knowledge pieces when relevant
      3. Maintain accuracy - only state what is supported by the knowledge pieces
      4. Use clear, concise language
      5. If the knowledge is insufficient, acknowledge limitations
      
      Format: Provide a natural, flowing response that a human would find helpful and easy to understand.
    `;

    return this.makeAPIRequest(prompt);
  }

  private async makeAPIRequest(prompt: string): Promise<string> {
    switch (this.settings.provider) {
      case 'openai':
        return this.openAIRequest(prompt);
      case 'anthropic':
        return this.anthropicRequest(prompt);
      default:
        throw new Error('Unsupported provider');
    }
  }

  private async openAIRequest(prompt: string): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.settings.apiKey}`
      },
      body: JSON.stringify({
        model: this.settings.model,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  private async anthropicRequest(prompt: string): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.settings.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.settings.model,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.content[0].text;
  }
}