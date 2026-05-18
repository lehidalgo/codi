import { PROJECT_NAME, SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Compact the current conversation into a handoff document so a fresh agent can pick up the work without re-reading the transcript. Use when the user says "hand off", "handoff", "summarise for the next session", "pass this to another agent", "wrap this up for tomorrow", or when the conversation is long enough that a fresh context window would help. Skip when natural artefacts (PR description, ADR, commit messages) already serve the same purpose.
category: ${SKILL_CATEGORY.DEVELOPER_WORKFLOW}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
argument-hint: "What will the next session be used for?"
version: 1
maintainers: ["@lehidalgo"]
---

# {{name}} — Handoff

Write a handoff document summarising the current conversation so a fresh agent can continue the work. Save it to a path produced by \`mktemp -t handoff-XXXXXX.md\` (read the file before you write to it).

Suggest the skills to be used, if any, by the next session.

Do not duplicate content already captured in other artifacts (PRDs, plans, ADRs, issues, commits, diffs). Reference them by path or URL instead.

If the user passed arguments, treat them as a description of what the next session will focus on and tailor the doc accordingly.
`;
