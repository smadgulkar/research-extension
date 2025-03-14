// src/storage/db.ts
import Dexie, { Table } from 'dexie';
import type { Highlight, Page, Knowledge, Settings } from '../types/models';

class ResearchDB extends Dexie {
  highlights!: Table<Highlight>;
  pages!: Table<Page>;
  knowledge!: Table<Knowledge>;
  settings!: Table<Settings>;

  constructor() {
    super('ResearchDB');
    
    this.version(2).stores({
      highlights: '++id, url, pageTitle, timestamp, keywords',
      pages: '++id, url, title, timestamp, keywords, importance, lastAccessed',
      knowledge: '++id, topic, lastUpdated',
      settings: 'id'
    });
  }
}

export const db = new ResearchDB();
export type { Highlight, Knowledge, Settings };
// Don't re-export Page to avoid conflicts