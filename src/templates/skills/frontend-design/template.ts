import { PROJECT_NAME, SUPPORTED_PLATFORMS_YAML, SKILL_CATEGORY } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Distinctive, production-grade frontend interfaces. Use when the user asks
  to build a website, landing page, dashboard, hero section, navbar, or
  any React / Vue / HTML component. Also activate when styling, restyling,
  or beautifying an existing web app, redesigning a UI, setting up a
  design system, using shadcn/ui components, or working on CSS styling.
  Also trigger for phrases like "beautify this app", "make this look
  better", "redesign this page", "elevate the UI", "design system", "hero
  section". Avoids generic AI aesthetics (overused fonts like Inter /
  Roboto, purple gradients on white, predictable layouts). Do NOT activate
  for slide decks or presentations (use ${PROJECT_NAME}-content-factory or
  ${PROJECT_NAME}-pptx), static posters / album covers (use
  ${PROJECT_NAME}-canvas-design), multi-component claude.ai artifacts (use
  ${PROJECT_NAME}-claude-artifacts-builder), or PDF documents (use
  ${PROJECT_NAME}-doc-engine).
category: ${SKILL_CATEGORY.CREATIVE_AND_DESIGN}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 5
---

# {{name}} — Frontend Design

## When to Activate

- User asks to build a website, landing page, dashboard, or React/HTML component
- User wants to style or beautify an existing web interface
- User needs a visually distinctive frontend artifact
- User asks to avoid generic or "AI slop" aesthetics
- User mentions a design system, hero section, navbar, or shadcn component

## Skip When

- User wants a slide deck or presentation — use ${PROJECT_NAME}-content-factory or ${PROJECT_NAME}-pptx
- User wants a static poster or album cover — use ${PROJECT_NAME}-canvas-design
- User wants a multi-component claude.ai HTML artifact — use ${PROJECT_NAME}-claude-artifacts-builder
- User wants a PDF report or branded document — use ${PROJECT_NAME}-doc-engine
- User wants a generative art sketch — use ${PROJECT_NAME}-algorithmic-art

This skill guides creation of distinctive, production-grade frontend interfaces that avoid generic "AI slop" aesthetics. Implement real working code with exceptional attention to aesthetic details and creative choices.

The user provides frontend requirements: a component, page, application, or interface to build. They may include context about the purpose, audience, or technical constraints.

## Design Thinking

Before coding, understand the context and commit to a BOLD aesthetic direction:
- **Purpose**: What problem does this interface solve? Who uses it?
- **Tone**: Pick an extreme: brutally minimal, maximalist chaos, retro-futuristic, organic/natural, luxury/refined, playful/toy-like, editorial/magazine, brutalist/raw, art deco/geometric, soft/pastel, industrial/utilitarian, etc. There are so many flavors to choose from. Use these for inspiration but design one that is true to the aesthetic direction.
- **Constraints**: Technical requirements (framework, performance, accessibility).
- **Differentiation**: What makes this UNFORGETTABLE? What's the one thing someone will remember?

**CRITICAL**: Choose a clear conceptual direction and execute it with precision. Bold maximalism and refined minimalism both work - the key is intentionality, not intensity.

Then implement working code (HTML/CSS/JS, React, Vue, etc.) that is:
- Production-grade and functional
- Visually striking and memorable
- Cohesive with a clear aesthetic point-of-view
- Meticulously refined in every detail

## Frontend Aesthetics Guidelines

Focus on:
- **Typography**: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter; opt instead for distinctive choices that elevate the frontend's aesthetics; unexpected, characterful font choices. Pair a distinctive display font with a refined body font.
- **Color & Theme**: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes.
- **Motion**: Use animations for effects and micro-interactions. Prioritize CSS-only solutions for HTML. Use Motion library for React when available. Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions. Use scroll-triggering and hover states that surprise.
- **Spatial Composition**: Unexpected layouts. Asymmetry. Overlap. Diagonal flow. Grid-breaking elements. Generous negative space OR controlled density.
- **Backgrounds & Visual Details**: Create atmosphere and depth rather than defaulting to solid colors. Add contextual effects and textures that match the overall aesthetic. Apply creative forms like gradient meshes, noise textures, geometric patterns, layered transparencies, dramatic shadows, decorative borders, custom cursors, and grain overlays.

NEVER use generic AI-generated aesthetics like overused font families (Inter, Roboto, Arial, system fonts), cliched color schemes (particularly purple gradients on white backgrounds), predictable layouts and component patterns, and cookie-cutter design that lacks context-specific character.

Interpret creatively and make unexpected choices that feel genuinely designed for the context. No design should be the same. Vary between light and dark themes, different fonts, different aesthetics. NEVER converge on common choices (Space Grotesk, for example) across generations.

**IMPORTANT**: Match implementation complexity to the aesthetic vision. Maximalist designs need elaborate code with extensive animations and effects. Minimalist or refined designs need restraint, precision, and careful attention to spacing, typography, and subtle details. Elegance comes from executing the vision well.

Remember: Claude is capable of extraordinary creative work. Don't hold back, show what can truly be created when thinking outside the box and committing fully to a distinctive vision.

## Available Agents

For performance validation of frontend implementations, delegate to this agent:
- **${PROJECT_NAME}-performance-auditor** — Core Web Vitals and rendering performance analysis. Prompt at \\\`\${CLAUDE_SKILL_DIR}[[/agents/performance-auditor.md]]\\\`
`;
