// In background.ts
import { db } from './storage/db';

console.log('Background script loaded');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request);
  
  if (request.type === 'TEXT_SELECTION_CHANGED') {
    // Forward the message to the popup if it's open
    chrome.runtime.sendMessage(request).catch(() => {
      // Ignore errors when popup is not open
    });
  }
  
  return true;
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.type) {
    case 'SAVE_HIGHLIGHT':
      db.highlights.add(request.highlight).then((id) => {
        console.log('Highlight saved with ID:', id);
        sendResponse({ success: true, id });
      }).catch((error) => {
        console.error('Error saving highlight:', error);
        sendResponse({ success: false, error });
      });
      return true;

    case 'GET_HIGHLIGHTS':
      db.highlights.where('url').equals(sender.tab?.url || '').toArray().then(highlights => {
        sendResponse({ highlights });
      }).catch((error) => {
        console.error('Error getting highlights:', error);
        sendResponse({ success: false, error });
      });
      return true;

    case 'REMOVE_HIGHLIGHT':
      db.highlights.delete(request.highlightId).then(() => {
        sendResponse({ success: true });
      }).catch((error) => {
        console.error('Error removing highlight:', error);
        sendResponse({ success: false, error });
      });
      return true;
  }
  return true;
});