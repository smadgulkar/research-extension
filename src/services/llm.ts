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

  async analyze(prompt: string): Promise<string> {
    try {
      if (this.settings.provider === 'openai') {
        return await this.callOpenAI(prompt);
      } else if (this.settings.provider === 'anthropic') {
        return await this.callAnthropic(prompt);
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
          model: this.settings.model || 'gpt-3.5-turbo',
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
    try {
      if (!knowledgeItems || knowledgeItems.length === 0) {
        return [];
      }

      const prompt = `
        Given this query: "${query}"
        
        Find the most relevant items from this knowledge base:
        ${JSON.stringify(knowledgeItems.map(item => ({
          id: item.id,
          topic: item.topic,
          content: item.content,
          confidence: item.confidence
        })))}
        
        Return ONLY the relevant items as a JSON array, maintaining their original structure.
        Include the id, topic, content, and confidence fields.
        If an item is relevant, keep its original confidence score.
        
        Example format:
        [
          {
            "id": 1,
            "topic": "Machine Learning",
            "content": "Machine learning is a subset of AI...",
            "confidence": 0.95
          }
        ]
        
        IMPORTANT: Return valid JSON only, no additional text.
      `;

      const response = await this.analyze(prompt);
      
      // Clean the response to ensure it only contains the JSON part
      const jsonStr = response.trim().replace(/^```json\s*|\s*```$/g, '');
      
      let relevantItems;
      try {
        relevantItems = JSON.parse(jsonStr);
      } catch (e) {
        console.error('Failed to parse LLM response:', e);
        console.log('Raw response:', response);
        // Return original items if parsing fails
        return knowledgeItems;
      }

      if (!Array.isArray(relevantItems)) {
        console.error('Invalid response format from LLM');
        return knowledgeItems;
      }

      // Ensure all required fields are present
      relevantItems = relevantItems.filter(item => 
        item.topic && 
        item.content && 
        typeof item.confidence === 'number'
      );

      return relevantItems.length > 0 ? relevantItems : knowledgeItems;
    } catch (error) {
      console.error('Error finding relevant knowledge:', error);
      // Return original items if there's an error
      return knowledgeItems;
    }
  }

  async synthesizeAnswer(query: string, relevantKnowledge: any[]): Promise<string> {
    try {
      if (!relevantKnowledge || relevantKnowledge.length === 0) {
        return "I don't have enough information to answer that question.";
      }

      const prompt = `
        Based on the following knowledge items:
        ${JSON.stringify(relevantKnowledge.map(item => ({
          topic: item.topic,
          content: item.content
        })))}
        
        Please provide a comprehensive answer to this question: "${query}"
        
        Requirements:
        1. Use ONLY the information provided above
        2. Be specific and detailed in your response
        3. If the information is insufficient, acknowledge the limitations
        4. Format the response in clear, readable text
        5. If multiple knowledge items are relevant, synthesize them coherently
        
        Response should be in natural language, not JSON format.
      `;

      const answer = await this.analyze(prompt);
      
      // Clean up the response
      const cleanedAnswer = answer
        .trim()
        .replace(/^```.*\n?/, '') // Remove any markdown code block starts
        .replace(/\n?```$/, '');   // Remove any markdown code block ends

      return cleanedAnswer || "Unable to generate an answer from the available knowledge.";
    } catch (error) {
      console.error('Error synthesizing answer:', error);
      return "An error occurred while generating the answer. Please try again.";
    }
  }
}