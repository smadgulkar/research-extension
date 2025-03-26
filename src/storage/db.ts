// src/storage/db.ts
import Dexie, { Table } from 'dexie';
import type { Page, Knowledge, Settings, Workspace } from '../types/models';

class ResearchDB extends Dexie {
  pages!: Table<Page>;
  knowledge!: Table<Knowledge>;
  settings!: Table<Settings>;
  workspaces!: Table<Workspace>;

  constructor() {
    super('ResearchDB');
    
    this.version(5).stores({
      pages: '++id, url, title, timestamp, keywords, importance, lastAccessed, *topics',
      knowledge: '++id, topic, content, sourcePages, *tags, confidence, lastUpdated, workspaceId',
      settings: 'id',
      workspaces: '++id, name, createdAt, lastAccessed'
    });
  }
}

export const db = new ResearchDB();
export type { Knowledge, Settings };
// Don't re-export Page to avoid conflicts