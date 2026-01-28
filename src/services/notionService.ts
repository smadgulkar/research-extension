// Notion Integration Service
// Uses Notion's Internal Integration tokens (user creates integration in Notion settings)

import { premiumService } from './premiumService';

const NOTION_API_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';
const NOTION_STORAGE_KEY = 'notion_integration';

interface NotionConfig {
  token: string;
  defaultDatabaseId?: string;
}

interface NotionDatabase {
  id: string;
  title: string;
  icon?: string;
}

interface NotionPage {
  id: string;
  title: string;
  url: string;
}

interface AnalysisData {
  title: string;
  url: string;
  summary: string;
  keyPoints: string[];
  topics: string[];
  sentiment: string;
  timestamp?: Date;
}

class NotionService {
  private config: NotionConfig | null = null;

  async initialize(): Promise<void> {
    await this.loadConfig();
  }

  private async loadConfig(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(NOTION_STORAGE_KEY);
      this.config = result[NOTION_STORAGE_KEY] || null;
    } catch (error) {
      console.error('Failed to load Notion config:', error);
      this.config = null;
    }
  }

  private async saveConfig(): Promise<void> {
    try {
      await chrome.storage.local.set({ [NOTION_STORAGE_KEY]: this.config });
    } catch (error) {
      console.error('Failed to save Notion config:', error);
    }
  }

  async isConnected(): Promise<boolean> {
    if (!this.config) await this.loadConfig();
    return !!this.config?.token;
  }

  async connect(token: string): Promise<boolean> {
    // Verify the token works
    try {
      const response = await fetch(`${NOTION_API_BASE}/users/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Notion-Version': NOTION_VERSION,
        },
      });

      if (!response.ok) {
        throw new Error('Invalid token or unauthorized');
      }

      this.config = { token };
      await this.saveConfig();
      return true;
    } catch (error) {
      console.error('Failed to connect to Notion:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.config = null;
    await chrome.storage.local.remove(NOTION_STORAGE_KEY);
  }

  async getDatabases(): Promise<NotionDatabase[]> {
    if (!this.config?.token) {
      throw new Error('Not connected to Notion');
    }

    try {
      const response = await fetch(`${NOTION_API_BASE}/search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.token}`,
          'Notion-Version': NOTION_VERSION,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filter: { property: 'object', value: 'database' },
          sort: { direction: 'descending', timestamp: 'last_edited_time' },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch databases');
      }

      const data = await response.json();
      return data.results.map((db: any) => ({
        id: db.id,
        title: db.title?.[0]?.plain_text || 'Untitled',
        icon: db.icon?.emoji || db.icon?.external?.url,
      }));
    } catch (error) {
      console.error('Failed to get databases:', error);
      throw error;
    }
  }

  async setDefaultDatabase(databaseId: string): Promise<void> {
    if (!this.config) {
      throw new Error('Not connected to Notion');
    }
    this.config.defaultDatabaseId = databaseId;
    await this.saveConfig();
  }

  async getDefaultDatabase(): Promise<string | undefined> {
    if (!this.config) await this.loadConfig();
    return this.config?.defaultDatabaseId;
  }

  async exportToNotion(data: AnalysisData, databaseId?: string): Promise<NotionPage> {
    // Check premium status
    const isPremium = await premiumService.isPremium();
    if (!isPremium) {
      throw new Error('Notion integration requires premium subscription');
    }

    if (!this.config?.token) {
      throw new Error('Not connected to Notion');
    }

    const targetDb = databaseId || this.config.defaultDatabaseId;
    if (!targetDb) {
      throw new Error('No database selected');
    }

    try {
      // Create page in database
      const response = await fetch(`${NOTION_API_BASE}/pages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.token}`,
          'Notion-Version': NOTION_VERSION,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parent: { database_id: targetDb },
          properties: {
            // Assumes database has a "Name" or "Title" property
            Name: {
              title: [{ text: { content: data.title } }],
            },
            // Optional: URL property
            URL: {
              url: data.url,
            },
            // Optional: Tags property (multi-select)
            Tags: {
              multi_select: data.topics.slice(0, 5).map(topic => ({ name: topic })),
            },
            // Optional: Sentiment property
            Sentiment: {
              select: { name: data.sentiment },
            },
          },
          children: this.buildNotionBlocks(data),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create page');
      }

      const page = await response.json();
      return {
        id: page.id,
        title: data.title,
        url: page.url,
      };
    } catch (error) {
      console.error('Failed to export to Notion:', error);
      throw error;
    }
  }

  private buildNotionBlocks(data: AnalysisData): any[] {
    const blocks: any[] = [];

    // Source link
    blocks.push({
      type: 'callout',
      callout: {
        icon: { emoji: '🔗' },
        rich_text: [{ type: 'text', text: { content: 'Source: ', link: null } }, { type: 'text', text: { content: data.url, link: { url: data.url } } }],
        color: 'blue_background',
      },
    });

    // Summary heading
    blocks.push({
      type: 'heading_2',
      heading_2: {
        rich_text: [{ type: 'text', text: { content: 'Summary' } }],
      },
    });

    // Summary content
    blocks.push({
      type: 'paragraph',
      paragraph: {
        rich_text: [{ type: 'text', text: { content: data.summary } }],
      },
    });

    // Key points
    if (data.keyPoints.length > 0) {
      blocks.push({
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: 'Key Points' } }],
        },
      });

      data.keyPoints.forEach(point => {
        blocks.push({
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [{ type: 'text', text: { content: point } }],
          },
        });
      });
    }

    // Topics
    if (data.topics.length > 0) {
      blocks.push({
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: 'Topics' } }],
        },
      });

      blocks.push({
        type: 'paragraph',
        paragraph: {
          rich_text: data.topics.map((topic, i) => ({
            type: 'text',
            text: { content: i === data.topics.length - 1 ? topic : `${topic}, ` },
            annotations: { code: true },
          })),
        },
      });
    }

    // Divider
    blocks.push({ type: 'divider', divider: {} });

    // Footer
    blocks.push({
      type: 'paragraph',
      paragraph: {
        rich_text: [
          {
            type: 'text',
            text: { content: `Sentiment: ${data.sentiment} • Analyzed with Research Assistant` },
            annotations: { italic: true, color: 'gray' },
          },
        ],
      },
    });

    return blocks;
  }
}

export const notionService = new NotionService();
