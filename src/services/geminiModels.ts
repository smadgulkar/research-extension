/**
 * Gemini model choices, kept in one place.
 *
 * Checked against Google's docs on 2026-11-10 (aistudio.google.com/docs/pricing,
 * /models and /deprecations):
 * - gemini-3.6-flash and gemini-3.5-flash-lite are stable and free of charge on
 *   the Gemini API free tier.
 * - gemini-2.0-flash and gemini-2.0-flash-lite were shut down on 2026-06-01, and
 *   the 1.5 models are gone. Settings saved by older versions may still name them.
 * - Gemini 4 models are not available on the free tier, so they must never be
 *   picked automatically.
 */
export const GEMINI_DEFAULT_MODEL = 'gemini-3.6-flash';

/** Preferred automatic picks, best first. All are free-tier models. */
export const GEMINI_PREFERRED_MODELS = [
  'gemini-3.6-flash',
  'gemini-3.8-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
];

const RETIRED_GEMINI_MODELS: Record<string, string> = {
  'gemini-2.0-flash': 'gemini-3.6-flash',
  'gemini-2.0-flash-lite': 'gemini-3.1-flash-lite',
  'gemini-1.5-pro': 'gemini-3.6-flash',
  'gemini-1.5-flash': 'gemini-3.6-flash',
  'gemini-1.5-flash-8b': 'gemini-3.1-flash-lite',
};

/** Map an empty or shut-down model ID to a working one. */
export function resolveGeminiModel(model?: string): string {
  if (!model) return GEMINI_DEFAULT_MODEL;
  return RETIRED_GEMINI_MODELS[model] ?? model;
}

/** Filters out models that accept generateContent but aren't text chat models. */
export function isGeminiTextModel(id: string): boolean {
  return !/(tts|image|live|transcribe|translate|robotics|embedding|omni|banana|aqa|vision)/i.test(id);
}

/** Order a fetched model list so the first entry is a sensible free-tier default. */
export function rankGeminiModels<T extends { id: string }>(models: T[]): T[] {
  const rank = (id: string) => {
    const i = GEMINI_PREFERRED_MODELS.indexOf(id);
    if (i >= 0) return i;
    if (/^gemini-4/.test(id)) return 1000; // paid only
    if (/flash/.test(id)) return 100;
    return 500;
  };
  return [...models].sort((a, b) => rank(a.id) - rank(b.id) || b.id.localeCompare(a.id));
}

export const GEMINI_KEY_URL = 'https://aistudio.google.com/app/apikey';
