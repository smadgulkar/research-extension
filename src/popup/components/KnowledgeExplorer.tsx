import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Search, Book, ArrowRight, ThumbsUp, ThumbsDown, Info, Database, Brain, X, Tag, Clock, Loader, Folder, Plus, FolderOpen, Trash2 } from 'lucide-react';
import { db } from '@/storage/db';
import { KnowledgeService } from '@/services/knowledgeService';
import type { Knowledge, Workspace } from '@/types/models';
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
    const [showWorkspaceModal, setShowWorkspaceModal] = useState(false);
    const [newWorkspaceName, setNewWorkspaceName] = useState('');
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);

    useEffect(() => {
      loadKnowledgeBase();
      loadWorkspaces();
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
        
        // First get all knowledge items based on workspace
        let knowledgeItems;
        if (selectedWorkspace === null) {
          knowledgeItems = await db.knowledge.toArray();
        } else {
          knowledgeItems = await db.knowledge.where('workspaceId').equals(selectedWorkspace).toArray();
        }
        
        if (knowledgeItems.length === 0) {
          setKnowledgeItems([]);
          setAnswer("No knowledge items found in this workspace. Try analyzing some pages first.");
          return;
        }
        
        const result = await knowledgeService.queryKnowledge(query, knowledgeItems);
        setKnowledgeItems(result.relevantKnowledge);
        setAnswer(result.synthesizedAnswer);
      } catch (error) {
        console.error('Knowledge search error:', error);
        setAnswer("An error occurred while searching. Please try again.");
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

    const loadWorkspaces = async () => {
      try {
        const workspaces = await db.workspaces.toArray();
        setWorkspaces(workspaces);
      } catch (error) {
        console.error('Error loading workspaces:', error);
      }
    };

    const createWorkspace = async () => {
      if (!newWorkspaceName.trim()) return;
      
      try {
        await db.workspaces.add({
          name: newWorkspaceName.trim(),
          description: '',
          color: '#4299E1',
          createdAt: new Date(),
          lastAccessed: new Date()
        });
        
        setNewWorkspaceName('');
        loadWorkspaces();
      } catch (error) {
        console.error('Error creating workspace:', error);
      }
    };

    const deleteWorkspace = async (id: number) => {
      if (!confirm('Move all items to Default workspace and delete this workspace?')) return;
      
      try {
        // Get default workspace
        const defaultWorkspace = await db.workspaces.where('name').equals('Default').first();
        if (!defaultWorkspace?.id) {
          throw new Error('Default workspace not found');
        }
        
        // Move items to default workspace
        await db.knowledge.where('workspaceId').equals(id).modify({
          workspaceId: defaultWorkspace.id
        });
        
        // Delete workspace
        await db.workspaces.delete(id);
        
        // If current workspace was deleted, switch to default
        if (selectedWorkspace === id) {
          setSelectedWorkspace(defaultWorkspace.id);
        }
        
        loadWorkspaces();
      } catch (error) {
        console.error('Error deleting workspace:', error);
      }
    };

    const deleteKnowledgeItem = async (itemId: number) => {
      if (!confirm('Are you sure you want to delete this knowledge item?')) {
        return;
      }
      
      try {
        await db.knowledge.delete(itemId);
        // Refresh the knowledge items
        if (query.trim()) {
          await searchKnowledge(); // If there's a search query, refresh search results
        } else {
          await loadKnowledgeBase(); // Otherwise refresh the regular view
        }
      } catch (error) {
        console.error('Error deleting knowledge item:', error);
      }
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
      <div className="flex flex-col h-full">
        {/* Workspace Selector */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-2">
            <select
              value={selectedWorkspace || ''}
              onChange={(e) => setSelectedWorkspace(e.target.value ? Number(e.target.value) : null)}
              className="flex-1 p-2 border rounded-lg mr-2 text-sm"
            >
              <option value="">All Workspaces</option>
              {workspaces.map(workspace => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowWorkspaceModal(true)}
              className="p-2 text-gray-600 hover:text-blue-600 rounded-lg hover:bg-gray-100"
              title="Manage Workspaces"
            >
              <Plus size={20} />
            </button>
          </div>
        </div>

        {/* Search and Q&A Interface */}
        <div className="mb-4 space-y-4">
          <div className="flex flex-col space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Search Knowledge Base or Ask a Question
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search or ask a question..."
                className="flex-1 p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    searchKnowledge();
                  }
                }}
              />
              <button
                onClick={searchKnowledge}
                disabled={isSearching}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                         disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
              >
                {isSearching ? (
                  <>
                    <Loader size={16} className="animate-spin mr-2" />
                    Searching...
                  </>
                ) : (
                  'Search'
                )}
              </button>
            </div>
          </div>

          {/* Answer Display */}
          {answer && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-medium text-blue-900 mb-2">Answer:</h3>
              <p className="text-blue-800">{answer}</p>
            </div>
          )}
        </div>

        {/* Knowledge Items Display */}
        <div className="flex-1 overflow-y-auto">
          {knowledgeItems.length === 0 ? (
            // Empty State
            <div className="text-center py-8">
              <Book size={32} className="mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-800 mb-2">
                Your Knowledge Base is Empty
              </h3>
              <p className="text-gray-600 mb-4">
                Start analyzing web pages to build your knowledge base.
              </p>
              <button 
                onClick={() => window.parent.postMessage({ type: 'SWITCH_TAB', tab: 'analyze' }, '*')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Analyze Your First Page
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {knowledgeItems.map((item) => (
                <div key={item.id} className="bg-white p-4 rounded-lg border relative group">
                  {/* Delete button */}
                  <button
                    onClick={() => deleteKnowledgeItem(item.id!)}
                    className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-600 
                             opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete knowledge item"
                  >
                    <Trash2 size={16} />
                  </button>

                  <h3 className="font-medium text-gray-800 mb-2">{item.topic}</h3>
                  <p className="text-gray-600 mb-2">{item.content}</p>
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span className="flex items-center">
                      <Tag size={14} className="mr-1" />
                      Confidence: {(item.confidence * 100).toFixed(0)}%
                    </span>
                    {item.workspaceId && (
                      <span className="text-gray-400">
                        {workspaces.find(w => w.id === item.workspaceId)?.name || 'Unknown Workspace'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Simple Workspace Management Modal */}
        {showWorkspaceModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-96 max-w-full">
              <div className="p-4 border-b flex justify-between items-center">
                <h3 className="font-medium">Manage Workspaces</h3>
                <button 
                  onClick={() => setShowWorkspaceModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={18} />
                </button>
              </div>
              
              <div className="p-4">
                {/* Create New Workspace */}
                <div className="mb-4">
                  <div className="flex gap-2 mb-4">
                    <input
                      type="text"
                      placeholder="New workspace name..."
                      value={newWorkspaceName}
                      onChange={(e) => setNewWorkspaceName(e.target.value)}
                      className="flex-1 p-2 border rounded"
                    />
                    <button
                      onClick={createWorkspace}
                      disabled={!newWorkspaceName.trim()}
                      className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      Create
                    </button>
                  </div>
                </div>

                {/* Workspace List */}
                <div className="space-y-2">
                  {workspaces.map(workspace => (
                    <div 
                      key={workspace.id}
                      className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
                    >
                      <div className="flex items-center">
                        <FolderOpen size={16} className="mr-2 text-gray-500" />
                        <span>{workspace.name}</span>
                      </div>
                      {workspace.name !== 'Default' && (
                        <button
                          onClick={() => deleteWorkspace(workspace.id!)}
                          className="text-red-500 hover:text-red-700 p-1"
                          title="Delete workspace"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);

export default KnowledgeExplorer; 