import React, { useState, useEffect } from 'react';
import { db } from '@/storage/db';
import { LLMService } from '@/services/llm';
import { Settings, History, Loader, X, BookOpen, Cog, Filter, 
         LucideIcon, Tag, Clock, Brain, Book } from 'lucide-react';
import type { Settings as SettingsType, Highlight } from '@/storage/db';
import type { Page, SummaryLength } from '@/types/models';
import SummaryDisplay from './components/SummaryDisplay';
import SearchBar from './components/SearchBar';
import NoteEditor from './components/NoteEditor';
import HighlightControls from './components/HighlightControls';
import KnowledgeExplorer from './components/KnowledgeExplorer';
import { ContentAnalyzer } from '@/services/contentAnalyzer';
import { ModelService } from '@/services/modelService';
import { KnowledgeService } from '@/services/knowledgeService';

interface TabButtonProps {
  id: string;
  icon: LucideIcon;
  label: string;
  activeTab: string;
  onTabChange: (id: string) => void;
}

interface CurrentPage {
  content: string;
  metadata: {
    title: string;
    url: string;
    description: string;
  };
}

interface AnalysisResult {
  summary: string;
  keyPoints: string[];
  topics: string[];
  sentiment: string;
  actionItems?: string[];
}

interface FilterOptions {
  dateRange: 'all' | 'today' | 'week' | 'month';
  topics: string[];
}

const DEFAULT_SETTINGS: SettingsType = {
  id: 'llm',
  provider: 'openai',
  apiKey: '',
  model: 'gpt-4'
};

const TabButton: React.FC<TabButtonProps> = ({ id, icon: Icon, label, activeTab, onTabChange }) => (
  <button
    onClick={() => onTabChange(id)}
    className={`enhanced-tab flex items-center ${activeTab === id ? 'active' : ''}`}
  >
    <Icon size={16} className="mr-2" />
    <span className="mono-text">{label}</span>
  </button>
);

const App: React.FC = () => {
  // State declarations
  const [settings, setSettings] = useState<SettingsType>(DEFAULT_SETTINGS);
  const [currentPage, setCurrentPage] = useState<CurrentPage | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('analyze');
  const [savedPages, setSavedPages] = useState<Page[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    dateRange: 'all',
    topics: []
  });
  const [uniqueTopics, setUniqueTopics] = useState<string[]>([]);
  const [contentAnalysis, setContentAnalysis] = useState(null);
  const [readingTime, setReadingTime] = useState<number | null>(null);
  const [availableModels, setAvailableModels] = useState<{id: string, name?: string}[]>([]);
  const [summaryLength, setSummaryLength] = useState<SummaryLength>('medium');
  const [selectedTextOnly, setSelectedTextOnly] = useState(false);
  const [selectedText, setSelectedText] = useState('');

  // Initialize app data
  useEffect(() => {
    const initializeApp = async () => {
      try {
        await Promise.all([
          loadCurrentPage(),
          loadSettings(),
          loadSavedPages(),
          loadUniqueTopics(),
        ]);
      } catch (error) {
        console.error('Error during app initialization:', error);
      }
    };
    
    initializeApp();
  }, []);

  // Listen for text selection
  useEffect(() => {
    const handleMessage = (message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
      if (message.type === 'TEXT_SELECTION_CHANGED') {
        if (!message.text) {
          return;
        }
      }
      return true;
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  // Data loading functions
  const loadUniqueTopics = async () => {
    const pages = await db.pages.toArray();
    const topics = new Set(
      pages.reduce<string[]>((acc, page) => [...acc, ...(page.topics || [])], [])
    );
    setUniqueTopics(Array.from(topics));
  };

  const loadCurrentPage = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;

      if (!tab.url || tab.url.startsWith('chrome://')) return;

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const article = document.querySelector('article');
          const main = document.querySelector('main');
          const content = article?.textContent || main?.textContent || document.body.textContent || '';
          
          const meta = document.querySelector('meta[name="description"]');
          const description = meta?.getAttribute('content') || '';

          return {
            content,
            metadata: {
              title: document.title,
              url: window.location.href,
              description
            }
          };
        }
      });

      if (results?.[0]?.result) {
        setCurrentPage(results[0].result as CurrentPage);
      }
    } catch (error) {
      console.error('Error loading current page:', error);
      setCurrentPage(null);
    }
  };

  const loadSettings = async () => {
    const stored = await db.settings.get('llm');
    if (stored) setSettings(stored);
  };

  const loadSavedPages = async () => {
    const pages = await db.pages.orderBy('timestamp').reverse().toArray();
    setSavedPages(filterPages(pages));
  };

  // Search and filter functions
  const handleSearch = (searchResults: Page[]) => {
    const filteredResults = filterPages(searchResults);
    setSavedPages(filteredResults);
  };

  const filterPages = (pages: Page[]): Page[] => {
    return pages.filter(page => {
      const pageDate = new Date(page.timestamp);
      const now = new Date();
      
      switch (filterOptions.dateRange) {
        case 'today':
          if (pageDate.toDateString() !== now.toDateString()) return false;
          break;
        case 'week':
          const weekAgo = new Date(now.setDate(now.getDate() - 7));
          if (pageDate < weekAgo) return false;
          break;
        case 'month':
          const monthAgo = new Date(now.setMonth(now.getMonth() - 1));
          if (pageDate < monthAgo) return false;
          break;
      }

      if (filterOptions.topics.length > 0) {
        return page.topics?.some(topic => filterOptions.topics.includes(topic));
      }

      return true;
    });
  };

  // Page analysis function
  const analyzePage = async () => {
    if (!currentPage) {
      alert('No page content to analyze');
      return;
    }
    
    if (!settings.apiKey) {
      setShowSettings(true); // Open settings dialog
      alert('Please configure your API key in settings first');
      return;
    }
    
    setIsLoading(true);
    
    try {
      let contentToAnalyze = currentPage.content;
      let titleToUse = currentPage.metadata.title;
      
      if (selectedTextOnly) {
        const text = await getSelectedText();
        if (text) {
          contentToAnalyze = text;
          titleToUse = `Selected text from: ${titleToUse}`;
        } else {
          setIsLoading(false);
          // Show message that no text is selected
          alert('No text selected. Please select text on the page or uncheck the "Analyze selected text only" option.');
          return;
        }
      }
      
      const llm = new LLMService({
        provider: settings.provider,
        model: settings.model,
        apiKey: settings.apiKey
      });

      const result = await llm.analyze(contentToAnalyze, titleToUse, summaryLength);
      setAnalysisResult(result);
      setShowSummary(true);
      
      // Save the page to history
      const page: Page = {
        url: currentPage.metadata.url,
        title: currentPage.metadata.title,
        content: currentPage.content,
        summary: result.summary,
        keyPoints: result.keyPoints,
        topics: result.topics,
        keywords: result.keywords || [],
        sentiment: result.sentiment,
        importance: result.importance,
        readingTime: result.readingTime,
        timestamp: new Date(),
        lastAccessed: new Date()
      };
      
      await db.pages.put(page);
      
      // Add this code to process the page for knowledge extraction
      try {
        const knowledgeService = new KnowledgeService({
          provider: settings.provider,
          model: settings.model,
          apiKey: settings.apiKey
        });
        
        await knowledgeService.processPage(page);
        console.log('Knowledge extracted and stored successfully');
      } catch (error) {
        console.error('Error processing knowledge:', error);
      }
      
      await loadSavedPages();
    } catch (error) {
      console.error('Analysis error:', error);
      setIsLoading(false);
    }
  };

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

  // Add function to get selected text
  const getSelectedText = async (): Promise<string> => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return '';
      
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_SELECTED_TEXT' });
      if (response && response.selectedText) {
        setSelectedText(response.selectedText);
        return response.selectedText;
      }
    } catch (error) {
      console.error('Error getting selected text:', error);
    }
    return '';
  };

  // Complete return block for App.tsx
  return (
    <div className="w-full h-full bg-white overflow-auto">
      <div className="w-full h-full">
        {/* Clean, minimal header */}
        <header className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
          <div className="flex items-center">
            <BookOpen className="text-blue-600 mr-2" size={20} />
            <h1 className="text-lg font-medium text-gray-800">Research Assistant</h1>
          </div>
          <button 
            onClick={() => setShowSettings(true)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Settings"
          >
            <Settings size={18} className="text-gray-600" />
          </button>
        </header>
        
        {/* Modern pill-style tab navigation */}
        <div className="px-5 pt-4 pb-2">
          <div className="flex bg-gray-100 rounded-full p-1">
            <button
              onClick={() => setActiveTab('analyze')}
              className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-colors flex items-center justify-center ${
                activeTab === 'analyze' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Brain size={15} className="mr-1.5" />
              Analyze
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-colors flex items-center justify-center ${
                activeTab === 'history' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <History size={15} className="mr-1.5" />
              History
            </button>
            <button
              onClick={() => setActiveTab('knowledge')}
              className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-colors flex items-center justify-center ${
                activeTab === 'knowledge' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Book size={15} className="mr-1.5" />
              Knowledge
            </button>
          </div>
        </div>
        
        {/* Content area with clean card design */}
        <div className="px-5 py-3">
          {activeTab === 'analyze' && (
            <div className="space-y-4">
              {/* Page info card */}
              {currentPage && (
                <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
                  <h2 className="text-lg font-medium text-blue-600 mb-2">Page Analysis</h2>
                  <h3 className="font-medium text-gray-800 mb-1 line-clamp-1">{currentPage.metadata.title}</h3>
                  <p className="text-xs text-gray-500 mb-3 truncate">{currentPage.metadata.url}</p>
                  
                  <div className="bg-gray-50 p-3 rounded-lg mb-4 text-sm text-gray-700 max-h-24 overflow-y-auto">
                    {currentPage.content.substring(0, 200)}...
                  </div>
                </div>
              )}
              
              {/* Options card */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Summary Length
                  </label>
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => setSummaryLength('short')}
                      className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium ${
                        summaryLength === 'short' 
                          ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Short
                    </button>
                    <button 
                      onClick={() => setSummaryLength('medium')}
                      className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium ${
                        summaryLength === 'medium' 
                          ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Medium
                    </button>
                    <button 
                      onClick={() => setSummaryLength('long')}
                      className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium ${
                        summaryLength === 'long' 
                          ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Long
                    </button>
                  </div>
                </div>
                
                <div className="mb-4">
                  <label className="flex items-center text-sm text-gray-700">
                    <input 
                      type="checkbox" 
                      checked={selectedTextOnly}
                      onChange={(e) => setSelectedTextOnly(e.target.checked)}
                      className="mr-2 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    Analyze selected text only
                  </label>
                </div>
              </div>
              
              {/* Analyze button */}
              <button 
                onClick={analyzePage}
                disabled={isLoading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg flex items-center justify-center transition-colors shadow-sm"
              >
                {isLoading ? (
                  <>
                    <Loader size={18} className="animate-spin mr-2" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <BookOpen size={18} className="mr-2" />
                    ANALYZE PAGE
                  </>
                )}
              </button>
            </div>
          )}
          
          {activeTab === 'history' && (
            <div className="space-y-4">
              <SearchBar onResultsChange={handleSearch} />
              
              {savedPages.length > 0 ? (
                <div className="space-y-3">
                  {savedPages.map((page) => (
                    <article 
                      key={page.id} 
                      className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => window.open(page.url, '_blank')}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-medium text-gray-800 line-clamp-1">{page.title}</h3>
                        <time className="text-xs text-gray-500 whitespace-nowrap ml-2">
                          {new Date(page.timestamp).toLocaleDateString()}
                        </time>
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                        {page.summary}
                      </p>
                      
                      <div className="flex flex-wrap gap-2">
                        {page.topics?.map((topic: string, idx: number) => (
                          <span key={idx} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">
                            {topic}
                          </span>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No pages analyzed yet.</p>
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'knowledge' && (
            <KnowledgeExplorer settings={settings} />
          )}
        </div>
        
        {/* Support link */}
        <div className="px-5 py-3 mt-auto border-t border-gray-100 text-center">
          <a 
            href="https://www.buymeacoffee.com/smadgulkar" 
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center justify-center"
          >
            <span className="mr-1">📖</span>
            Support this project
          </a>
        </div>
      </div>

      {/* Settings Modal with improved design */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-[400px] max-w-full overflow-hidden">
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
              
              <div className="mt-5 pt-4 border-t border-gray-100 text-center">
                <p className="text-sm text-gray-600 mb-2">If this extension helped you:</p>
                <a 
                  href="https://www.buymeacoffee.com/smadgulkar" 
                  target="_blank"
                  rel="noopener noreferrer" 
                  className="inline-flex items-center justify-center px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-black font-medium rounded-lg transition-colors"
                >
                  <span className="mr-2">📖</span>
                  Buy me a book
                </a>
              </div>
              
              <button
                onClick={async () => {
                  await db.settings.put(settings);
                  setShowSettings(false);
                }}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg 
                  hover:bg-blue-700 transition-colors font-medium mt-4 shadow-sm"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary Display with improved design */}
      {showSummary && analysisResult && currentPage && (
        <SummaryDisplay
          summary={analysisResult.summary}
          keyPoints={analysisResult.keyPoints}
          topics={analysisResult.topics}
          sentiment={analysisResult.sentiment}
          title={currentPage.metadata.title}
          url={currentPage.metadata.url}
          onClose={() => setShowSummary(false)}
        />
      )}
    </div>
  );
};

export default App;