# Skills Consolidation Plan
- **Date**: 2026-04-17 14:43
- **Document**: 20260417_144337_[PLAN]_skills-consolidation.md
- **Category**: PLAN

## Goal

Collapse the Codi skill catalog from **66 → 56** by merging 17 redundant skills into 7 unified skills, and reposition 7 format skills as content-factory export backends. No functionality loss — only consolidation of overlapping entry points.

## Scope

Edits happen **only at the source layer**: `src/templates/skills/`. Per the audit-source-only rule, no build / reinstall / regenerate per iteration. A single build + reinstall + regenerate at the end of the session.

## Merge Matrix

| # | Target Skill | Merges | Action |
|---|---|---|---|
| 1 | `feedback-loop` | `rule-feedback` + `skill-feedback-reporter` + `refine-rules` | Create new skill dir; delete 3 old |
| 2 | `session-state` | `session-handoff` + `daily-log` + `session-recovery` | Create new skill dir; delete 3 old |
| 3 | `codebase-context` | `codebase-explore` + `codebase-onboarding` + `graph-sync` | Create new skill dir; delete 3 old |
| 4 | `debugging` (tiered) | `debugging` + `diagnostics` | Expand existing `debugging`; delete `diagnostics` |
| 5 | `testing` | `test-run` + `test-coverage` | Rename `test-run` → `testing`; absorb coverage; delete `test-coverage` |
| 6 | `plan-execution` | `plan-executor` + `subagent-dev` | Create new skill; delete 2 old |
| 7 | `content-factory` (expanded) | `content-factory` + `doc-engine` | Expand `content-factory`; delete `doc-engine`; reposition Tier 3 exporters |

## Out of Scope (Retracted from Tier 1)

- `project-documentation` + `dev-docs-manager` — complementary (consumer vs Codi-internal), keep separate
- `brand-creator` + `codi-brand` — intentional pair, keep separate
- Dev lifecycle quartet, Creators quartet, Visual design trio — keep separate

## Tier 3 Repositioning (No Merge, Description Rewrite Only)

Update frontmatter `description:` on 7 format skills to position them as content-factory callees rather than primary entry points:

- `pptx`, `docx`, `pdf`, `xlsx`, `slack-gif-creator`, `box-validator`, `theme-factory`

## Sequencing — Merge Order by ROI

1. **feedback-loop** (smallest, cleanest 3-phase pipeline, lowest risk)
2. **session-state** (3 skills with near-identical output format)
3. **codebase-context** (3 graph-tied skills, tight scope)
4. **debugging** tiered (2-skill simple merge with existing target)
5. **testing** (2-skill simple merge with rename)
6. **plan-execution** (2-skill merge, touches subagent orchestration)
7. **content-factory + doc-engine + Tier 3 reposition** (largest, strategic, last)

Each merge = one atomic commit. Commit at the end of the session (per commit-timing feedback), not between merges.

## Per-Merge Execution Template

Each merge follows the same 7-step flow:

1. **Read** the 2-3 source templates in full (`template.ts`)
2. **Identify** unique content per source skill + shared/duplicated sections
3. **Design** the merged SKILL.md outline (phases or modes preserving each skill's unique mechanics)
4. **Write** new `src/templates/skills/<target>/template.ts` with merged content
5. **Copy** `evals/`, `references/`, `assets/`, `agents/` subdirs from sources into target as needed
6. **Delete** source skill directories
7. **Update** `src/templates/skills/index.ts` to register target and drop sources
8. **Bump** `version:` in frontmatter (per version-bump-per-edit feedback)

## Additional File Updates (Per Merge)

- `src/core/version/artifact-version-baseline.json` — add target, remove sources
- `src/constants.ts` — update skill lists / counts if referenced
- `src/cli/artifact-categories.ts` — update category lists if referenced
- Cross-references in other skills' `Skip When` sections — replace deleted skill names with target
- `.codi/artifact-manifest.json` — NOT edited by us; regenerated at session end

## Single End-of-Session Finalization

After all 7 merges are in `src/templates/`:

```bash
pnpm build
# For each deleted skill: rm -rf .codi/skills/<old-name>
# Prune artifact-manifest.json of deleted entries
# codi add skill <target> --template <target>  (for each new target)
codi generate --force
```

Then one commit with all 7 merges.

## Cross-Reference Audit

Before any merge lands, grep for references to the skills being deleted:

```bash
grep -rn "rule-feedback\|skill-feedback-reporter\|refine-rules" src/templates/
grep -rn "session-handoff\|daily-log\|session-recovery" src/templates/
# etc.
```

Every hit is a required edit. Missing one leaves a dangling skill reference.

## Risks

| Risk | Mitigation |
|---|---|
| Merged SKILL.md exceeds artifact char limit | Check `MAX_ARTIFACT_CHARS` per merge; split into phases with reference files if needed |
| Trigger description becomes too broad → false activations | Keep explicit "Skip When" section listing original scope boundaries |
| User muscle memory on deleted slash commands (e.g., `/codi-refine-rules`) | Accept breakage; this is a major version bump anyway |
| Evals coverage gaps on merged skill | Concatenate existing evals; may need new cases for mode-switching |
| Version baseline drift | Update `artifact-version-baseline.json` in same commit as merge |

## Per-Merge Details

### Merge 1 — feedback-loop (3 → 1)

- **Phase 1 (observe):** content from `rule-feedback` — emits `[CODI-OBSERVATION: ...]` markers
- **Phase 2 (aggregate):** content from `skill-feedback-reporter` — reads `.codi/feedback/`, groups by artifact
- **Phase 3 (refine):** content from `refine-rules` — reviews feedback, proposes improvements with approval
- **Mode dispatch:** frontmatter description lists triggers for each phase; SKILL.md routes internally

### Merge 2 — session-state (3 → 1)

- **Mode: handoff** — context-full trigger → produces handoff prompt
- **Mode: daily-log** — day-end or start-of-day trigger → appends to daily log JSON
- **Mode: recovery** — 2+ self-corrections detected → produces diagnostic report

### Merge 3 — codebase-context (3 → 1)

- **Mode: explore** — navigate via code graph, find callers, dependencies
- **Mode: onboard** — explore + persist Project Context block into CLAUDE.md/AGENTS.md
- **Mode: sync** — reindex the graph when stale

### Merge 4 — debugging (tiered)

- **Tier 1 (default):** existing `debugging` content — root cause, first-line fix
- **Tier 2 (escalate):** content from `diagnostics` — MCP-powered analysis after Tier 1 stalls
- Trigger: `--escalate` or 2+ failed Tier 1 attempts

### Merge 5 — testing (2 → 1)

- **Mode: run** — detect framework, run suite, triage failures (existing `test-run`)
- **Mode: coverage** — run + coverage report + gap analysis (existing `test-coverage`)
- Rename `src/templates/skills/test-run/` → `src/templates/skills/testing/`

### Merge 6 — plan-execution (2 → 1)

- **Mode: inline (`plan-executor`):** sequential execution with checkpoints
- **Mode: subagent (`subagent-dev`, default per existing recommendation):** dispatch subagent per task with two-stage review
- Frontmatter default: subagent mode

### Merge 7 — content-factory + doc-engine + Tier 3 reposition

- Absorb `doc-engine`'s branded-report generation into `content-factory`
- Update descriptions of 7 Tier 3 format skills (`pptx`, `docx`, `pdf`, `xlsx`, `slack-gif-creator`, `box-validator`, `theme-factory`) to position as content-factory callees
- No rename or delete for the 7 format skills — they remain standalone (format logic is substantial)

## Post-Merge Refactor (Deferred — Not in This Plan)

- Extract shared "capture intent" interview section into `references/artifact-authoring.md` for the 4 creator skills (`rule-creator`, `preset-creator`, `agent-creator`, `skill-creator`). Tracked separately.

## Verification

After all 7 merges + finalization:

1. `codi verify` — confirm counts match updated baseline
2. `codi list | grep -c skill` — should report 56 skills
3. `pnpm run test` — full test suite green
4. Manual trigger check — invoke each new target via its slash command, verify routing to correct phase/mode
5. Cross-reference sweep — zero hits for deleted skill names

## Next Steps

Awaiting approval to execute **Merge 1 (feedback-loop)** as the first atomic change.
