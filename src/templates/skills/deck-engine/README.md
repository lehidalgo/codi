# codi-deck-engine

Generates self-contained HTML slide decks with keyboard navigation, animated transitions, and browser-based PDF export. No build tools needed — output is a single `.html` file that opens in any browser.

## Prerequisites

| Dependency | Install | Purpose |
|------------|---------|---------|
| Web browser | any modern browser | view and navigate the deck |
| pandoc | `brew install pandoc` (optional) | convert the deck to DOCX if needed |

No Node.js, no npm install, no Python. The deck is a standalone HTML file.

## Output

Each generated deck is a single `.html` file that includes:

- Slide navigation (keyboard arrow keys, click)
- Animated transitions between slides
- Progress indicator
- Speaker notes (hidden by default, press `S` to show)
- Print-to-PDF via browser (`File → Print → Save as PDF`)

## Brand Integration

If a skill with `category: brand` is active in the project, the deck uses its design tokens (CSS variables, fonts, logo). Otherwise, neutral professional defaults apply.

## Slide Components

Slides use a `.deck > .deck__viewport > section.slide` structure. Available layout variants:

| CSS class | Layout |
|-----------|--------|
| `slide--accent` | Colored background — for title and section divider slides |
| `slide__content--centered` | Vertically centered content |
| `slide__content--split` | Two-column layout |

## PDF Export

To export as PDF, open the file in Chrome or Edge and use:

```
File → Print → Destination: Save as PDF → More settings → Paper size: A4 or Letter → Save
```

For programmatic export via Playwright:

```bash
npx playwright screenshot --full-page deck.html deck.pdf
```
