// src/config/config.ts
export const isExtensionContext = (): boolean => {
  return typeof chrome !== 'undefined' && 
         typeof chrome.runtime !== 'undefined' && 
         typeof chrome.runtime.id === 'string';
};