# Pipeline 4 — Operations: Design Spec

**Date:** 2026-04-04  
**Status:** Approved  
**Category:** Developer Workflow

---

## Context

Codi has 3 pipelines (Implementation, Content, Quality) and a shared discipline layer (TDD, debugging, verification). These pipelines cover feature work, content creation, and reactive quality tasks. They do not cover two important operational patterns:

1. **First-time guided execution** — a user performs a setup, config, infra, or deployment task for the first time and needs structured guidance, documented step by step as they go. The agent and user work as a team: the agent reasons, plans, and executes what it can; the user performs actions requiring credentials, browser access, or external systems.

2. **Iterative audit-and-fix** — a user wants to process a list of items (audit findings, migration checklist, lint backlog, security fix list) one at a time with evidence gathering, a fix proposal, and explicit approval before each implementation.

Both patterns share a need for structured investigation before action and structured documentation after action.

---

## Architecture

### Pipeline 4 — Operations

Two entry points sharing a common evidence and documentation layer:

```
Entry A: codi-guided-execution
  → [per step] codi-evidence-gathering → codi-verification → codi-step-documenter
  → Final summary: docs/executions/<workflow>/README.md

Entry B: codi-audit-fix
  → [per item] codi-evidence-gathering → codi-verification → commit
```

Shared discipline layer applies to both entries: `codi-verification`, `codi-debugging`, `codi-tdd` when applicable.

---

## Skills

### codi-evidence-gathering (shared)

**Pattern:** Gate/Evidence (like codi-verification)  
**Role:** Structured investigation before proposing any change or evaluating any item

**When to use:** Before any fix proposal, audit evaluation, or step validation. Also standalone for "investigate X before we change it."

**Protocol (5 steps):**
1. **FRAME** — Write the question explicitly before searching
2. **SEARCH** — Use tools in priority order: graph-code MCP → Grep/Glob → Read → Tests → Web research
3. **COLLECT** — Build evidence table: Finding | Source | File:Line | Confidence
4. **ANALYZE** — Separate confirmed facts from inferences from unverified assumptions
5. **REPORT** — Present question, evidence table, analysis, conclusion, open questions

**Iron Law:** No conclusions without evidence. No evidence without tool usage. No tool usage without a question to answer.

---

### codi-step-documenter (shared)

**Pattern:** Gate/Evidence  
**Role:** Generates structured step completion documents after each validated workflow step

**When to use:** After `codi-guided-execution` validates a step, or standalone to document completed work retroactively.

**Output:** `docs/executions/<workflow-name>/step-NN-<step-slug>.md`

**Document sections (14):** Step Title, Objective, Why This Step Matters, Initial Situation, Actions Performed, Agent Contributions, User Contributions, Commands/Inputs/Config Used, Decisions Made, Problems Encountered, Outcome, How We Validated, Reusable Guide, Next Step.

**Directory setup:** Creates `docs/executions/<workflow-name>/` and a README index on the first step.

**Iron Law:** Every completed step must leave behind a document good enough for someone else to repeat it from scratch.

---

### codi-audit-fix (Pipeline 4 Entry B)

**Pattern:** Phased/Systematic (like codi-debugging)  
**Role:** One-item-at-a-time audit processor with approval gates and per-item commits

**When to use:** Processing a list of audit findings, migration items, lint backlog, security fix list, or any batch requiring individual evidence + approval.

**Three phases per item:**
- **Phase 1 — Build TODO List:** Analyze scope, create one task per item, present for review, lock the list
- **Phase 2 — Process Current Item:** Invoke `codi-evidence-gathering` → evaluate → prepare Fix Proposal (Problem, Root Cause, Proposed Fix, Impact, Validation Plan) → present → STOP → wait for approval
- **Phase 3 — Close Item:** Implement → validate → invoke `codi-verification` → commit → attempt graph update → mark completed

**Iron Laws:**
- One item at a time. Always.
- No fix proposal without evidence. No exceptions.
- No implementation without explicit user approval. No exceptions.
- One commit per item. Traceability is non-negotiable.

**Escalation:** After 3+ items with the same root cause, flag the pattern and propose a systematic approach.

---

### codi-guided-execution (Pipeline 4 Entry A)

**Pattern:** Orchestrator (like codi-brainstorming)  
**Role:** Collaborative step-by-step execution for first-time technical processes

**When to use:** First-time setup, environment config, infrastructure, deployment, operational workflows where agent and user collaborate with documentation at each step.

**9-step checklist:**
1. Understand the goal
2. Build the master task list
3. Present the execution plan
4. Execute the current step
5. Validate the step
6. Document the step
7. Update the task list
8. Repeat steps 4–7
9. Generate workflow summary

**7-phase step execution protocol (per step):**
1. Step framing
2. Context and rationale
3. Responsibility split (agent vs user)
4. Action instructions
5. Feedback loop (wait for user output)
6. Validation (evidence-gathering + verification)
7. Step closure (step-documenter)

**Responsibility model:**

| Agent Does | User Does |
|-----------|-----------|
| Code changes and file creation | External service configuration |
| CLI commands within the project | Commands requiring elevated credentials |
| Analysis, planning, documentation | Browser actions, visual confirmation |
| Proposing decisions | Approving decisions |

**Troubleshooting mode:** When validation fails, invoke `codi-debugging`, targeted fix, re-validate. Escalate to user after 3 cycles.

**Iron Laws:**
- Never execute a step without explaining what, why, and who does it.
- Never move to the next step without validating the current one.
- Every completed step must produce a written document.

---

## Design Decisions

**Why a separate `codi-evidence-gathering` skill rather than inlining investigation into each orchestrator?**  
Both `codi-audit-fix` and `codi-guided-execution` require structured investigation. Extracting it into a shared skill ensures the investigation protocol is consistent, updateable in one place, and usable standalone or by other pipelines (e.g., `codi-debugging` Phase 1).

**Why `docs/executions/` for step documents?**  
Step documents accumulate per workflow. Keeping them in a dedicated `docs/executions/<workflow>/` subdirectory keeps them discoverable and organized without polluting the flat `docs/` root. The README index per workflow provides navigation.

**Why one commit per audit-fix item?**  
Granular commits preserve traceability. When a fix introduces a regression, the offending commit is immediately identifiable and revertable without undoing unrelated changes.

**Why "always on" for guided execution's teaching style?**  
Advanced users can move through approval gates quickly. Beginners need the explanations. Always-on is safer than a mode switch that requires configuration.

---

## Verification

1. `pnpm tsc --noEmit` — confirm no new TypeScript errors in new files
2. `pnpm test` — confirm no regressions
3. `loadSkillTemplate("codi-evidence-gathering")` returns `ok: true`
4. `codi add skill codi-guided-execution` in a test project — confirm SKILL.md scaffolds correctly
5. `codi validate` after scaffolding — confirm frontmatter validates
