import React, { useEffect, useState } from 'react';
import { BookMarked, CheckCircle2 } from 'lucide-react';
import { findRelated, type RelatedResult } from '@/services/related';
import type { ExtractedPage } from '@/inpage/extract';
import { SiteTile } from './ui';

interface RelatedReadingProps {
  page: ExtractedPage;
  /** Changes when pages are saved, so the list refreshes. */
  refreshKey?: unknown;
  /** Don't repeat "Saved on..." when the page's summary is already showing. */
  hideSaved?: boolean;
}

/** "Already saved" and "Related from your reading" for the page the popup was opened on. */
const RelatedReading: React.FC<RelatedReadingProps> = ({ page, refreshKey, hideSaved }) => {
  const [result, setResult] = useState<RelatedResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    findRelated({
      url: page.metadata.url,
      title: page.metadata.title,
      description: page.metadata.description,
      headings: page.headings,
    })
      .then((r) => !cancelled && setResult(r))
      .catch((e) => console.warn('Related reading failed:', e));
    return () => {
      cancelled = true;
    };
  }, [page.metadata.url, refreshKey]);

  const showSaved = !!result?.saved && !hideSaved;
  if (!result || (!showSaved && result.related.length === 0)) return null;

  return (
    <div className="ms-card ms-in p-4 text-sm" data-testid="related-reading">
      {showSaved && result.saved && (
        <p className="flex items-center gap-1.5 text-slate-700">
          <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
          Saved to your Mindstack on {new Date(result.saved.timestamp).toLocaleDateString()}
        </p>
      )}
      {result.related.length > 0 && (
        <>
          <p className={`flex items-center gap-1.5 ms-label ${showSaved ? 'mt-3' : ''}`}>
            <BookMarked size={13} className="text-blue-500 shrink-0" />
            Related from your reading
          </p>
          <ul className="mt-2 -mx-2 space-y-0.5">
            {result.related.map((r) => (
              <li key={r.pageId} className="min-w-0">
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex gap-2.5 rounded-xl px-2 py-2 hover:bg-slate-50 transition-colors"
                  title={r.url}
                >
                  <SiteTile url={r.url} size={26} />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-800">{r.title}</span>
                    <span className="block text-xs text-slate-500 line-clamp-2">{r.snippet}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

export default RelatedReading;
