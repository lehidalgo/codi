import { PROJECT_NAME } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Iron Law 9 — proactively emit capture markers when the user states a rule,
  prohibition, preference, feedback, insight, observation, decision, question,
  prompt, or correction. The agent persists; the user never has to. False
  negatives are tolerated; false positives are not. Markers go at the end of
  the response in the form pipe TYPE colon space quoted-content pipe.
priority: high
alwaysApply: true
managed_by: ${PROJECT_NAME}
version: 4
---

# Capture Everything (Iron Law 9)

## Core Rule

The agent MUST emit \\\`|TYPE: "verbatim content"|\\\` markers at the **end** of any response that detected one of the canonical capture types. The dev never persists manually; the agent is responsible for proactive capture.

## Canonical capture types (closed set)

This list is exhaustive. The parser auto-promotes any marker with a
non-canonical TYPE to \\\`OBSERVATION\\\`, prefixing the content with
\\\`[unknown_type=<RAW>]\\\` and preserving the literal marker in the
\\\`raw_marker\\\` column. A stderr warning is also emitted so the typo
is visible during the session. Prefer the canonical type whenever it
fits — auto-promotion is a safety net, not the default path. Synonyms
to avoid: \\\`BUG\\\`, \\\`ERROR\\\`, \\\`NOTE\\\`, \\\`TODO\\\`,
\\\`HIGHLIGHT\\\`.

| Type | When to emit |
|------|--------------|
| \\\`RULE\\\` | The user states a normative rule for future behavior. |
| \\\`PROHIBITION\\\` | The user forbids an action ("never", "don't", "stop"). |
| \\\`PREFERENCE\\\` | The user expresses a non-binding preference. |
| \\\`FEEDBACK\\\` | The user evaluates the agent's work positively or negatively. |
| \\\`INSIGHT\\\` | The user reveals a non-obvious fact about the codebase, team, or domain. |
| \\\`OBSERVATION\\\` | The agent itself notices a pattern worth recording. |
| \\\`DECISION\\\` | The user picks one path among presented options. |
| \\\`QUESTION\\\` | The user asks something that should be answered later, not now. |
| \\\`PROMPT\\\` | The user provides reusable wording the agent should remember. |
| \\\`CORRECTION\\\` | The user fixes a mistake the agent made — always high-severity. |
| \\\`DEFECT\\\` | The agent finds a real bug in code (file:line + symptom + fix hint). |

## Format

\\\`\\\`\\\`
|TYPE: "single-line verbatim content"|
\\\`\\\`\\\`

- Exactly one type, ONE colon, ONE space, then the content in straight double quotes.
- Embedded quotes escape as \\\`\\\\"\\\`. No multi-line content.
- Multiple markers per turn are allowed; emit them in the order the events occurred.
- Place markers at the **end** of the agent response — after all prose / code / tool reports.

## False-positive policy

A false positive — capturing something the user didn't actually say — pollutes the brain and is **NOT** tolerated. A false negative — missing a real rule — is recoverable via offline consolidation. When unsure: do not emit.

## When not to emit

- The user is asking a question (not stating a rule).
- The "rule" is one-shot guidance for THIS turn only ("do this once").
- The content is already captured earlier in the same session.
- The agent itself is the speaker (use \\\`OBSERVATION\\\` for genuine pattern detection, never to record the agent's own opinions).

## Examples

User: "Always commit at the end of a session, never per fix."
Agent: ... → \\\`|RULE: "commit at end of session, not per fix"|\\\`

User: "Don't use git worktrees in this project."
Agent: ... → \\\`|PROHIBITION: "no git worktrees in this project"|\\\`

User: "Yes, the bundled PR was the right call here."
Agent: ... → \\\`|FEEDBACK: "single bundled PR preferred over splits in this area"|\\\`

User: "No, that's not right — \\\`pnpm\\\` not \\\`npm\\\`."
Agent: corrects + → \\\`|CORRECTION: "use pnpm not npm"|\\\`

## Boundary

This rule defines **emission**. The runtime parser (\\\`src/runtime/capture/markers.ts\\\`) deduplicates by \\\`(turn_id, raw_marker)\\\` and persists into the \\\`captures\\\` table. Re-emitting the same marker on a subsequent turn is harmless.
`;
