import React, { useState, useEffect } from 'react';
import { db } from '@/storage/db';
import { LLMService } from '@/services/llm';
import { Settings, History, Loader, X, BookOpen, Cog, Filter, 
         LucideIcon, Tag, Clock, Brain } from 'lucide-react';
import type { Settings as SettingsType, Highlight } from '@/storage/db';
import type { Page } from '@/types/models';
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
    className={`material-tab ${activeTab === id ? 'active' : ''}`}
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
      const llm = new LLMService({
        provider: settings.provider,
        model: settings.model,
        apiKey: settings.apiKey
      });

      const result = await llm.analyze(currentPage.content, currentPage.metadata.title);
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
      alert('Failed to analyze page: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
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
  const handleProviderChange = (provider: string) => {
    setSettings({...settings, provider, model: ''});
    // Reset model when provider changes
  };

  // Add useEffect to fetch models when provider or API key changes
  useEffect(() => {
    if (settings.apiKey) {
      fetchAvailableModels();
    }
  }, [settings.provider, settings.apiKey]);

  // Complete return block for App.tsx
  return (
    <>
      <div className="w-full h-full bg-white shadow-xl flex flex-col">
        {/* Header */}
        <header className="px-4 py-3 bg-surface border-b flex items-center justify-between">
          <h1 className="text-lg font-semibold mono-heading text-primary-dark">Research Assistant</h1>
          <div className="flex space-x-2">
            {activeTab === 'history' && (
              <button 
                onClick={() => setShowFilters(prev => !prev)}
                className={`p-2 rounded-full transition-colors ${
                  showFilters ? 'bg-primary-light text-primary-dark' : 'hover:bg-gray-100'
                }`}
              >
                <Filter size={18} />
              </button>
            )}
            <button 
              onClick={() => setShowSettings(true)}
              className="p-2 hover:bg-gray-100 rounded-full"
            >
              <Cog size={18} />
            </button>
          </div>
        </header>

        {/* Navigation */}
        <nav className="material-tabs px-4 py-2 border-b">
          <TabButton
            id="analyze"
            icon={BookOpen}
            label="Analyze"
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
          <TabButton
            id="history"
            icon={History}
            label="History"
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
          <TabButton
            id="knowledge"
            icon={Brain}
            label="Knowledge"
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </nav>

        {/* Main Content */}
        <main className="flex-1 flex overflow-hidden">
          {/* Filters Sidebar */}
          {showFilters && activeTab === 'history' && (
            <aside className="w-48 border-r bg-gray-50 p-4 overflow-y-auto flex flex-col">
              <div className="space-y-6">
                <section>
                  <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <Clock size={14} className="mr-2" />
                    Time Range
                  </h3>
                  <div className="space-y-2">
                    {['all', 'today', 'week', 'month'].map((range) => (
                      <label key={range} className="flex items-center space-x-2 text-sm text-gray-600">
                        <input
                          type="radio"
                          checked={filterOptions.dateRange === range}
                          onChange={() => setFilterOptions(prev => ({
                            ...prev,
                            dateRange: range as FilterOptions['dateRange']
                          }))}
                          className="text-blue-600"
                        />
                        <span className="capitalize">{range}</span>
                      </label>
                    ))}
                  </div>
                </section>

                <section>
                  <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <Tag size={14} className="mr-2" />
                    Topics
                  </h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {uniqueTopics.map((topic: string) => (
                      <label key={topic} className="flex items-center space-x-2 text-sm text-gray-600">
                        <input
                          type="checkbox"
                          checked={filterOptions.topics.includes(topic)}
                          onChange={(e) => {
                            setFilterOptions(prev => ({
                              ...prev,
                              topics: e.target.checked
                                ? [...prev.topics, topic]
                                : prev.topics.filter(t => t !== topic)
                            }));
                          }}
                          className="text-blue-600"
                        />
                        <span className="truncate">{topic}</span>
                      </label>
                    ))}
                  </div>
                </section>
              </div>
            </aside>
          )}

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 space-y-4">
              {activeTab === 'knowledge' ? (
                <KnowledgeExplorer settings={settings} />
              ) : activeTab === 'analyze' ? (
                <div className="p-4 space-y-6">
                  <div className="dashboard-section">
                    <h2 className="mono-heading text-primary-dark mb-4">Page Analysis</h2>
                    
                    {currentPage ? (
                      <>
                        <div className="mb-4">
                          <h3 className="text-sm font-medium mono-heading mb-2">{currentPage.metadata.title}</h3>
                          <p className="text-xs text-gray-500 mono-text mb-4 truncate">{currentPage.metadata.url}</p>
                          
                          <div className="bg-gray-50 p-3 rounded-lg mb-4 max-h-32 overflow-y-auto">
                            <p className="text-xs text-gray-600 mono-text line-clamp-5">
                              {currentPage.content.substring(0, 300)}...
                            </p>
                          </div>
                        </div>
                        
                        <button
                          onClick={analyzePage}
                          disabled={isLoading}
                          className="gradient-button w-full"
                        >
                          {isLoading ? (
                            <>
                              <Loader size={16} className="animate-spin mr-2" />
                              Analyzing...
                            </>
                          ) : (
                            <>
                              <BookOpen size={16} className="mr-2" />
                              Analyze Page
                            </>
                          )}
                        </button>
                        
                        {isLoading && (
                          <div className="mt-4">
                            <div className="loading-bar"></div>
                            <p className="text-center text-xs text-gray-500 mt-2">This may take a moment...</p>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-8 bg-gray-50 rounded-lg">
                        <BookOpen size={40} className="mx-auto text-gray-300 mb-2" />
                        <p className="text-gray-500 font-medium">No page content detected</p>
                        <p className="text-sm text-gray-400 mt-1">Navigate to a webpage to analyze its content</p>
                      </div>
                    )}
                  </div>
                  
                  {analysisResult && (
                    <div className="dashboard-section">
                      <h2 className="mono-heading text-primary-dark mb-4">Analysis Results</h2>
                      
                      <div className="enhanced-card mb-4">
                        <h3 className="text-sm font-medium mono-heading mb-2 text-primary-dark">Summary</h3>
                        <p className="mono-text text-sm leading-relaxed">{analysisResult.summary}</p>
                      </div>
                      
                      <div className="enhanced-card mb-4">
                        <h3 className="text-sm font-medium mono-heading mb-2 text-primary-dark">Key Points</h3>
                        <ul className="list-disc pl-5 space-y-2">
                          {analysisResult.keyPoints.map((point, idx) => (
                            <li key={idx} className="mono-text text-sm">{point}</li>
                          ))}
                        </ul>
                      </div>
                      
                      <div className="enhanced-card">
                        <h3 className="text-sm font-medium mono-heading mb-2 text-primary-dark">Topics & Sentiment</h3>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {analysisResult.topics.map((topic, idx) => (
                            <span key={idx} className="topic-pill">{topic}</span>
                          ))}
                        </div>
                        <p className="mono-text text-sm">
                          <span className="font-medium">Sentiment:</span> {analysisResult.sentiment}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : activeTab === 'highlights' ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-medium text-gray-900">Saved Highlights</h2>
                    <select 
                      className="px-3 py-1.5 border rounded-lg text-sm"
                      onChange={(e) => {
                        // Filter logic here
                      }}
                    >
                      <option value="all">All Pages</option>
                      <option value="current">Current Page</option>
                    </select>
                  </div>
                  
                  {savedPages.length > 0 ? (
                    <div className="space-y-4">
                      {savedPages.map((page) => (
                        <div key={page.id} className="highlight-card">
                          <div className="flex items-start">
                            <div className="flex-1">
                              <p className="text-sm mono-text">{page.summary}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <p>No highlights saved yet.</p>
                      <p className="text-sm mt-1">Select text on any page to create highlights.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <SearchBar onResultsChange={handleSearch} />
                  
                  {savedPages.length > 0 ? (
                    <div className="space-y-3">
                      {savedPages.map((page) => (
                        <article 
                          key={page.id} 
                          className="material-card cursor-pointer"
                          onClick={() => window.open(page.url, '_blank')}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h3 className="font-medium mono-heading text-primary-dark">{page.title}</h3>
                            <time className="text-xs text-text-secondary mono-text">
                              {new Date(page.timestamp).toLocaleDateString()}
                            </time>
                          </div>
                          
                          <p className="text-sm text-text-secondary mb-3 line-clamp-2">
                            {page.summary}
                          </p>
                          
                          <div className="flex flex-wrap gap-2">
                            {page.topics?.map((topic: string, idx: number) => (
                              <span key={idx} className="material-chip">
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
            </div>
          </div>
        </main>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="w-96 bg-white rounded-lg shadow-xl">
            <div className="px-4 py-3 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800">Settings</h2>
              <button 
                onClick={() => setShowSettings(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Provider
                </label>
                <select
                  value={settings.provider}
                  onChange={(e) => handleProviderChange(e.target.value)}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                </select>
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  API Key
                </label>
                <input
                  type="password"
                  value={settings.apiKey}
                  onChange={(e) => setSettings({...settings, apiKey: e.target.value})}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder={`Enter your ${settings.provider} API key`}
                />
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Model
                </label>
                <select
                  value={settings.model}
                  onChange={(e) => setSettings({...settings, model: e.target.value})}
                  className="material-input"
                  disabled={availableModels.length === 0}
                >
                  {settings.model === '' && <option value="">Select a model</option>}
                  
                  {availableModels.map(model => (
                    <option key={model.id} value={model.id}>
                      {model.name || model.id}
                    </option>
                  ))}
                  
                  {availableModels.length === 0 && (
                    <option value="" disabled>
                      {settings.apiKey ? 'Loading models...' : 'Enter API key first'}
                    </option>
                  )}
                </select>
              </div>
              
              <button
                onClick={async () => {
                  await db.settings.put(settings);
                  setShowSettings(false);
                }}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg 
                  hover:bg-blue-700 transition-colors"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary Display */}
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
    </>
  );
};

export default App;