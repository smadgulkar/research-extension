# Chrome Web Store Assets Specification

## Required Icons

| Size | Filename | Location | Purpose |
|------|----------|----------|---------|
| 16x16 | icon16.png | src/icons/ | Favicon, toolbar |
| 48x48 | icon48.png | src/icons/ | Extension management page |
| 128x128 | icon128.png | src/icons/ | Chrome Web Store, installation |

### Icon Guidelines
- PNG format with transparency
- Simple, recognizable design
- Works at small sizes
- Consistent with brand colors (blue #4361ee)

---

## Screenshots (Required)

**Dimensions:** 1280x800 or 640x400 pixels
**Format:** PNG or JPEG
**Quantity:** 1-5 screenshots (recommend at least 3)

### Screenshot 1: Main Analysis View
- Show extension popup open
- Display a real webpage being analyzed
- Show summary and key points visible
- Highlight the clean, modern UI

### Screenshot 2: Knowledge Base
- Show the Knowledge tab active
- Display Q&A interface with a question
- Show knowledge items with tags
- Demonstrate workspace organization

### Screenshot 3: Export Options
- Show analysis results modal
- Highlight export format dropdown (Markdown, JSON, HTML, Obsidian, Notion)
- Show the "Download" and integration buttons
- Include premium badge indicators

### Screenshot 4: Settings & Configuration
- Show settings modal with tabs
- Display API key configuration area
- Show provider selection (OpenAI/Anthropic)
- Include Premium tab preview

### Screenshot 5: Workspaces Feature
- Show workspace manager expanded
- Display multiple workspaces with colors
- Show workspace selection in action
- Demonstrate organization capabilities

---

## Promotional Images

### Small Promotional Tile (Required if featured)
- **Size:** 440x280 pixels
- **Format:** PNG or JPEG
- **Content:**
  - Extension logo prominently displayed
  - "Research Assistant" name
  - Brief tagline: "AI-Powered Page Analysis"
  - Clean, professional design
  - Brand colors

### Large Promotional Tile (Optional, recommended)
- **Size:** 920x680 pixels
- **Format:** PNG or JPEG
- **Content:**
  - Larger version of small tile
  - Can include feature highlights
  - More room for visual elements

### Marquee Promotional Tile (Optional)
- **Size:** 1400x560 pixels
- **Format:** PNG or JPEG
- **Content:**
  - Wide banner format
  - Hero image with extension in action
  - Key value proposition
  - Used for featured placement

---

## Design Guidelines

### Brand Colors
- Primary Blue: #4361ee
- Secondary Dark: #1a1a2e
- Accent Amber: #f59e0b (for premium)
- Success Green: #10b981
- Background: #ffffff
- Text: #1f2937

### Typography
- Headlines: System font, bold
- Body: System font, regular
- Monospace: JetBrains Mono (for code/technical)

### Visual Style
- Clean, minimal design
- Rounded corners (8px standard)
- Subtle shadows for depth
- Generous whitespace
- Professional, trustworthy appearance

---

## File Checklist

```
src/icons/
├── icon16.png    [ ] Created
├── icon48.png    [x] Exists
└── icon128.png   [x] Exists

store-assets/
├── screenshot-1-analysis.png      [ ] Create
├── screenshot-2-knowledge.png     [ ] Create
├── screenshot-3-export.png        [ ] Create
├── screenshot-4-settings.png      [ ] Create
├── screenshot-5-workspaces.png    [ ] Create
├── promo-small-440x280.png        [ ] Create
├── promo-large-920x680.png        [ ] Create (optional)
└── promo-marquee-1400x560.png     [ ] Create (optional)
```

---

## Creation Tools

Recommended tools for creating assets:
- **Figma** - Free, great for UI mockups
- **Canva** - Easy promotional images
- **Screenshot tools** - Chrome DevTools device mode
- **Image optimization** - TinyPNG, ImageOptim

### Screenshot Tips
1. Use Chrome DevTools to set exact viewport size
2. Hide bookmarks bar for cleaner look
3. Use realistic but non-sensitive content
4. Ensure text is readable at thumbnail size
5. Test how images look at 50% zoom (store preview)
