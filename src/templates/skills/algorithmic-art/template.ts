import { PROJECT_NAME, SUPPORTED_PLATFORMS_YAML, SKILL_CATEGORY } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Generative and algorithmic art with p5.js. Use when the user wants to create
  generative art, algorithmic art, computational art, creative coding sketches,
  p5.js sketches, flow fields, particle systems, Perlin noise fields, L-systems,
  recursive or parametric art, or any interactive artwork driven by seeded
  randomness. Also activate for phrases like "generative sketch", "noise field",
  "algorithmic composition", or "generative aesthetic movement". Do NOT activate
  for static illustrations, logo design, or data visualization — those have
  their own skills.
category: ${SKILL_CATEGORY.CREATIVE_AND_DESIGN}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 6
---

# {{name}} — Algorithmic Art

## When to Activate

- User asks for generative art, algorithmic art, or computational art
- User mentions p5.js, creative coding, flow fields, particle systems, Perlin noise, L-systems, Voronoi, or circle packing
- User wants an interactive artwork with seeded variation and parameter controls
- User wants an art piece built around a mathematical or philosophical concept
- User says "generative sketch", "noise field", "parametric art", "algorithmic composition"

## Skip When

- User asks for a static illustration, poster, or logo — route to canvas-design or frontend-design
- User asks for a data visualization (chart, graph, dashboard) — route to data-analytics or a viz library
- User asks for an animation unrelated to generative systems (lottie, CSS transitions)

## Output Shape

The skill produces two artifacts:

1. **Algorithmic Philosophy** — a 4-6 paragraph \\\`.md\\\` manifesto describing
   the computational aesthetic movement
2. **Interactive Viewer** — a single self-contained \\\`.html\\\` artifact built
   from the skill's viewer template, embedding the p5.js algorithm inline

## Process

### Step 1 — Interpret Intent

**[CODING AGENT]** Read the user's request. Identify the subtle conceptual
thread — the niche reference, mood, or mathematical idea that will become
the **quiet DNA** of the algorithm. This reference should enhance depth
without announcing itself (think jazz musician quoting another song).

### Step 2 — Write the Algorithmic Philosophy

**[CODING AGENT]** Compose a 4-6 paragraph manifesto naming and articulating
a generative aesthetic movement. The philosophy must describe:

- Computational processes and mathematical relationships
- Noise functions and randomness patterns
- Particle behaviors and field dynamics
- Temporal evolution, emergence, and parametric variation

Emphasize **meticulous craftsmanship** — the final algorithm should read as
the product of deep expertise, refined through countless iterations. Avoid
repeating the same point; each paragraph should add depth.

Read \\\`\${CLAUDE_SKILL_DIR}[[/references/philosophy-examples.md]]\\\` for
tone and shape references (Organic Turbulence, Quantum Harmonics, Recursive
Whispers, Field Dynamics, Stochastic Crystallization).

Output the philosophy as a \\\`.md\\\` file.

### Step 3 — Read the Viewer Template

**[CODING AGENT]** **Before writing any HTML**, Read
\\\`\${CLAUDE_SKILL_DIR}[[/assets/viewer.html]]\\\` in full. This file is the
**literal starting point** — not inspiration. Keep its FIXED sections
(header, sidebar structure, Anthropic branding, seed controls, action
buttons) exactly as shown. Replace only the VARIABLE sections (algorithm,
parameters, parameter UI controls).

Also read \\\`\${CLAUDE_SKILL_DIR}[[/assets/generator_template.js]]\\\` for
p5.js structure conventions.

### Step 4 — Implement the Algorithm

**[CODING AGENT]** Express the philosophy in code. The algorithm flows from
the philosophy, not from a menu of options:

- **Organic emergence** → accumulation, feedback loops, constrained randomness
- **Mathematical beauty** → ratios, trigonometry, precise geometric relationships
- **Controlled chaos** → bounded variation, bifurcation, order from disorder

Design parameters by asking "what qualities should be tunable?" — quantities,
scales, probabilities, ratios, angles, thresholds.

Read \\\`\${CLAUDE_SKILL_DIR}[[/references/p5js-patterns.md]]\\\` for the
seeded-randomness pattern, parameter object shape, canvas setup, sidebar
structure, and craftsmanship checklist.

### Step 5 — Assemble the Single-Artifact HTML

**[CODING AGENT]** Produce one self-contained \\\`.html\\\` file:

- p5.js from CDN (https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.7.0/p5.min.js)
- All code inline — no external files, no imports
- Fixed sidebar sections: Seed, Actions (Regenerate / Reset / Download PNG)
- Variable sidebar sections: Parameters (sliders, inputs), Colors (optional)
- Seed controls must work: prev/next/random/jump-to-seed/display
- Anthropic branding preserved (Poppins/Lora fonts, light colors, gradient)

### Step 6 — Validate

**[CODING AGENT]** Before returning, verify:

- [ ] Same seed always produces identical output
- [ ] All parameters have working UI controls
- [ ] Regenerate / Reset / Download PNG buttons function
- [ ] Sidebar order is Seed → Parameters → Colors (optional) → Actions
- [ ] HTML works standalone in a browser (no server needed)
- [ ] Philosophy \\\`.md\\\` and viewer \\\`.html\\\` are both delivered

## Constraints

- Do NOT copy the flow-field example from the template — build what the philosophy demands
- Do NOT create HTML from scratch — start from \\\`assets/viewer.html\\\`
- Do NOT use external files beyond the p5.js CDN
- Do NOT change the sidebar structure or Anthropic branding
- Do NOT omit seed reproducibility — \\\`randomSeed(seed)\\\` and \\\`noiseSeed(seed)\\\` are mandatory

## Related Skills

- **${PROJECT_NAME}-canvas-design** — static visual design (posters, logos, illustrations)
- **${PROJECT_NAME}-frontend-design** — production UI components, not generative art
`;
