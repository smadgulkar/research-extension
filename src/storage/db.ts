// src/storage/db.ts
import Dexie, { Table } from 'dexie';
import type { Highlight, Page, Knowledge, Settings, Workspace } from '../types/models';

class ResearchDB extends Dexie {
  highlights!: Table<Highlight>;
  pages!: Table<Page>;
  knowledge!: Table<Knowledge>;
  settings!: Table<Settings>;
  workspaces!: Table<Workspace>;

  constructor() {
    super('ResearchDB');
    
    this.version(3).stores({
      highlights: '++id, url, pageTitle, timestamp, keywords',
      pages: '++id, url, title, timestamp, keywords, importance, lastAccessed, *topics',
      knowledge: '++id, topic, content, sourcePages, *tags, confidence, lastUpdated, workspaceId',
      settings: 'id',
      workspaces: '++id, name, createdAt, lastAccessed'
    });
  }
}

export const db = new ResearchDB();
export type { Highlight, Knowledge, Settings };
// Don't re-export Page to avoid conflicts