/**
 * E2E tests for Mindstack (formerly Research Assistant).
 *
 * Runs the real extension in headless Chrome against a local fixture page.
 * All AI provider APIs are mocked via request interception, so no API keys
 * are needed and nothing leaves the machine.
 *
 * Uses the E2E build (dist-e2e), which adds host permissions for 127.0.0.1 and
 * the provider APIs. That stands in for the activeTab grant a real user gets by
 * clicking the toolbar icon. The E2E build is never packaged for release.
 *
 * Run: npm run test:e2e   (set HEADFUL=1 to watch)
 */

const puppeteer = require('puppeteer');
const http = require('http');
const path = require('path');

const EXTENSION_PATH = path.resolve(__dirname, '../../dist-e2e');
const FIXTURE_TITLE = 'Fixture Article About Tidal Energy';

const ANALYSIS = {
  summary: 'MOCK_SUMMARY tidal turbines generate predictable power.',
  keyPoints: ['Tides are predictable', 'Turbines sit on the seabed'],
  topics: ['energy', 'oceans'],
  sentiment: 'positive',
};
const KNOWLEDGE = [{ topic: 'tidal energy', content: 'Tides are predictable.', confidence: 0.9 }];

let server;
let fixtureUrl;
let browser;
let extensionId;

const FIXTURE_HTML = `<!doctype html><html><head><title>${FIXTURE_TITLE}</title>
<meta name="description" content="A test article"></head><body><article>
<h1>Tidal energy</h1><p>${'Tidal turbines convert the movement of tides into electricity. '.repeat(30)}</p>
</article></body></html>`;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(FIXTURE_HTML);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  fixtureUrl = `http://127.0.0.1:${server.address().port}/article.html`;
});

afterAll(async () => {
  await new Promise((r) => server.close(r));
});

beforeEach(async () => {
  // Fresh browser + temporary profile per test, so storage never leaks between tests.
  browser = await puppeteer.launch({
    headless: !process.env.HEADFUL,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
    ],
  });
  const worker = await browser.waitForTarget(
    (t) => t.type() === 'service_worker' && t.url().startsWith('chrome-extension://'),
    { timeout: 20000 }
  );
  extensionId = new URL(worker.url()).host;
});

afterEach(async () => {
  if (browser) await browser.close();
});

/** Mock every provider endpoint. Returns the list of intercepted provider requests. */
async function installProviderMocks(page) {
  const calls = [];
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const url = req.url();
    const json = (body) =>
      req.respond({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(body),
      });
    const isKnowledge = (req.postData() || '').includes('key knowledge points');
    const record = (provider) => calls.push({ provider, url, headers: req.headers(), body: req.postData() });

    if (url.startsWith('https://api.openai.com/v1/models')) {
      record('openai');
      return json({ data: [{ id: 'gpt-4o', created: 2 }, { id: 'text-embedding-3-small', created: 1 }] });
    }
    if (url.startsWith('https://api.openai.com/v1/chat/completions')) {
      record('openai');
      if ((req.postData() || '').includes('Answer the question using only')) {
        return json({ choices: [{ message: { content: 'MOCK_ANSWER: turbines sit in tidal streams [1].' } }] });
      }
      const content = JSON.stringify(isKnowledge ? KNOWLEDGE : ANALYSIS);
      return json({ choices: [{ message: { content } }] });
    }
    if (url.startsWith('https://api.anthropic.com/v1/models')) {
      record('anthropic');
      return json({ data: [{ id: 'claude-sonnet-5-5', display_name: 'Claude Sonnet 5.5', created_at: '2026-01-01T00:00:00Z' }] });
    }
    if (url.startsWith('https://api.anthropic.com/v1/messages')) {
      record('anthropic');
      // Claude often fences JSON. The analyzer must cope with that.
      const text = '```json\n' + JSON.stringify(isKnowledge ? KNOWLEDGE : ANALYSIS, null, 2) + '\n```';
      return json({ content: [{ type: 'text', text }] });
    }
    if (url.startsWith('https://generativelanguage.googleapis.com/') && url.includes('/models?')) {
      record('gemini');
      // Paid-only and non-text models come first; the free Flash model must still be the default.
      const gen = ['generateContent'];
      return json({
        models: [
          { name: 'models/gemini-4-carbon', displayName: 'Gemini 4 Carbon', supportedGenerationMethods: gen },
          { name: 'models/gemini-3.8-flash-tts', displayName: 'Gemini 3.8 Flash TTS', supportedGenerationMethods: gen },
          { name: 'models/gemini-embedding-2', displayName: 'Embedding', supportedGenerationMethods: ['embedContent'] },
          { name: 'models/gemini-3.6-flash', displayName: 'Gemini 3.6 Flash', supportedGenerationMethods: gen },
        ],
      });
    }
    if (url.startsWith('https://generativelanguage.googleapis.com/') && url.includes(':generateContent')) {
      record('gemini');
      // Prose around the JSON, as Gemini sometimes does.
      const text = 'Here is the analysis:\n' + JSON.stringify(isKnowledge ? KNOWLEDGE : ANALYSIS);
      // A thought-summary part comes first, as Gemini 3 thinking models can return.
      return json({ candidates: [{ content: { parts: [{ text: 'THOUGHT_SHOULD_BE_SKIPPED', thought: true }, { text }] } }] });
    }
    return req.continue();
  });
  return calls;
}

/** Open the popup as a tab, tracking dialogs and uncaught errors. */
async function openPopup({ mocks = true } = {}) {
  const page = await browser.newPage();
  const problems = { dialogs: [], pageErrors: [] };
  page.on('dialog', async (d) => {
    problems.dialogs.push(d.message());
    await d.dismiss();
  });
  page.on('pageerror', (e) => problems.pageErrors.push(e.message));
  if (process.env.E2E_DEBUG) {
    page.on('console', (m) => console.log(`[popup ${m.type()}]`, m.text()));
    page.on('requestfailed', (r) => console.log('[popup requestfailed]', r.url(), r.failure()?.errorText));
  }
  const calls = mocks ? await installProviderMocks(page) : [];
  await page.goto(`chrome-extension://${extensionId}/popup.html`, { waitUntil: 'networkidle0' });
  return { page, problems, calls };
}

async function bodyText(page) {
  return page.evaluate(() => document.body.innerText);
}

async function clickButtonWithText(page, text) {
  await page.waitForFunction(
    (t) => [...document.querySelectorAll('button')].some((b) => b.innerText.includes(t)),
    { timeout: 10000 },
    text
  );
  await page.evaluate((t) => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.innerText.includes(t));
    btn.click();
  }, text);
}

async function skipOnboarding(page) {
  await clickButtonWithText(page, 'Skip');
  await page.waitForSelector('[aria-label="Settings"]', { timeout: 10000 });
}

async function configureProvider(page, provider, expectedModelId) {
  await page.click('[aria-label="Settings"]');
  const providerSelect = 'select:has(option[value="anthropic"])';
  await page.waitForSelector(providerSelect);
  await page.select(providerSelect, provider);
  await page.type('input[type="password"]', `test-key-${provider}`);
  // Model list is fetched from the (mocked) provider API.
  await page.waitForSelector(`option[value="${expectedModelId}"]`, { timeout: 10000 });
  await clickButtonWithText(page, 'Save Settings');
}

/**
 * Make the fixture page the active tab in the popup's window, then reload the
 * popup so it reads that tab, the same way it does when opened from the toolbar.
 */
async function pointPopupAtFixture(page) {
  await page.evaluate(async (url) => {
    const win = await chrome.windows.getCurrent();
    const tab = await chrome.tabs.create({ url, active: true, windowId: win.id });
    await new Promise((resolve) => {
      const listener = (id, info) => {
        if (id === tab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });
  }, fixtureUrl);
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForFunction((t) => document.body.innerText.includes(t), { timeout: 10000 }, FIXTURE_TITLE);
  // The popup has captured the fixture tab's content; put it back in the foreground,
  // as a real popup would be, so rendering isn't throttled as a background tab.
  await page.bringToFront();
}

describe('Loading', () => {
  test('popup opens without uncaught errors', async () => {
    const { page, problems } = await openPopup();
    expect(await page.title()).toBeDefined();
    expect(problems.pageErrors).toEqual([]);
  });

  test('onboarding shows on first launch and stays dismissed', async () => {
    const { page } = await openPopup();
    expect(await bodyText(page)).toMatch(/Skip/);
    await skipOnboarding(page);
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('[aria-label="Settings"]');
    expect(await bodyText(page)).not.toMatch(/Skip tour/);
  });
});

describe('Free tier (paid tier disabled)', () => {
  test('no upgrade, Pro, or Premium prompts anywhere', async () => {
    const { page } = await openPopup();
    await skipOnboarding(page);
    const main = await bodyText(page);
    await page.click('[aria-label="Settings"]');
    const settings = await bodyText(page);
    await clickButtonWithText(page, 'Integrations');
    const integrations = await bodyText(page);
    for (const text of [main, settings, integrations]) {
      expect(text).not.toMatch(/Upgrade|Premium|\bPRO\b/);
    }
  });

  test('Notion connect form is available without a paywall', async () => {
    const { page } = await openPopup();
    await skipOnboarding(page);
    await page.click('[aria-label="Settings"]');
    await clickButtonWithText(page, 'Integrations');
    expect(await bodyText(page)).toMatch(/Notion/);
    expect(await bodyText(page)).not.toMatch(/Upgrade to Premium/);
  });
});

describe('Anthropic requests', () => {
  test('model list and messages include the browser-access header', async () => {
    const { page, calls, problems } = await openPopup();
    await skipOnboarding(page);
    await configureProvider(page, 'anthropic', 'claude-sonnet-5-5');
    await pointPopupAtFixture(page);
    await clickButtonWithText(page, 'ANALYZE PAGE');
    await page.waitForFunction(() => document.body.innerText.includes('MOCK_SUMMARY'), { timeout: 15000 });

    const anthropic = calls.filter((c) => c.provider === 'anthropic');
    expect(anthropic.some((c) => c.url.includes('/v1/models'))).toBe(true);
    expect(anthropic.some((c) => c.url.includes('/v1/messages'))).toBe(true);
    for (const c of anthropic) {
      expect(c.headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    }
    expect(problems.dialogs).toEqual([]);
  });
});

describe.each([
  ['openai', 'gpt-4o', 'plain JSON'],
  ['anthropic', 'claude-sonnet-5-5', 'JSON in ```json fences'],
  ['gemini', 'gemini-3.6-flash', 'JSON after prose'],
])('Analyze flow with %s', (provider, modelId, format) => {
  test(`summarizes the page and saves it (${format})`, async () => {
    const { page, calls, problems } = await openPopup();
    await skipOnboarding(page);
    await configureProvider(page, provider, modelId);
    await pointPopupAtFixture(page);
    await clickButtonWithText(page, 'ANALYZE PAGE');

    await page.waitForFunction(() => document.body.innerText.includes('MOCK_SUMMARY'), { timeout: 15000 });
    expect(await bodyText(page)).not.toContain('Error analyzing content');
    await clickButtonWithText(page, 'Key Points');
    await page.waitForFunction(() => document.body.innerText.includes('Tides are predictable'), { timeout: 5000 });
    expect(problems.dialogs).toEqual([]);

    // The request used the model picked from the fetched list and contained the page text.
    const analyzeCall = calls.find(
      (c) => c.provider === provider && c.body && c.body.includes('Analyze the following web content')
    );
    expect(analyzeCall).toBeDefined();
    expect(analyzeCall.body + analyzeCall.url).toContain(modelId);
    expect(analyzeCall.body).toContain('Tidal turbines convert');

    // The page was saved to IndexedDB.
    const saved = await page.evaluate(
      () =>
        new Promise((resolve, reject) => {
          const open = indexedDB.open('ResearchDB');
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const req = open.result.transaction('pages').objectStore('pages').getAll();
            req.onsuccess = () => resolve(req.result.map((p) => p.title));
            req.onerror = () => reject(req.error);
          };
        })
    );
    expect(saved).toContain(FIXTURE_TITLE);
  });
});

describe('Free Gemini key', () => {
  test('new installs default to Gemini and show the free-key hint until a key is entered', async () => {
    const { page, problems } = await openPopup();
    await skipOnboarding(page);
    await page.click('[aria-label="Settings"]');
    const providerSelect = 'select:has(option[value="anthropic"])';
    await page.waitForSelector(providerSelect);
    expect(await page.$eval(providerSelect, (s) => s.value)).toBe('gemini');
    await page.waitForSelector('[data-testid="free-key-hint"]');
    expect(await page.$eval('[data-testid="free-key-hint"] a', (a) => a.href)).toBe('https://aistudio.google.com/app/apikey');

    // Another provider offers a one-click switch back to Gemini.
    await page.select(providerSelect, 'openai');
    await page.waitForSelector('[data-testid="free-key-switch"] button');
    await page.click('[data-testid="free-key-switch"] button');
    await page.waitForSelector('[data-testid="free-key-hint"]');
    expect(await page.$eval(providerSelect, (s) => s.value)).toBe('gemini');

    // Hidden once a key is typed.
    await page.type('input[type="password"]', 'test-key-gemini');
    await page.waitForFunction(() => !document.querySelector('[data-testid="free-key-hint"]'));
    expect(problems.pageErrors).toEqual([]);
  });

  test('auto-picks a free Flash model, never paid Gemini 4 or non-text models', async () => {
    const { page } = await openPopup();
    await skipOnboarding(page);
    await page.click('[aria-label="Settings"]');
    const providerSelect = 'select:has(option[value="anthropic"])';
    await page.waitForSelector(providerSelect);
    // Start from another provider so switching to Gemini picks from the fetched list.
    await page.select(providerSelect, 'openai');
    await page.type('input[type="password"]', 'test-key');
    await page.waitForSelector('option[value="gpt-4o"]');
    await page.select(providerSelect, 'gemini');
    await page.waitForSelector('option[value="gemini-3.6-flash"]');
    const modelSelect = 'select:has(option[value="gemini-3.6-flash"])';
    const options = await page.$$eval(`${modelSelect} option`, (os) => os.map((o) => o.value));
    expect(options[0]).toBe('gemini-3.6-flash');
    expect(options).not.toContain('gemini-3.8-flash-tts');
    expect(options).not.toContain('gemini-embedding-2');
    expect(await page.$eval(modelSelect, (s) => s.value)).toBe('gemini-3.6-flash');
  });
});

describe('Knowledge Q&A', () => {
  /** Write pages and knowledge straight into IndexedDB, then reload so the popup sees them. */
  async function seedKnowledge(page, fillerCount) {
    await page.evaluate(
      (fillerCount) =>
        new Promise((resolve, reject) => {
          const open = indexedDB.open('ResearchDB');
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const tx = open.result.transaction(['pages', 'knowledge'], 'readwrite');
            const pages = tx.objectStore('pages');
            const knowledge = tx.objectStore('knowledge');
            const addPage = (title, url) =>
              new Promise((res) => {
                pages.add({ title, url, content: '', summary: '', keyPoints: [], topics: [], keywords: [], sentiment: '', timestamp: new Date() }).onsuccess = (e) => res(e.target.result);
              });
            (async () => {
              const tidal = await addPage('Tidal energy explained', 'https://example.org/tidal');
              const bread = await addPage('Sourdough basics', 'https://example.org/bread');
              const note = (topic, content, pageId) =>
                knowledge.add({ topic, content, sourcePages: [pageId], tags: [], confidence: 0.9, lastUpdated: new Date(), workspaceId: 1 });
              note('Tidal turbines', 'Tidal turbines generate electricity from predictable tidal currents.', tidal);
              note('Sourdough starter', 'A sourdough starter is flour and water fermented by wild yeast.', bread);
              for (let i = 0; i < fillerCount; i++) note(`Filler topic ${i}`, `Unrelated filler note number ${i} about gardening.`, bread);
            })();
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
          };
        }),
      fillerCount
    );
    await page.reload({ waitUntil: 'networkidle0' });
  }

  test('sends only matching notes in one request and cites the source page', async () => {
    const { page, calls, problems } = await openPopup();
    await skipOnboarding(page);
    await configureProvider(page, 'openai', 'gpt-4o');
    await seedKnowledge(page, 200);

    await clickButtonWithText(page, 'Knowledge');
    const input = 'input[placeholder="Search or ask a question..."]';
    await page.waitForSelector(input);
    await page.type(input, 'How do tidal turbines make electricity?');
    await page.keyboard.press('Enter');
    await page.waitForSelector('[data-testid="answer-sources"] a', { timeout: 15000 });

    const qaCalls = calls.filter((c) => c.body && c.body.includes('Answer the question using only'));
    expect(qaCalls).toHaveLength(1);
    // The relevant note went to the AI; the 201 unrelated ones did not.
    expect(qaCalls[0].body).toContain('predictable tidal currents');
    expect(qaCalls[0].body).not.toContain('sourdough starter');
    expect(qaCalls[0].body).not.toContain('Unrelated filler');
    // No second AI call to pick relevant items (the old, unscalable approach).
    expect(calls.some((c) => c.body && c.body.includes('Find the most relevant items'))).toBe(false);

    expect(await bodyText(page)).toContain('MOCK_ANSWER');
    const links = await page.$$eval('[data-testid="answer-sources"] a', (as) => as.map((a) => [a.textContent, a.href]));
    expect(links).toEqual([['Tidal energy explained', 'https://example.org/tidal']]);
    expect(problems.dialogs).toEqual([]);
  });

  test('a question with no matches says so without calling the AI', async () => {
    const { page, calls } = await openPopup();
    await skipOnboarding(page);
    await configureProvider(page, 'openai', 'gpt-4o');
    await seedKnowledge(page, 0);

    await clickButtonWithText(page, 'Knowledge');
    const input = 'input[placeholder="Search or ask a question..."]';
    await page.waitForSelector(input);
    await page.type(input, 'quantum chromodynamics');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.body.innerText.includes('Nothing in your saved reading matches'), { timeout: 10000 });
    expect(calls.some((c) => c.body && c.body.includes('Answer the question using only'))).toBe(false);
    expect(await bodyText(page)).not.toContain('Your Knowledge Base is Empty');
  });
});

describe('Rating prompt', () => {
  async function analyzeOnce(page) {
    await pointPopupAtFixture(page);
    await clickButtonWithText(page, 'ANALYZE PAGE');
    await page.waitForFunction(() => document.body.innerText.includes('MOCK_SUMMARY'), { timeout: 15000 });
  }

  const promptVisible = (page) => page.$('[data-testid="rating-prompt"]').then(Boolean);

  test('does not appear before the 5th successful analysis', async () => {
    const { page } = await openPopup();
    await skipOnboarding(page);
    await configureProvider(page, 'openai', 'gpt-4o');
    await analyzeOnce(page);
    expect(await promptVisible(page)).toBe(false);
    expect(await page.evaluate(() => chrome.storage.local.get('successful_analysis_count'))).toEqual({
      successful_analysis_count: 1,
    });
  });

  test('appears on the 5th analysis; "Rate it" opens this extension\'s review page and never shows again', async () => {
    const { page } = await openPopup();
    await skipOnboarding(page);
    await configureProvider(page, 'openai', 'gpt-4o');
    await page.evaluate(() => chrome.storage.local.set({ successful_analysis_count: 4 }));
    await analyzeOnce(page);
    await page.waitForSelector('[data-testid="rating-prompt"]', { timeout: 5000 });

    const reviewTab = browser.waitForTarget(
      (t) => t.url().startsWith(`https://chromewebstore.google.com/detail/${extensionId}/reviews`),
      { timeout: 10000 }
    );
    await clickButtonWithText(page, 'Rate it');
    await reviewTab;

    expect(await promptVisible(page)).toBe(false);
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('[aria-label="Settings"]');
    expect(await promptVisible(page)).toBe(false);
  });

  test('"No thanks" hides it for good', async () => {
    const { page } = await openPopup();
    await skipOnboarding(page);
    await page.evaluate(() => chrome.storage.local.set({ successful_analysis_count: 7 }));
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-testid="rating-prompt"]', { timeout: 5000 });
    await clickButtonWithText(page, 'No thanks');
    expect(await promptVisible(page)).toBe(false);
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('[aria-label="Settings"]');
    expect(await promptVisible(page)).toBe(false);
  });
});
