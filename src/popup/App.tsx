import React, { useState, useEffect, useRef } from 'react';
import { db } from '@/storage/db';
import { Settings, History, X, BookOpen, Cog, LucideIcon, Folder, Crown, Key, FileText, MessageCircleQuestion } from 'lucide-react';
import type { Settings as SettingsType } from '@/storage/db';
import type { Page, SummaryLength } from '@/types/models';
import SearchBar from './components/SearchBar';
import KnowledgeExplorer, { KnowledgeExplorerRef } from './components/KnowledgeExplorer';
import { ModelService } from '@/services/modelService';
import FeedbackButton from '../components/FeedbackButton';
import PremiumSettings from './components/PremiumSettings';
import RatingPrompt, { shouldShowRatingPrompt } from './components/RatingPrompt';
import NotionSettings from './components/NotionSettings';
import Onboarding from './components/Onboarding';
import FreeKeyHint from './components/FreeKeyHint';
import SuggestionsCard from './components/SuggestionsCard';
import ThisPage from './components/ThisPage';
import { extractPage, type ExtractedPage } from '@/inpage/extract';
import { GEMINI_DEFAULT_MODEL } from '@/services/geminiModels';
import { DEFAULT_PREFS, getPrefs, updatePrefs, type Prefs } from '@/services/prefs';
import { premiumService, PAID_TIER_ENABLED } from '../services/premiumService';

const ONBOARDING_KEY = 'research_assistant_onboarding_complete';

type Tab = 'page' | 'library' | 'ask';

const DEFAULT_SETTINGS: SettingsType = {
  id: 'llm',
  // Gemini is the default for new installs because Google offers a free tier.
  provider: 'gemini',
  apiKey: '',
  model: GEMINI_DEFAULT_MODEL
};

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'page', label: 'This page', icon: FileText },
  { id: 'library', label: 'Library', icon: History },
  { id: 'ask', label: 'Ask', icon: MessageCircleQuestion },
];

const App: React.FC = () => {
  const [settings, setSettings] = useState<SettingsType>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  // The key as saved (not as being typed in Settings).
  const [savedKey, setSavedKey] = useState('');
  const [currentPage, setCurrentPage] = useState<ExtractedPage | null>(null);
  const [tabId, setTabId] = useState<number | null>(null);
  const [pageLoaded, setPageLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('page');
  const [savedPages, setSavedPages] = useState<Page[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [availableModels, setAvailableModels] = useState<{id: string, name?: string}[]>([]);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const knowledgeExplorerRef = useRef<KnowledgeExplorerRef>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [showRatingPrompt, setShowRatingPrompt] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'api' | 'premium' | 'integrations'>('api');
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        const onboardingResult = await chrome.storage.local.get(ONBOARDING_KEY);
        if (!onboardingResult[ONBOARDING_KEY]) setShowOnboarding(true);
        await initializeDefaultWorkspace();
        setIsPremium(await premiumService.isPremium());
        setShowRatingPrompt(await shouldShowRatingPrompt());
        await Promise.all([loadCurrentPage(), loadSettings(), loadSavedPages(), getPrefs().then(setPrefs)]);
      } catch (error) {
        console.error('Error during app initialization:', error);
      }
    };
    initializeApp();
  }, []);

  const loadCurrentPage = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !tab.url || !/^(https?|file):/i.test(tab.url)) return;
      const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractPage });
      if (results?.[0]?.result) {
        setTabId(tab.id);
        setCurrentPage(results[0].result as ExtractedPage);
      }
    } catch (error) {
      console.warn('Mindstack cannot read this tab:', error);
      setCurrentPage(null);
    } finally {
      setPageLoaded(true);
    }
  };

  const loadSettings = async () => {
    try {
      const stored = await db.settings.get('llm');
      if (stored) {
        setSettings(stored);
        setSavedKey(stored.apiKey || '');
      }
    } finally {
      setSettingsLoaded(true);
    }
  };

  const loadSavedPages = async () => {
    setSavedPages(await db.pages.orderBy('timestamp').reverse().toArray());
  };

  const libraryChanged = async () => {
    await loadSavedPages();
    knowledgeExplorerRef.current?.reloadKnowledgeBase();
    setShowRatingPrompt(await shouldShowRatingPrompt());
  };

  const changePrefs = async (patch: Partial<Prefs>) => setPrefs(await updatePrefs(patch));

  // Fetch models when provider or API key changes
  const fetchAvailableModels = async () => {
    if (!settings.apiKey) return;
    
    try {
      const modelService = new ModelService(settings);
      const models = await modelService.getAvailableModels();
      setAvailableModels(models);
    } catch (error) {
      console.error('Error fetching models:', error);
    }
  };

  // Update the provider change handler
  const handleProviderChange = async (provider: string) => {
    // Update provider in settings
    const updatedSettings = { ...settings, provider, model: '' };
    setSettings(updatedSettings);
    
    // Load available models for the selected provider
    if (updatedSettings.apiKey) {
      try {
        const modelService = new ModelService(updatedSettings);
        const models = await modelService.getAvailableModels();
        setAvailableModels(models);
        
        // Set a default model if available
        if (models.length > 0) {
          setSettings({ ...updatedSettings, model: models[0].id });
        }
      } catch (error) {
        console.error('Error loading models:', error);
        setAvailableModels([]);
      }
    }
  };

  // Add this effect to load models when API key changes
  useEffect(() => {
    const loadModels = async () => {
      if (settings.apiKey) {
        try {
          const modelService = new ModelService(settings);
          const models = await modelService.getAvailableModels();
          setAvailableModels(models);
          
          // If current model is not in the list, select the first one
          if (models.length > 0 && !models.some(m => m.id === settings.model)) {
            setSettings({ ...settings, model: models[0].id });
          }
        } catch (error) {
          console.error('Error loading models:', error);
        }
      }
    };
    
    loadModels();
  }, [settings.apiKey, settings.provider]);

  const initializeDefaultWorkspace = async () => {
    try {
      const existing = await db.workspaces.where('name').equals('Default').first();
      if (!existing) {
        await db.workspaces.add({
          name: 'Default',
          description: 'Default workspace',
          color: '#4299E1',
          createdAt: new Date(),
          lastAccessed: new Date()
        });
      }
    } catch (error) {
      console.error('Error initializing default workspace:', error);
    }
  };

  const handleOnboardingComplete = async () => {
    await chrome.storage.local.set({ [ONBOARDING_KEY]: true });
    setShowOnboarding(false);
  };

  if (showOnboarding) {
    return (
      <Onboarding
        onComplete={handleOnboardingComplete}
        onOpenSettings={() => setShowSettings(true)}
      />
    );
  }

  return (
    <div className="relative h-full">
      <div className="w-full h-full bg-white overflow-auto">
        <div className="w-full h-full flex flex-col">
          <header className="px-4 pt-3 pb-2 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <BookOpen className="text-blue-600" size={18} />
              <h1 className="text-base font-semibold text-gray-800">Mindstack</h1>
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Settings"
            >
              <Settings size={17} className="text-gray-500" />
            </button>
          </header>

          <nav className="px-4 flex gap-4 border-b border-gray-100" role="tablist">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                role="tab"
                aria-selected={activeTab === id}
                onClick={() => setActiveTab(id)}
                className={`py-2 -mb-px text-sm font-medium flex items-center gap-1.5 border-b-2 transition-colors ${
                  activeTab === id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </nav>

          <main className="px-4 py-4 flex-grow overflow-auto">
            {activeTab === 'page' && (
              <ThisPage
                currentPage={currentPage}
                tabId={tabId}
                pageLoaded={pageLoaded}
                hasApiKey={!!savedKey}
                settingsLoaded={settingsLoaded}
                savedCount={savedPages.length}
                onOpenSettings={() => { setSettingsTab('api'); setShowSettings(true); }}
                onLibraryChanged={libraryChanged}
              />
            )}

            {activeTab === 'library' && (
              <div className="space-y-3">
                <SearchBar onResultsChange={setSavedPages} />
                {savedPages.length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {savedPages.map((page) => (
                      <article
                        key={page.id}
                        className="py-3 cursor-pointer group"
                        onClick={() => window.open(page.url, '_blank')}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-medium text-gray-900 line-clamp-1 group-hover:text-blue-700">{page.title}</h3>
                          <time className="text-xs text-gray-400 whitespace-nowrap">
                            {new Date(page.timestamp).toLocaleDateString()}
                          </time>
                        </div>
                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">{page.summary}</p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="text-center py-8 text-sm text-gray-500">Nothing saved yet. Pages you save appear here.</p>
                )}
              </div>
            )}

            {activeTab === 'ask' && (
              <KnowledgeExplorer
                ref={knowledgeExplorerRef}
                settings={settings}
                onGoToPage={() => setActiveTab('page')}
              />
            )}
          </main>

          {showRatingPrompt && <RatingPrompt onDone={() => setShowRatingPrompt(false)} />}

          <footer className="px-4 py-2 border-t border-gray-100 flex justify-center items-center">
            <FeedbackButton />
          </footer>
        </div>

        {/* Settings Modal with improved design */}
        {showSettings && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl w-[420px] max-w-full max-h-[95vh] overflow-y-auto">
              <div className="px-5 py-4 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-lg font-medium text-gray-800 flex items-center">
                  <Cog size={18} className="mr-2 text-blue-600" />
                  Settings
                </h2>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Settings Tabs */}
              <div className="flex border-b border-gray-200">
                <button
                  onClick={() => setSettingsTab('api')}
                  className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 ${
                    settingsTab === 'api'
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Key size={16} />
                  General
                </button>
                {PAID_TIER_ENABLED && (
                <button
                  onClick={() => setSettingsTab('premium')}
                  className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 ${
                    settingsTab === 'premium'
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Crown size={16} className={isPremium ? 'text-amber-500' : ''} />
                  Premium
                  {isPremium && (
                    <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                      Active
                    </span>
                  )}
                </button>
                )}
                <button
                  onClick={() => setSettingsTab('integrations')}
                  className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 ${
                    settingsTab === 'integrations'
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Folder size={16} />
                  Integrations
                </button>
              </div>

              {settingsTab === 'api' ? (
                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Provider
                    </label>
                    <select
                      value={settings.provider}
                      onChange={(e) => handleProviderChange(e.target.value)}
                      className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic</option>
                      <option value="gemini">Google Gemini</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      API Key
                    </label>
                    <input
                      type="password"
                      value={settings.apiKey}
                      onChange={(e) => setSettings({...settings, apiKey: e.target.value})}
                      className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder={`Enter your ${settings.provider} API key`}
                    />
                  </div>

                  {!settings.apiKey && (
                    <FreeKeyHint
                      provider={settings.provider}
                      onUseGemini={() => handleProviderChange('gemini')}
                    />
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Model
                    </label>
                    <select
                      value={settings.model}
                      onChange={(e) => setSettings({...settings, model: e.target.value})}
                      className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {availableModels.length === 0 ? (
                        <option value="" disabled>
                          {settings.apiKey ? 'Loading models...' : 'Enter API key first'}
                        </option>
                      ) : (
                        availableModels.map(model => (
                          <option key={model.id} value={model.id}>
                            {model.name || model.id}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <button
                    onClick={async () => {
                      await db.settings.put(settings);
                      setSavedKey(settings.apiKey || '');
                      setShowSettings(false);
                    }}
                    className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg
                      hover:bg-blue-700 transition-colors font-medium mt-4 shadow-sm"
                  >
                    Save Settings
                  </button>

                  <div className="pt-4 border-t border-gray-200 space-y-3 text-sm" data-testid="summary-prefs">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={prefs.autoSave}
                        onChange={(e) => changePrefs({ autoSave: e.target.checked })}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600"
                      />
                      <span>
                        <span className="font-medium text-gray-800 block">Summarize articles when I open Mindstack</span>
                        <span className="text-gray-500">Saves the article you're on automatically. You can remove it with one click.</span>
                      </span>
                    </label>
                    <label className="flex items-center justify-between gap-3">
                      <span className="font-medium text-gray-800">Summary length</span>
                      <select
                        aria-label="Summary length"
                        value={prefs.summaryLength}
                        onChange={(e) => changePrefs({ summaryLength: e.target.value as SummaryLength })}
                        className="p-1.5 bg-gray-50 border border-gray-300 rounded-lg"
                      >
                        <option value="short">Short</option>
                        <option value="medium">Medium</option>
                        <option value="long">Long</option>
                      </select>
                    </label>
                  </div>

                  <SuggestionsCard variant="settings" />
                </div>
              ) : PAID_TIER_ENABLED && settingsTab === 'premium' ? (
                <PremiumSettings onClose={() => {
                  premiumService.isPremium().then(setIsPremium);
                }} />
              ) : (
                <NotionSettings />
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default App;
