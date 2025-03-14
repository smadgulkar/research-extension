import { isExtensionContext } from './config/config';

console.log('Content script loaded');

// Store current selection
let currentSelection: Selection | null = null;

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

// Handle text selection
document.addEventListener('mouseup', () => {
  // Get the current selection
  const selection = window.getSelection();
  currentSelection = selection;

  if (!selection || selection.isCollapsed) {
    // No text selected
    sendMessage({
      type: 'TEXT_SELECTION_CHANGED',
      text: '',
      position: null
    });
    return;
  }

  const text = selection.toString().trim();
  if (!text) return;

  // Get the position of the selected text
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  sendMessage({
    type: 'TEXT_SELECTION_CHANGED',
    text,
    position: {
      top: rect.top + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width,
      height: rect.height
    }
  });
});

// Only set up message listener if in extension context
if (isExtensionContext()) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Content script received message:', request);

    if (request.type === 'CREATE_HIGHLIGHT') {
      if (!currentSelection) {
        sendResponse({ success: false, error: 'No text selected' });
        return true;
      }

      try {
        const range = currentSelection.getRangeAt(0);
        const text = currentSelection.toString().trim();

        // Create highlight element
        const span = document.createElement('span');
        span.className = 'research-highlight';
        span.style.backgroundColor = request.color || 'rgba(255, 235, 59, 0.3)';
        
        // Wrap the selected text
        range.surroundContents(span);
        
        // Clear the selection
        currentSelection.removeAllRanges();
        currentSelection = null;

        // Send success response
        sendResponse({ 
          success: true, 
          highlight: {
            id: `highlight-${Date.now()}`,
            text,
            url: window.location.href,
            pageTitle: document.title,
            color: request.color,
            timestamp: new Date()
          }
        });
      } catch (error) {
        console.error('Error creating highlight:', error instanceof Error ? error.message : 'Unknown error');
        sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    return true;
  });
}

// Add highlight styles
const style = document.createElement('style');
style.textContent = `
  .research-highlight {
    background-color: rgba(255, 235, 59, 0.3);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .research-highlight:hover {
    background-color: rgba(255, 235, 59, 0.5);
  }
`;
document.head.appendChild(style);

// Add this listener to handle selected text requests
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_SELECTED_TEXT') {
    const selectedText = window.getSelection()?.toString() || '';
    sendResponse({ selectedText });
  }
  return true;
});