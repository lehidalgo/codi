import { PROJECT_NAME, SUPPORTED_PLATFORMS_YAML, SKILL_CATEGORY } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Step completion document generator. Invoked after each validated step in a
  ${PROJECT_NAME}-guided-execution workflow to produce a structured,
  reusable guide under \\\`docs/executions/<workflow-name>/\\\`. Also
  usable standalone to document a completed task retroactively. Activate
  for phrases like "document this step", "write up what we just did",
  "turn this into a reusable procedure", "document the completed task",
  "step doc", "runbook entry", "reproducible guide". Do NOT activate for
  README / ADR / general project docs (use
  ${PROJECT_NAME}-project-documentation), branded reports (use
  ${PROJECT_NAME}-doc-engine), or daily progress logs (use
  ${PROJECT_NAME}-daily-log).
category: ${SKILL_CATEGORY.DEVELOPER_WORKFLOW}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 8
---

# {{name}} — Step Documenter

## When to Activate

- After ${PROJECT_NAME}-guided-execution validates a step as complete
- Standalone: "Document what we just did as a reusable guide"
- When you want to turn completed work into a reproducible procedure

## Skip When

- User wants a README or general project docs — use ${PROJECT_NAME}-project-documentation
- User wants an ADR (architecture decision record) — use ${PROJECT_NAME}-project-documentation
- User wants a branded PDF report — use ${PROJECT_NAME}-doc-engine
- User wants a daily work log — use ${PROJECT_NAME}-daily-log
- The step has not been validated yet — run ${PROJECT_NAME}-verification first

## The Iron Law

> **Every completed step must leave behind a document good enough for someone else to repeat it from scratch.**

If the document would not let a new person reproduce the step, it is not complete.

## Step Document Template

Generate a markdown file with the following sections. Include all sections — leave a section blank with "N/A" only if it genuinely does not apply.

---

### [Step Title]

A concise, action-oriented name for the completed step (e.g., "Configure PostgreSQL connection", "Deploy to staging environment").

---

#### Objective

What this step was meant to achieve. One to three sentences.

---

#### Why This Step Matters

Plain-language explanation of why this step was necessary and what would break without it. Write for someone doing this for the first time.

---

#### Initial Situation

Describe the starting condition before the step began. What existed, what was missing, what state the system was in.

---

#### Actions Performed

Ordered list of all actions taken during the step. Be specific — include file names, commands, config values, and decisions made in sequence.

---

#### Agent Contributions

What the agent did: code written, files created, commands executed, analysis performed, documentation generated.

---

#### User Contributions

What the user did manually: external service configuration, authentication, browser actions, physical verification, approval gates.

---

#### Commands, Inputs, or Configuration Used

All commands, settings, parameters, file contents, environment variables, or other implementation details. Include exact values where safe to do so.

---

#### Decisions Made

Each relevant decision taken during the step and the reasoning behind it. Include alternatives that were considered and rejected.

---

#### Problems or Uncertainties Encountered

Blockers, failed attempts, ambiguities, troubleshooting notes. Include what was tried, what failed, and how it was resolved.

---

#### Outcome

The final result of the step. What now exists or works that did not before.

---

#### How We Validated Success

The exact verification performed and its result. Reference ${PROJECT_NAME}-verification output when available.

---

#### Reusable Guide

Rewrite the completed step as a clear standalone procedure that can be followed again in the future. Use numbered steps. Include all commands and expected outputs. Write as if the reader has no context from this session.

---

#### Next Step

The logical next action in the overall process.

---

## File Naming

Write the document to:

\`docs/executions/<workflow-name>/step-NN-<step-slug>.md\`

Where:
- \`<workflow-name>\` is a short kebab-case name for the overall workflow (e.g., \`postgres-setup\`, \`staging-deploy\`)
- \`NN\` is the zero-padded step number (01, 02, 03...)
- \`<step-slug>\` is a short kebab-case description of the step (e.g., \`install-dependencies\`, \`configure-env\`)

Example: \`docs/executions/postgres-setup/step-01-install-dependencies.md\`

## Directory Setup

On the first step of a new workflow:
1. Create the \`docs/executions/<workflow-name>/\` directory
2. Create a \`docs/executions/<workflow-name>/README.md\` index file with:
   - Workflow title and objective
   - Table linking each step doc as steps complete
   - Overall status (in progress / complete)

Update the README index after writing each step doc.

## Quality Check

Before finishing, verify the document meets these criteria:

- [ ] All sections present (or explicitly marked N/A)
- [ ] Commands are exact and reproducible, not paraphrased
- [ ] Reusable Guide could be followed without reading any other section
- [ ] Problems section captures any failures, not just the happy path
- [ ] Validation evidence is specific (not "it worked" — show the output)

## Integration

- Invoked by \`${PROJECT_NAME}-guided-execution\` at the end of each completed step.
- Receives validation output from \`${PROJECT_NAME}-verification\` for the "How We Validated" section.
- Produces the source material for the workflow summary doc at the end of \`${PROJECT_NAME}-guided-execution\`.
`;
