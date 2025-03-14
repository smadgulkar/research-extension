import { LLMService } from './llm';
import { debugLog } from './debugService';

export class ContentAnalyzer {
  private llm: LLMService;

  constructor(settings: any) {
    this.llm = new LLMService(settings);
  }

  calculateReadingTime(content: string): number {
    const wordsPerMinute = 200;
    const words = content.trim().split(/\s+/).length;
    return Math.ceil(words / wordsPerMinute);
  }

  async analyzeContent(content: string, title: string) {
    const readingTime = this.calculateReadingTime(content);
    
    const prompt = `
      Analyze this content titled "${title}":
      ${content}

      Provide:
      1. A 2-3 sentence quick summary
      2. 5-7 relevant keywords
      3. Main topics (3-5)
      4. Content type (article/documentation/research/other)
      5. Importance rating (1-5) based on content depth and uniqueness
      
      Format as JSON:
      {
        "quickSummary": "...",
        "keywords": ["..."],
        "topics": ["..."],
        "contentType": "...",
        "importance": n
      }
    `;

    try {
      const analysis = await this.llm.analyze(prompt, title);
      return {
        ...analysis,
        readingTime
      };
    } catch (error) {
      debugLog('Content analysis error:', error);
      throw error;
    }
  }
} 