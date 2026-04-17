# App UI Reference

How the Content Factory browser app is laid out. Agents rarely need this
to write content — it is mostly relevant when responding to user questions
about where a control lives.

## Sidebar (left panel, scrollable)

| Control | Description |
|---------|-------------|
| **Format** | 6 buttons: 1:1 (1080×1080), 4:5 (1080×1350), 9:16 (1080×1920), OG (1200×630), 16:9 (1280×720), A4 (794×1123). Active format applies to all content. Social and slides presets adapt to the selected format. A4 is the only fixed format — document cards always render at 794×1123 regardless of the selector |
| **Handle** | `@username` placeholder replaced in agent-generated content. Preset thumbnails show `@preview`; preview cards show `@[handle]` |
| **Zoom** | Slider from 15% to 120%. Scales all card frames in the Preview strip. Default: 40% |
| **Logo** | ON/OFF toggle + Size / X% / Y% sliders. Adds a `codi` gradient wordmark overlay positioned absolutely over every card frame. Does not modify iframe content |
| **Content files** | List of HTML files written by the agent to the content dir. Anchor files show an `ANCHOR` badge. Click to load |
| **Export** | Context-aware buttons based on content type: social → PNG (current slide) + PDF (all); slides → PPTX (all, primary) + PDF (all) + PNG (current); document → PDF (all, primary) + DOCX (all) + PNG (current). PNG uses Playwright 2× resolution; PDF renders server-side via Playwright; PPTX embeds PNG images using PptxGenJS; DOCX uses client-side Pandoc with Playwright screenshots for code blocks and SVG diagrams |
| **Activity log** | Timestamped log of server events and user actions. WebSocket status dot (green = connected) |

## Main area (tabs)

### Preview tab

Horizontal card strip. Keyboard arrow keys navigate between slides. Active
card highlighted with accent border. Click any card to select it. A
**metadata bar** above the canvas shows the active content name, type chip,
pixel dimensions, and slide count — updated whenever content changes.

Element-level interaction:

- **Click** any element in a card to capture it as the active element
  (readable at `GET /api/active-element`)
- **Cmd/Ctrl-click** to add an element to the multi-select set
  (readable at `GET /api/active-elements`)

### Gallery tab

Vertical list of preset cards. Each shows a horizontal strip of all slide
thumbnails (IntersectionObserver lazy-loaded).

Five filter buttons:

- **All** — every built-in template plus every installed brand skill
  template, regardless of type. Past projects are excluded from this view
- **Social** — templates whose `type` meta is `social` (cards, carousels, stories)
- **Slides** — templates whose `type` meta is `slides` (16:9 decks)
- **Document** — templates whose `type` meta is `document` (A4 pages)
- **My Work** — past projects loaded from `.codi_output/`. Shows project
  date, preset name, and resolved content name. A secondary status filter
  row appears (All / Draft / In Progress / Review / Done) when this filter
  is active

Stock templates and brand templates appear side by side in the same flat
list — the Gallery does not separate them into their own tab. Each card's
`type` attribute decides which type filter it shows up under.

## Status workflow

Projects move through five states on the status filter:

| Status | Meaning |
|--------|---------|
| `draft` | New project, anchor not yet approved |
| `in-progress` | Anchor approved, variants being distilled or iterated |
| `review` | All variants drafted, waiting for user sign-off |
| `done` | User approved the final set, ready to export |

Status is persisted via `POST /api/session-status` and displayed as a
chip on the project card in the My Work filter.
