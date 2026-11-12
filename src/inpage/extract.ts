/**
 * Runs inside the web page via chrome.scripting.executeScript, so it must be
 * self-contained: no imports, no references to module scope, and no async/await
 * (the es6 TypeScript target would pull in a module-level helper).
 */
export interface ExtractedPage {
  content: string;
  metadata: { title: string; url: string; description: string };
  headings: string[];
  /** Text the user has selected on the page, if any. */
  selection: string;
  wordCount: number;
  /** Rough guess that this is something worth reading (an article, doc or post). */
  isArticle: boolean;
}

export function extractPage(): ExtractedPage {
  const article = document.querySelector('article');
  const main = document.querySelector('main');
  const root = article || main || document.body;
  const content = (root && root.textContent) || '';
  const meta = document.querySelector('meta[name="description"]');
  const description = (meta && meta.getAttribute('content')) || '';
  const headings = Array.prototype.slice
    .call(document.querySelectorAll('h1, h2'), 0, 12)
    .map((h: Element) => (h.textContent || '').trim())
    .filter((t: string) => t.length > 0 && t.length < 200);

  // Count words in paragraphs, so menus and footers don't make a page look long.
  let paragraphWords = 0;
  const paragraphs = root ? root.querySelectorAll('p') : [];
  for (let i = 0; i < paragraphs.length; i++) {
    paragraphWords += ((paragraphs[i].textContent || '').match(/\S+/g) || []).length;
  }
  const wordCount = (content.match(/\S+/g) || []).length;

  return {
    content,
    metadata: { title: document.title, url: location.href, description },
    headings,
    selection: String(window.getSelection() || '').slice(0, 20000),
    wordCount,
    isArticle: paragraphWords >= 250 || (!!article && wordCount >= 250),
  };
}
