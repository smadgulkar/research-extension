# Chrome Web Store Listing Content

## Extension Name
**Mindstack – AI knowledge base & summarizer** (set from the manifest `name`; max 45 characters: Firefox manifest limit. Formerly "Research Assistant".)

## Short Description (132 characters max)
```
Turn what you read into a searchable AI knowledge base. Summaries & Q&A via GPT, Claude or Gemini. Export to Obsidian & Notion.
```

## Detailed Description

```
🧠 Mindstack: everything you read, turned into a knowledge base you can ask

Mindstack (formerly Research Assistant) captures the articles, docs and papers you read, distills each into a summary and key points with AI, and builds a personal knowledge base you can search and question. Bring your own OpenAI, Claude or Gemini key. No account, no servers.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✨ KEY FEATURES

📖 Smart Page Analysis
• Get instant summaries in short, medium, or long formats
• Extract key points and main arguments automatically
• Identify topics and sentiment analysis
• Works on articles, documentation, research papers, and more

🧩 Personal Knowledge Base
• Every analysis builds your searchable knowledge base
• Ask questions across all your research, with answers that cite your sources
• Save any page with Alt+Shift+S or right-click, without opening the extension
• Optional reminders: see what you've already read on a topic, right on the page, matched on your device
• Organize with customizable workspaces

📤 Export Anywhere (all free)
• Markdown, JSON & HTML export
• Obsidian integration with YAML frontmatter & wikilinks
• Notion database export

🔒 Privacy-First Design
• Your API key stays on your device
• No tracking, no analytics, no data collection
• All data stored locally in your browser
• Direct API calls to OpenAI, Anthropic or Google Gemini. We never see your data

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 GETTING STARTED

1. Install the extension
2. Click the Mindstack icon
3. Add your API key in Settings. No key? Get a free Gemini key from Google AI Studio (free tier with daily limits)
4. Navigate to any webpage and click "Analyze Page"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 PERFECT FOR

• Researchers analyzing academic papers
• Students summarizing study materials
• Professionals staying current with industry news
• Content creators gathering research
• Anyone who reads a lot online

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔑 REQUIREMENTS

• An API key from OpenAI, Anthropic or Google Gemini (bring your own key; Gemini has a free tier)
• Chrome browser (Manifest V3 compatible)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 SUPPORT

Having issues? We're here to help!
• Check our documentation
• Report bugs on GitHub
• Contact us through the Chrome Web Store

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Mindstack respects your privacy. We don't collect any personal data, and your API keys never leave your device. Read our full privacy policy for details.


Made with ❤️ for researchers everywhere.
```

## Category
**Productivity**

## Language
**English**

## Tags/Keywords
- research
- AI
- summary
- GPT
- Claude
- Gemini
- summarize webpage
- article summarizer
- knowledge base
- page analyzer
- productivity
- note-taking
- Obsidian
- Notion

---

## Screenshot Descriptions

### Screenshot 1: Main Analysis View
Show the extension popup with a page being analyzed, displaying the summary and key points.

### Screenshot 2: Knowledge Base
Show the Knowledge tab with the Q&A interface and knowledge items.

### Screenshot 3: Export Options
Show the export dropdown with different format options (Markdown, JSON, Obsidian, Notion).

### Screenshot 4: Settings
Show the settings modal with API provider and model selection.

### Screenshot 5: Workspaces
Show the workspace manager with multiple workspaces organized by project.

---

## Promotional Tile Text

### Small Tile (440x280)
```
Mindstack
Everything you read, remembered
```

### Marquee (1400x560)
```
Mindstack
Turn what you read into a knowledge base
Ask questions across everything you've saved
```

---

## Version 2.1 Changelog (draft)

Mindstack now comes to you:
• Save any page with Alt+Shift+S or right-click > "Save page to Mindstack", with a confirmation on the page
• Optional suggestions: see related pages you've already read, right on the page, plus a count on the toolbar icon. Matching happens on your device
• After you've read an article, a one-click offer to save it (optional, and never more than one prompt per page)
• The popup shows "Related from your reading" and whether you've already saved the page
• Knowledge answers cite the pages they came from, and stay fast and cheap however much you've saved
• Fixed: the Summary Length buttons and "Analyze selected text only" now work

## Permission justifications (Chrome dashboard > Privacy practices)

- **contextMenus:** Adds "Save page to Mindstack" to the right-click menu so users can save the page they're reading without opening the extension.
- **activeTab:** Reads the current page only when the user clicks the toolbar icon, presses the save shortcut or uses the right-click menu.
- **scripting:** Extracts the readable text of the current page for analysis, and shows the on-page save confirmation and suggestions.
- **storage:** Saves settings and preferences locally.
- **Optional host permissions (http://*/*, https://*/*):** Requested only if the user turns on "Suggestions while browsing". Used to compare the page being viewed with the user's saved reading on the device, and to show related pages and a save offer on the page. No page data leaves the device unless the user clicks Save.
- **Optional host permission (api.notion.com):** Requested only when the user connects Notion, to export analyses to their Notion database.

## Version 2.0 Changelog

```
Version 2.0

NEW
• Google Gemini support, plus updated model lists for all providers
• Obsidian export with frontmatter and wikilinks
• Notion export straight to your databases
• JSON and HTML export formats
• Onboarding walkthrough for new users

FIXES
• Claude (Anthropic) requests no longer blocked by the browser

IMPROVEMENTS
• Tabbed settings
• Export format picker in analysis results
• Better error messages
• Faster load times
```
