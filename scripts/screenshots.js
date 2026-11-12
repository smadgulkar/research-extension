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
  { file: '2-summary.png', caption: 'Open it. It\'s already summarized.', sub: 'Click Mindstack on any article and it is summarized and saved. No buttons to press.' },
  { file: '3-key-points.png', caption: 'Key points, and what you read before', sub: 'See the substance of long articles, plus related pages from your own reading.' },
  { file: '4-history.png', caption: 'A knowledge base that builds itself', sub: 'Every page you analyze is saved, searchable and organized into workspaces.' },
  { file: '5-export.png', caption: 'It comes to you', sub: 'Save any page with Alt+Shift+S, and get reminders of related reading as you browse.' },
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
    // Fake provider replies, used for the popup and the background worker (which saves pages).
    const mockBody = (url, prompt) => {
      if (url.startsWith('https://api.openai.com/v1/models')) {
        return { data: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'o3-mini'].map((id, i) => ({ id, created: 10 - i })) };
      }
      if (url.startsWith('https://api.openai.com/v1/chat/completions')) {
        if (prompt.includes('Answer the question using only')) return { choices: [{ message: { content: ANSWER } }] };
        const key = Object.keys(ARTICLES).find((k) => prompt.includes(k) || prompt.includes(ARTICLES[k].title)) || '/tidal-energy';
        return { choices: [{ message: { content: JSON.stringify(ARTICLES[key].analysis) } }] };
      }
      return null;
    };
    await page.setRequestInterception(true);
    page.on('dialog', (d) => d.dismiss());
    page.on('request', (req) => {
      const body = mockBody(req.url(), req.postData() || '');
      if (!body) return req.continue();
      return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
    const cdp = await worker.createCDPSession();
    cdp.on('Fetch.requestPaused', async (e) => {
      let prompt = e.request.postData || '';
      if (!prompt && e.request.postDataEntries) {
        prompt = e.request.postDataEntries.map((x) => Buffer.from(x.bytes || '', 'base64').toString()).join('');
      }
      const body = mockBody(e.request.url, prompt);
      if (!body) return cdp.send('Fetch.continueRequest', { requestId: e.requestId }).catch(() => {});
      await cdp
        .send('Fetch.fulfillRequest', {
          requestId: e.requestId,
          responseCode: 200,
          responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: '*' }],
          body: Buffer.from(JSON.stringify(body)).toString('base64'),
        })
        .catch(() => {});
    });
    await cdp.send('Fetch.enable', { patterns: [{ urlPattern: 'https://api.openai.com/*' }] });

    const clickText = async (text) => {
      await page.waitForFunction(
        (t) => [...document.querySelectorAll('button')].some((b) => b.innerText.trim().includes(t)),
        { timeout: 10000 },
        text
      );
      await page.evaluate((t) => [...document.querySelectorAll('button')].find((b) => b.innerText.trim().includes(t)).click(), text);
    };
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
      await page.waitForSelector('[data-testid="page-result"]', { timeout: 15000 });
    }

    await settle();
    captures['2-summary.png'] = await page.screenshot();
    await page.evaluate(() => document.querySelector('main').scrollTo(0, document.querySelector('main').scrollHeight));
    await settle();
    captures['3-key-points.png'] = await page.screenshot();

    await page.click('[aria-label="Settings"]');
    await page.waitForSelector('[data-testid="summary-prefs"]');
    await page.evaluate(() => document.querySelector('[data-testid="summary-prefs"]').scrollIntoView({ block: 'start' }));
    await settle();
    captures['5-export.png'] = await page.screenshot();
    await clickText('Save Settings');

    await clickText('Library');
    await page.waitForFunction((t) => document.body.innerText.includes(t), { timeout: 5000 }, "Beginner's Guide");
    await settle();
    captures['4-history.png'] = await page.screenshot();

    // Knowledge Q&A across everything saved.
    await clickText('Ask');
    const askInput = 'input[placeholder="Ask about anything you\'ve saved..."]';
    await page.waitForSelector(askInput);
    await page.type(askInput, QUESTION);
    await page.keyboard.press('Enter');
    await page.waitForSelector('[data-testid="answer-sources"] a', { timeout: 15000 });
    // Scroll so the answer and its source links are in view.
    await page.evaluate(() => document.querySelector('[data-testid="answer-sources"]').scrollIntoView({ block: 'end' }));
    // Show the start of the question, without a caret.
    await page.evaluate(() => {
      const i = document.querySelector('input[placeholder^="Ask about"]');
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
