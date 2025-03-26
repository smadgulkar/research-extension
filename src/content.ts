import { isExtensionContext } from './config/config';

console.log('Content script loaded');

// Safe message sending function
const sendMessage = (message: any) => {
  if (!isExtensionContext()) {
    console.error('Not in extension context');
    return;
  }
  
  try {
    chrome.runtime.sendMessage(message);
  } catch (error) {
    console.error('Error sending message:', error instanceof Error ? error.message : 'Unknown error');
  }
};

// Only set up message listener if in extension context
if (isExtensionContext()) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Content script received message:', request);
    return true;
  });
}