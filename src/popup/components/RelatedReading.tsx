import React, { useEffect, useState } from 'react';
import { BookMarked, CheckCircle2 } from 'lucide-react';
import { findRelated, type RelatedResult } from '@/services/related';
import type { ExtractedPage } from '@/inpage/extract';

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
    <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-sm" data-testid="related-reading">
      {showSaved && result.saved && (
        <p className="flex items-center gap-1.5 text-gray-700">
          <CheckCircle2 size={15} className="text-green-600 shrink-0" />
          Saved to your Mindstack on {new Date(result.saved.timestamp).toLocaleDateString()}
        </p>
      )}
      {result.related.length > 0 && (
        <>
          <p className={`flex items-center gap-1.5 font-medium text-gray-900 ${showSaved ? 'mt-2' : ''}`}>
            <BookMarked size={15} className="text-blue-600 shrink-0" />
            Related from your reading
          </p>
          <ul className="mt-1.5 space-y-1.5">
            {result.related.map((r) => (
              <li key={r.pageId} className="min-w-0">
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline font-medium block truncate" title={r.url}>
                  {r.title}
                </a>
                <p className="text-xs text-gray-600 line-clamp-2">{r.snippet}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

export default RelatedReading;
