import React from 'react';
import { Crown, Lock } from 'lucide-react';
import { premiumService } from '../../services/premiumService';

interface PremiumBadgeProps {
  showUpgrade?: boolean;
  size?: 'sm' | 'md';
}

export const PremiumBadge: React.FC<PremiumBadgeProps> = ({ showUpgrade = true, size = 'sm' }) => {
  const iconSize = size === 'sm' ? 12 : 16;
  const textClass = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-full ${textClass} font-medium`}>
      <Crown size={iconSize} />
      PRO
    </span>
  );
};

interface LockedFeatureProps {
  featureName: string;
  children?: React.ReactNode;
  compact?: boolean;
}

export const LockedFeature: React.FC<LockedFeatureProps> = ({ featureName, children, compact = false }) => {
  const handleUpgrade = () => {
    premiumService.openCheckout();
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-gray-400">
        <Lock size={14} />
        <span className="text-sm">{featureName}</span>
        <PremiumBadge size="sm" />
      </div>
    );
  }

  return (
    <div className="relative p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Lock size={18} className="text-gray-400" />
          <div>
            <h4 className="font-medium text-gray-700 flex items-center gap-2">
              {featureName}
              <PremiumBadge size="sm" />
            </h4>
            {children && <p className="text-sm text-gray-500 mt-1">{children}</p>}
          </div>
        </div>
      </div>
      <button
        onClick={handleUpgrade}
        className="mt-3 w-full py-2 px-4 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white text-sm font-medium rounded-lg transition-all"
      >
        Upgrade to Pro
      </button>
    </div>
  );
};

interface UpgradePromptProps {
  feature?: string;
  onClose?: () => void;
}

export const UpgradePrompt: React.FC<UpgradePromptProps> = ({ feature, onClose }) => {
  const handleUpgrade = () => {
    premiumService.openCheckout();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
        <div className="bg-gradient-to-r from-amber-400 to-orange-500 p-6 text-white text-center">
          <Crown size={48} className="mx-auto mb-3" />
          <h2 className="text-2xl font-bold">Upgrade to Pro</h2>
          {feature && (
            <p className="mt-2 opacity-90">{feature} is a Pro feature</p>
          )}
        </div>

        <div className="p-6">
          <h3 className="font-semibold text-gray-800 mb-4">Pro features include:</h3>
          <ul className="space-y-3 text-sm text-gray-600">
            <li className="flex items-center gap-2">
              <span className="text-green-500">&#10003;</span>
              Export to JSON & HTML formats
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">&#10003;</span>
              Notion integration
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">&#10003;</span>
              Obsidian integration
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">&#10003;</span>
              PDF analysis
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">&#10003;</span>
              Citation generator
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">&#10003;</span>
              Highlight-to-analyze
            </li>
          </ul>

          <div className="mt-6 space-y-3">
            <button
              onClick={handleUpgrade}
              className="w-full py-3 px-4 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white font-semibold rounded-lg transition-all"
            >
              Upgrade Now
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="w-full py-2 px-4 text-gray-500 hover:text-gray-700 text-sm transition-colors"
              >
                Maybe later
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PremiumBadge;
