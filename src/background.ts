// In background.ts
import { db } from './storage/db';

// Listen for extension icon clicks
chrome.action.onClicked.addListener(() => {
  // Check if a popup window is already open
  chrome.windows.getAll({ populate: true }, (windows) => {
    const existingPopup = windows.find(window => 
      window.type === 'popup' && 
      window.tabs && 
      window.tabs[0] && 
      window.tabs[0].url && 
      window.tabs[0].url.includes(chrome.runtime.id)
    );

    if (existingPopup) {
      // Focus the existing popup
      chrome.windows.update(existingPopup.id!, { focused: true });
    } else {
      // Create a new popup window
      chrome.windows.create({
        url: chrome.runtime.getURL('popup.html'),
        type: 'popup',
        width: 800,
        height: 600,
        left: (screen.width / 2) - 400, // Center the window
        top: (screen.height / 2) - 300
      });
    }
  });
});

console.log('Background script loaded');

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);
  
  if (message.type === 'TEXT_SELECTION_CHANGED') {
    // Forward the message to the popup if it's open
    chrome.runtime.sendMessage(message).catch(() => {
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