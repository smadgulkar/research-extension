#!/usr/bin/env node
/**
 * Generate real screenshots of the extension for the landing page, README and store listings.
 *
 * Drives the actual popup (E2E build) against local article pages with mocked AI replies,
 * captures the UI, then composes each capture onto a captioned 1280x800 canvas (the size
 * Chrome Web Store, Edge Add-ons and AMO accept).
 *
 * Usage: npm run screenshots      -> docs/screenshots/*.png
 */

const puppeteer = require('puppeteer');
const http = require('http');
const path = require('path');
const fs = require('fs');

const EXTENSION_PATH = path.resolve(__dirname, '../dist-e2e');
const OUT_DIR = path.resolve(__dirname, '../docs/screenshots');

const ARTICLES = {
  '/vector-databases': {
    title: "A Beginner's Guide to Vector Databases",
    body: 'Vector databases store embeddings, numeric representations of text, images or audio, and find the items most similar to a query. ',
    analysis: {
      summary:
        'Vector databases index embeddings so applications can search by meaning rather than exact keywords. The article explains how approximate nearest-neighbour indexes such as HNSW trade a little accuracy for large speed gains, and why that trade-off makes semantic search practical at scale. It compares managed services with self-hosted options and closes with guidance on choosing chunk sizes and distance metrics for retrieval-augmented generation.',
      keyPoints: [
        'Embeddings turn text, images and audio into vectors that capture meaning',
        'Approximate nearest-neighbour indexes (e.g. HNSW) make similarity search fast at scale',
        'Chunk size and distance metric matter more than which database you pick',
        'Managed services trade cost for less operational work than self-hosting',
      ],
      topics: ['Vector databases', 'Embeddings', 'Semantic search', 'RAG', 'Machine learning'],
      sentiment: 'neutral',
    },
  },
  '/four-day-week': {
    title: 'The Four-Day Week: What 61 Companies Learned',
    body: 'Sixty-one companies moved to a four-day week for six months while keeping pay unchanged. ',
    analysis: {
      summary:
        'A six-month trial across 61 companies found that most kept the four-day week afterwards, citing stable revenue and lower staff turnover.',
      keyPoints: ['Most participating companies kept the policy', 'Revenue stayed broadly flat', 'Resignations fell'],
      topics: ['Work', 'Productivity', 'Management'],
      sentiment: 'positive',
    },
  },
  '/rag-pipelines': {
    title: 'Building a RAG Pipeline With Vector Search',
    body: 'Retrieval-augmented generation pairs a language model with a vector search index over your own documents. ',
    analysis: {
      summary: 'A RAG pipeline retrieves relevant chunks with vector search and passes them to the model as context.',
      keyPoints: [
        'Vector search retrieves the chunks most similar to the question',
        'Embedding quality limits retrieval quality',
        'Re-ranking the top results improves answers',
      ],
      topics: ['RAG', 'Vector search', 'Embeddings'],
      sentiment: 'neutral',
    },
  },
  '/tidal-energy': {
    title: 'How Tidal Turbines Turn Ocean Currents Into Power',
    body: 'Tidal turbines sit on the seabed and turn as the tide flows in and out, generating electricity on a predictable schedule. ',
    analysis: {
      summary: 'Tidal turbines generate electricity on a schedule that can be predicted decades ahead, unlike wind or solar.',
      keyPoints: ['Tides are fully predictable', 'Turbines sit on the seabed', 'Costs are still high'],
      topics: ['Energy', 'Renewables', 'Oceans'],
      sentiment: 'positive',
    },
  },
};

// Chrome Web Store accepts at most 5 screenshots: upload 1-5 there; 6 is extra for AMO.
const SHOTS = [
  { file: '1-ask.png', caption: 'Ask everything you\'ve read', sub: 'Answers come from your own saved reading, not the open web.' },
  { file: '2-summary.png', caption: 'Distill any page in one click', sub: 'Summaries from GPT, Claude or Gemini, using your own API key.' },
  { file: '3-key-points.png', caption: 'Key points, topics and sentiment', sub: 'Get the substance of long articles, docs and papers in seconds.' },
  { file: '4-history.png', caption: 'A knowledge base that builds itself', sub: 'Every page you analyze is saved, searchable and organized into workspaces.' },
  { file: '5-export.png', caption: 'Export to Obsidian, Notion and more', sub: 'Markdown, JSON, HTML, Obsidian with frontmatter, or straight into a Notion database.' },
  { file: '6-settings.png', caption: 'Your AI, your key, your data', sub: 'No account and no servers. Requests go straight from your browser to the provider you choose.' },
];

const QUESTION = 'What matters most when choosing a vector database?';
const ANSWER =
  'How you prepare data matters more than which database you pick: chunk size and the distance metric ' +
  'drive retrieval quality [1]. HNSW indexes keep search fast at scale [1].';

const UNSAVED_ARTICLE = {
  title: 'Embeddings and Vector Search: A Practical Guide',
  body: 'Good embeddings put similar ideas close together, which is what makes vector search useful for finding related passages. ',
};

function articleHtml({ title, body }) {
  const para = `<p>${body.repeat(6)}</p>`;
  return `<!doctype html><html><head><title>${title}</title><style>
    body{margin:0;background:#fafaf9;color:#1c1917;font:19px/1.7 Georgia,'Times New Roman',serif}
    header{border-bottom:1px solid #e7e5e4;background:#fff;padding:18px 0;font:600 18px system-ui,sans-serif;color:#44403c}
    header div,article{max-width:720px;margin:0 auto;padding:0 24px}
    h1{font:700 40px/1.2 system-ui,-apple-system,'Segoe UI',sans-serif;letter-spacing:-.02em;margin:48px 0 8px}
    .meta{font:15px system-ui,sans-serif;color:#78716c;margin-bottom:32px}
  </style></head><body><header><div>The Example Blog</div></header><article><h1>${title}</h1>
  <div class="meta">8 min read</div>${para.repeat(5)}</article></body></html>`;
}

async function main() {
  if (!fs.existsSync(path.join(EXTENSION_PATH, 'manifest.json'))) {
    throw new Error('Run `npm run build:e2e` first (npm run screenshots does this for you).');
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const server = http.createServer((req, res) => {
    const article = req.url === '/embeddings-guide' ? UNSAVED_ARTICLE : ARTICLES[req.url] || ARTICLES['/tidal-energy'];
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(articleHtml(article));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  // Show a realistic address in the screenshots instead of 127.0.0.1:port.
  const base = 'http://blog.example.com';

  const browser = await puppeteer.launch({
    headless: !process.env.HEADFUL,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
      `--host-resolver-rules=MAP blog.example.com 127.0.0.1:${server.address().port}`,
    ],
  });

  try {
    const worker = await browser.waitForTarget(
      (t) => t.type() === 'service_worker' && t.url().startsWith('chrome-extension://'),
      { timeout: 20000 }
    );
    const extensionId = new URL(worker.url()).host;

    const page = await browser.newPage();
    await page.setViewport({ width: 400, height: 600, deviceScaleFactor: 2 });
    await page.setRequestInterception(true);
    page.on('dialog', (d) => d.dismiss());
    page.on('request', (req) => {
      const url = req.url();
      const json = (body) => req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      if (url.startsWith('https://api.openai.com/v1/models')) {
        return json({ data: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'o3-mini'].map((id, i) => ({ id, created: 10 - i })) });
      }
      if (url.startsWith('https://api.openai.com/v1/chat/completions')) {
        const prompt = req.postData() || '';
        // Analysis prompts include the URL; knowledge prompts include the title.
        const key = Object.keys(ARTICLES).find((k) => prompt.includes(k) || prompt.includes(ARTICLES[k].title)) || '/tidal-energy';
        const a = ARTICLES[key].analysis;
        if (prompt.includes('Answer the question using only')) return json({ choices: [{ message: { content: ANSWER } }] });
        const content = prompt.includes('key knowledge points')
          ? JSON.stringify(a.keyPoints.slice(0, 3).map((k) => ({ topic: a.topics[0], content: k, confidence: 0.9 })))
          : JSON.stringify(a);
        return json({ choices: [{ message: { content } }] });
      }
      return req.continue();
    });

    const clickText = async (text) => {
      await page.waitForFunction(
        (t) => [...document.querySelectorAll('button')].some((b) => b.innerText.trim().includes(t)),
        { timeout: 10000 },
        text
      );
      await page.evaluate((t) => [...document.querySelectorAll('button')].find((b) => b.innerText.trim().includes(t)).click(), text);
    };
    const closeResults = () =>
      page.evaluate(() => {
        const h2 = [...document.querySelectorAll('h2')].find((h) => h.innerText.includes('Analysis Results'));
        h2.parentElement.querySelector('button').click();
      });
    const settle = () => new Promise((r) => setTimeout(r, 400));
    const captures = {};

    await page.goto(`chrome-extension://${extensionId}/popup.html`, { waitUntil: 'networkidle0' });
    await clickText('Skip');
    await page.waitForSelector('[aria-label="Settings"]');

    // Settings with a fetched model list.
    await page.click('[aria-label="Settings"]');
    // New installs default to Gemini; the mocks below serve OpenAI.
    await page.waitForSelector('select:has(option[value="anthropic"])');
    await page.select('select:has(option[value="anthropic"])', 'openai');
    await page.type('input[type="password"]', 'sk-xxxxxxxxxxxxxxxxxxxxxxxx');
    await page.waitForSelector('option[value="gpt-4o"]');
    await settle();
    captures['6-settings.png'] = await page.screenshot();
    await clickText('Save Settings');

    // Analyze four articles; the last one is the one shown in the results shots.
    const order = ['/tidal-energy', '/rag-pipelines', '/four-day-week', '/vector-databases'];
    for (const [i, route] of order.entries()) {
      await page.evaluate(async (url) => {
        const win = await chrome.windows.getCurrent();
        const tab = await chrome.tabs.create({ url, active: true, windowId: win.id });
        await new Promise((resolve) => {
          const l = (id, info) => {
            if (id === tab.id && info.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(l);
              resolve();
            }
          };
          chrome.tabs.onUpdated.addListener(l);
        });
      }, base + route);
      await page.reload({ waitUntil: 'networkidle0' });
      await page.waitForFunction((t) => document.body.innerText.includes(t), { timeout: 10000 }, ARTICLES[route].title);
      await page.bringToFront();
      await clickText('ANALYZE PAGE');
      await page.waitForFunction(() => document.body.innerText.includes('Analysis Results'), { timeout: 15000 });
      if (i < order.length - 1) await closeResults();
    }

    await settle();
    captures['2-summary.png'] = await page.screenshot();
    await clickText('Key Points');
    await settle();
    captures['3-key-points.png'] = await page.screenshot();
    await clickText('Markdown');
    await settle();
    captures['5-export.png'] = await page.screenshot();
    await page.keyboard.press('Escape');
    await closeResults();
    await clickText('History');
    await page.waitForFunction((t) => document.body.innerText.includes(t), { timeout: 5000 }, "Beginner's Guide");
    await settle();
    captures['4-history.png'] = await page.screenshot();

    // Knowledge Q&A across everything saved.
    await clickText('Knowledge');
    await page.waitForSelector('input[placeholder="Search or ask a question..."]');
    await page.type('input[placeholder="Search or ask a question..."]', QUESTION);
    await page.keyboard.press('Enter');
    await page.waitForSelector('[data-testid="answer-sources"] a', { timeout: 15000 });
    // Scroll so the answer and its source links are in view.
    await page.evaluate(() => document.querySelector('[data-testid="answer-sources"]').scrollIntoView({ block: 'end' }));
    // Show the start of the question, without a caret.
    await page.evaluate(() => {
      const i = document.querySelector('input[placeholder="Search or ask a question..."]');
      i.setSelectionRange(0, 0); i.scrollLeft = 0; i.blur();
    });
    await settle();
    captures['1-ask.png'] = await page.screenshot();

    // On-page related reading (opt-in suggestions) on an article that isn't saved yet.
    await page.evaluate(() =>
      chrome.storage.local.set({ suggestions: { enabled: true, related: true, offerSave: true, mutedSites: [] } })
    );
    const site = await browser.newPage();
    await site.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
    await site.goto(base + '/embeddings-guide', { waitUntil: 'networkidle0' });
    const agentHas = (t) =>
      site.waitForFunction((x) => (document.querySelector('#mindstack-agent')?.shadowRoot?.textContent || '').includes(x), { timeout: 15000 }, t);
    await agentHas('related page');
    await site.evaluate(() => {
      const root = document.querySelector('#mindstack-agent').shadowRoot;
      [...root.querySelectorAll('button')].find((b) => b.textContent.includes('related page')).click();
    });
    await agentHas('Related from your reading');
    await settle();
    await site.screenshot({ path: path.join(OUT_DIR, 'related-on-page.png') });
    console.log('wrote', path.join('docs/screenshots', 'related-on-page.png'));
    await site.close();

    // Compose each capture onto a captioned 1280x800 canvas.
    const canvas = await browser.newPage();
    await canvas.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
    for (const shot of SHOTS) {
      const img = captures[shot.file].toString('base64');
      await canvas.setContent(`<!doctype html><html><head><style>
        body{margin:0;width:1280px;height:800px;display:flex;align-items:center;gap:72px;padding:0 96px;box-sizing:border-box;
          background:linear-gradient(135deg,#eef2ff 0%,#e0e7ff 45%,#f5f3ff 100%);font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
        .text{flex:1;color:#1e1b4b}
        .brand{font-size:20px;font-weight:600;color:#4361ee;margin-bottom:20px}
        h1{font-size:52px;line-height:1.1;margin:0 0 24px;font-weight:750;letter-spacing:-0.02em}
        p{font-size:24px;line-height:1.45;color:#3f3f68;margin:0}
        .frame{width:400px;height:600px;border-radius:18px;overflow:hidden;box-shadow:0 30px 60px -12px rgba(30,27,75,.35),0 0 0 1px rgba(30,27,75,.08);background:#fff;flex:none}
        .frame img{width:400px;height:600px;display:block}
      </style></head><body><div class="text"><div class="brand">Mindstack</div><h1>${shot.caption}</h1><p>${shot.sub}</p></div>
      <div class="frame"><img src="data:image/png;base64,${img}"></div></body></html>`);
      await canvas.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
      await canvas.screenshot({ path: path.join(OUT_DIR, shot.file) });
      fs.writeFileSync(path.join(OUT_DIR, `popup-${shot.file}`), captures[shot.file]);
      console.log('wrote', path.join('docs/screenshots', shot.file));
    }
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
