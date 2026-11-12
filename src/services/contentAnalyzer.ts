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

// Extract a JSON object from an LLM reply that may be fenced or surrounded by text.
export function parseJsonObject(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const candidate = (fenced ? fenced[1] : text).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start === -1 || end <= start) throw new Error('No JSON object found in model response');
    return JSON.parse(candidate.slice(start, end + 1));
  }
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
      
      // Parse the JSON response (models often wrap JSON in ```json fences or add prose)
      try {
        const analysis = parseJsonObject(responseText);
        return {
          summary: analysis.summary || '',
          keyPoints: analysis.keyPoints || [],
          topics: analysis.topics || [],
          sentiment: analysis.sentiment || 'neutral',
          readingTime: this.calculateReadingTime(content)
        };
      } catch (error) {
        // Don't save a page with a placeholder summary; let the caller show the error.
        console.error('Error parsing analysis result:', error, responseText);
        throw new Error("The AI's reply couldn't be read. Please try again.");
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