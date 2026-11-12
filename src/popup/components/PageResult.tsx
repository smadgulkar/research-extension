import React, { useEffect, useState } from 'react';
import { Check, CheckCircle2, Copy, Download, FileText, Trash2 } from 'lucide-react';
import { exportService, openInObsidian } from '@/services/exportService';
import { notionService } from '@/services/notionService';
import type { Page, Workspace } from '@/types/models';
import { hostOf } from './ui';

interface PageResultProps {
  page: Page;
  /** Saved during this popup visit (as opposed to earlier). */
  justSaved: boolean;
  workspaces: Workspace[];
  workspaceId: number | null;
  onMoveToWorkspace: (id: number) => void;
  onRemove: () => void;
}

/** A saved page's summary, shown inline in the popup with a few quiet actions. */
const PageResult: React.FC<PageResultProps> = ({ page, justSaved, workspaces, workspaceId, onMoveToWorkspace, onRemove }) => {
  const [copied, setCopied] = useState(false);
  const [notionConnected, setNotionConnected] = useState(false);
  const [notionBusy, setNotionBusy] = useState(false);

  useEffect(() => {
    notionService.isConnected().then(setNotionConnected).catch(() => setNotionConnected(false));
  }, []);

  const data = {
    title: page.title,
    url: page.url,
    summary: page.summary,
    keyPoints: page.keyPoints || [],
    topics: page.topics || [],
    sentiment: page.sentiment,
    timestamp: new Date(page.timestamp),
  };

  const copy = async () => {
    await navigator.clipboard.writeText(await exportService.exportAnalysis(data, 'markdown'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const download = async () => {
    const content = await exportService.exportAnalysis(data, 'markdown');
    exportService.downloadFile(content, `${page.title.slice(0, 50).replace(/[^a-z0-9]/gi, '-')}.md`, 'text/markdown');
  };
  const toNotion = async () => {
    setNotionBusy(true);
    try {
      const result = await notionService.exportToNotion(data);
      window.open(result.url, '_blank');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Notion export failed');
    } finally {
      setNotionBusy(false);
    }
  };

  const pill =
    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-60';

  return (
    <section data-testid="page-result" className="ms-card ms-in p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-1 text-xs font-medium">
          <CheckCircle2 size={13} />
          {justSaved ? 'Saved to your Mindstack' : `Saved ${new Date(page.timestamp).toLocaleDateString()}`}
        </span>
        <button
          onClick={onRemove}
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          title="Remove from your Mindstack"
        >
          <Trash2 size={12} /> Remove
        </button>
      </div>

      <div>
        <h2 className="text-[15px] font-semibold text-slate-900 leading-snug">{page.title}</h2>
        <a href={page.url} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-400 hover:text-blue-600">
          {hostOf(page.url)}
        </a>
      </div>

      {page.summary && <p className="text-sm text-slate-700 leading-relaxed">{page.summary}</p>}

      {page.keyPoints?.length > 0 && (
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="ms-label mb-2">Key points</p>
          <ul className="space-y-2" data-testid="key-points">
            {page.keyPoints.map((point, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-slate-700 leading-snug">
                <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {page.topics?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {page.topics.map((t, i) => (
            <span key={i} className="px-2.5 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <button onClick={copy} className={pill}>
          {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button onClick={download} className={pill}>
          <Download size={13} /> Markdown
        </button>
        <button onClick={() => openInObsidian(data)} className={pill}>
          <FileText size={13} /> Obsidian
        </button>
        {notionConnected && (
          <button onClick={toNotion} disabled={notionBusy} className={pill}>
            <span className="font-bold">N</span> {notionBusy ? 'Sending…' : 'Notion'}
          </button>
        )}
        {workspaces.length > 1 && (
          <select
            aria-label="Workspace"
            value={workspaceId ?? ''}
            onChange={(e) => onMoveToWorkspace(Number(e.target.value))}
            className="ml-auto text-xs text-slate-600 bg-slate-100 rounded-full px-2.5 py-1.5 border-0 focus:ring-2 focus:ring-blue-500"
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        )}
      </div>
    </section>
  );
};

export default PageResult;
