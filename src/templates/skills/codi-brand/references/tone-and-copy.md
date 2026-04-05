# Codi Tone of Voice & Copy Guide

> Source of truth: /references/site-index.html

## Brand Essence

**Product**: codi — unified AI agent configuration management.

**Core positioning**: Your AI coding knowledge, centralized. Codi is the single source of truth that keeps every AI coding agent in sync — no drift, no duplication, no fragmentation.

**Primary tagline**: *"Your AI coding knowledge. Centralized."*

**Supporting tagline**: *"The AI knowledge your team builds should compound — not scatter."*

**Core problem**: When teams add multiple AI coding agents (Claude Code, Cursor, Codex, Windsurf, Cline), each needs its own config file. Rules added to one never reach the others. Knowledge fragments. Codi eliminates this by generating all agent configs from one `.codi/` source of truth.

**The compounding metaphor**: Each rule written makes every agent smarter. The `.codi/` directory becomes a living knowledge base — any new agent added inherits it instantly.

## Tone

**Personality**:
- Direct and developer-friendly — no corporate jargon
- Conversational and specific — speaks to developers in their own terms
- Confident without being grandiose — facts over superlatives
- Honest about the problem first — names the frustration before offering the fix

**Writing patterns**:
- Short declarative sentences. One idea per sentence.
- Second person: "you", "your team", "your agents" — never "users" or "developers" in copy
- Lead with the concrete problem or outcome, then explain the solution
- Name specific agents: Claude Code, Cursor, Codex, Windsurf, Cline
- Concrete and specific: name commands, file paths, exact counts

## Phrases to USE

- "Your AI coding knowledge. Centralized."
- "The knowledge compounds — not scatters."
- "One `.codi/` folder. Every agent in sync."
- "Write once, works everywhere."
- "No drift."
- "The more rules you write, the better your agents get."
- "New hire runs `codi init` and inherits everything."

## Phrases to AVOID

- "Revolutionary", "cutting-edge", "next-generation", "game-changer"
- "AI-powered" without specifics
- "Seamless", "robust", "comprehensive solution"
- "Our users" / "developers who use Codi"
- Passive voice: "configurations are generated" → "Codi generates your configs"
- Vague benefits: "saves time" → be specific

## Key Product Facts

| Fact | Value |
|------|-------|
| Supported agents | 5 (Claude Code, Cursor, Codex, Windsurf, Cline) |
| Built-in templates | 148+ |
| Install command | `npm install -g codi-cli@latest` |
| Source directory | `.codi/` |
| Generate command | `codi generate` |
| Init command | `codi init` |
| GitHub | `https://github.com/lehidalgo/codi` |
| Live site | `https://lehidalgo.github.io/codi` |
| Builder | Leandro A. Hidalgo, AI Engineer |

## Output by Artifact Type

### HTML / Landing Page
1. Set `background-color: #070a0f` on `<body>`
2. Include the full CSS variables block (see /references/design-tokens.md)
3. Load Google Fonts (Outfit + Geist Mono)
4. Add `<div class="noise" aria-hidden="true"></div>` as first child of `<body>`
5. Use `.gradient-text` on second line of major H1/H2 headings
6. Add `.reveal` classes + IntersectionObserver for entrance animations
7. Add corner accent spans to all cards
8. Section labels: Geist Mono, uppercase, `var(--c0)`, wide letter-spacing
9. Feature icons: geometric Unicode symbols in `.feature-icon-box`

### Documents (Markdown / HTML print)
- Background: white for print, `#070a0f` for screen
- Headings: Outfit Bold, gradient accent on key phrases
- Code blocks: Geist Mono, cyan tint background
- Section numbering: `01.`, `02.`, `03.` format

### Presentations (PPTX / slides)
- Dark slides: background `#070a0f`
- Title slide: "codi" wordmark centered, Geist Mono + gradient
- Section dividers: large zero-padded step number + section heading in gradient
- Body slides: Surface card style (`#0d1117`), `#e6edf3` text

### Marketing Copy (social, README, email)
1. Lead with the concrete problem — fragmented configs, no shared AI knowledge
2. Name specific agents: Claude Code, Cursor, Codex, Windsurf, Cline
3. Use the compounding metaphor
4. End with a concrete action: `npm install -g codi-cli@latest` or "→ Quick Start"
5. Max 2-3 sentences per paragraph
