import { PROJECT_NAME, SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Use when starting ${PROJECT_NAME} in a repository for the first time, when
  CONTEXT.md is missing, or when ${PROJECT_NAME} run blocks with
  KnowledgeBaseMissingError. Bootstraps the project knowledge base by scanning
  the codebase, proposing canonical domain terms for human approval, and
  writing docs/CONTEXT.md and docs/adr/. Runs as a forked subagent so the
  bootstrap analysis does not pollute the main session context. Not for
  routine updates to CONTEXT.md (those happen inline during workflow phases).
category: ${SKILL_CATEGORY.DEVELOPER_WORKFLOW}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 1
---

# {{name}}

Bootstrap the ${PROJECT_NAME} knowledge base for a repository. Runs once per repo. Produces \\\`docs/CONTEXT.md\\\` (domain glossary) and \\\`docs/adr/\\\` (decisions directory). Forked-subagent execution keeps the main session clean (see contract.json \\\`fork_policy\\\`).

## When to use

- \\\`${PROJECT_NAME} run <type> "<task>"\\\` blocks with \\\`KnowledgeBaseMissingError\\\` → agent invokes this skill automatically.
- User asks "set up the knowledge base" or equivalent.
- User wants to repair after accidental deletion.

## When to skip

- \\\`docs/CONTEXT.md\\\` already exists with content → use \\\`discover\\\` mode \\\`domain\\\` or \\\`architecture-review\\\` for ongoing updates.

## Process

1. **Scan the codebase** for recurring nouns, unique terms, acronyms, and domain-specific verbs. Read \\\`README.md\\\`, \\\`package.json\\\` (or equivalent), top-level source directories, representative source files. See \\\`references/scanning.md\\\` for the full procedure.
2. **Propose initial term set** — numbered list, 5-15 high-value terms, grouped by Entities / Actions / Roles / Domain concepts. Format per \\\`references/term-format.md\\\`.
3. **Get explicit human approval per term** (HARD GATE — approve / edit / reject). Disagreements about vocabulary are the point.
4. **Write \\\`docs/CONTEXT.md\\\`** in the canonical format (see \\\`references/context-md-template.md\\\`).
5. **Create \\\`docs/adr/\\\`** with a placeholder README.
6. **Report completion** with term count and a pointer to start the workflow.

## Anti-patterns

- Inventing terms not used in the codebase.
- Importing generic terms ("User", "Account") when the project uses different language ("Customer", "Tenant").
- Writing ADRs in this skill — ADRs come from real trade-offs surfaced during workflows.
- Auto-approving terms — every term requires human confirmation (HARD GATE).
- Overwriting existing \\\`CONTEXT.md\\\` — that is an update, not bootstrap.

## References

- \\\`references/scanning.md\\\` — codebase scanning procedure (what to read, in what order, what to look for).
- \\\`references/term-format.md\\\` — per-term format (Term / Definition / Evidence / Avoid).
- \\\`references/context-md-template.md\\\` — full \\\`docs/CONTEXT.md\\\` template with Language / Relationships / Flagged ambiguities sections.

## Termination

- Knowledge base bootstrapped → \\\`context_term_added\\\` events emitted per approved term → \\\`docs/CONTEXT.md\\\` and \\\`docs/adr/\\\` written → user can run their workflow.
- If \\\`CONTEXT.md\\\` already exists → stop and report; do not overwrite.

## Boundaries

- Bootstraps the knowledge base. Does NOT handle ongoing updates (those go through \\\`discover\\\` mode \\\`domain\\\` or \\\`architecture-review\\\`).
- Does NOT write ADRs (those come from workflow-driven decisions).
- Forked-by-design — main session context preserved.
`;
