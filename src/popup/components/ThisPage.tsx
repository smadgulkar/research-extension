import React, { useEffect, useRef, useState } from 'react';
import { KeyRound, Loader, Sparkles, TextSelect } from 'lucide-react';
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
  const primary =
    'w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors';
  const secondary =
    'w-full py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center justify-center gap-2';

  let body: React.ReactNode = null;
  if (phase === 'checking') {
    body = <div className="py-10 flex justify-center text-gray-400"><Loader size={18} className="animate-spin" /></div>;
  } else if (phase === 'saving') {
    body = (
      <div className="space-y-3" data-testid="saving">
        <h2 className="text-base font-semibold text-gray-900 leading-snug line-clamp-2">{title}</h2>
        <p className="flex items-center gap-2 text-sm text-blue-700">
          <Loader size={15} className="animate-spin" /> Summarizing and saving…
        </p>
        <div className="space-y-2 animate-pulse">
          <div className="h-3 bg-gray-100 rounded w-full" />
          <div className="h-3 bg-gray-100 rounded w-11/12" />
          <div className="h-3 bg-gray-100 rounded w-4/6" />
        </div>
        <p className="text-xs text-gray-400">You can close this. Saving carries on in the background.</p>
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
      <div className="py-6 text-center space-y-2">
        <Sparkles size={22} className="mx-auto text-blue-500" />
        <p className="text-sm text-gray-700">Open an article, then click Mindstack to summarize and save it.</p>
        {shortcut && <p className="text-xs text-gray-500">Or press <kbd className="px-1 py-0.5 border rounded bg-gray-50">{shortcut}</kbd> on any page.</p>}
      </div>
    );
  } else if (settingsLoaded && !hasApiKey) {
    body = (
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900 leading-snug line-clamp-2">{title}</h2>
        <div className="rounded-xl bg-blue-50 p-4 space-y-2" data-testid="connect-ai">
          <p className="text-sm font-medium text-gray-900">Connect an AI to start</p>
          <p className="text-sm text-gray-600">
            Mindstack summarizes pages with your own AI key, so your reading stays yours. Google Gemini has a free tier.
          </p>
          <button onClick={onOpenSettings} className={primary}>
            <KeyRound size={15} /> Add a key
          </button>
        </div>
      </div>
    );
  } else {
    body = (
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900 leading-snug line-clamp-2">{title}</h2>
        {removed && <p className="text-xs text-gray-500">Removed from your Mindstack.</p>}
        {phase === 'error' && (
          <p className="text-sm text-red-700 bg-red-50 rounded-lg p-3" data-testid="save-error">{error}</p>
        )}
        {hasSelection && (
          <button onClick={() => save(true)} className={primary}>
            <TextSelect size={15} /> Summarize selection ({selectionWords} words)
          </button>
        )}
        <button onClick={() => save(false)} className={hasSelection ? secondary : primary}>
          <Sparkles size={15} /> {phase === 'error' ? 'Try again' : hasSelection ? 'Whole page instead' : 'Summarize & save'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {body}
      {currentPage && phase !== 'checking' && (
        <RelatedReading page={currentPage} refreshKey={savedCount} hideSaved />
      )}
      {savedCount >= 2 && phase !== 'saving' && phase !== 'checking' && <SuggestionsCard />}
    </div>
  );
};

export default ThisPage;
