// src/services/debugService.ts
export const debugLog = (message: string, data?: any) => {
    console.log(`[Mindstack] ${message}`, data || '');
  };
  
  export const debugError = (message: string, error?: any) => {
    console.error(`[Mindstack] ${message}`, error || '');
  };