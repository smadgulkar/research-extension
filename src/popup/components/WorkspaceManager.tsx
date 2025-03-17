import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Folder, ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { db } from '../../storage/db';
import type { Workspace } from '../../types/models';

interface WorkspaceManagerProps {
  onSelectWorkspace: (workspaceId: number | null) => void;
  selectedWorkspaceId: number | null;
  showCreateButton?: boolean;
}

const WORKSPACE_COLORS = [
  '#4299E1', // blue
  '#48BB78', // green
  '#ED8936', // orange
  '#9F7AEA', // purple
  '#F56565', // red
  '#38B2AC', // teal
];

const WorkspaceManager: React.FC<WorkspaceManagerProps> = ({ 
  onSelectWorkspace, 
  selectedWorkspaceId,
  showCreateButton = true
}) => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspaceDesc, setNewWorkspaceDesc] = useState('');
  const [selectedColor, setSelectedColor] = useState(WORKSPACE_COLORS[0]);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    loadWorkspaces();
  }, []);

  const loadWorkspaces = async () => {
    console.log('Loading workspaces...');
    try {
      const allWorkspaces = await db.workspaces.toArray();
      setWorkspaces(allWorkspaces);
      
      // If no workspace is selected and we have workspaces, select the first one
      if (selectedWorkspaceId === null && allWorkspaces.length > 0) {
        onSelectWorkspace(allWorkspaces[0].id!);
      }
      console.log('Loaded workspaces:', allWorkspaces);
    } catch (error) {
      console.error('Error loading workspaces:', error);
    }
  };

  const createWorkspace = async () => {
    if (!newWorkspaceName.trim()) return;
    
    try {
      console.log('Creating workspace:', { name: newWorkspaceName, color: selectedColor });
      const id = await db.workspaces.add({
        name: newWorkspaceName.trim(),
        description: newWorkspaceDesc.trim(),
        color: selectedColor,
        createdAt: new Date(),
        lastAccessed: new Date()
      });
      
      console.log('Created workspace with ID:', id);
      setIsCreating(false);
      setNewWorkspaceName('');
      setNewWorkspaceDesc('');
      await loadWorkspaces();
      onSelectWorkspace(id as number);
    } catch (error) {
      console.error('Error creating workspace:', error);
    }
  };

  const updateWorkspace = async (id: number) => {
    if (!newWorkspaceName.trim()) return;
    
    try {
      await db.workspaces.update(id, {
        name: newWorkspaceName.trim(),
        description: newWorkspaceDesc.trim(),
        color: selectedColor,
        lastAccessed: new Date()
      });
      
      setIsEditing(null);
      setNewWorkspaceName('');
      setNewWorkspaceDesc('');
      await loadWorkspaces();
    } catch (error) {
      console.error('Error updating workspace:', error);
    }
  };

  const deleteWorkspace = async (id: number) => {
    if (!confirm('Are you sure you want to delete this workspace? All knowledge items in this workspace will be moved to the default workspace.')) {
      return;
    }
    
    try {
      // Get default workspace or create one if it doesn't exist
      let defaultWorkspace = await db.workspaces.where('name').equals('Default').first();
      
      if (!defaultWorkspace) {
        const defaultId = await db.workspaces.add({
          name: 'Default',
          description: 'Default workspace',
          color: '#4299E1',
          createdAt: new Date(),
          lastAccessed: new Date()
        });
        defaultWorkspace = await db.workspaces.get(defaultId as number);
      }
      
      // Move all knowledge items to default workspace
      await db.knowledge.where('workspaceId').equals(id).modify({
        workspaceId: defaultWorkspace!.id
      });
      
      // Delete the workspace
      await db.workspaces.delete(id);
      
      // If the deleted workspace was selected, select the default workspace
      if (selectedWorkspaceId === id) {
        onSelectWorkspace(defaultWorkspace!.id || null);
      }
      
      await loadWorkspaces();
    } catch (error) {
      console.error('Error deleting workspace:', error);
    }
  };

  const startEditing = (workspace: Workspace) => {
    setIsEditing(workspace.id!);
    setNewWorkspaceName(workspace.name);
    setNewWorkspaceDesc(workspace.description || '');
    setSelectedColor(workspace.color);
  };

  // Filter workspaces based on search query
  const filteredWorkspaces = workspaces.filter(workspace => 
    workspace.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (workspace.description && workspace.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="mb-6 border border-gray-200 rounded-lg overflow-hidden">
      {/* Header with collapse toggle */}
      <div className="bg-gray-50 p-3 flex justify-between items-center cursor-pointer" 
           onClick={() => setIsCollapsed(!isCollapsed)}>
        <div className="flex items-center">
          <Folder size={18} className="mr-2 text-blue-600" />
          <h2 className="text-gray-800 font-medium">Workspaces</h2>
          {workspaces.length > 0 && (
            <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">
              {workspaces.length}
            </span>
          )}
        </div>
        <div className="flex items-center">
          {!isCollapsed && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setShowSearch(!showSearch);
              }}
              className="p-1 mr-2 text-gray-500 hover:text-blue-600 rounded-full hover:bg-gray-200"
            >
              <Search size={16} />
            </button>
          )}
          <button className="text-gray-500">
            {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
          </button>
        </div>
      </div>

      {/* Collapsible content */}
      {!isCollapsed && (
        <div className="p-3">
          {/* Search bar */}
          {showSearch && (
            <div className="mb-3 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search workspaces..."
                className="w-full p-2 pl-8 border rounded-lg text-sm"
              />
              <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          )}

          {/* Help text */}
          {workspaces.length > 5 && !showSearch && (
            <div className="text-xs text-gray-500 mb-2 italic">
              Tip: Use the search icon to find specific workspaces
            </div>
          )}

          {/* Create/Edit Workspace Form */}
          {(isCreating || isEditing !== null) && (
            <div className="bg-white border border-gray-200 rounded-lg mb-4 p-4">
              <h3 className="font-medium mb-3 text-gray-800">
                {isCreating ? 'Create New Workspace' : 'Edit Workspace'}
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700">Name</label>
                  <input
                    type="text"
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    className="w-full p-2 border rounded-lg"
                    placeholder="Workspace name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700">Description</label>
                  <input
                    type="text"
                    value={newWorkspaceDesc}
                    onChange={(e) => setNewWorkspaceDesc(e.target.value)}
                    className="w-full p-2 border rounded-lg"
                    placeholder="Optional description"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700">Color</label>
                  <div className="flex space-x-2">
                    {WORKSPACE_COLORS.map((color) => (
                      <div
                        key={color}
                        onClick={() => setSelectedColor(color)}
                        className={`w-6 h-6 rounded-full cursor-pointer ${
                          selectedColor === color ? 'ring-2 ring-offset-2 ring-gray-400' : ''
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex space-x-2 pt-2">
                  <button
                    onClick={() => {
                      isCreating ? createWorkspace() : updateWorkspace(isEditing!);
                    }}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm"
                  >
                    {isCreating ? 'Create Workspace' : 'Update Workspace'}
                  </button>
                  <button
                    onClick={() => {
                      setIsCreating(false);
                      setIsEditing(null);
                    }}
                    className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* New Workspace Button */}
          {showCreateButton && (
            <button 
              onClick={() => {
                setIsCreating(true);
                setNewWorkspaceName('');
                setNewWorkspaceDesc('');
                setSelectedColor(WORKSPACE_COLORS[0]);
              }}
              className="w-full mb-3 py-2 bg-blue-50 text-blue-700 rounded-lg flex items-center justify-center hover:bg-blue-100 transition-colors"
            >
              <Plus size={16} className="mr-1" />
              New Workspace
            </button>
          )}

          {/* Workspace List */}
          <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
            <button
              onClick={() => onSelectWorkspace(null)}
              className={`w-full text-left p-2 rounded-lg flex items-center ${
                selectedWorkspaceId === null
                  ? 'bg-blue-100 text-blue-800'
                  : 'hover:bg-gray-100 text-gray-800'
              }`}
            >
              <Folder size={16} className="mr-2" />
              <span className="flex-1 text-sm">All Workspaces</span>
            </button>
            
            {filteredWorkspaces.length > 0 ? (
              filteredWorkspaces.map((workspace) => (
                <div 
                  key={workspace.id}
                  className={`w-full text-left p-2 rounded-lg flex items-center justify-between group ${
                    selectedWorkspaceId === workspace.id
                      ? 'bg-blue-100 text-blue-800'
                      : 'hover:bg-gray-100 text-gray-800'
                  }`}
                >
                  <div 
                    className="flex items-center flex-1 cursor-pointer"
                    onClick={() => onSelectWorkspace(workspace.id!)}
                  >
                    <div 
                      className="w-3 h-3 rounded-full mr-2" 
                      style={{ backgroundColor: workspace.color }}
                    />
                    <span className="text-sm truncate">{workspace.name}</span>
                  </div>
                  
                  <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditing(workspace);
                      }}
                      className="p-1 text-gray-500 hover:text-blue-600 rounded-full hover:bg-gray-200"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteWorkspace(workspace.id!);
                      }}
                      className="p-1 text-gray-500 hover:text-red-500 rounded-full hover:bg-gray-200"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-3 text-gray-500 text-sm">
                {searchQuery ? 'No matching workspaces' : 'No workspaces yet'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkspaceManager; 