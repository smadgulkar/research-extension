import React, { useState, useEffect } from 'react';
import { Check, AlertCircle, ExternalLink, Database, Unlink, RefreshCw } from 'lucide-react';
import { notionService } from '../../services/notionService';
import { premiumService } from '../../services/premiumService';

interface NotionDatabase {
  id: string;
  title: string;
  icon?: string;
}

interface NotionSettingsProps {
  onClose?: () => void;
}

const NotionSettings: React.FC<NotionSettingsProps> = ({ onClose }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [token, setToken] = useState('');
  const [databases, setDatabases] = useState<NotionDatabase[]>([]);
  const [selectedDb, setSelectedDb] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadState();
  }, []);

  const loadState = async () => {
    const premium = await premiumService.isPremium();
    setIsPremium(premium);

    const connected = await notionService.isConnected();
    setIsConnected(connected);

    if (connected) {
      await loadDatabases();
      const defaultDb = await notionService.getDefaultDatabase();
      if (defaultDb) setSelectedDb(defaultDb);
    }
  };

  const loadDatabases = async () => {
    try {
      const dbs = await notionService.getDatabases();
      setDatabases(dbs);
    } catch (err) {
      console.error('Failed to load databases:', err);
    }
  };

  const handleConnect = async () => {
    if (!token.trim()) {
      setError('Please enter your Notion integration token');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await notionService.connect(token.trim());
      setIsConnected(true);
      setSuccess('Connected to Notion successfully!');
      await loadDatabases();
      setToken('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    await notionService.disconnect();
    setIsConnected(false);
    setDatabases([]);
    setSelectedDb('');
    setSuccess('');
  };

  const handleSelectDatabase = async (dbId: string) => {
    setSelectedDb(dbId);
    await notionService.setDefaultDatabase(dbId);
    setSuccess('Default database updated');
    setTimeout(() => setSuccess(''), 2000);
  };

  if (!isPremium) {
    return (
      <div className="p-4">
        <div className="text-center py-6">
          <Database size={48} className="mx-auto mb-3 text-gray-300" />
          <h3 className="font-medium text-gray-700 mb-2">Notion Integration</h3>
          <p className="text-sm text-gray-500 mb-4">
            Export your research directly to Notion databases.
          </p>
          <button
            onClick={() => premiumService.openCheckout()}
            className="px-4 py-2 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white font-medium rounded-lg transition-all"
          >
            Upgrade to Premium
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Database size={18} />
          Notion Integration
        </h3>
        {isConnected && (
          <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">
            Connected
          </span>
        )}
      </div>

      {!isConnected ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Connect your Notion workspace to export research analyses.
          </p>

          <div className="bg-blue-50 p-3 rounded-lg text-sm">
            <p className="font-medium text-blue-800 mb-2">Setup Instructions:</p>
            <ol className="list-decimal list-inside text-blue-700 space-y-1">
              <li>Go to <a href="https://www.notion.so/my-integrations" target="_blank" rel="noopener noreferrer" className="underline">Notion Integrations</a></li>
              <li>Create a new integration</li>
              <li>Copy the Internal Integration Token</li>
              <li>Share your database with the integration</li>
            </ol>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Integration Token
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="secret_xxxxx..."
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <Check size={14} />
              {success}
            </div>
          )}

          <button
            onClick={handleConnect}
            disabled={loading}
            className="w-full py-2 px-4 bg-black hover:bg-gray-800 disabled:bg-gray-300 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? 'Connecting...' : 'Connect to Notion'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Default Database
              </label>
              <button
                onClick={loadDatabases}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <RefreshCw size={12} />
                Refresh
              </button>
            </div>

            {databases.length > 0 ? (
              <select
                value={selectedDb}
                onChange={(e) => handleSelectDatabase(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              >
                <option value="">Select a database...</option>
                {databases.map((db) => (
                  <option key={db.id} value={db.id}>
                    {db.icon ? `${db.icon} ` : ''}{db.title}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-gray-500 p-3 bg-gray-50 rounded-lg">
                No databases found. Make sure you've shared a database with your integration.
              </p>
            )}
          </div>

          {success && (
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <Check size={14} />
              {success}
            </div>
          )}

          <div className="pt-4 border-t">
            <button
              onClick={handleDisconnect}
              className="w-full py-2 px-4 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Unlink size={14} />
              Disconnect from Notion
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotionSettings;
