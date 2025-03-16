import { db } from './storage/db';

export async function migrateToWorkspaces() {
  try {
    // Check if we need to migrate
    const knowledgeCount = await db.knowledge.count();
    const workspaceCount = await db.workspaces.count();
    
    if (knowledgeCount > 0 && workspaceCount === 0) {
      console.log('Migrating knowledge items to workspaces...');
      
      // Create default workspace
      const defaultWorkspaceId = await db.workspaces.add({
        name: 'Default',
        description: 'Default workspace',
        color: '#4299E1',
        createdAt: new Date(),
        lastAccessed: new Date()
      });
      
      // Update all knowledge items to use the default workspace
      await db.knowledge.toCollection().modify(item => {
        item.workspaceId = defaultWorkspaceId as number;
      });
      
      console.log('Migration complete!');
    }
  } catch (error) {
    console.error('Error during migration:', error);
  }
} 