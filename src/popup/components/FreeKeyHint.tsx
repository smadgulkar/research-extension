import React from 'react';
import { ExternalLink, Gift } from 'lucide-react';
import { GEMINI_KEY_URL } from '@/services/geminiModels';

interface FreeKeyHintProps {
  provider: string;
  /** Called when the user wants to switch to Gemini from another provider. */
  onUseGemini?: () => void;
}

/**
 * Points people without an API key to Google's free Gemini tier, with the
 * catches stated up front. Wording checked against Google's terms on 2026-11-10.
 */
const FreeKeyHint: React.FC<FreeKeyHintProps> = ({ provider, onUseGemini }) => {
  if (provider !== 'gemini') {
    return onUseGemini ? (
      <p className="text-xs text-gray-500" data-testid="free-key-switch">
        No API key?{' '}
        <button type="button" onClick={onUseGemini} className="text-blue-600 hover:underline">
          Use Google Gemini, which has a free tier
        </button>
      </p>
    ) : null;
  }

  return (
    <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-gray-700 space-y-1.5" data-testid="free-key-hint">
      <p className="flex items-center gap-1.5 font-medium text-gray-900">
        <Gift size={14} className="text-blue-600" />
        No key? Get a free one from Google
      </p>
      <p>
        Sign in to{' '}
        <a href={GEMINI_KEY_URL} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-0.5">
          Google AI Studio <ExternalLink size={11} />
        </a>
        , click <strong>Create API key</strong> and paste it above. The free tier has daily limits.
      </p>
      <p className="text-gray-500">
        On the free tier Google may use what you send to improve its products, and people at Google may
        review it, so avoid analyzing private pages with a free key. Not available in every country; in the
        UK, EU and Switzerland Google may require a paid key.
      </p>
    </div>
  );
};

export default FreeKeyHint;
