import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Search, Book, ArrowRight, ThumbsUp, ThumbsDown, Info, Database, Brain, X, Tag, Clock, Loader, Folder } from 'lucide-react';
import { db } from '@/storage/db';
import { KnowledgeService } from '@/services/knowledgeService';
import type { Knowledge } from '@/storage/db';
import KnowledgeGuide from './KnowledgeGuide';
import WorkspaceManager from './WorkspaceManager';

interface KnowledgeExplorerProps {
  settings: any;
}

// Define the ref type
export interface KnowledgeExplorerRef {
  reloadKnowledgeBase: () => void;
  setSelectedWorkspace: (id: number | null) => void;
}

const KnowledgeExplorer = forwardRef<KnowledgeExplorerRef, KnowledgeExplorerProps>(
  ({ settings }, ref) => {
    const [query, setQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [knowledgeItems, setKnowledgeItems] = useState<Knowledge[]>([]);
    const [answer, setAnswer] = useState('');
    const [topTopics, setTopTopics] = useState<{topic: string, count: number}[]>([]);
    const [showInfo, setShowInfo] = useState(true);
    const [showGuide, setShowGuide] = useState(false);
    const [newTag, setNewTag] = useState('');
    const [editingTagsFor, setEditingTagsFor] = useState<number | null>(null);
    const [selectedWorkspace, setSelectedWorkspace] = useState<number | null>(null);

    useEffect(() => {
      loadKnowledgeBase();
    }, [selectedWorkspace]);

    const loadKnowledgeBase = async () => {
      try {
        let allKnowledge;
        
        if (selectedWorkspace === null) {
          // Load all knowledge items
          allKnowledge = await db.knowledge.toArray();
        } else {
          // Load knowledge items for the selected workspace
          allKnowledge = await db.knowledge.where('workspaceId').equals(selectedWorkspace).toArray();
          
          // Update last accessed timestamp for the workspace
          await db.workspaces.update(selectedWorkspace, {
            lastAccessed: new Date()
          });
        }
        
        // Get top topics
        const topicCounts: Record<string, number> = {};
        allKnowledge.forEach(item => {
          if (!topicCounts[item.topic]) {
            topicCounts[item.topic] = 0;
          }
          topicCounts[item.topic]++;
        });
        
        const sortedTopics = Object.entries(topicCounts)
          .map(([topic, count]) => ({ topic, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);
        
        setTopTopics(sortedTopics);
        
        // Show recent knowledge items
        const recentItems = allKnowledge
          .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
          .slice(0, 10);
        
        setKnowledgeItems(recentItems);
      } catch (error) {
        console.error('Error loading knowledge base:', error);
      }
    };

    const searchKnowledge = async () => {
      if (!query.trim()) {
        await loadKnowledgeBase();
        return;
      }
      
      setIsSearching(true);
      try {
        const knowledgeService = new KnowledgeService(settings);
        const result = await knowledgeService.queryKnowledge(query, selectedWorkspace);
        
        setKnowledgeItems(result.relevantKnowledge);
        setAnswer(result.synthesizedAnswer);
      } catch (error) {
        console.error('Knowledge search error:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const addTagToKnowledge = async (knowledgeId: number, tag: string) => {
      if (!tag.trim()) return;
      
      const knowledge = await db.knowledge.get(knowledgeId);
      if (!knowledge) return;
      
      const tags = knowledge.tags || [];
      if (!tags.includes(tag)) {
        const updatedTags = [...tags, tag];
        await db.knowledge.update(knowledgeId, { tags: updatedTags });
        await loadKnowledgeBase(); // Refresh the knowledge items
      }
      
      setNewTag('');
    };

    const removeTagFromKnowledge = async (knowledgeId: number, tagToRemove: string) => {
      const knowledge = await db.knowledge.get(knowledgeId);
      if (!knowledge) return;
      
      const tags = knowledge.tags || [];
      const updatedTags = tags.filter(tag => tag !== tagToRemove);
      await db.knowledge.update(knowledgeId, { tags: updatedTags });
      await loadKnowledgeBase(); // Refresh the knowledge items
    };

    // Expose methods to parent components
    useImperativeHandle(ref, () => ({
      reloadKnowledgeBase: () => {
        loadKnowledgeBase();
      },
      setSelectedWorkspace: (id: number | null) => {
        setSelectedWorkspace(id);
      }
    }));

    return (
      <div className="space-y-6">
        {/* Workspace Manager */}
        <WorkspaceManager 
          onSelectWorkspace={setSelectedWorkspace}
          selectedWorkspaceId={selectedWorkspace}
        />

        {/* Knowledge Base Info */}
        {showInfo && (
          <div className="enhanced-card bg-blue-50 border-l-4 border-blue-500">
            <div className="flex justify-between items-start">
              <div className="flex items-start">
                <Info size={20} className="text-blue-500 mt-1 mr-3 flex-shrink-0" />
                <div>
                  <h3 className="font-medium text-blue-800 mb-2">About Knowledge Base</h3>
                  <p className="text-sm text-blue-800 mb-2">
                    The Knowledge Base automatically extracts and stores key information from your analyzed pages.
                  </p>
                  <ul className="text-sm text-blue-800 list-disc pl-5 mb-2">
                    <li>Search for specific topics or ask questions</li>
                    <li>Browse extracted knowledge by topic</li>
                    <li>Build a personal research database over time</li>
                  </ul>
                </div>
              </div>
              <button 
                onClick={() => setShowInfo(false)}
                className="text-blue-500 hover:text-blue-700"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}
        
        {/* Search Section */}
        <div className="enhanced-card p-4">
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask a question or search your knowledge base..."
              className="w-full p-3 pl-10 pr-24 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-all"
            />
            <Search size={18} className="absolute left-3 top-3.5 text-gray-400" />
            <button
              onClick={searchKnowledge}
              disabled={isSearching || !query.trim()}
              className="absolute right-2 top-2 px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {isSearching ? (
                <div className="flex items-center">
                  <Loader size={14} className="animate-spin mr-1" />
                  <span>Searching...</span>
                </div>
              ) : (
                "Search"
              )}
            </button>
          </div>
          
          {topTopics.length > 0 && (
            <div className="mt-3">
              <div className="text-sm text-gray-600 mb-2 flex items-center">
                <Tag size={14} className="mr-1" />
                Popular Topics:
              </div>
              <div className="flex flex-wrap gap-2">
                {topTopics.map(({ topic, count }) => (
                  <button
                    key={topic}
                    onClick={() => {
                      setQuery(topic);
                      searchKnowledge();
                    }}
                    className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs rounded-full flex items-center"
                  >
                    {topic}
                    <span className="ml-1 bg-gray-200 text-gray-700 rounded-full px-1.5 text-xs">
                      {count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Answer Section */}
        {answer && (
          <div className="dashboard-section">
            <h2 className="mono-heading text-primary-dark mb-4 flex items-center">
              <Brain size={18} className="mr-2" />
              Answer
            </h2>
            <div className="enhanced-card bg-blue-50 border-l-4 border-blue-500">
              <p className="mono-text leading-relaxed">{answer}</p>
              <div className="flex justify-end mt-4 space-x-2">
                <button className="p-2 rounded-full hover:bg-blue-100 transition-colors">
                  <ThumbsUp size={16} className="text-primary" />
                </button>
                <button className="p-2 rounded-full hover:bg-red-100 transition-colors">
                  <ThumbsDown size={16} className="text-red-500" />
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Knowledge Items */}
        <div className="dashboard-section">
          <h2 className="mono-heading text-primary-dark mb-4 flex items-center">
            <Book size={18} className="mr-2" />
            Knowledge Items
            {selectedWorkspace !== null && (
              <span className="ml-2 text-sm text-gray-500">
                in selected workspace
              </span>
            )}
          </h2>
          
          {knowledgeItems.length > 0 ? (
            <div className="space-y-4">
              {knowledgeItems.map((item) => (
                <div key={item.id} className="enhanced-card hover:bg-gray-50">
                  <div className="flex items-start">
                    <div className="bg-primary-light rounded-full p-2 mr-3 flex-shrink-0">
                      <Book size={16} className="text-primary-dark" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium mono-heading text-primary-dark mb-2">{item.topic}</h3>
                      <p className="mono-text text-sm mb-3 leading-relaxed">{item.content}</p>
                      <div className="flex flex-wrap items-center text-xs text-gray-500">
                        <span className="flex items-center mr-4">
                          <div className="w-2 h-2 rounded-full bg-green-500 mr-1"></div>
                          Confidence: {Math.round(item.confidence * 100)}%
                        </span>
                        <span className="flex items-center">
                          <Clock size={12} className="mr-1" />
                          {new Date(item.lastUpdated).toLocaleDateString()}
                        </span>
                        {item.tags && item.tags.length > 0 && (
                          <div className="w-full mt-2 flex flex-wrap">
                            {item.tags.map((tag, idx) => (
                              <span key={idx} className="mr-2 mb-1 px-2 py-1 bg-gray-100 rounded-full text-xs flex items-center">
                                {tag}
                                <button 
                                  onClick={() => removeTagFromKnowledge(item.id!, tag)}
                                  className="ml-1 text-gray-500 hover:text-red-500"
                                >
                                  <X size={12} />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {editingTagsFor === item.id && (
                    <div className="mt-2 flex">
                      <input
                        type="text"
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        placeholder="Add tag..."
                        className="text-xs p-2 border rounded-l-lg flex-1"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            addTagToKnowledge(item.id!, newTag);
                          }
                        }}
                      />
                      <button
                        onClick={() => addTagToKnowledge(item.id!, newTag)}
                        className="text-xs bg-primary text-white px-3 py-1 rounded-r-lg"
                      >
                        Add
                      </button>
                    </div>
                  )}
                  {editingTagsFor !== item.id && (
                    <button
                      onClick={() => setEditingTagsFor(item.id!)}
                      className="mt-2 text-xs text-primary flex items-center"
                    >
                      <Tag size={12} className="mr-1" />
                      Manage Tags
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="bg-blue-50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Book size={24} className="text-blue-500" />
              </div>
              <h3 className="text-lg font-medium text-gray-800 mb-2">Your Knowledge Base is Empty</h3>
              <p className="text-gray-600 max-w-md mx-auto mb-4">
                Analyze web pages to automatically extract and store knowledge in your personal database.
              </p>
              <button 
                onClick={() => window.parent.postMessage({ type: 'SWITCH_TAB', tab: 'analyze' }, '*')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Start Analyzing Pages
              </button>
            </div>
          )}
          {knowledgeItems.length === 0 && selectedWorkspace !== null && (
            <div className="text-center py-6 bg-gray-50 rounded-lg border border-gray-200">
              <div className="text-gray-500 mb-2">
                <Folder size={24} className="mx-auto mb-2" />
                <p>This workspace is empty</p>
              </div>
              <p className="text-sm text-gray-600 max-w-md mx-auto">
                Analyze pages and save knowledge to this workspace to see items here.
              </p>
            </div>
          )}
        </div>
        {showGuide && <KnowledgeGuide onClose={() => setShowGuide(false)} />}
      </div>
    );
  }
);

export default KnowledgeExplorer; 