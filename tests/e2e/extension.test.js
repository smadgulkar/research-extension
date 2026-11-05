/**
 * E2E tests for Research Assistant.
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
      return json({ models: [{ name: 'models/gemini-test-flash', displayName: 'Gemini Test Flash', supportedGenerationMethods: ['generateContent'] }] });
    }
    if (url.startsWith('https://generativelanguage.googleapis.com/') && url.includes(':generateContent')) {
      record('gemini');
      // Prose around the JSON, as Gemini sometimes does.
      const text = 'Here is the analysis:\n' + JSON.stringify(isKnowledge ? KNOWLEDGE : ANALYSIS);
      return json({ candidates: [{ content: { parts: [{ text }] } }] });
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
  ['gemini', 'gemini-test-flash', 'JSON after prose'],
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
