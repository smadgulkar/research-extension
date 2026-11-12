import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Search, Book, ArrowRight, ThumbsUp, ThumbsDown, Info, Database, Brain, X, Tag, Clock, Loader, Folder, Plus, FolderOpen, Trash2 } from 'lucide-react';
import { db } from '@/storage/db';
import { KnowledgeService, type KnowledgeSource } from '@/services/knowledgeService';
import type { Knowledge, Workspace } from '@/types/models';
import KnowledgeGuide from './KnowledgeGuide';
import WorkspaceManager from './WorkspaceManager';
import { getPrefs, updatePrefs } from '@/services/prefs';

interface KnowledgeExplorerProps {
  settings: any;
  /** Switch to the "This page" tab (from the empty state). */
  onGoToPage?: () => void;
}

// Define the ref type
export interface KnowledgeExplorerRef {
  reloadKnowledgeBase: () => void;
  setSelectedWorkspace: (id: number | null) => void;
}

const KnowledgeExplorer = forwardRef<KnowledgeExplorerRef, KnowledgeExplorerProps>(
  ({ settings, onGoToPage }, ref) => {
    const [query, setQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [knowledgeItems, setKnowledgeItems] = useState<Knowledge[]>([]);
    const [answer, setAnswer] = useState('');
    const [sources, setSources] = useState<KnowledgeSource[]>([]);
    // True after a question, so an empty result reads "no matches", not "empty knowledge base".
    const [hasSearched, setHasSearched] = useState(false);
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
        setAnswer('');
        setSources([]);
        setHasSearched(false);
        await loadKnowledgeBase();
        return;
      }

      setIsSearching(true);
      setSources([]);
      try {
        const knowledgeService = new KnowledgeService(settings);
        
        // First get all knowledge items based on workspace
        let knowledgeItems;
        if (selectedWorkspace === null) {
          knowledgeItems = await db.knowledge.toArray();
        } else {
          knowledgeItems = await db.knowledge.where('workspaceId').equals(selectedWorkspace).toArray();
        }
        
        if (knowledgeItems.length === 0 && (selectedWorkspace !== null || (await db.pages.count()) === 0)) {
          setKnowledgeItems([]);
          setHasSearched(false);
          setAnswer("No knowledge items found in this workspace. Try analyzing some pages first.");
          return;
        }

        const result = await knowledgeService.queryKnowledge(query, knowledgeItems, { allPages: selectedWorkspace === null });
        setKnowledgeItems(result.relevantKnowledge);
        setSources(result.sources);
        setAnswer(result.synthesizedAnswer);
        setHasSearched(true);
      } catch (error) {
        console.error('Knowledge search error:', error);
        setHasSearched(true);
        setAnswer(`Couldn't answer that: ${error instanceof Error ? error.message : 'unknown error'}`);
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
        
        // Delete workspace; new pages stop going into it.
        await db.workspaces.delete(id);
        const prefs = await getPrefs();
        if (prefs.workspaceId === id) await updatePrefs({ workspaceId: null });
        
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
        <div className="space-y-3 mb-4">
          {workspaces.length > 1 && (
            <select
              aria-label="Workspace"
              value={selectedWorkspace || ''}
              onChange={(e) => setSelectedWorkspace(e.target.value ? Number(e.target.value) : null)}
              className="w-full p-1.5 border border-gray-200 rounded-lg text-sm text-gray-700"
            >
              <option value="">All workspaces</option>
              {workspaces.map(workspace => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask about anything you've saved..."
              className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter') searchKnowledge();
              }}
            />
            <button
              onClick={searchKnowledge}
              disabled={isSearching}
              className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center"
            >
              {isSearching ? <Loader size={16} className="animate-spin" /> : 'Ask'}
            </button>
            <button
              onClick={() => setShowWorkspaceModal(true)}
              className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-gray-100"
              title="Workspaces"
              aria-label="Workspaces"
            >
              <Folder size={16} />
            </button>
          </div>

          {/* Answer Display */}
          {answer && (
            <div className="bg-blue-50 p-3 rounded-lg text-sm" data-testid="knowledge-answer">
              <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{answer}</p>
              {sources.length > 0 && (
                <ol className="mt-3 pt-3 border-t border-blue-100 space-y-1 text-sm" data-testid="answer-sources">
                  {sources.map((source, i) => (
                    <li key={source.pageId} className="flex gap-1.5 min-w-0">
                      <span className="text-blue-900 font-medium shrink-0">[{source.number ?? i + 1}]</span>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-700 hover:underline truncate"
                        title={source.url}
                      >
                        {source.title}
                      </a>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="flex-1 overflow-y-auto">
          {knowledgeItems.length === 0 && hasSearched ? null : knowledgeItems.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <Book size={26} className="mx-auto text-gray-300" />
              <p className="text-sm font-medium text-gray-800">Nothing saved yet</p>
              <p className="text-sm text-gray-500">Save a few pages, then ask questions across everything you've read.</p>
              {onGoToPage && (
                <button onClick={onGoToPage} className="text-sm text-blue-600 hover:underline">
                  Save this page
                </button>
              )}
            </div>
          ) : (
            <>
              <h3 className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1">
                {hasSearched ? 'Notes used' : 'Recent notes'}
              </h3>
              <div className="divide-y divide-gray-100">
                {knowledgeItems.map((item) => (
                  <div key={item.id} className="py-2.5 relative group pr-6">
                    <button
                      onClick={() => deleteKnowledgeItem(item.id!)}
                      className="absolute top-2.5 right-0 p-0.5 text-gray-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete note"
                    >
                      <Trash2 size={14} />
                    </button>
                    <p className="text-xs text-gray-400 line-clamp-1">{item.topic}</p>
                    <p className="text-sm text-gray-700">{item.content}</p>
                  </div>
                ))}
              </div>
            </>
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