import React from 'react';
import { Star, X } from 'lucide-react';

// Shown once, after the user's Nth successful analysis. Never nags:
// either action (rate or dismiss) hides it for good.
export const RATING_THRESHOLD = 5;
export const ANALYSIS_COUNT_KEY = 'successful_analysis_count';
export const RATING_PROMPT_KEY = 'rating_prompt_done';

// Store review page for whichever store this copy was installed from.
// A store-installed extension's runtime ID is its store ID (Chrome, Edge),
// and AMO accepts the add-on ID in place of a slug.
export function reviewUrl(): string {
  const id = chrome.runtime.id;
  const ua = navigator.userAgent;
  if (ua.includes('Firefox/')) return `https://addons.mozilla.org/firefox/addon/${id}/reviews/`;
  if (ua.includes('Edg/')) return `https://microsoftedge.microsoft.com/addons/detail/${id}`;
  return `https://chromewebstore.google.com/detail/${id}/reviews`;
}

// Call after each successful analysis. Returns true if the prompt should now show.
export async function recordSuccessfulAnalysis(): Promise<boolean> {
  const stored = await chrome.storage.local.get([ANALYSIS_COUNT_KEY, RATING_PROMPT_KEY]);
  const count = (Number(stored[ANALYSIS_COUNT_KEY]) || 0) + 1;
  await chrome.storage.local.set({ [ANALYSIS_COUNT_KEY]: count });
  return !stored[RATING_PROMPT_KEY] && count >= RATING_THRESHOLD;
}

export async function shouldShowRatingPrompt(): Promise<boolean> {
  const stored = await chrome.storage.local.get([ANALYSIS_COUNT_KEY, RATING_PROMPT_KEY]);
  return !stored[RATING_PROMPT_KEY] && (Number(stored[ANALYSIS_COUNT_KEY]) || 0) >= RATING_THRESHOLD;
}

interface RatingPromptProps {
  onDone: () => void;
}

const RatingPrompt: React.FC<RatingPromptProps> = ({ onDone }) => {
  const finish = async (rated: boolean) => {
    await chrome.storage.local.set({ [RATING_PROMPT_KEY]: rated ? 'rated' : 'dismissed' });
    if (rated) chrome.tabs.create({ url: reviewUrl() });
    onDone();
  };

  return (
    <div
      className="mx-5 mb-3 p-3 rounded-lg border border-amber-200 bg-amber-50 flex items-start gap-3"
      role="status"
      data-testid="rating-prompt"
    >
      <Star size={18} className="text-amber-500 mt-0.5 shrink-0" />
      <div className="flex-1">
        <p className="text-sm text-gray-800">Finding Research Assistant useful? A quick rating helps others find it.</p>
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => finish(true)}
            className="px-3 py-1 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded-md"
          >
            Rate it
          </button>
          <button
            onClick={() => finish(false)}
            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
          >
            No thanks
          </button>
        </div>
      </div>
      <button onClick={() => finish(false)} aria-label="Dismiss rating prompt" className="text-gray-400 hover:text-gray-600">
        <X size={14} />
      </button>
    </div>
  );
};

export default RatingPrompt;
