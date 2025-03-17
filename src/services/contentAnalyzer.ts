import { LLMService } from './llm';
import type { SummaryLength } from '@/types/models';

interface AnalysisResult {
  summary: string;
  keyPoints: string[];
  topics: string[];
  sentiment: string;
  actionItems?: string[];
  readingTime?: number;
}

export class ContentAnalyzer {
  private llm: LLMService;

  constructor(llm: LLMService) {
    this.llm = llm;
  }

  async analyzeContent(content: string, url: string, summaryLength: SummaryLength = 'medium'): Promise<AnalysisResult> {
    try {
      const lengthInstructions = {
        short: "Provide a very concise summary in 2-3 sentences.",
        medium: "Provide a balanced summary in 4-6 sentences.",
        long: "Provide a comprehensive summary in 7-10 sentences."
      };
      
      const prompt = `
        Analyze the following web content:
        URL: ${url}
        Content: ${content.substring(0, 5000)}... 

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

      // Now we only pass the prompt to the analyze method
      const responseText = await this.llm.analyze(prompt);
      
      // Parse the JSON response
      try {
        const analysis = JSON.parse(responseText);
        return {
          summary: analysis.summary || '',
          keyPoints: analysis.keyPoints || [],
          topics: analysis.topics || [],
          sentiment: analysis.sentiment || 'neutral',
          readingTime: this.calculateReadingTime(content)
        };
      } catch (error) {
        console.error('Error parsing analysis result:', error);
        return {
          summary: 'Error analyzing content.',
          keyPoints: [],
          topics: [],
          sentiment: 'neutral',
          readingTime: this.calculateReadingTime(content)
        };
      }
    } catch (error) {
      console.error('Content analysis error:', error);
      throw error;
    }
  }

  private calculateReadingTime(content: string): number {
    const wordsPerMinute = 200;
    const words = content.trim().split(/\s+/).length;
    return Math.ceil(words / wordsPerMinute);
  }
} 