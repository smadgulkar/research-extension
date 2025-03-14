// src/services/debugService.ts
export const debugLog = (message: string, data?: any) => {
    console.log(`[Research Assistant] ${message}`, data || '');
  };
  
  export const debugError = (message: string, error?: any) => {
    console.error(`[Research Assistant] ${message}`, error || '');
  };