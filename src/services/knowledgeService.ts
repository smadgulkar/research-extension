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

  async processPage(page: Page, workspaceId: number | null = null): Promise<void> {
    try {
      // Extract knowledge from the page
      const prompt = `
        Based on the following content, extract 3-5 key knowledge points:
        Title: ${page.title}
        Content: ${page.content?.substring(0, 5000) || ''}... // Limit content length
        Summary: ${page.summary || ''}
        
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
        
        IMPORTANT: Make sure to provide a valid JSON array with all closing brackets.
      `;
      
      // Extract knowledge points
      let knowledge = await this.llm.extractKnowledge(prompt);
      
      // Validate the knowledge structure
      if (!Array.isArray(knowledge)) {
        console.error('Invalid knowledge format, expected array but got:', typeof knowledge);
        console.log('Knowledge content:', knowledge);
        knowledge = [];
      }
      
      // If knowledge extraction failed, try a simpler approach
      if (knowledge.length === 0) {
        console.log('Knowledge extraction failed, creating a default knowledge item');
        
        // Create a single knowledge item based on the page title and summary
        knowledge = [{
          topic: page.title,
          content: page.summary || 'No summary available',
          confidence: 0.7
        }];
      }
      
      console.log('Extracted knowledge:', knowledge);
      
      // If no workspace is specified, use the default workspace
      let targetWorkspaceId = workspaceId;
      
      if (targetWorkspaceId === null) {
        // Get or create default workspace
        let defaultWorkspace = await db.workspaces.where('name').equals('Default').first();
        
        if (!defaultWorkspace) {
          const defaultId = await db.workspaces.add({
            name: 'Default',
            description: 'Default workspace',
            color: '#4299E1',
            createdAt: new Date(),
            lastAccessed: new Date()
          });
          defaultWorkspace = await db.workspaces.get(defaultId as number);
          targetWorkspaceId = defaultWorkspace?.id || null;
        } else {
          targetWorkspaceId = defaultWorkspace.id!;
        }
      }
      
      // Store knowledge points with workspace ID
      for (const point of knowledge) {
        await db.knowledge.add({
          topic: point.topic,
          content: point.content,
          sourcePages: [page.id!],
          lastUpdated: new Date(),
          confidence: point.confidence,
          tags: page.topics || [],
          workspaceId: targetWorkspaceId!
        });
      }
      
      console.log('Knowledge stored successfully in workspace:', targetWorkspaceId);
    } catch (error) {
      console.error('Error processing page for knowledge:', error);
      throw error;
    }
  }

  async queryKnowledge(query: string, knowledgeItems: Knowledge[]): Promise<any> {
    try {
      if (!knowledgeItems || knowledgeItems.length === 0) {
        return {
          relevantKnowledge: [],
          synthesizedAnswer: "No knowledge items found in the database. Try analyzing some pages first."
        };
      }

      // Find relevant knowledge points
      const relevantKnowledge = await this.llm.findRelevantKnowledge(query, knowledgeItems);

      if (!relevantKnowledge || relevantKnowledge.length === 0) {
        return {
          relevantKnowledge: [],
          synthesizedAnswer: "No relevant information found for your query."
        };
      }

      // Synthesize an answer
      const synthesizedAnswer = await this.llm.synthesizeAnswer(query, relevantKnowledge);

      return {
        relevantKnowledge,
        synthesizedAnswer: synthesizedAnswer || "Unable to generate an answer from the available knowledge."
      };
    } catch (error) {
      console.error('Error querying knowledge:', error);
      throw new Error(`Failed to query knowledge: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
} 