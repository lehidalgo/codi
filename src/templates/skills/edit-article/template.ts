import { PROJECT_NAME, SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Edit and improve articles by restructuring sections, improving clarity, and tightening prose. Use when the user wants to edit, revise, or improve an article draft. Skip for pure copy-edits with no structural change (typo fixes belong in a regular edit, not a skill invocation).
category: ${SKILL_CATEGORY.CONTENT_REFINEMENT}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 1
maintainers: ["@lehidalgo"]
---

# {{name}} — Edit Article

1. First, divide the article into sections based on its headings. Think about the main points you want to make during those sections.

   Consider that information is a directed acyclic graph, and that pieces of information can depend on other pieces of information. Make sure that the order of the sections and their contents respects these dependencies.

   Confirm the sections with the user.

2. For each section:

   2a. Rewrite the section to improve clarity, coherence, and flow. Use maximum 240 characters per paragraph.
`;
