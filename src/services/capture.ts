import { db } from '../storage/db';
import type { Page, LLMSettings, SummaryLength } from '../types/models';
import { LLMService } from './llm';
import { ContentAnalyzer } from './contentAnalyzer';
import { KnowledgeService } from './knowledgeService';
import { recordSuccessfulAnalysis } from './usage';

export interface PageToCapture {
  content: string;
  metadata: { title: string; url: string; description?: string };
}

export interface CaptureResult {
  page: Page;
  analysis: Awaited<ReturnType<ContentAnalyzer['analyzeContent']>>;
  /** True when this save reached the rating-prompt threshold. */
  showRatingPrompt: boolean;
}

/** What the background saver reports back to the popup. */
export type CaptureOutcome =
  | { status: 'saved'; pageId: number }
  | { status: 'exists'; pageId: number }
  | { status: 'error'; error: string; missingKey?: boolean };

export class MissingApiKeyError extends Error {
  constructor() {
    super('Add an API key in Mindstack settings first.');
  }
}

/**
 * Analyze a page, save it, and add its knowledge points. Shared by the popup's
 * Analyze button, the keyboard shortcut, the right-click menu and the on-page
 * "Save" offer, so every path saves the same way.
 */
export async function analyzeAndSave(
  current: PageToCapture,
  settings: LLMSettings,
  workspaceId: number | null = null,
  summaryLength: SummaryLength = 'medium'
): Promise<CaptureResult> {
  if (!settings?.apiKey) throw new MissingApiKeyError();
  if (!current.content?.trim()) throw new Error('This page has no readable text to save.');

  const analyzer = new ContentAnalyzer(new LLMService(settings));
  const analysis = await analyzer.analyzeContent(current.content, current.metadata.url, summaryLength);

  const page: Page = {
    url: current.metadata.url,
    title: current.metadata.title,
    content: current.content.substring(0, 1000),
    summary: analysis.summary || '',
    keyPoints: analysis.keyPoints || [],
    topics: analysis.topics || [],
    sentiment: analysis.sentiment || '',
    keywords: analysis.topics || [],
    readingTime: analysis.readingTime,
    timestamp: new Date(),
  };
  const pageId = (await db.pages.add(page)) as number;
  page.id = pageId;

  await new KnowledgeService(settings).processPage(page, workspaceId);
  const showRatingPrompt = await recordSuccessfulAnalysis();
  return { page, analysis, showRatingPrompt };
}
