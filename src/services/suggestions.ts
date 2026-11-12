/**
 * Opt-in browsing suggestions: related-reading chip, toolbar badge and the
 * "save this?" offer. They need access to the pages the user visits, which is an
 * optional permission requested only when the user turns them on, so existing
 * installs aren't disabled by a new permission warning on update.
 */
export const SUGGESTION_ORIGINS = ['http://*/*', 'https://*/*'];
const KEY = 'suggestions';

export interface SuggestionSettings {
  enabled: boolean;
  related: boolean;
  offerSave: boolean;
  mutedSites: string[];
}

const DEFAULTS: SuggestionSettings = { enabled: false, related: true, offerSave: true, mutedSites: [] };

export async function getSuggestionSettings(): Promise<SuggestionSettings> {
  const stored = await chrome.storage.local.get(KEY);
  return { ...DEFAULTS, ...(stored[KEY] || {}) };
}

export async function updateSuggestionSettings(patch: Partial<SuggestionSettings>): Promise<SuggestionSettings> {
  const next = { ...(await getSuggestionSettings()), ...patch };
  await chrome.storage.local.set({ [KEY]: next });
  return next;
}

export async function hasSuggestionPermission(): Promise<boolean> {
  try {
    return await chrome.permissions.contains({ origins: SUGGESTION_ORIGINS });
  } catch {
    return false;
  }
}

/**
 * Turn suggestions on. Must be called directly from a click handler: browsers
 * only show the permission dialog during a user gesture, and Firefox rejects
 * the request if anything is awaited first.
 */
export function enableSuggestions(): Promise<boolean> {
  const request = chrome.permissions.request({ origins: SUGGESTION_ORIGINS });
  return request.then(async (granted) => {
    await updateSuggestionSettings({ enabled: granted });
    return granted;
  });
}

export async function disableSuggestions(): Promise<void> {
  await updateSuggestionSettings({ enabled: false });
  try {
    await chrome.permissions.remove({ origins: SUGGESTION_ORIGINS });
  } catch {
    // Some browsers refuse to remove origins that are also granted elsewhere.
  }
}

export function isMuted(settings: SuggestionSettings, hostname: string): boolean {
  return settings.mutedSites.some((h) => hostname === h || hostname.endsWith('.' + h));
}
