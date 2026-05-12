import { PROJECT_NAME, SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Team consolidation workflow — collect brain DBs from N devs, analyze cross-team patterns, and produce a consensus-candidate markdown report. Use when a team lead wants to extract collective knowledge from multiple devs' brain.db files and feed it back into artifact improvements. Activates on /\${PROJECT_NAME}-team-consolidation, "team consolidation", "consolidate team brains", "cross-dev analysis", "team knowledge extraction". Manages 5 phases: intent (scope + mode + path), collect (list and validate brains), analyze (read each DB), consolidate (write report). Workflow stops at the report — does NOT mutate artifacts. Mutations happen via existing meta-skills (refine-rules, artifact-contributor) after team consensus on the report. Skip when working with a single dev brain (use existing meta-skills directly), when there is no cross-dev knowledge to consolidate, or when the lead just wants brain UI browsing.
category: ${SKILL_CATEGORY.DEVELOPER_WORKFLOW}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 1
---

# {{name}}

Cross-dev brain analysis. The team lead drops every dev's \\\`brain.db\\\` into a shared directory; the agent walks the corpus and writes a markdown report ready for team consensus review. After consensus, existing meta-skills consume the report and mutate artifacts.

## When to use

User wants to consolidate brain captures from multiple devs into one analysis. Typical phrasings:

- "Run team consolidation"
- "Consolidate the team's brain DBs"
- "Analyze what the team learned this sprint"
- /${PROJECT_NAME}-team-consolidation

Start the workflow:

\\\`\\\`\\\`bash
${PROJECT_NAME} run team-consolidation "<one-line description of the consolidation cycle>"
\\\`\\\`\\\`

## When to skip

- Single brain.db analysis → use brain UI directly (\\\`${PROJECT_NAME} brain ui\\\`).
- Need to apply already-known artifact changes → use the relevant meta-skill directly (\\\`refine-rules\\\`, \\\`rule-creator\\\`, \\\`skill-creator\\\`).
- No prior captures collected → the brain DBs need work sessions first; this workflow has nothing to analyze.

## Phase order

| Phase         | Purpose                                                        | Detail                              |
| ------------- | -------------------------------------------------------------- | ----------------------------------- |
| \\\`intent\\\`      | Confirm scope, mode (sequential/parallel), brains path         | \\\`references/phase-intent.md\\\`      |
| \\\`collect\\\`     | List brain.db files, validate each is a Codi brain             | \\\`references/phase-collect.md\\\`     |
| \\\`analyze\\\`     | Read each DB, produce per-dev findings                         | \\\`references/phase-analyze.md\\\`     |
| \\\`consolidate\\\` | Cross-reference findings, write the consensus-candidate report | \\\`references/phase-consolidate.md\\\` |
| \\\`done\\\`        | Workflow ends; lead receives next-step instructions            | terminal                            |

## Core principle

**Workflow produces information, not mutations.** The output is a free-form markdown report at \\\`docs/YYYYMMDD_HHMMSS_[REPORT]_team-consolidation.md\\\`. The team reaches consensus async (PR review, Slack, live meeting) by marking each finding APPROVED / REJECTED / DEFERRED in the report. Then the lead invokes existing meta-skills passing the report path:

- \\\`/${PROJECT_NAME}-dev-refine-rules <report-path>\\\` — for domain rule edits/creates
- \\\`/${PROJECT_NAME}-dev-artifact-contributor <report-path>\\\` — for upstream PR candidates
- Manual invocation of \\\`rule-creator\\\` / \\\`skill-creator\\\` / \\\`agent-creator\\\` for edge cases

## Schema reference

The agent reads \\\`references/schema-reference.md\\\` once during the \\\`analyze\\\` phase. It documents every brain DB table the agent may query (no allowlist, no privacy filtering — the dev controls what they contribute).

## Anti-patterns

- Mutating artifacts during the workflow. The workflow STOPS at "report written".
- Building dedup logic in framework code. The agent does dedup in its context using LLM cognition.
- Adding privacy scrubbing inside the workflow. The dev controls their brain.db before contributing.
- Auto-triggering the workflow. Always user-invoked.
- Writing JSON sidecar to disk. Markdown report is the only output.

## References

- \\\`references/phase-intent.md\\\`
- \\\`references/phase-collect.md\\\`
- \\\`references/phase-analyze.md\\\`
- \\\`references/phase-consolidate.md\\\`
- \\\`references/schema-reference.md\\\`
`;
