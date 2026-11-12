import React, { useEffect, useState } from 'react';
import { BellRing, Keyboard, X } from 'lucide-react';
import {
  disableSuggestions,
  enableSuggestions,
  getSuggestionSettings,
  hasSuggestionPermission,
  updateSuggestionSettings,
  type SuggestionSettings,
} from '@/services/suggestions';

const DISMISS_KEY = 'suggestions_card_dismissed';

/** The keyboard shortcut as the user has it set (they can change it in the browser). */
export function useSaveShortcut(): string {
  const [shortcut, setShortcut] = useState('Alt+Shift+S');
  useEffect(() => {
    chrome.commands?.getAll?.().then((cmds) => {
      const c = cmds.find((x) => x.name === 'save-page');
      setShortcut(c?.shortcut || '');
    }).catch(() => undefined);
  }, []);
  return shortcut;
}

interface SuggestionsCardProps {
  /** 'prompt': a dismissible invitation on the Analyze tab. 'settings': the full switch. */
  variant?: 'prompt' | 'settings';
}

const SuggestionsCard: React.FC<SuggestionsCardProps> = ({ variant = 'prompt' }) => {
  const [settings, setSettings] = useState<SuggestionSettings | null>(null);
  const [granted, setGranted] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const shortcut = useSaveShortcut();

  const refresh = async () => {
    const [s, g, d] = await Promise.all([
      getSuggestionSettings(),
      hasSuggestionPermission(),
      chrome.storage.local.get(DISMISS_KEY),
    ]);
    setSettings(s);
    setGranted(g);
    setDismissed(!!d[DISMISS_KEY]);
  };

  useEffect(() => {
    refresh();
  }, []);

  if (!settings) return null;
  const on = settings.enabled && granted;

  // Must run straight from the click: the permission dialog needs the user gesture.
  const turnOn = () => {
    enableSuggestions().then(refresh).catch((e) => console.warn('Enable suggestions failed:', e));
  };
  const turnOff = () => {
    disableSuggestions().then(refresh);
  };
  const dismiss = () => {
    chrome.storage.local.set({ [DISMISS_KEY]: true });
    setDismissed(true);
  };

  if (variant === 'prompt') {
    if (on || dismissed) return null;
    return (
      <div className="relative rounded-xl bg-indigo-50 p-3 text-sm" data-testid="suggestions-card">
        <button onClick={dismiss} className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600" aria-label="Not now">
          <X size={14} />
        </button>
        <p className="flex items-center gap-2 font-medium text-gray-900">
          <BellRing size={16} className="text-indigo-600" />
          Let Mindstack remind you
        </p>
        <p className="mt-1 text-gray-600">
          See what you've already read on a topic while you browse. Matching stays on your device.
        </p>
        <div className="mt-3 flex items-center gap-3">
          <button onClick={turnOn} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700">
            Turn on
          </button>
          <button onClick={dismiss} className="text-gray-500 hover:text-gray-700">Not now</button>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-4 border-t border-gray-200 space-y-2 text-sm" data-testid="suggestions-settings">
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={on}
          onChange={() => (on ? turnOff() : turnOn())}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600"
        />
        <span>
          <span className="font-medium text-gray-800 block">Suggestions while browsing</span>
          <span className="text-gray-500">
            Shows related reading and offers to save articles. Needs access to the pages you visit; matching stays on your device.
          </span>
        </span>
      </label>
      {on && (
        <div className="pl-7 space-y-1.5 text-gray-700">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={settings.related} onChange={(e) => updateSuggestionSettings({ related: e.target.checked }).then(refresh)} />
            Show related reading on pages
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={settings.offerSave} onChange={(e) => updateSuggestionSettings({ offerSave: e.target.checked }).then(refresh)} />
            Offer to save articles after I've read them
          </label>
          {settings.mutedSites.length > 0 && (
            <p className="text-xs text-gray-500">
              Hidden on {settings.mutedSites.length} site{settings.mutedSites.length === 1 ? '' : 's'}.{' '}
              <button className="text-blue-600 hover:underline" onClick={() => updateSuggestionSettings({ mutedSites: [] }).then(refresh)}>
                Show everywhere again
              </button>
            </p>
          )}
        </div>
      )}
      <p className="text-xs text-gray-500 flex items-center gap-1.5">
        <Keyboard size={13} />
        {shortcut ? <>Save any page with <kbd className="px-1 rounded border bg-white">{shortcut}</kbd> or right-click &rarr; Save page to Mindstack.</> : <>Save any page by right-clicking &rarr; Save page to Mindstack. You can set a keyboard shortcut in your browser's extension shortcuts page.</>}
      </p>
    </div>
  );
};

export default SuggestionsCard;
