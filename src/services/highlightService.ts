// src/services/highlightService.ts
import { debugLog, debugError } from './debugService';
import type { Highlight } from '../storage/db';

export class HighlightService {
  private static generateHighlightId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  static createHighlight(selection: Selection, color: string, note?: string): Promise<Highlight | null> {
    return new Promise((resolve) => {
      if (!selection || selection.isCollapsed) {
        debugLog('No valid selection for highlighting');
        resolve(null);
        return;
      }

      try {
        const range = selection.getRangeAt(0);
        const text = selection.toString().trim();
        
        if (!text) {
          debugLog('Empty text selection');
          resolve(null);
          return;
        }

        const highlight: Highlight = {
          id: this.generateHighlightId(),
          text,
          url: window.location.href,
          pageTitle: document.title,
          color,
          note,
          timestamp: new Date()
        };

        const span = document.createElement('span');
        span.className = 'research-highlight';
        span.dataset.highlightId = highlight.id;
        span.style.backgroundColor = color;
        
        if (note) {
          span.dataset.note = note;
          span.title = note;
        }

        // Add hover effect
        span.addEventListener('mouseenter', () => {
          span.style.opacity = '0.8';
        });

        span.addEventListener('mouseleave', () => {
          span.style.opacity = '1';
        });

        // Add click handler for notes
        span.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          if (note) {
            chrome.runtime.sendMessage({
              type: 'SHOW_NOTE',
              highlightId: highlight.id,
              note: note
            });
          }
        });

        range.surroundContents(span);
        selection.removeAllRanges();

        // Save highlight to storage
        chrome.runtime.sendMessage(
          { type: 'SAVE_HIGHLIGHT', highlight },
          (response) => {
            if (response?.success) {
              debugLog('Highlight saved successfully:', highlight);
              resolve(highlight);
            } else {
              debugError('Failed to save highlight:', response?.error);
              resolve(null);
            }
          }
        );
      } catch (error) {
        debugError('Error creating highlight:', error);
        resolve(null);
      }
    });
  }

  static restoreHighlights(): Promise<void> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'GET_HIGHLIGHTS', url: window.location.href },
        (response) => {
          if (response?.highlights) {
            response.highlights.forEach((highlight: Highlight) => {
              this.restoreSingleHighlight(highlight);
            });
          }
          resolve();
        }
      );
    });
  }

  private static restoreSingleHighlight(highlight: Highlight): void {
    if (!highlight.text) return;

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null
    );

    let node: Node | null;
    while ((node = walker.nextNode())) {
      const text = node.textContent || '';
      const index = text.indexOf(highlight.text);
      
      if (index !== -1) {
        try {
          const range = document.createRange();
          range.setStart(node, index);
          range.setEnd(node, index + highlight.text.length);
          
          const span = document.createElement('span');
          span.className = 'research-highlight';
          span.dataset.highlightId = highlight.id || '';
          span.style.backgroundColor = highlight.color;
          
          if (highlight.note) {
            span.dataset.note = highlight.note;
            span.title = highlight.note;
          }

          range.surroundContents(span);
          break;
        } catch (error) {
          debugError('Error restoring highlight:', error);
        }
      }
    }
  }

  static removeHighlight(id: string): Promise<boolean> {
    return new Promise((resolve) => {
      const element = document.querySelector(`[data-highlight-id="${id}"]`);
      if (!element) {
        resolve(false);
        return;
      }

      try {
        const parent = element.parentNode;
        if (!parent) {
          resolve(false);
          return;
        }

        const textContent = element.textContent || '';
        parent.replaceChild(document.createTextNode(textContent), element);
        parent.normalize();

        chrome.runtime.sendMessage(
          { type: 'REMOVE_HIGHLIGHT', highlightId: id },
          (response) => {
            resolve(response?.success || false);
          }
        );
      } catch (error) {
        debugError('Error removing highlight:', error);
        resolve(false);
      }
    });
  }

  static updateHighlight(id: string, updates: Partial<Highlight>): Promise<boolean> {
    return new Promise((resolve) => {
      const element = document.querySelector(`[data-highlight-id="${id}"]`) as HTMLElement;
      if (!element) {
        resolve(false);
        return;
      }

      try {
        if (updates.color) {
          element.style.backgroundColor = updates.color;
        }

        if (updates.note !== undefined) {
          if (updates.note) {
            element.dataset.note = updates.note;
            element.title = updates.note;
          } else {
            delete element.dataset.note;
            element.removeAttribute('title');
          }
        }

        chrome.runtime.sendMessage(
          { type: 'UPDATE_HIGHLIGHT', highlightId: id, updates },
          (response) => {
            resolve(response?.success || false);
          }
        );
      } catch (error) {
        debugError('Error updating highlight:', error);
        resolve(false);
      }
    });
  }
}