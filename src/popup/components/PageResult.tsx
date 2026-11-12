import React, { useEffect, useState } from 'react';
import { Check, CheckCircle2, Copy, Download, FileText } from 'lucide-react';
import { exportService, openInObsidian } from '@/services/exportService';
import { notionService } from '@/services/notionService';
import type { Page, Workspace } from '@/types/models';

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

  const action = 'inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-gray-600 hover:bg-gray-100 hover:text-gray-900';

  return (
    <section data-testid="page-result" className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-green-700">
          <CheckCircle2 size={14} />
          {justSaved ? 'Saved to your Mindstack' : `Saved ${new Date(page.timestamp).toLocaleDateString()}`}
        </span>
        <button onClick={onRemove} className="text-gray-400 hover:text-red-600">
          Remove
        </button>
      </div>

      <h2 className="text-base font-semibold text-gray-900 leading-snug">{page.title}</h2>

      {page.summary && <p className="text-sm text-gray-700 leading-relaxed">{page.summary}</p>}

      {page.keyPoints?.length > 0 && (
        <ul className="space-y-1.5" data-testid="key-points">
          {page.keyPoints.map((point, i) => (
            <li key={i} className="flex gap-2 text-sm text-gray-700">
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      )}

      {page.topics?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {page.topics.map((t, i) => (
            <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1 border-t border-gray-100 pt-2 -mx-2">
        <button onClick={copy} className={action}>
          {copied ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button onClick={download} className={action}>
          <Download size={13} /> Markdown
        </button>
        <button onClick={() => openInObsidian(data)} className={action}>
          <FileText size={13} /> Obsidian
        </button>
        {notionConnected && (
          <button onClick={toNotion} disabled={notionBusy} className={action}>
            <span className="font-bold">N</span> {notionBusy ? 'Sending…' : 'Notion'}
          </button>
        )}
        {workspaces.length > 1 && (
          <select
            aria-label="Workspace"
            value={workspaceId ?? ''}
            onChange={(e) => onMoveToWorkspace(Number(e.target.value))}
            className="ml-auto text-xs text-gray-600 bg-transparent border border-gray-200 rounded-md px-1.5 py-1"
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
