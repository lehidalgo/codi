export const template = `---
name: codi-rl3-brand
description: "Apply RL3 AI Agency brand identity to any content creation task. Use this skill whenever creating branded materials for RL3 — including presentations, documents, landing pages, proposals, social media posts, pitch decks, emails, one-pagers, dashboards, HTML pages, React components, or any visual/written deliverable that needs RL3 branding. Also use when the user mentions 'RL3', 'nuestra marca', 'branded', 'con nuestra identidad', 'estilo RL3', 'brand', 'propuesta comercial', 'para un cliente', or asks to create any client-facing or internal material. This skill should trigger even for tasks like writing a follow-up email to a prospect, creating a case study, building an internal dashboard, or generating a social media graphic — anything that should carry the RL3 identity. If in doubt about whether RL3 branding applies, use this skill."
category: brand
---

# RL3 AI Agency — Brand System

RL3 is an AI agency that designs, builds and optimizes intelligent systems for businesses. The name comes from **Reinforcement Learning** — the 3 represents the three phases of every project cycle: **Observar · Actuar · Iterar** (Observe · Act · Iterate). The tagline is *"Cada iteración nos acerca al resultado óptimo."*

## Brand Essence

RL3 exists because most AI projects fail for the same reason: they get analyzed but never executed, executed without understanding the business, or delivered and never measured again. RL3 closes that gap by uniting strategy, implementation, and optimization in one continuous loop.

**Core positioning**: We build AI systems that improve with every iteration. Not demos — production systems that generate value from day one.

**Three service pillars**:
1. **Estrategia AI** (Strategy & Vision) — Observe the environment, design the optimal policy
2. **Implementación** (Build & Deploy) — Agents, automations, and intelligent systems in production
3. **Optimización Continua** (Optimize & Scale) — Every data point is a reward signal; iterate and scale

---

## Visual Identity

### Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| \`--rl3-black\` | \`#0a0a0b\` | Primary dark / backgrounds |
| \`--rl3-white\` | \`#ffffff\` | Primary light / text on dark |
| \`--rl3-accent\` | \`#c8b88a\` | Gold accent — the 3, highlights, CTAs, interactive elements |
| \`--rl3-accent-dim\` | \`#c8b88a33\` | Accent at 20% opacity — glows, subtle backgrounds |
| \`--rl3-gray\` | \`#7a7a7a\` | Secondary text, descriptions |
| \`--rl3-dark-gray\` | \`#1a1a1b\` | Cards, elevated surfaces on dark backgrounds |
| \`--rl3-mid-gray\` | \`#2a2a2b\` | Borders, dividers on dark backgrounds |
| \`--rl3-light-bg\` | \`#f5f5f5\` | Light mode background alternative |

**Usage rules**:
- The gold accent \`#c8b88a\` is reserved for the "3" in the logo, key highlights, interactive elements, and section labels. Never use it for large background fills.
- Default to dark mode (dark background, light text). Light mode is the secondary option.
- Background is never pure white (#fff) in dark mode — always use \`#0a0a0b\` or similar near-black.
- Maintain high contrast: body text on dark backgrounds should be \`#ffffff\` or \`#f5f5f5\`.

### CSS Variables Block
When creating any HTML/React artifact for RL3, include this CSS variables block:

\`\`\`css
:root {
  --rl3-black: #0a0a0b;
  --rl3-white: #ffffff;
  --rl3-accent: #c8b88a;
  --rl3-accent-dim: #c8b88a33;
  --rl3-gray: #7a7a7a;
  --rl3-dark-gray: #1a1a1b;
  --rl3-mid-gray: #2a2a2b;
  --rl3-light-bg: #f5f5f5;
}
\`\`\`

### Typography

| Role | Font | Weight | Fallback |
|------|------|--------|----------|
| **Headlines / Logo** | Space Grotesk | 500–700 | 'Helvetica Neue', Arial, sans-serif |
| **Monospace / Labels** | Space Mono | 400–700 | 'Courier New', monospace |
| **Body text** | Instrument Sans | 400–600 | system-ui, sans-serif |

Space Grotesk and Space Mono share the same geometric DNA — they form a natural typographic family. This cohesion is intentional: the brand feels technical without being cold.

**Google Fonts import** (use when creating web content):
\`\`\`html
<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
\`\`\`

**Typography rules**:
- Headlines: Space Grotesk, weight 600-700, tight letter-spacing (-0.02em to -0.03em), large sizes
- Section labels: Space Mono, all caps, letter-spacing 0.3-0.5em, small size (0.65rem), gold color
- Body: Instrument Sans, weight 400-600, line-height 1.7-1.8, gray color for secondary text
- Numbers and technical terms: Space Mono for monospaced aesthetic
- The format for section labels is: \`01 — Section Name\` (number + em dash + name)

### Logo — Minimal Wordmark (Propuesta 01)

The logo is pure typography on a single shared baseline: **RL** in dark/white + **3** in gold accent (#c8b88a), all at the same vertical level. Below it, "AI AGENCY" in Space Mono, uppercase, letter-spaced.

**CRITICAL**: The "RL" and the "3" MUST sit on the exact same baseline. They are part of a single text element — never separate text nodes, never different vertical positions. The "3" is simply a color change within the same word, not a separate element.

**SVG logos are available** in \`assets/rl3-logo-dark.svg\` (for light backgrounds) and \`assets/rl3-logo-light.svg\` (for dark backgrounds).

**Inline SVG for dark backgrounds** (most common):
\`\`\`html
<svg viewBox="0 0 300 120" xmlns="http://www.w3.org/2000/svg">
  <text x="20" y="78" font-family="'Space Grotesk', sans-serif" font-weight="700" font-size="72" letter-spacing="-2" fill="#ffffff">RL<tspan fill="#c8b88a">3</tspan></text>
  <text x="22" y="104" font-family="'Space Mono', monospace" font-size="11" letter-spacing="5" fill="#7a7a7a">AI AGENCY</text>
</svg>
\`\`\`

**Inline SVG for light backgrounds**:
\`\`\`html
<svg viewBox="0 0 300 120" xmlns="http://www.w3.org/2000/svg">
  <text x="20" y="78" font-family="'Space Grotesk', sans-serif" font-weight="700" font-size="72" letter-spacing="-2" fill="#0a0a0b">RL<tspan fill="#c8b88a">3</tspan></text>
  <text x="22" y="104" font-family="'Space Mono', monospace" font-size="11" letter-spacing="5" fill="#7a7a7a">AI AGENCY</text>
</svg>
\`\`\`

**HTML/CSS logo** (when SVG is not appropriate):
\`\`\`html
<div style="font-family:'Space Grotesk',sans-serif; font-weight:700; font-size:72px; letter-spacing:-0.03em; line-height:1;">
  <span style="color:#ffffff;">RL</span><span style="color:#c8b88a;">3</span>
</div>
<div style="font-family:'Space Mono',monospace; font-size:11px; letter-spacing:0.35em; color:#7a7a7a; text-transform:uppercase; margin-top:8px;">
  AI Agency
</div>
\`\`\`

**Logo rules**:
- The "3" is ALWAYS in gold (#c8b88a), never in the same color as "RL"
- The "RL" and "3" ALWAYS share the same baseline — they are one word, one line, one level
- Use a single \`<text>\` element with a \`<tspan>\` for the color change — never two separate \`<text>\` elements
- Minimum size: ensure "AI AGENCY" remains legible
- Always use the Minimal Wordmark variant (Propuesta 01) unless explicitly asked otherwise
- For favicon/compact: just "RL3" with the gold 3, no "AI AGENCY" subtitle

### Design Patterns

**Grid & Layout**:
- Use subtle background grids (60px) with radial-gradient masks for hero sections
- Cards separated by 1px gaps with shared background color (creates thin line separators)
- Generous padding: 3rem in cards, 8rem section padding
- Max content width: 1200px centered

**Interactions & Motion**:
- Hover: gold top-border reveal (scaleX from 0), background shift to slightly lighter
- Entrance: fadeUp animation (opacity 0 → 1, translateY 20px → 0) with staggered delays
- Pulse: subtle glow behind the "3" element using radial-gradient + blur
- Scroll indicator: single vertical gold line with pulse animation
- Cursor: crosshair on body (signature detail)
- Grain overlay on body using SVG feTurbulence filter at very low opacity (0.02)

**Component Patterns**:
- Section labels: \`<p class="section-label">01 — Title</p>\` — Space Mono, gold, uppercase, border-bottom
- Service cards: number + tag + title + subtitle + description + feature list with arrow bullets (→)
- Pillar cards: 3-column grid, large faded number, title, description; gold number on hover
- Cycle visualization: numbered steps with arrows (→) and loop symbol (↻) at the end

---

## Tone of Voice

**Language**: Spanish by default (the primary market is Spain/EU). Switch to English when explicitly requested or when creating materials for US/UAE markets.

**Personality**:
- **Confident but not arrogant** — We know what we're doing, but we explain it clearly
- **Technical but accessible** — Use RL terminology (policy, reward signal, iteration) naturally, not forced
- **Direct and concise** — No filler words, no empty promises
- **Data-driven** — Every claim backed by the cycle: observe → act → learn

**Writing patterns**:
- Short, punchy sentences. Break long ideas into fragments.
- Use periods or commas to separate ideas. Never use em dashes (—) to connect clauses.
- Bold key phrases within paragraphs for scanability
- Prefer active voice: "Construimos agentes" not "Los agentes son construidos"
- RL metaphors woven naturally: "cada dato es una señal de mejora", "la policy óptima", "el reward signal"

**Phrases to USE**:
- "Cada iteración nos acerca al resultado óptimo"
- "Observar · Actuar · Iterar"
- "No demos. Soluciones en producción"
- "Cada dato es una señal de mejora"
- "Sistemas que mejoran con el tiempo"
- "Entender antes de construir, construir lo que se va a usar, mejorar con datos reales"

**Phrases to AVOID**:
- "Revolucionamos" / "Disruptivo" / "Cutting-edge" (overused, empty)
- "Nuestro equipo de expertos" (generic agency speak)
- "Soluciones 360" / "End-to-end" without specifics
- "Inteligencia artificial al servicio de..." (cliché)

---

## Document & Presentation Standards

When creating **documents (docx, pdf)** for RL3:
- Header: RL3 logo (Minimal Wordmark) top-left, gold accent line below
- Footer: "RL3 AI AGENCY" in Space Mono, page number
- Headings: Space Grotesk, weight 600-700, near-black
- Body: Clean sans-serif (Instrument Sans or equivalent), 11pt, adequate line spacing
- Accent color for highlights, section numbers, and key callouts
- Section numbering: 01, 02, 03... format

When creating **presentations (pptx)** for RL3:
- Dark slides (near-black background) as default
- Title slide: Logo centered, gold "3" on same baseline as "RL", subtitle in Space Mono below
- Section dividers: large number in gold + section title in Space Grotesk
- Content slides: minimal, lots of white space, gold accents for data highlights
- Use the 3-pillar structure (Observe / Act / Iterate) when presenting methodology

When creating **web content (HTML/React)** for RL3:
- Always include the CSS variables block and Google Fonts import (Space Grotesk + Space Mono + Instrument Sans)
- Dark mode default with grain overlay
- Use the component patterns described above (section labels, cards, pillars, cycle)
- Responsive: single column below 768px
- Include subtle animations (fadeUp, hover gold borders)
- The logo must always render RL3 on one baseline — use \`<tspan>\` for the gold "3", never a separate element

---

## Reference Files

Read these when you need deeper context:

- \`references/services.md\` — Full service catalog with descriptions, deliverables, and pricing tiers for all 6 service lines and the top 25 use cases.
- \`references/ecosystem.md\` — Regional market analysis (Spain, UAE, US), complete use case matrix with prioritization scores, and the 18-block technology platform catalog (what exists, what's needed, OSS vs paid options).
- \`references/brandguide.html\` — **The approved brand guide (v1.0)**. Complete HTML showcasing logo, colors, typography, voice & tone, and interactive component demos. This is the team-approved definitive reference for all visual implementation. Open in a browser to see exact rendering.
- \`references/brand-concept.html\` — The original brand concept landing page. Use as additional visual reference for layout patterns, animations, and the full service section structure. Note: typography has been updated from Syne to Space Grotesk in all new implementations.
- \`assets/rl3-logo-dark.svg\` — Minimal Wordmark logo for light backgrounds (Space Grotesk)
- \`assets/rl3-logo-light.svg\` — Minimal Wordmark logo for dark backgrounds (Space Grotesk)
`;
