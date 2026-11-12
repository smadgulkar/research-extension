import { db } from '../storage/db';
import type { Knowledge, Page } from '../types/models';
import { rankByQuery, tokenize } from './retrieval';

export interface RelatedPage {
  pageId: number;
  title: string;
  url: string;
  /** The saved note that matched best. */
  snippet: string;
}

export interface RelatedResult {
  /** This exact page is already saved. */
  saved: Page | null;
  related: RelatedPage[];
}

export interface PageSignals {
  url: string;
  title: string;
  description?: string;
  headings?: string[];
}

const MAX_RELATED = 5;

/** Compare URLs without #fragments, tracking parameters or a trailing slash. */
export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = '';
    [...u.searchParams.keys()].forEach((k) => {
      if (/^(utm_|fbclid|gclid|mc_|ref$)/i.test(k)) u.searchParams.delete(k);
    });
    return u.toString().replace(/\/$/, '');
  } catch {
    return raw;
  }
}

/** "How tides work | Ocean Blog" -> "How tides work": drop site names so they don't count as matches. */
export function stripSiteName(title: string): string {
  const parts = title.split(/\s+[|–—·-]\s+/).filter(Boolean);
  if (parts.length < 2) return title;
  return parts.reduce((a, b) => (b.length > a.length ? b : a));
}

/**
 * Find saved reading related to a page, locally and without any AI call.
 * Uses the page's title, description and headings as the query, and needs at
 * least two shared words so a single common word doesn't count as related.
 */
export async function findRelated(signals: PageSignals): Promise<RelatedResult> {
  const [pages, knowledge] = await Promise.all([db.pages.toArray(), db.knowledge.toArray()]);
  const target = normalizeUrl(signals.url);
  const saved = pages.find((p) => normalizeUrl(p.url) === target) || null;
  if (knowledge.length === 0) return { saved, related: [] };

  const pageById = new Map<number, Page>();
  pages.forEach((p) => p.id !== undefined && pageById.set(p.id, p));

  const query = [stripSiteName(signals.title), signals.description || '', ...(signals.headings || [])].join(' ');
  const queryTermCount = new Set(tokenize(query)).size;
  const minMatched = Math.min(2, queryTermCount);
  if (minMatched === 0) return { saved, related: [] };

  const ranked = rankByQuery<Knowledge>(
    query,
    knowledge,
    (k) => [
      [k.topic, 2],
      [k.content, 1],
      [(k.tags || []).join(' '), 1],
      [stripSiteName(pageById.get(k.sourcePages?.[0] ?? -1)?.title || ''), 1],
    ],
    60
  ).filter((r) => r.matched >= minMatched);

  const related: RelatedPage[] = [];
  const seen = new Set<number>();
  for (const { item } of ranked) {
    const pageId = item.sourcePages?.[0];
    if (pageId === undefined || seen.has(pageId)) continue;
    const page = pageById.get(pageId);
    if (!page || (saved && page.id === saved.id) || normalizeUrl(page.url) === target) continue;
    seen.add(pageId);
    related.push({ pageId, title: page.title || page.url, url: page.url, snippet: item.content });
    if (related.length >= MAX_RELATED) break;
  }
  return { saved, related };
}
