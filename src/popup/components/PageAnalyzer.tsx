import React, { useState, useEffect } from 'react';
import { db } from '@/storage/db';
import type { Page } from '@/types/models';
import type { Settings } from '@/storage/db';
import WorkspaceManager from './WorkspaceManager';

interface PageAnalyzerProps {
  settings: Settings;
  onAnalysisComplete: (page: Page) => void;
}

const PageAnalyzer: React.FC<PageAnalyzerProps> = ({ settings, onAnalysisComplete }) => {
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<number | null>(null);
  
  useEffect(() => {
    // Initialize with default workspace
    const initializeDefaultWorkspace = async () => {
      try {
        const defaultWorkspace = await db.workspaces.where('name').equals('Default').first();
        if (defaultWorkspace?.id) {
          setSelectedWorkspaceId(defaultWorkspace.id);
        }
      } catch (error) {
        console.error('Error initializing default workspace:', error);
      }
    };
    
    initializeDefaultWorkspace();
  }, []);
  
  return (
    <WorkspaceManager
      onSelectWorkspace={setSelectedWorkspaceId}
      selectedWorkspaceId={selectedWorkspaceId}
    />
  );
};

export default PageAnalyzer; 