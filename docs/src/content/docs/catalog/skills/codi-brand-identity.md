---
title: codi-brand-identity
description: >
  Template for creating brand identity skills. Use when building a new brand skill — provides the standard brand_tokens.json schema, dual-runtime generator structure (pptxgenjs default, python-pptx fallback), and routing table pattern. See codi-brand for a reference implementation. Also activate when applying design tokens, typography, logo, or tone of voice to any deliverable.
sidebar:
  label: "codi-brand-identity"
artifactType: skill
artifactCategory: Brand Identity
userInvocable: true
compatibility:
  - claude-code
  - cursor
  - codex
  - windsurf
  - cline
version: 1
---

# SKILL.md

---

## Required: brand_tokens.json

Every brand skill **must** have a `scripts/brand_tokens.json` as the canonical source of truth.
No colors or fonts are hardcoded anywhere else — all adapters read this file.

```json
{
  "brand": "codi-brand-identity",
  "version": 1,
  "colors": {
    "primary":        "#000000",
    "background":     "#ffffff",
    "background_dark": "#000000",
    "surface":        "#f5f5f5",
    "text_primary":   "#1a1a2e",
    "text_secondary": "#4a4a68",
    "text_muted":     "#9a9aaa",
    "accent":         "#000000",
    "white":          "#ffffff"
  },
  "fonts": {
    "pptx_headlines": "Arial",
    "pptx_body":      "Arial",
    "web_headlines":  "Arial",
    "web_body":       "Arial"
  },
  "layout": {
    "slide_width_in":      "13.333",
    "slide_height_in":     "7.5",
    "content_margin_in":   "0.5",
    "accent_bar_width_in": "0.05"
  },
  "assets": {
    "logo_light_bg": "../../assets/logo-dark.svg",
    "logo_dark_bg":  "../../assets/logo-light.svg"
  },
  "voice": {
    "phrases_use":   ["Brand phrase 1", "Brand phrase 2"],
    "phrases_avoid": ["Phrase to avoid 1", "Phrase to avoid 2"]
  }
}
```

---

## Required: scripts/ Directory Layout

```
scripts/
  brand_tokens.json          ← canonical brand data (no runtime dep)
  ts/
    brand_tokens.ts          ← TypeScript adapter (reads JSON)
    generate_pptx.ts         ← pptxgenjs generator (DEFAULT)
    generate_docx.ts         ← docx npm generator (DEFAULT)
    validators/
      validate_pptx.ts       ← brand rule checker
  python/
    brand_tokens.py          ← Python adapter (reads JSON)
    generate_pptx.py         ← python-pptx generator (FALLBACK)
    generate_docx.py         ← python-docx generator (FALLBACK)
    validators/
      pptx_validator.py      ← brand rule checker
```

See `${CLAUDE_SKILL_DIR}[[/references/brand-standard.md]]` for full implementation details and adapter patterns.

---

## Generator Routing

| Format | Runtime | Command |
|--------|---------|---------|
| PPTX | **TypeScript (DEFAULT)** | `npx tsx ${CLAUDE_SKILL_DIR}/scripts/ts/generate_pptx.ts --content content.json --output out.pptx` |
| PPTX | Python (fallback) | `python3 ${CLAUDE_SKILL_DIR}/scripts/python/generate_pptx.py --content content.json --output out.pptx` |
| DOCX | **TypeScript (DEFAULT)** | `npx tsx ${CLAUDE_SKILL_DIR}/scripts/ts/generate_docx.ts --content content.json --output out.docx` |
| DOCX | Python (fallback) | `python3 ${CLAUDE_SKILL_DIR}/scripts/python/generate_docx.py --content content.json --output out.docx` |

**Always use TypeScript first.** Fall back to Python only when `npx` is unavailable.

### content.json Schema

```json
{
  "title": "Document Title",
  "subtitle": "Optional subtitle",
  "author": "Author Name",
  "sections": [
    {
      "number": "01",
      "label": "Section Label",
      "heading": "Section Heading",
      "body": "Body paragraph text.",
      "items": ["Bullet 1", "Bullet 2"],
      "callout": "Optional highlighted quote"
    }
  ]
}
```

---

Read `${CLAUDE_SKILL_DIR}[[/references/brand-standard.md]]` for the color palette scaffold, CSS variables template, typography, logo guidelines, tone of voice, adapter patterns, and validation checklist.
