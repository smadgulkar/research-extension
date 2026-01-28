import React, { useState, useEffect } from 'react';
import { Crown, Key, Check, AlertCircle, ExternalLink, X } from 'lucide-react';
import { premiumService } from '../../services/premiumService';
import type { PremiumStatus } from '../../types/models';

interface PremiumSettingsProps {
  onClose?: () => void;
}

const PremiumSettings: React.FC<PremiumSettingsProps> = ({ onClose }) => {
  const [status, setStatus] = useState<PremiumStatus>({ isPremium: false });
  const [licenseKey, setLicenseKey] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    const currentStatus = await premiumService.getStatus();
    setStatus(currentStatus);
    if (currentStatus.licenseKey) {
      setLicenseKey(currentStatus.licenseKey);
    }
    if (currentStatus.email) {
      setEmail(currentStatus.email);
    }
  };

  const handleActivate = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await premiumService.activateLicense(licenseKey, email || undefined);
      setSuccess('License activated successfully!');
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to activate license');
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async () => {
    setError('');
    setSuccess('');
    await premiumService.deactivate();
    setLicenseKey('');
    setEmail('');
    await loadStatus();
  };

  const formatLicenseKey = (value: string) => {
    // Remove non-alphanumeric characters and convert to uppercase
    const cleaned = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    // Add dashes every 4 characters
    const parts = cleaned.match(/.{1,4}/g) || [];
    return parts.slice(0, 4).join('-');
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Crown className="text-amber-500" size={20} />
          Premium Subscription
        </h3>
        {onClose && (
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={18} />
          </button>
        )}
      </div>

      {status.isPremium ? (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-amber-700 font-medium">
              <Check size={18} />
              Premium Active
            </div>
            {status.expiresAt && (
              <p className="text-sm text-amber-600 mt-1">
                Expires: {new Date(status.expiresAt).toLocaleDateString()}
              </p>
            )}
            {status.email && (
              <p className="text-sm text-gray-600 mt-1">
                Email: {status.email}
              </p>
            )}
          </div>

          <div className="text-sm text-gray-600">
            <p className="font-medium mb-2">Your premium features:</p>
            <ul className="space-y-1">
              <li className="flex items-center gap-2">
                <Check size={14} className="text-green-500" /> JSON & HTML exports
              </li>
              <li className="flex items-center gap-2">
                <Check size={14} className="text-green-500" /> Obsidian integration
              </li>
              <li className="flex items-center gap-2">
                <Check size={14} className="text-green-500" /> Notion integration
              </li>
              <li className="flex items-center gap-2">
                <Check size={14} className="text-green-500" /> PDF analysis
              </li>
              <li className="flex items-center gap-2">
                <Check size={14} className="text-green-500" /> Citation generator
              </li>
            </ul>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => premiumService.openCustomerPortal()}
              className="flex-1 py-2 px-4 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
            >
              <ExternalLink size={14} />
              Manage Subscription
            </button>
            <button
              onClick={handleDeactivate}
              className="py-2 px-4 text-red-600 hover:bg-red-50 rounded-lg text-sm"
            >
              Deactivate
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-4">
              Enter your license key to unlock premium features, or purchase a subscription.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  License Key
                </label>
                <div className="relative">
                  <Key size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={licenseKey}
                    onChange={(e) => setLicenseKey(formatLicenseKey(e.target.value))}
                    placeholder="XXXX-XXXX-XXXX-XXXX"
                    className="w-full pl-10 pr-3 py-2 border rounded-lg text-sm font-mono uppercase"
                    maxLength={19}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email (optional)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
            </div>

            {error && (
              <div className="mt-3 flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            {success && (
              <div className="mt-3 flex items-center gap-2 text-green-600 text-sm">
                <Check size={14} />
                {success}
              </div>
            )}

            <button
              onClick={handleActivate}
              disabled={loading || licenseKey.length < 19}
              className="mt-4 w-full py-2 px-4 bg-primary hover:bg-primary-dark disabled:bg-gray-300 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {loading ? 'Activating...' : 'Activate License'}
            </button>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-500 mb-2">Don't have a license?</p>
            <button
              onClick={() => premiumService.openCheckout()}
              className="w-full py-3 px-4 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
            >
              <Crown size={18} />
              Get Premium
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PremiumSettings;
