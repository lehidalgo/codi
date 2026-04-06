# Preview Shell Guide

## What It Provides

The `preview-shell.js` asset (in `assets/`) injects a full review UI into any generated HTML file.

| Feature | Description |
|---------|-------------|
| **Toolbar** | Aspect ratio presets: 1:1 LinkedIn, 4:5 Instagram, 9:16 Story, 1200×630 OG image |
| **Slide scaling** | CSS `transform: scale()` fits slides to viewport; each slide independently scrollable |
| **Chat panel** | Resizable right-side panel — user clicks a slide, types feedback, presses Enter |
| **Event storage** | Feedback stored as JSON in a hidden DOM element `<script id="cf-events">` |
| **PNG export** | In-browser export via html2canvas at 2× resolution — one slide or all at once |

## Why Inline Scripts

Browsers block external `<script src>` on `file://` protocol. Both `preview-shell.js` and `html2canvas.min.js` **must be inlined** before `</body>` for the toolbar, chat panel, and PNG export to work when HTML files are opened directly.

## Reading Feedback

```javascript
// Read stored feedback from the browser after the user's turn
mcp__playwright__browser_evaluate({
  expression: "JSON.parse(document.getElementById('cf-events').textContent)"
})
// Returns: [{ slide: 3, type: "content", text: "headline too long", timestamp: ... }]
```

If `cf-events` returns `[]`, the user did not interact with the browser — use their terminal text only.

## Aspect Ratio Reference

| Preset | Dimensions | Platform |
|--------|-----------|---------|
| 1:1 | 1080×1080 | LinkedIn, Instagram feed |
| 4:5 | 1080×1350 | Instagram portrait |
| 9:16 | 1080×1920 | Instagram/TikTok Story |
| 1200×630 | 1200×630 | Open Graph / blog header |
