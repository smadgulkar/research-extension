# Privacy Policy for Mindstack (formerly Research Assistant)

**Last Updated:** November 2026

## Overview

Mindstack is a browser extension that helps you analyze web content using AI. We are committed to protecting your privacy and being transparent about our data practices.

## Data Collection

### What We Collect

**Locally Stored Data (on your device only):**
- Your API keys for OpenAI, Anthropic, or Google Gemini (stored unencrypted in your browser's local extension storage)
- Analyzed page content and summaries
- Your personal knowledge base entries
- Workspace configurations
- Extension settings and preferences
- Your Notion integration token, if you connect Notion

### What We Do NOT Collect

- We do NOT collect any personal information
- We do NOT track or record your browsing history (see "Suggestions while browsing" below for the optional feature that reads the page you're on)
- We do NOT send any data to our servers
- We do NOT use analytics or tracking services
- We do NOT share any data with third parties, other than sending content to the services you choose (your AI provider, and Notion if you connect it)
- We do NOT store your data in the cloud

## Data Transmission

### API Calls
When you analyze a page, the content is sent directly to your chosen AI provider (OpenAI, Anthropic, or Google Gemini) using YOUR API key. We act only as a facilitator—the data flows directly from your browser to the AI provider.

- **OpenAI:** Subject to [OpenAI's Privacy Policy](https://openai.com/privacy)
- **Anthropic:** Subject to [Anthropic's Privacy Policy](https://www.anthropic.com/privacy)
- **Google Gemini:** Subject to [Google's Privacy Policy](https://policies.google.com/privacy) and the [Gemini API terms](https://ai.google.dev/gemini-api/terms). If you use a free (unpaid) Gemini key, Google's terms say it may use what you send to improve its products and that human reviewers may read it, so don't analyze sensitive pages with a free key. Paid keys are not used this way.

### Notion Integration (optional)
If you connect to Notion, the extension asks for permission to access api.notion.com, and data is sent directly to Notion's API using your personal integration token. We do not have access to your Notion account.

### Opening Mindstack on an article
When you click the Mindstack icon on a page that looks like an article, Mindstack summarizes and saves it straight away: the page text is sent to your AI provider and the result is saved locally. A page you saved before is shown from your device without contacting the AI. You can remove a saved page with one click, or turn this off in Settings ("Summarize articles when I open Mindstack"), in which case nothing is sent until you click "Summarize & save".

### Saving with the keyboard shortcut or right-click menu
Pressing the shortcut (Alt+Shift+S by default) or choosing "Save page to Mindstack" gives the extension one-time access to that tab, the same as opening the popup. The page is sent to your AI provider and saved locally, and a small confirmation is shown on the page.

### Suggestions while browsing (optional, off by default)
If you turn on suggestions, your browser asks you to let Mindstack read the pages you visit. With that permission:
- When a page finishes loading, Mindstack reads its title, description and headings, and compares them with your saved reading **on your device**. Nothing is sent to an AI provider or anywhere else, and the pages you visit are not recorded.
- If you have read related pages, the toolbar icon shows a count, and a small panel on the page lists them. It is drawn in an isolated area the website's own scripts cannot read.
- After you have spent some time reading an article, Mindstack may offer to save it. Content is sent to your AI provider only if you click Save.
- You can hide suggestions on any site, or turn them off in Settings, which also gives the permission back.

### No Intermediary Servers
Mindstack does not operate any backend servers. All extension functionality runs locally in your browser.

## Data Storage

All data is stored locally using:
- **IndexedDB** (via Dexie.js) for pages, knowledge base, and workspaces
- **Chrome Storage API** for settings and preferences

Your data leaves your device only when you:
1. Save a page: by opening the popup on an article (if "Summarize articles when I open Mindstack" is on, as it is by default), or with the popup's button, the keyboard shortcut, the right-click menu or the on-page Save button
2. Ask a question about your saved reading (the most relevant saved notes are sent with it)
3. Export to Notion
4. Share via the Web Share API

## Data Security

- API keys are stored unencrypted in your browser's local extension storage. Anyone with access to your browser profile could read them, so use keys with spending limits
- All API communications use HTTPS encryption
- No data is transmitted to any servers we control

## Your Rights

You have full control over your data:
- **Access:** View all stored data in the extension
- **Delete:** Clear all data via browser settings or extension reset
- **Export:** Download your knowledge base in various formats
- **Portability:** Your data is stored locally and can be backed up

## Children's Privacy

Mindstack is not intended for use by children under 13. We do not knowingly collect data from children.

## Changes to This Policy

We may update this privacy policy from time to time. Any changes will be reflected in the "Last Updated" date above.

## Contact

For privacy-related questions or concerns, please open an issue on our GitHub repository or contact us through the Chrome Web Store.

---

## Summary

| Data Type | Collected | Stored | Shared |
|-----------|-----------|--------|--------|
| Personal info | No | No | No |
| Browsing history | No | No | No |
| Page content (for analysis) | Yes* | Locally | With AI provider* |
| API keys | Yes | Locally (unencrypted) | Only with the matching provider |
| Usage analytics | No | No | No |

*Only when you click "Analyze Page"
