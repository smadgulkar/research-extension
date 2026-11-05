// Premium subscription management service
import type { PremiumStatus, ExportFormat } from '../types/models';

// Paid tier is OFF until there is a real checkout + server-side license verification.
// While false, every feature is unlocked and no upgrade/checkout UI is shown.
export const PAID_TIER_ENABLED = false;

const PREMIUM_STORAGE_KEY = 'research_assistant_premium';
const STRIPE_PAYMENT_LINK = 'https://buy.stripe.com/YOUR_PAYMENT_LINK'; // Replace with actual link
const STRIPE_CUSTOMER_PORTAL = 'https://billing.stripe.com/p/login/YOUR_PORTAL'; // Replace with actual portal

// Features that require premium
const PREMIUM_FEATURES = {
  exportFormats: ['json', 'html', 'notion', 'obsidian'] as ExportFormat[],
  notionIntegration: true,
  obsidianIntegration: true,
  pdfAnalysis: true,
  citationGenerator: true,
  highlightToAnalyze: true,
} as const;

// Free features
const FREE_FEATURES = {
  exportFormats: ['markdown'] as ExportFormat[],
  unlimitedAnalyses: true,
  knowledgeBase: true,
  workspaces: true,
} as const;

class PremiumService {
  private status: PremiumStatus | null = null;

  async initialize(): Promise<void> {
    await this.loadStatus();
  }

  private async loadStatus(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(PREMIUM_STORAGE_KEY);
      if (result[PREMIUM_STORAGE_KEY]) {
        this.status = result[PREMIUM_STORAGE_KEY];
        // Check if subscription has expired
        if (this.status?.expiresAt && new Date(this.status.expiresAt) < new Date()) {
          this.status.isPremium = false;
          await this.saveStatus();
        }
      }
    } catch (error) {
      console.error('Failed to load premium status:', error);
      this.status = { isPremium: false };
    }
  }

  private async saveStatus(): Promise<void> {
    try {
      await chrome.storage.local.set({ [PREMIUM_STORAGE_KEY]: this.status });
    } catch (error) {
      console.error('Failed to save premium status:', error);
    }
  }

  async getStatus(): Promise<PremiumStatus> {
    if (!this.status) {
      await this.loadStatus();
    }
    return this.status || { isPremium: false };
  }

  async isPremium(): Promise<boolean> {
    if (!PAID_TIER_ENABLED) return true;
    const status = await this.getStatus();
    return status.isPremium;
  }

  // Activate premium with a license key
  // Activate premium with a license key.
  // There is no verification backend yet, so activation always fails rather than
  // granting premium to any string that merely looks like a key.
  async activateLicense(_licenseKey: string, _email?: string): Promise<boolean> {
    throw new Error('License activation is not available yet');
  }

  // Deactivate premium
  async deactivate(): Promise<void> {
    this.status = { isPremium: false };
    await this.saveStatus();
  }

  // Check if a specific feature is available
  async isFeatureAvailable(feature: keyof typeof PREMIUM_FEATURES): Promise<boolean> {
    const isPremium = await this.isPremium();
    if (isPremium) return true;

    // Check if it's a free feature
    return feature in FREE_FEATURES;
  }

  // Check if an export format is available
  async isExportFormatAvailable(format: ExportFormat): Promise<boolean> {
    const isPremium = await this.isPremium();
    if (isPremium) return true;
    return FREE_FEATURES.exportFormats.includes(format);
  }

  // Get available export formats for current user
  async getAvailableExportFormats(): Promise<ExportFormat[]> {
    const isPremium = await this.isPremium();
    if (isPremium) {
      return [...FREE_FEATURES.exportFormats, ...PREMIUM_FEATURES.exportFormats];
    }
    return [...FREE_FEATURES.exportFormats];
  }

  // Get all premium features for display
  getPremiumFeatures(): typeof PREMIUM_FEATURES {
    return PREMIUM_FEATURES;
  }

  // Get Stripe payment link
  getPaymentLink(): string {
    return STRIPE_PAYMENT_LINK;
  }

  // Get Stripe customer portal
  getCustomerPortalLink(): string {
    return STRIPE_CUSTOMER_PORTAL;
  }

  // Open checkout in new tab
  openCheckout(): void {
    if (!PAID_TIER_ENABLED) return;
    chrome.tabs.create({ url: STRIPE_PAYMENT_LINK });
  }

  // Open customer portal in new tab
  openCustomerPortal(): void {
    if (!PAID_TIER_ENABLED) return;
    chrome.tabs.create({ url: STRIPE_CUSTOMER_PORTAL });
  }
}

export const premiumService = new PremiumService();
export { PREMIUM_FEATURES, FREE_FEATURES };
