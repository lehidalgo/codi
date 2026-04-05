# NotebookLM UI Layout Reference

This guide documents the NotebookLM web interface layout. The UI changes frequently — always verify with screenshots before relying on element locations.

## Page Structure

NotebookLM uses a three-panel layout inside a notebook:

```
┌──────────────────────────────────────────────────────────┐
│  Top bar: notebook title, share button, settings         │
├────────────┬───────────────────────┬─────────────────────┤
│            │                       │                     │
│  Sources   │    Chat / Main        │  Notebook Guide     │
│  Panel     │    Content Area       │  Panel              │
│  (left)    │    (center)           │  (right)            │
│            │                       │                     │
│  - List of │  - Chat messages      │  - Audio Overview   │
│    uploaded│  - AI responses       │  - Study guide      │
│    sources │    with citations     │  - FAQ              │
│            │  - Chat input at      │  - Briefing doc     │
│  - "Add    │    bottom             │  - Timeline         │
│    source" │                       │  - Flashcards       │
│    button  │                       │                     │
├────────────┴───────────────────────┴─────────────────────┤
│  Chat input: "Ask a question about your sources..."      │
└──────────────────────────────────────────────────────────┘
```

## Dashboard (Home Page)

URL: `https://notebooklm.google.com`

- Grid or list of existing notebooks
- "Create new" or "New notebook" button (top area or prominent position)
- Each notebook card shows title, source count, last edited date

## Sources Panel (Left)

- Lists all uploaded sources with titles
- "Add source" button — opens a modal with source type options:
  - **Google Drive**: Google Docs, Slides, Sheets
  - **Website URL**: paste a URL
  - **Upload file**: PDF, DOCX, TXT, PPTX, XLSX, CSV, audio files, images
  - **Copied text**: paste raw text content
  - **YouTube**: paste a YouTube URL
- Each source can be selected/deselected to focus the AI on specific sources
- Source count shown (e.g., "5 of 5 sources selected")

## Chat Area (Center)

- Chat messages with the AI, each response includes inline citations
- Citations appear as numbered references (e.g., [1], [2]) linked to source passages
- Chat input field at the bottom: "Ask a question about your sources..."
- Suggested questions may appear when a notebook is first opened

## Notebook Guide Panel (Right)

- Contains generated output options:
  - **Audio Overview**: generate podcast-style discussions
  - **Study guide**: structured learning material
  - **FAQ**: frequently asked questions from sources
  - **Briefing doc**: executive summary
  - **Timeline**: chronological events from sources
  - **Table of contents**: structured outline
  - **Flashcards**: Q&A cards for study
- Each option has a generate/create button
- Generated content appears inline in the panel

## Audio Overview Section

Located in the Notebook Guide panel:

- Format selector (when available): Deep Dive, Briefing, Critique, Debate
- "Generate" or "Create" button to start generation
- Progress indicator during generation (2-5 minutes)
- Audio player with play/pause controls when ready
- Download option (if available)
- Daily limit indicator (3/day on free tier)

## Common Element Labels to Search For

Use these with `mcp__claude-in-chrome__find`:

| Action | Search terms to try |
|--------|-------------------|
| Create notebook | "Create new", "New notebook", "+" button |
| Add source | "Add source", "Upload", "Add" |
| URL source | "Website", "URL", "Link" |
| Text source | "Copied text", "Paste text" |
| File upload | "Upload", "Upload file", "Browse" |
| Submit source | "Insert", "Add", "Submit" |
| Chat input | "Ask a question", "Type a message", text input |
| Audio Overview | "Audio Overview", "Generate audio" |
| Study guide | "Study guide" |
| FAQ | "FAQ", "Frequently asked" |
| Briefing doc | "Briefing doc", "Summary" |
| Timeline | "Timeline" |
| Flashcards | "Flashcards" |
| Notebook guide | "Notebook guide", "Guide" |

## Tips

- If a panel is collapsed, look for toggle buttons or hamburger menus
- The Notebook Guide panel may need to be scrolled to see all output options
- Some features may be behind a "More" or "..." menu
- After generating content, scroll within the panel to see the full output
