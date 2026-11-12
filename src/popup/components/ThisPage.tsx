import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, KeyRound, Loader, Sparkles, TextSelect } from 'lucide-react';
import { SiteTile, hostOf } from './ui';
import { db } from '@/storage/db';
import { findRelated } from '@/services/related';
import { getPrefs, updatePrefs } from '@/services/prefs';
import type { CaptureOutcome } from '@/services/capture';
import type { ExtractedPage } from '@/inpage/extract';
import type { Page, Workspace } from '@/types/models';
import PageResult from './PageResult';
import RelatedReading from './RelatedReading';
import SuggestionsCard, { useSaveShortcut } from './SuggestionsCard';

interface ThisPageProps {
  currentPage: ExtractedPage | null;
  tabId: number | null;
  /** False until the active tab has been read (or found unreadable). */
  pageLoaded: boolean;
  hasApiKey: boolean;
  /** False until settings have loaded, so we don't flash the "add a key" card. */
  settingsLoaded: boolean;
  savedCount: number;
  onOpenSettings: () => void;
  /** A page was saved or removed: refresh lists and the rating prompt. */
  onLibraryChanged: () => void;
}

type Phase = 'checking' | 'idle' | 'saving' | 'saved' | 'error';

const MIN_SELECTION_WORDS = 20;
const wordCount = (s: string) => (s.trim().match(/\S+/g) || []).length;

/**
 * The popup's main view. Opening Mindstack on an article summarizes and saves it
 * straight away (the background does the work, so closing the popup doesn't
 * stop it). A page saved earlier shows its summary instantly, with no AI call.
 */
const ThisPage: React.FC<ThisPageProps> = ({
  currentPage, tabId, pageLoaded, hasApiKey, settingsLoaded, savedCount, onOpenSettings, onLibraryChanged,
}) => {
  const [phase, setPhase] = useState<Phase>('checking');
  const [page, setPage] = useState<Page | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState('');
  const [removed, setRemoved] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState<number | null>(null);
  const started = useRef(false);
  const shortcut = useSaveShortcut();

  const selectionWords = wordCount(currentPage?.selection || '');
  const hasSelection = selectionWords >= MIN_SELECTION_WORDS;

  useEffect(() => {
    db.workspaces.toArray().then(setWorkspaces).catch(() => undefined);
  }, []);

  // Decide what to show once the page and settings are known. Runs once per popup visit.
  useEffect(() => {
    if (!pageLoaded || !settingsLoaded || started.current) return;
    started.current = true;
    (async () => {
      if (!currentPage) return setPhase('idle');
      const { saved } = await findRelated({ url: currentPage.metadata.url, title: currentPage.metadata.title });
      if (saved) {
        await showSaved(saved, false);
        return;
      }
      const prefs = await getPrefs();
      if (hasApiKey && prefs.autoSave && currentPage.isArticle && !hasSelection) save(false);
      else setPhase('idle');
    })().catch((e) => {
      console.error('Mindstack popup:', e);
      setPhase('idle');
    });
  }, [pageLoaded, settingsLoaded, currentPage, hasApiKey]);

  async function showSaved(saved: Page, fresh: boolean) {
    const note = await db.knowledge.filter((k) => (k.sourcePages || []).includes(saved.id!)).first();
    setWorkspaceId(note?.workspaceId ?? null);
    setPage(saved);
    setJustSaved(fresh);
    setPhase('saved');
  }

  async function save(selectionOnly: boolean) {
    if (tabId === null) return;
    setPhase('saving');
    setError('');
    setRemoved(false);
    try {
      const outcome: CaptureOutcome = await chrome.runtime.sendMessage({ type: 'MS_SAVE_PAGE', tabId, selectionOnly });
      if (!outcome) throw new Error('Mindstack could not start saving. Reload the page and try again.');
      if (outcome.status === 'error') {
        setError(outcome.error);
        setPhase('error');
        if (outcome.missingKey) onOpenSettings();
        return;
      }
      const saved = await db.pages.get(outcome.pageId);
      if (!saved) throw new Error('The page was saved but could not be loaded.');
      await showSaved(saved, outcome.status === 'saved');
      onLibraryChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase('error');
    }
  }

  async function remove() {
    if (!page?.id) return;
    await db.knowledge.filter((k) => (k.sourcePages || []).includes(page.id!)).delete();
    await db.pages.delete(page.id);
    if (tabId !== null) chrome.action.setBadgeText({ tabId, text: '' }).catch(() => undefined);
    setPage(null);
    setRemoved(true);
    setPhase('idle');
    onLibraryChanged();
  }

  async function moveToWorkspace(id: number) {
    if (!page?.id) return;
    await db.knowledge.filter((k) => (k.sourcePages || []).includes(page.id!)).modify({ workspaceId: id });
    await updatePrefs({ workspaceId: id });
    setWorkspaceId(id);
  }

  const title = currentPage?.metadata.title || '';
  const url = currentPage?.metadata.url || '';
  const pageHeader = (
    <div className="flex items-start gap-3">
      <SiteTile url={url} size={32} />
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-slate-900 leading-snug line-clamp-2">{title}</h2>
        <p className="text-xs text-slate-400 truncate">{hostOf(url)}</p>
      </div>
    </div>
  );

  let body: React.ReactNode = null;
  if (phase === 'checking') {
    body = <div className="py-16 flex justify-center text-slate-300"><Loader size={20} className="animate-spin" /></div>;
  } else if (phase === 'saving') {
    body = (
      <div className="ms-card ms-in p-4 space-y-4" data-testid="saving">
        {pageHeader}
        <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75 animate-ping" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-600" />
          </span>
          Summarizing and saving…
        </div>
        <div className="space-y-2.5 animate-pulse">
          <div className="h-2.5 bg-slate-100 rounded-full w-full" />
          <div className="h-2.5 bg-slate-100 rounded-full w-11/12" />
          <div className="h-2.5 bg-slate-100 rounded-full w-9/12" />
          <div className="h-16 bg-slate-50 rounded-xl w-full mt-3" />
        </div>
        <p className="text-xs text-slate-400">You can close this. Saving carries on in the background.</p>
      </div>
    );
  } else if (phase === 'saved' && page) {
    body = (
      <PageResult
        page={page}
        justSaved={justSaved}
        workspaces={workspaces}
        workspaceId={workspaceId}
        onMoveToWorkspace={moveToWorkspace}
        onRemove={remove}
      />
    );
  } else if (!currentPage) {
    body = (
      <div className="ms-card ms-in px-6 py-10 text-center">
        <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
          <Sparkles size={22} className="text-blue-600" />
        </div>
        <p className="text-sm font-medium text-slate-800">Open an article to get started</p>
        <p className="mt-1 text-sm text-slate-500">Then click Mindstack and it is summarized and saved for you.</p>
        {shortcut && (
          <p className="mt-4 text-xs text-slate-400">
            Or press <kbd className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-sans">{shortcut}</kbd> on any page.
          </p>
        )}
      </div>
    );
  } else if (settingsLoaded && !hasApiKey) {
    body = (
      <div className="space-y-3 ms-in">
        <div className="ms-card p-4">{pageHeader}</div>
        <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 p-5 text-white shadow-md shadow-blue-600/20" data-testid="connect-ai">
          <div className="mb-3 h-9 w-9 rounded-xl bg-white/15 flex items-center justify-center">
            <KeyRound size={18} />
          </div>
          <p className="text-base font-semibold">Connect an AI to start</p>
          <p className="mt-1 text-sm text-blue-100 leading-relaxed">
            Mindstack summarizes pages with your own AI key, so your reading stays yours. Google Gemini has a free tier.
          </p>
          <button
            onClick={onOpenSettings}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 transition-colors"
          >
            Add a key <ArrowRight size={15} />
          </button>
        </div>
      </div>
    );
  } else {
    body = (
      <div className="ms-card ms-in p-4 space-y-4">
        {pageHeader}
        {removed && <p className="text-xs text-slate-500">Removed from your Mindstack.</p>}
        {phase === 'error' && (
          <p className="text-sm text-red-700 bg-red-50 rounded-xl p-3" data-testid="save-error">{error}</p>
        )}
        <div className="space-y-2">
          {hasSelection && (
            <button onClick={() => save(true)} className="ms-btn w-full">
              <TextSelect size={15} /> Summarize selection ({selectionWords} words)
            </button>
          )}
          <button onClick={() => save(false)} className={hasSelection ? 'ms-btn-soft w-full' : 'ms-btn w-full'}>
            <Sparkles size={15} /> {phase === 'error' ? 'Try again' : hasSelection ? 'Whole page instead' : 'Summarize & save'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {body}
      {currentPage && phase !== 'checking' && (
        <RelatedReading page={currentPage} refreshKey={savedCount} hideSaved />
      )}
      {savedCount >= 2 && phase !== 'saving' && phase !== 'checking' && <SuggestionsCard />}
    </div>
  );
};

export default ThisPage;
