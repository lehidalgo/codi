import { PROJECT_NAME } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Instructs the agent to emit structured CODI-* markers during the session so the Stop hook can capture decisions.
priority: medium
alwaysApply: true
managed_by: ${PROJECT_NAME}
version: 3
---

# {{name}} — Codi Brain Capture

## Marker schema (emit inline during the session)

\\\`\\\`\\\`
<CODI-DECISION@v1>
{"title": "<concise, <200 chars>", "reason": "<1 sentence>", "tags": ["<tag1>", "<tag2>"]}
</CODI-DECISION@v1>
\\\`\\\`\\\`

\\\`\\\`\\\`
<CODI-HOT@v1>
{"body": "<current session focus>"}
</CODI-HOT@v1>
\\\`\\\`\\\`

\\\`\\\`\\\`
<CODI-NOTE@v1>
{"title": "...", "body": "multiline ok", "tags": ["..."]}
</CODI-NOTE@v1>
\\\`\\\`\\\`

Body is JSON — any characters (brackets, pipes, quotes) are safe inside JSON strings.

## When to emit

- After a concrete technology / library / tool choice
- After an architecture or design decision
- After identifying a root cause + fix during debugging
- When the user says "remember this" / "save this" / "let's go with X"
- At the start of a focused work session → emit a CODI-HOT marker

## When NOT to emit

- For exploratory back-and-forth
- For questions or information requests
- For ideas the user considered and rejected
- When the user says "don't save this" / "this is private"
- For content containing secrets, credentials, or PII (rely on redaction only as a last resort, never as a primary control)

## Rules

- One decision per marker — do not bundle unrelated decisions.
- Title concise (<200 chars).
- Tags: 1-5 lowercase kebab-case.
- Separate multiple markers with a blank line.
- The Stop hook captures markers automatically — do not also call the CLI unless a user-invocable skill (/codi-brain-decide) explicitly tells you to.
`;
