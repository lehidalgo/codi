import { PROJECT_NAME, SUPPORTED_PLATFORMS_YAML, SKILL_CATEGORY } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Create a structured roadmap or persistent todo list as a JSON file in
  \\\`docs/roadmaps/\\\`. Use when the user plans features, tracks
  milestones, breaks down an epic, organizes phase-based work, or drafts
  a product roadmap. Also activate for phrases like "create a roadmap",
  "plan next steps", "feature roadmap", "Q3 plan", "milestone tracking",
  "epic breakdown", "phase-based plan", "multi-phase rollout", "product
  roadmap". Output is JSON (priority, status, dependencies). Do NOT
  activate for in-session task tracking (use TaskCreate), implementation
  plans (use ${PROJECT_NAME}-plan-writer after ${PROJECT_NAME}-brainstorming),
  or daily progress logs (use ${PROJECT_NAME}-daily-log).
category: ${SKILL_CATEGORY.PLANNING}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 5
---

# {{name}} — Roadmap

## When to Activate

- User wants to create a structured task list or roadmap for a feature or project
- User asks to plan out next steps in a persistent format
- User needs a trackable task list saved to the repository

## Skip When

- Short-lived in-session task tracking — use TaskCreate instead of a persistent roadmap
- Concrete implementation plan (file paths + TDD steps) — use ${PROJECT_NAME}-plan-writer
- Design exploration before the roadmap — use ${PROJECT_NAME}-brainstorming first
- Daily session log or end-of-day summary — use ${PROJECT_NAME}-daily-log

## Workflow

### Step 1: Gather Requirements

**[CODING AGENT]** Understand the scope:
- What feature, epic, or project is being planned?
- What is the target completion or priority?
- Are there dependencies or blockers to capture?

### Step 2: Structure the Roadmap

**[CODING AGENT]** Organize tasks with:
- Clear task descriptions
- Priority levels (high / medium / low)
- Status tracking (pending / in-progress / done)
- Dependencies between tasks where relevant

### Step 3: Save to File

**[SYSTEM]** Save the roadmap:
- Use the template at \`docs/roadmap-template.json\` if it exists
- Save to \`docs/roadmaps/\` directory
- Filename convention: \`YYYYMMDD_HHMM_roadmap_name.json\`
`;
