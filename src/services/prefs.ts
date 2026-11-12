import type { SummaryLength } from '@/types/models';

/** Everyday preferences shared by the popup and the background saver. */
export interface Prefs {
  /** Summarize and save an article as soon as the popup opens on it. */
  autoSave: boolean;
  summaryLength: SummaryLength;
  /** Workspace new pages go into; null means Default. */
  workspaceId: number | null;
}

const KEY = 'prefs';
export const DEFAULT_PREFS: Prefs = { autoSave: true, summaryLength: 'medium', workspaceId: null };

export async function getPrefs(): Promise<Prefs> {
  const stored = (await chrome.storage.local.get(KEY))[KEY] || {};
  return { ...DEFAULT_PREFS, ...stored };
}

export async function updatePrefs(patch: Partial<Prefs>): Promise<Prefs> {
  const next = { ...(await getPrefs()), ...patch };
  await chrome.storage.local.set({ [KEY]: next });
  return next;
}
