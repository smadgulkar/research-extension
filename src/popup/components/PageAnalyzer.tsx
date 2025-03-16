import React, { useState, useEffect } from 'react';
import { db } from '../../storage/db';
import { KnowledgeService } from '../../services/knowledgeService';
import type { Workspace, Page, LLMSettings } from '../../types/models';

interface PageAnalyzerProps {
  settings: LLMSettings;
  onAnalysisComplete?: (page: Page) => void;
}

const PageAnalyzer: React.FC<PageAnalyzerProps> = ({ settings, onAnalysisComplete }) => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<number | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [pageData, setPageData] = useState<Page | null>(null);

  useEffect(() => {
    // Load workspaces
    const loadWorkspaces = async () => {
      try {
        console.log('Loading workspaces in PageAnalyzer');
        const allWorkspaces = await db.workspaces.toArray();
        console.log('Loaded workspaces:', allWorkspaces);
        setWorkspaces(allWorkspaces);
        
        // Set default workspace if available
        const defaultWorkspace = allWorkspaces.find(w => w.name === 'Default');
        if (defaultWorkspace) {
          setSelectedWorkspaceId(defaultWorkspace.id!);
        } else if (allWorkspaces.length > 0) {
          setSelectedWorkspaceId(allWorkspaces[0].id!);
        }
      } catch (error) {
        console.error('Error loading workspaces:', error);
      }
    };
    
    // Get current page data
    const getCurrentPage = async () => {
      try {
        // For browser extension context
        if (typeof chrome !== 'undefined' && chrome.tabs) {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tabs[0]) {
            const url = tabs[0].url || '';
            const title = tabs[0].title || '';
            
            // Check if we already have this page in our database
            const existingPage = await db.pages.where('url').equals(url).first();
            
            if (existingPage) {
              console.log('Found existing page:', existingPage);
              setPageData(existingPage);
            } else {
              // Create a new page object with all required properties
              const newPage: Page = {
                url,
                title,
                timestamp: new Date(),
                lastAccessed: new Date(),
                content: '',
                summary: '',
                keyPoints: [],
                topics: [],
                keywords: [],
                sentiment: ''
              };
              console.log('Created new page object:', newPage);
              setPageData(newPage);
            }
          }
        } else {
          // For development/testing outside extension
          console.log('Not in extension context, using mock page data');
          setPageData({
            url: 'https://example.com',
            title: 'Example Page',
            timestamp: new Date(),
            lastAccessed: new Date(),
            content: 'Example content',
            summary: 'Example summary',
            keyPoints: [],
            topics: [],
            keywords: [],
            sentiment: ''
          });
        }
      } catch (error) {
        console.error('Error getting current page:', error);
      }
    };
    
    loadWorkspaces();
    getCurrentPage();
  }, []);

  const analyzePage = async () => {
    if (!pageData) {
      console.error('No page data to analyze');
      return;
    }
    
    console.log('Analyzing page with workspace:', selectedWorkspaceId);
    setIsAnalyzing(true);
    try {
      // Process page for knowledge with selected workspace
      const knowledgeService = new KnowledgeService(settings);
      await knowledgeService.processPage(pageData, selectedWorkspaceId);
      
      console.log('Analysis complete');
      if (onAnalysisComplete) {
        onAnalysisComplete(pageData);
      }
    } catch (error) {
      console.error('Error analyzing page:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div>
      {/* Workspace selector */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Save to Workspace</label>
        <select
          value={selectedWorkspaceId || ''}
          onChange={(e) => setSelectedWorkspaceId(e.target.value ? Number(e.target.value) : null)}
          className="w-full p-2 border rounded-lg"
        >
          {workspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.name}
            </option>
          ))}
        </select>
      </div>
      
      {/* Analysis button */}
      <button
        onClick={analyzePage}
        disabled={isAnalyzing || !pageData}
        className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
      >
        {isAnalyzing ? 'Analyzing...' : 'Analyze Page'}
      </button>
    </div>
  );
};

export default PageAnalyzer; 