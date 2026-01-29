# Privacy Policy for Research Assistant

**Last Updated:** January 2025

## Overview

Research Assistant is a browser extension that helps you analyze web content using AI. We are committed to protecting your privacy and being transparent about our data practices.

## Data Collection

### What We Collect

**Locally Stored Data (on your device only):**
- Your API keys for OpenAI or Anthropic (encrypted in browser storage)
- Analyzed page content and summaries
- Your personal knowledge base entries
- Workspace configurations
- Extension settings and preferences
- Premium license keys (if applicable)

### What We Do NOT Collect

- We do NOT collect any personal information
- We do NOT track your browsing history
- We do NOT send any data to our servers
- We do NOT use analytics or tracking services
- We do NOT share any data with third parties
- We do NOT store your data in the cloud

## Data Transmission

### API Calls
When you analyze a page, the content is sent directly to your chosen AI provider (OpenAI or Anthropic) using YOUR API key. We act only as a facilitator—the data flows directly from your browser to the AI provider.

- **OpenAI:** Subject to [OpenAI's Privacy Policy](https://openai.com/privacy)
- **Anthropic:** Subject to [Anthropic's Privacy Policy](https://www.anthropic.com/privacy)

### Notion Integration (Premium)
If you connect to Notion, data is sent directly to Notion's API using your personal integration token. We do not have access to your Notion account.

### No Intermediary Servers
Research Assistant does not operate any backend servers. All extension functionality runs locally in your browser.

## Data Storage

All data is stored locally using:
- **IndexedDB** (via Dexie.js) for pages, knowledge base, and workspaces
- **Chrome Storage API** for settings and preferences

Your data never leaves your device unless you explicitly:
1. Make an API call to analyze content
2. Export to Notion (Premium feature)
3. Share via the Web Share API

## Data Security

- API keys are stored in browser local storage
- All API communications use HTTPS encryption
- No data is transmitted to any servers we control

## Your Rights

You have full control over your data:
- **Access:** View all stored data in the extension
- **Delete:** Clear all data via browser settings or extension reset
- **Export:** Download your knowledge base in various formats
- **Portability:** Your data is stored locally and can be backed up

## Children's Privacy

Research Assistant is not intended for use by children under 13. We do not knowingly collect data from children.

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
| API keys | Yes | Locally | No |
| Usage analytics | No | No | No |

*Only when you click "Analyze Page"
