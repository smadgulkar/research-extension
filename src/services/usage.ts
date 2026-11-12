// Local counters for the rating prompt. No React here, so the background script can use it.
export const RATING_THRESHOLD = 5;
export const ANALYSIS_COUNT_KEY = 'successful_analysis_count';
export const RATING_PROMPT_KEY = 'rating_prompt_done';

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
