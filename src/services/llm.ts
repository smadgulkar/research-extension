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

  async analyze(prompt: string): Promise<any> {
    try {
      // Check if API key is provided
      if (!this.settings.apiKey) {
        throw new Error('API key is required. Please add your API key in the settings.');
      }

      // Determine which provider to use
      switch (this.settings.provider.toLowerCase()) {
        case 'openai':
          return await this.callOpenAI(prompt);
        case 'anthropic':
          return await this.callAnthropic(prompt);
        default:
          throw new Error(`Unsupported provider: ${this.settings.provider}`);
      }
    } catch (error) {
      console.error('LLM analysis error:', error);
      throw error;
    }
  }

  private async callOpenAI(prompt: string): Promise<any> {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.settings.apiKey}`
        },
        body: JSON.stringify({
          model: this.settings.model || 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant that analyzes web content.'
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

  private async callAnthropic(prompt: string): Promise<any> {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.settings.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.settings.model || 'claude-2',
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

  async findRelevantKnowledge(query: string, knowledgeItems: any[]): Promise<any[]> {
    // Simple implementation for now
    return knowledgeItems.slice(0, 5);
  }

  async synthesizeAnswer(query: string, relevantKnowledge: any[]): Promise<string> {
    if (relevantKnowledge.length === 0) {
      return "I don't have enough information to answer that question.";
    }

    const knowledgeText = relevantKnowledge
      .map(item => `${item.topic}: ${item.content}`)
      .join('\n\n');

    const prompt = `
      Based on the following knowledge:
      ${knowledgeText}
      
      Please answer this question: ${query}
    `;

    return await this.analyze(prompt);
  }
}