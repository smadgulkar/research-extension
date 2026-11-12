import { db } from './storage/db';
import { extractPage, type ExtractedPage } from './inpage/extract';
import { mindstackAgent, type AgentConfig, type AgentRelated } from './inpage/agent';
import { analyzeAndSave, MissingApiKeyError, type CaptureOutcome } from './services/capture';
import { findRelated, normalizeUrl } from './services/related';
import { getSuggestionSettings, updateSuggestionSettings, isMuted, SUGGESTION_ORIGINS } from './services/suggestions';
import { getPrefs } from './services/prefs';

declare const __E2E__: boolean;
const E2E = typeof __E2E__ !== 'undefined' && __E2E__;

// The "save this?" offer waits until the page has actually been read.
const ENGAGE_MS = E2E ? 1000 : 45000;
const MIN_SCROLL = E2E ? 0 : 0.3;
const SHADOW_MODE: AgentConfig['shadowMode'] = E2E ? 'open' : 'closed';
const MENU_SAVE = 'mindstack-save-page';
const COMMAND_SAVE = 'save-page';
const BADGE_COLOR = '#2196F3';

// ---------- Entry points that work without any extra permission ----------
// A keyboard shortcut or menu click grants temporary access to the current tab (activeTab).

function setupMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: MENU_SAVE, title: 'Save page to Mindstack', contexts: ['page', 'selection'] });
  });
}
chrome.runtime.onInstalled.addListener(setupMenus);
chrome.runtime.onStartup.addListener(setupMenus);

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_SAVE && tab?.id !== undefined) capture(tab.id);
});

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== COMMAND_SAVE) return;
  const id = tab?.id ?? (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id;
  if (id !== undefined) capture(id);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== 'string') return;
  // Extension pages (the popup, even when opened as a tab) say which tab they mean.
  // From the on-page agent, the sender's tab is the page.
  const fromExtensionPage = !!sender.url?.startsWith(chrome.runtime.getURL(''));
  const tabId: number | undefined = fromExtensionPage
    ? typeof message.tabId === 'number' ? message.tabId : undefined
    : sender.tab?.id;
  if (message.type === 'MS_SAVE_PAGE' && tabId !== undefined) {
    // The popup waits for the result; the save carries on even if it closes.
    capture(tabId, { selectionOnly: !!message.selectionOnly }).then(sendResponse);
    return true;
  } else if (message.type === 'MS_MUTE_SITE' && typeof message.host === 'string' && message.host) {
    getSuggestionSettings().then((s) => {
      if (!s.mutedSites.includes(message.host)) updateSuggestionSettings({ mutedSites: [...s.mutedSites, message.host] });
    });
    if (tabId !== undefined) setBadge(tabId, '', 'Mindstack');
  }
});

// ---------- Saving ----------

// One save per tab at a time; a second request (say the shortcut while the popup
// is saving) gets the same result instead of saving twice.
const inFlight = new Map<number, Promise<CaptureOutcome>>();

function capture(tabId: number, options: { selectionOnly?: boolean } = {}): Promise<CaptureOutcome> {
  const running = inFlight.get(tabId);
  if (running) return running;
  const job = doCapture(tabId, options).finally(() => inFlight.delete(tabId));
  inFlight.set(tabId, job);
  return job;
}

async function doCapture(tabId: number, { selectionOnly = false }: { selectionOnly?: boolean }): Promise<CaptureOutcome> {
  try {
    try {
      await injectAgent(tabId, { related: [], offerSave: false }, true);
    } catch {
      // Browser pages (chrome://, the web stores) can't be scripted.
      setBadge(tabId, '!', "Mindstack can't save this kind of page");
      return { status: 'error', error: "Mindstack can't read this kind of page." };
    }
    toast(tabId, 'progress', 'Saving to Mindstack…');

    const page = await extract(tabId);
    const target = normalizeUrl(page.metadata.url);
    const existing = (await db.pages.toArray()).find((p) => normalizeUrl(p.url) === target);
    if (existing && !selectionOnly) {
      toast(tabId, 'success', 'Already in your Mindstack');
      setBadge(tabId, '✓', 'Saved in your Mindstack');
      return { status: 'exists', pageId: existing.id! };
    }

    const selection = page.selection?.trim() || '';
    if (selectionOnly && !selection) throw new Error('Select some text on the page first.');
    const [settings, prefs] = await Promise.all([db.settings.get('llm'), getPrefs()]);
    const { page: saved, analysis } = await analyzeAndSave(
      selectionOnly ? { ...page, content: selection } : page,
      settings as any,
      prefs.workspaceId,
      prefs.summaryLength
    );
    const n = analysis.keyPoints?.length || 0;
    toast(tabId, 'success', `Saved to Mindstack${n ? ` · ${n} key point${n === 1 ? '' : 's'}` : ''}`);
    setBadge(tabId, '✓', 'Saved in your Mindstack');
    return { status: 'saved', pageId: saved.id! };
  } catch (error) {
    const missingKey = error instanceof MissingApiKeyError;
    const message = error instanceof Error ? error.message : 'unknown error';
    toast(
      tabId,
      'error',
      missingKey ? 'Add an API key first: click the Mindstack icon, then Settings. Gemini has a free tier.' : `Couldn't save: ${message}`
    );
    return { status: 'error', error: message, missingKey };
  }
}

// ---------- Opt-in suggestions while browsing ----------

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  // tab.url is only visible here once the user has granted page access.
  if (info.status === 'complete' && tab.url) suggest(tabId, tab.url).catch((e) => console.warn('Mindstack suggestions:', e));
});

chrome.permissions.onAdded.addListener((p) => {
  if (p.origins?.some((o) => SUGGESTION_ORIGINS.includes(o))) updateSuggestionSettings({ enabled: true });
});
chrome.permissions.onRemoved.addListener((p) => {
  if (p.origins?.some((o) => SUGGESTION_ORIGINS.includes(o))) updateSuggestionSettings({ enabled: false });
});

async function suggest(tabId: number, url: string): Promise<void> {
  if (!/^https?:\/\//i.test(url)) return;
  const settings = await getSuggestionSettings();
  if (!settings.enabled || isMuted(settings, new URL(url).hostname)) return;
  if (!(await chrome.permissions.contains({ origins: [new URL(url).origin + '/*'] }))) return;

  const page = await extract(tabId);
  const { saved, related } = await findRelated({
    url: page.metadata.url,
    title: page.metadata.title,
    description: page.metadata.description,
    headings: page.headings,
  });

  if (saved) setBadge(tabId, '✓', 'Saved in your Mindstack');
  else if (related.length) setBadge(tabId, String(related.length), `${related.length} related page${related.length === 1 ? '' : 's'} in your Mindstack`);
  else setBadge(tabId, '', 'Mindstack');

  const llm = await db.settings.get('llm');
  const showRelated = settings.related && !saved && related.length > 0;
  const offerSave = settings.offerSave && !saved && page.isArticle && !!llm?.apiKey;
  if (!showRelated && !offerSave) return;

  const items: AgentRelated[] = showRelated
    ? related.map((r) => ({ title: r.title, url: r.url, snippet: r.snippet.slice(0, 200) }))
    : [];
  await injectAgent(tabId, { related: items, offerSave });
}

// ---------- Helpers ----------

async function extract(tabId: number): Promise<ExtractedPage> {
  const [result] = await chrome.scripting.executeScript({ target: { tabId }, func: extractPage });
  if (!result?.result) throw new Error('Could not read this page.');
  return result.result as ExtractedPage;
}

async function injectAgent(
  tabId: number,
  config: Pick<AgentConfig, 'related' | 'offerSave'>,
  keepExisting = false
): Promise<void> {
  const full: AgentConfig = { ...config, engageMs: ENGAGE_MS, minScroll: MIN_SCROLL, shadowMode: SHADOW_MODE, keepExisting };
  await chrome.scripting.executeScript({ target: { tabId }, func: mindstackAgent, args: [full] });
}

function toast(tabId: number, kind: 'progress' | 'success' | 'error', text: string) {
  chrome.tabs.sendMessage(tabId, { type: 'MS_TOAST', kind, text }).catch(() => undefined);
}

function setBadge(tabId: number, text: string, title: string) {
  chrome.action.setBadgeBackgroundColor({ tabId, color: BADGE_COLOR }).catch(() => undefined);
  chrome.action.setBadgeText({ tabId, text }).catch(() => undefined);
  chrome.action.setTitle({ tabId, title }).catch(() => undefined);
}
