import { PROJECT_NAME, SUPPORTED_PLATFORMS_YAML, SKILL_CATEGORY } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Write internal communications — status reports, 3P updates (Progress /
  Plans / Problems), leadership updates, team newsletters, company-wide
  newsletters, FAQ responses, incident reports, internal memos, internal
  emails, all-hands summaries, weekly/bi-weekly/monthly updates. Use when
  the user says "write the 3P update", "draft the newsletter", "write the
  team update", "answer this FAQ", "internal memo", "leadership email",
  "status update for the team". Follows structured guideline files per
  comm type. Do NOT activate for external press releases, customer-facing
  emails, marketing copy (use a copywriting skill), or personal 1:1
  communications.
category: ${SKILL_CATEGORY.DEVELOPER_TOOLS}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 5
---

# {{name}} — Internal Comms

## When to Activate

- User needs to write a status report, 3P update, or leadership update
- User asks to draft a team newsletter, FAQ response, or incident report
- User needs any structured internal communication document

## Skip When

- User wants an external press release or PR announcement — use a marketing skill
- User wants a customer-facing email or outreach — use an external-comms approach
- User wants marketing copy for a landing page or campaign — use a copywriting skill
- User wants a 1:1 personal message — just draft it directly, no template needed

## How to use this skill

To write any internal communication:

1. **Identify the communication type** from the request
2. **Load the appropriate guideline file** from the \\\`references/\\\` directory:
    - \\\`\${CLAUDE_SKILL_DIR}[[/references/3p-updates.md]]\\\` — for Progress / Plans / Problems team updates
    - \\\`\${CLAUDE_SKILL_DIR}[[/references/company-newsletter.md]]\\\` — for company-wide newsletters
    - \\\`\${CLAUDE_SKILL_DIR}[[/references/faq-answers.md]]\\\` — for answering frequently asked questions
    - \\\`\${CLAUDE_SKILL_DIR}[[/references/general-comms.md]]\\\` — for anything else that doesn't explicitly match one of the above
3. **Follow the specific instructions** in that file for formatting, tone, and content gathering

If the communication type doesn't match any existing guideline, ask for clarification or more context about the desired format.
`;
