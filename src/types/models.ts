export interface PageMetadata {
  title: string;
  url: string;
  description: string;
  timestamp: string;
}


export interface Highlight {
  id?: string;
  text: string;
  url: string;
  pageTitle: string;
  color: string;
  note?: string;
  timestamp: Date;
}

export interface Page {
  id?: number;
  url: string;
  title: string;
  content: string;
  summary: string;
  keyPoints: string[];
  topics: string[];
  keywords: string[];
  sentiment: string;
  actionItems?: string[];
  timestamp: Date;
  lastAccessed?: Date;
  readingTime?: number;
  sourceType?: 'article' | 'documentation' | 'research' | 'other';
  importance?: 1 | 2 | 3 | 4 | 5;
}

export interface Knowledge {
  id?: number;
  topic: string;
  content: string;
  sourcePages: number[];
  lastUpdated: Date;
  confidence: number;
  tags: string[];
  workspaceId: number;
}

export interface Workspace {
  id?: number;
  name: string;
  description: string;
  color: string;
  createdAt: Date;
  lastAccessed?: Date;
}

export interface Settings {
  id: string;
  provider: string;
  apiKey: string;
  model: string;
}

export interface LLMSettings {
  provider: string;
  model: string;
  apiKey: string;
}

export type SummaryLength = 'short' | 'medium' | 'long';