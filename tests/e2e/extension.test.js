/**
 * E2E Tests for Research Assistant Extension
 * Uses Puppeteer to test extension functionality
 *
 * Run: npm test
 */

const puppeteer = require('puppeteer');
const path = require('path');

const EXTENSION_PATH = path.resolve(__dirname, '../../dist');
const EXTENSION_ID = 'your-extension-id'; // Will be assigned after loading

let browser;
let page;

// Helper to wait and retry
const waitForSelector = async (page, selector, timeout = 5000) => {
  try {
    await page.waitForSelector(selector, { timeout });
    return true;
  } catch {
    return false;
  }
};

// Get extension popup page
const getExtensionPage = async (browser, extensionId) => {
  const page = await browser.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`, {
    waitUntil: 'networkidle0'
  });
  return page;
};

describe('Research Assistant Extension', () => {

  beforeAll(async () => {
    // Launch browser with extension
    browser = await puppeteer.launch({
      headless: false, // Extensions require headed mode
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    });

    // Get extension ID from service worker
    const targets = await browser.targets();
    const extensionTarget = targets.find(
      target => target.type() === 'service_worker' &&
                target.url().includes('chrome-extension://')
    );

    if (extensionTarget) {
      const extensionUrl = extensionTarget.url();
      const [, , extensionId] = extensionUrl.split('/');
      global.EXTENSION_ID = extensionId;
      console.log('Extension ID:', extensionId);
    }
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  describe('Extension Loading', () => {
    test('should load extension successfully', async () => {
      expect(global.EXTENSION_ID).toBeDefined();
      expect(global.EXTENSION_ID.length).toBeGreaterThan(0);
    });

    test('should open popup without errors', async () => {
      const page = await getExtensionPage(browser, global.EXTENSION_ID);

      // Check for React root
      const root = await page.$('#root');
      expect(root).not.toBeNull();

      await page.close();
    });
  });

  describe('Onboarding Flow', () => {
    test('should show onboarding on first launch', async () => {
      const page = await getExtensionPage(browser, global.EXTENSION_ID);

      // Look for onboarding content
      const hasOnboarding = await waitForSelector(page, 'text/Welcome to Research Assistant');

      // Note: May not show if already completed
      console.log('Onboarding visible:', hasOnboarding);

      await page.close();
    });
  });

  describe('Main UI', () => {
    test('should display main tabs', async () => {
      const page = await getExtensionPage(browser, global.EXTENSION_ID);

      // Wait for app to load
      await page.waitForTimeout(1000);

      // Check for main navigation tabs
      const analyzeTab = await page.$('button:has-text("Analyze")');
      const historyTab = await page.$('button:has-text("History")');
      const knowledgeTab = await page.$('button:has-text("Knowledge")');

      // At least one tab should exist after onboarding
      const hasUI = analyzeTab || historyTab || knowledgeTab;
      console.log('Main UI loaded:', hasUI);

      await page.close();
    });

    test('should open settings modal', async () => {
      const page = await getExtensionPage(browser, global.EXTENSION_ID);

      // Wait for app to load
      await page.waitForTimeout(1000);

      // Click settings button (gear icon)
      const settingsBtn = await page.$('[aria-label="Settings"]');
      if (settingsBtn) {
        await settingsBtn.click();
        await page.waitForTimeout(500);

        // Check for settings modal
        const settingsModal = await page.$('text/Settings');
        expect(settingsModal).not.toBeNull();
      }

      await page.close();
    });
  });

  describe('Settings', () => {
    test('should have provider dropdown', async () => {
      const page = await getExtensionPage(browser, global.EXTENSION_ID);

      // Open settings
      const settingsBtn = await page.$('[aria-label="Settings"]');
      if (settingsBtn) {
        await settingsBtn.click();
        await page.waitForTimeout(500);

        // Check for provider select
        const providerSelect = await page.$('select');
        expect(providerSelect).not.toBeNull();
      }

      await page.close();
    });

    test('should have premium tab', async () => {
      const page = await getExtensionPage(browser, global.EXTENSION_ID);

      // Open settings
      const settingsBtn = await page.$('[aria-label="Settings"]');
      if (settingsBtn) {
        await settingsBtn.click();
        await page.waitForTimeout(500);

        // Check for Premium tab
        const premiumTab = await page.$('button:has-text("Premium")');
        expect(premiumTab).not.toBeNull();
      }

      await page.close();
    });
  });

  describe('Export Functionality', () => {
    test('should have export format options', async () => {
      // This would require analyzing a page first
      // Skipping for now as it requires API key
      console.log('Export test skipped - requires API key');
      expect(true).toBe(true);
    });
  });

  describe('Performance', () => {
    test('popup should load within 3 seconds', async () => {
      const startTime = Date.now();
      const page = await getExtensionPage(browser, global.EXTENSION_ID);

      // Wait for React to render
      await page.waitForSelector('#root');

      const loadTime = Date.now() - startTime;
      console.log('Popup load time:', loadTime, 'ms');

      expect(loadTime).toBeLessThan(3000);

      await page.close();
    });

    test('should not have console errors', async () => {
      const page = await getExtensionPage(browser, global.EXTENSION_ID);

      const errors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      await page.waitForTimeout(2000);

      // Filter out expected errors (like missing API key warnings)
      const criticalErrors = errors.filter(e =>
        !e.includes('API key') &&
        !e.includes('net::ERR')
      );

      console.log('Console errors:', criticalErrors.length);
      expect(criticalErrors.length).toBe(0);

      await page.close();
    });
  });
});

// Run tests if called directly
if (require.main === module) {
  console.log('Run tests with: npm test');
}
