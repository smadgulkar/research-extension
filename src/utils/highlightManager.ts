// highlightManager.ts
export interface Highlight {
  id: string;
  text: string;
  url: string;
  color: string;
  note?: string;
  timestamp: Date;
}

export class HighlightManager {
  private static generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  static createHighlight(selection: Selection, color: string = '#FFEB3B', note?: string): Highlight | null {
    const range = selection.getRangeAt(0);
    const text = selection.toString().trim();
    
    if (!text) return null;

    const highlight: Highlight = {
      id: this.generateId(),
      text,
      url: window.location.href,
      color: color,
      note: note,
      timestamp: new Date()
    };

    const span = document.createElement('span');
    span.className = 'research-highlight';
    span.dataset.highlightId = highlight.id;
    span.style.backgroundColor = highlight.color;
    
    range.surroundContents(span);
    return highlight;
  }

  static removeHighlight(id: string) {
    const span = document.querySelector(`[data-highlight-id="${id}"]`) as HTMLSpanElement | null;
    if (span) {
      const parent = span.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(span.textContent || ''), span);
        parent.normalize();
      }
    }
  }

  static restoreHighlights(highlights: Highlight[]) {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null
    );

    highlights.forEach(highlight => {
      let node: Node | null;
      while (node = walker.nextNode()) {
        if (node.textContent?.includes(highlight.text)) {
          const range = document.createRange();
          range.setStart(node, node.textContent.indexOf(highlight.text));
          range.setEnd(node, node.textContent.indexOf(highlight.text) + highlight.text.length);
          
          const span = document.createElement('span');
          span.className = 'research-highlight';
          span.dataset.highlightId = highlight.id;
          span.style.backgroundColor = highlight.color;
          if (highlight.note) {
            span.dataset.note = highlight.note;
          }
          
          range.surroundContents(span);
          break;
        }
      }
    });
  }

  static updateHighlight(id: string, updates: Partial<Highlight>) {
    const span = document.querySelector(`[data-highlight-id="${id}"]`) as HTMLSpanElement | null;
    if (span) {
      if (updates.color) {
        span.style.backgroundColor = updates.color;
      }
      if (updates.note !== undefined) {
        if (updates.note) {
          span.dataset.note = updates.note;
        } else {
          delete span.dataset.note;
        }
      }
    }
  }
}