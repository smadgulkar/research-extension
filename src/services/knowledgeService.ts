import { db } from '../storage/db';
import { LLMService } from './llm';
import type { Knowledge } from '../storage/db';
import type { Page, LLMSettings } from '../types/models';

export class KnowledgeService {
  private llm: LLMService;
  private settings: LLMSettings;

  constructor(settings: LLMSettings) {
    this.llm = new LLMService(settings);
    this.settings = settings;
  }

  async processPage(page: Page): Promise<void> {
    try {
      // Extract knowledge from the page
      const prompt = `
        Based on the following content, extract 3-5 key knowledge points:
        Title: ${page.title}
        Content: ${page.content.substring(0, 5000)}... // Limit content length
        Summary: ${page.summary}
        
        For each knowledge point:
        1. Identify a specific topic
        2. Write a concise, factual statement (1-2 sentences)
        3. Assign a confidence score (0.0-1.0)
        
        Format as JSON array:
        [
          {
            "topic": "specific topic",
            "content": "concise knowledge statement",
            "confidence": 0.95
          },
          ...
        ]
      `;

      const llm = new LLMService({
        provider: 'openai', // Default to OpenAI for knowledge extraction
        model: 'gpt-3.5-turbo', // Use a cheaper model for this task
        apiKey: this.settings.apiKey
      });

      const knowledge = await llm.extractKnowledge(prompt);
      console.log('Extracted knowledge:', knowledge);
      
      // Store knowledge points
      for (const point of knowledge) {
        await db.knowledge.add({
          topic: point.topic,
          content: point.content,
          sourcePages: [page.id!],
          lastUpdated: new Date(),
          confidence: point.confidence,
          tags: page.topics || []
        });
      }
      
      console.log('Knowledge stored successfully');
    } catch (error) {
      console.error('Error processing page for knowledge:', error);
    }
  }

  async queryKnowledge(query: string): Promise<{
    relevantKnowledge: Knowledge[];
    synthesizedAnswer: string;
  }> {
    // Find relevant knowledge points
    const allKnowledge = await db.knowledge.toArray();
    const relevantKnowledge = await this.llm.findRelevantKnowledge(query, allKnowledge);

    // Synthesize an answer
    const synthesizedAnswer = await this.llm.synthesizeAnswer(query, relevantKnowledge);

    return {
      relevantKnowledge,
      synthesizedAnswer
    };
  }
} 