# Skill Catalog Shrink — workflow-first focus

- **Date**: 2026-05-11 11:30
- **Document**: 20260511*113045*[PLAN]\_skill-catalog-shrink.md
- **Category**: PLAN
- **Status**: approved, ready for execution

## Executive summary

Reduce the Codi skill catalog from **84 → 69 skills** (−18%) by removing 7
niche skills, merging 4 overlapping skills, and chaining 5 currently-orphan
skills into the appropriate workflow phases. Codi self-customization
(meta-codi) and the agent-facing workflow entries are LOCKED — they stay by
default in every Codi install. Work is split into 6 atomic commits so each
can be reviewed and reverted independently.

## Pre-conditions (already done in earlier commits — do NOT re-do)

- `slack-gif-creator`, `canvas-design`, `theme-factory`, `algorithmic-art` —
  already deleted at the source layer in a prior session.

## Locked groups (NEVER touched by this plan)

### Workflow entries (6) — agent-facing layer for `codi workflow run X`

`bug-fix-workflow` · `feature-workflow` · `refactor-workflow` ·
`migration-workflow` · `project-workflow` · `team-consolidation-workflow`

Hard-referenced from `src/runtime/brain/render-chains.ts:86-90`,
`src/runtime/cli-handlers/workflow.ts:457-461`, `src/runtime/sync/*`.

### Meta-codi (16) — codi self-customization, by-default in every install

`agent-creator` · `skill-creator` · `rule-creator` · `preset-creator` ·
`artifact-contributor` · `compare-preset` · `refine-rules` · `rule-feedback` ·
`using-codi` · `brain-ui` · `dev-docs-manager` · `dev-e2e-testing` ·
`dev-operations` · `codi-brand` · `init-knowledge-base` · `mcp-ops`

### Workflow chains (20) — referenced by `chains:` in any workflow yaml

`discover` · `step-documenter` · `architecture-review` · `plan-writing` ·
`subagent-orchestration` · `tdd` · `plan-execution` · `worktrees` ·
`code-review` · `verify-evidence` · `gate-plan-coverage` ·
`gate-deep-modules` · `security-scan` · `sheets-sync` · `team-charter` ·
`brainstorming` · `roadmap` · `commit` · `diagnose` · `refactoring`

## Net change

| step                                                                       | skills | rules |
| -------------------------------------------------------------------------- | ------ | ----- |
| starting point                                                             | 84     | —     |
| commit 1 — drop 6 niche office-format / research                           | 78     | —     |
| commit 2 — drop `internal-comms`                                           | 77     | —     |
| commit 3 — merge `dispatching-parallel-agents`                             | 76     | —     |
| commit 4 — merge `plan-writer` → `plan-writing`                            | 75     | —     |
| commit 5 — merge `verification` + `evidence-gathering` → `verify-evidence` | 73     | —     |
| commit 6 — chain 5 orphans into workflow phases                            | 73     | —     |
| **final**                                                                  | **73** | —     |

(Note: starting count of 84 is pre-visual-deletes. Post-visual-deletes is 80;
applying commits 1-6 yields **69** skills as the user-facing catalog.)

---

## Commit 1 — Drop 6 niche office-format / research skills

### Skills removed (6)

`pdf` · `pptx` · `docx` · `xlsx` · `notebooklm` · `box-validator`

### Rationale

Office-format converters and research tools that do not serve day-to-day
software-development workflows. The team-focused lens treats document
production as a separate concern (handled by `content-factory` + a future
external export pipeline if needed).

### Files touched

For each skill `<name>` in the list above:

1. `rm -rf src/templates/skills/<name>/`
2. `src/templates/skills/index.ts` — remove the export line.
3. `src/core/scaffolder/skill-template-loader.ts` — remove the entry from
   `TEMPLATE_MAP` and `STATIC_DIR_MAP`.
4. Search for cross-references in other skills:
   `grep -l "<name>" src/templates/skills/*/template.ts` — strip any
   "use `X` for ..." mentions and bump the cross-referencer's `version:`.
5. Search runtime:
   `grep -rn "<name>" src/runtime/` — confirm zero hits before deletion.

### Validation

```bash
pnpm lint
pnpm test:unit
pnpm vitest run tests/unit/adapters/skill-generator.test.ts \
                tests/unit/cli/workflow.test.ts
```

### Commit message

```
refactor(skills): drop 6 niche skills outside dev-team workflow scope

Removes pdf, pptx, docx, xlsx, notebooklm, box-validator. These are
office-format converters and research tools that do not appear in any
workflow chain and do not serve daily dev-team activities. content-factory
remains for branded HTML output.

Plan: docs/20260511_113045_[PLAN]_skill-catalog-shrink.md
```

---

## Commit 2 — Drop `internal-comms`

### Rationale

Status reports, 3P updates, leadership emails, newsletters serve EM/PM/lead
roles, not IC dev workflow. PR descriptions + commit messages cover the
dev-to-dev communication surface. Removed in a separate commit so it can be
reverted independently if any team objects.

### Files touched

1. `rm -rf src/templates/skills/internal-comms/`
2. `src/templates/skills/index.ts`
3. `src/core/scaffolder/skill-template-loader.ts`
4. Cross-reference scrub: `grep -l "internal-comms" src/templates/`
5. Runtime check: `grep -rn "internal-comms" src/runtime/`

### Commit message

```
refactor(skills): drop internal-comms (EM/PM territory, not IC dev)
```

---

## Commit 3 — Merge `dispatching-parallel-agents` → `subagent-orchestration`

### Rationale

`dispatching-parallel-agents` is `internal: true`, `disable-model-invocation: true`.
Its triggers ("≥3 unrelated failures", "fan out", "dispatch agents") are a
strict subset of `subagent-orchestration`'s. The "iron law: independence
must be proven before dispatch" lives as a section inside the merged target.

### Files touched

1. `src/templates/skills/subagent-orchestration/template.ts` — append a new
   section "Parallel fan-out: independence iron law" with the content from
   `dispatching-parallel-agents/template.ts`. Bump `version:` (current → +1).
2. `rm -rf src/templates/skills/dispatching-parallel-agents/`
3. `src/templates/skills/index.ts`
4. `src/core/scaffolder/skill-template-loader.ts`
5. Cross-reference scrub: replace any `dispatching-parallel-agents` mention
   with `subagent-orchestration` in other templates and rules.

### Validation

```bash
pnpm lint
pnpm test:unit
grep -rn "dispatching-parallel-agents" src/ tests/   # must return 0 hits
```

### Commit message

```
refactor(skills): merge dispatching-parallel-agents into subagent-orchestration

dispatching-parallel-agents was internal: true and a strict subset of
subagent-orchestration. Folds the independence iron law as a parallel-mode
section. -1 skill, no functionality lost.
```

---

## Commit 4 — Merge `plan-writer` → `plan-writing`

### Rationale

`plan-writer` documents a TDD-task-breakdown mode that is functionally a
mode of `plan-writing`. The split forces the model to choose between two
near-identical entries.

### Files touched

1. `src/templates/skills/plan-writing/template.ts` — add a "TDD breakdown
   mode" section with the content from `plan-writer/template.ts`. Update
   `description:` to mention all three modes (PRD, decomposition, TDD
   breakdown). Bump `version:`.
2. `rm -rf src/templates/skills/plan-writer/`
3. `src/templates/skills/index.ts`
4. `src/core/scaffolder/skill-template-loader.ts`
5. Cross-reference scrub:
   `grep -l "plan-writer" src/templates/ src/runtime/`

### Validation

```bash
pnpm lint
pnpm test:unit
grep -rn "plan-writer" src/ tests/   # must return 0 hits (or only plan-writing)
```

### Commit message

```
refactor(skills): merge plan-writer into plan-writing as TDD-breakdown mode

plan-writer was a mode of plan-writing. Folds it as the third documented
mode (PRD / decomposition / TDD-breakdown). -1 skill, no functionality lost.
```

---

## Commit 5 — Merge `verification` + `evidence-gathering` → `verify-evidence`

### Direction (CRITICAL — different from one prior audit)

`verify-evidence` is **referenced by workflow chains** (bug-fix verify,
feature verify, refactor verify, migration verify). It is the merge
**target** that must be preserved. `verification` and `evidence-gathering`
are the **sources** that get folded in and deleted.

### Rationale

`verification`, `verify-evidence`, and `evidence-gathering` form one logical
gate: gather → verify → claim. Three skills for one responsibility forces
the model to pick the wrong one. Unify under `verify-evidence` (the chained
one) with two documented sub-phases.

### Files touched

1. `src/templates/skills/verify-evidence/template.ts`:
   - Update `description:` to absorb the "before claiming work is complete"
     trigger from `verification` and the "structured investigation before
     proposing changes" trigger from `evidence-gathering`.
   - Add two body sections: "Phase 1 — Gather" (from `evidence-gathering`)
     and "Phase 2 — Verify" (existing + content from `verification`).
   - Bump `version:`.
2. `rm -rf src/templates/skills/verification/`
3. `rm -rf src/templates/skills/evidence-gathering/`
4. `src/templates/skills/index.ts` — remove both exports.
5. `src/core/scaffolder/skill-template-loader.ts` — remove both entries.
6. Cross-reference scrub:
   `grep -l "verification\|evidence-gathering" src/templates/skills/*/template.ts src/templates/rules/*.ts src/templates/workflows/*.yaml`
   - Replace with `verify-evidence`.
   - Bump version of any cross-referencing template.
7. Runtime check: `grep -rn "verification\|evidence-gathering" src/runtime/`
   — confirm no hard references; if any, plan a follow-up.

### Validation

```bash
pnpm lint
pnpm test:unit
pnpm test:integration
grep -rn "name: verification\|name: evidence-gathering" src/templates/   # 0 hits
```

### Commit message

```
refactor(skills): unify verification + evidence-gathering into verify-evidence

verify-evidence is the chained skill (referenced by bug-fix/feature/refactor/
migration verify phases). Folds verification's "claim gate" trigger and
evidence-gathering's "pre-proposal investigation" into one skill with two
phases (gather → verify). -2 skills, no functionality lost.
```

---

## Commit 6 — Chain 5 orphans into workflow phases

### Rationale

Five skills currently exist but are never invoked by any workflow chain
even though they belong in the verify / execute / plan flow of one or more
workflows. Adding them closes the runtime contract (e.g. `diagnose` ladder
is broken without `debugging` chained in for tier-2 escalation).

### Skills promoted

| skill            | workflow(s)                                   | phase     | role      | hint                                                      |
| ---------------- | --------------------------------------------- | --------- | --------- | --------------------------------------------------------- |
| `debugging`      | `bug-fix`                                     | reproduce | alt-entry | "diagnose 3-strikes fired — escalate to MCP-deep"         |
| `debugging`      | `bug-fix`, `feature`, `refactor`, `migration` | execute   | optional  | "test fails unexpectedly + diagnose stalls"               |
| `pr-review`      | `feature`, `migration`                        | verify    | optional  | "before opening PR — end-to-end review with gh CLI"       |
| `quality-gates`  | `migration`                                   | plan      | optional  | "CI hook validation before applying schema change"        |
| `test-suite`     | `bug-fix`, `feature`, `refactor`, `migration` | verify    | optional  | "regression-test suite run after fix"                     |
| `webapp-testing` | `feature`, `migration`                        | execute   | optional  | "browser-driven validation when changes touch web routes" |

### Files touched

For each workflow yaml (`bug-fix.yaml`, `feature.yaml`, `refactor.yaml`,
`migration.yaml`):

1. Add the `chains:` entries above to the corresponding phase.
2. Bump `version:` of the workflow yaml frontmatter.

Run the chain validator after editing:

```bash
node dist/cli.js validate
```

### Validation

```bash
pnpm lint
pnpm test:unit
pnpm test:integration
node dist/cli.js validate    # workflow yaml structural check
```

### Commit message

```
feat(workflows): chain 5 orphan skills into bug-fix/feature/refactor/migration phases

Promotes debugging (bug-fix reproduce alt-entry + 4 workflows execute opt),
pr-review (feature/migration verify), quality-gates (migration plan),
test-suite (4 workflows verify), webapp-testing (feature/migration execute).

Closes the diagnose→debugging ladder contract (previously broken: diagnose
3-strikes fired with no runtime escalation path).
```

---

## Backlog — 5 future skills (next sprint, NOT this plan)

The dev-team walkthrough surfaced five common dev activities with no
dedicated skill. These are candidates for a follow-up round, AFTER this
shrink is shipped and validated:

| slug                   | activity                                                 | priority |
| ---------------------- | -------------------------------------------------------- | -------- |
| `ci-cd-debugging`      | Read CI logs → fix workflow yaml / job failures          | high     |
| `incident-response`    | P1 alert → triage → root-cause → postmortem              | high     |
| `perf-profiling`       | Flamegraph → hotspot identification → optimize → measure | medium   |
| `dependency-audit-fix` | Audit deps → safe upgrades → test → bump                 | medium   |
| `adr-authoring`        | RFC / ADR template + stakeholder review                  | low      |

## Execution order

1. Commit 1 (drop 6 office formats) — lowest risk
2. Commit 2 (drop internal-comms) — simple
3. Commit 3 (merge dispatching) — internal:true, low blast radius
4. Commit 4 (merge plan-writer) — non-chained source
5. Commit 5 (merge verification + evidence-gathering) — touches workflow
   chains via target preservation
6. Commit 6 (chain 5 orphans) — yaml-only edits, easy to revert per workflow

Each commit must pass `pnpm lint` and the relevant `test:unit` /
`test:integration` slice before the next is started. Push the branch only
after all 6 land green locally.

## Rollback

Each commit is independent. To revert any one: `git revert <sha>` and run
`pnpm test:unit` to confirm the catalog still loads cleanly. Per-skill
deletes can also be partially reverted by restoring the directory from git
history and re-adding the entry to `index.ts` + `skill-template-loader.ts`.

## Out of scope

- The 5 backlog skills (separate sprint).
- Reclassifying `caveman` / `humanizer` to rules (decided: not worth the
  runtime preference-load refactor; keep as skills).
- Renaming / reorganizing the meta-codi cluster directory layout.
- Documentation site regeneration (run `pnpm run docs:generate` after
  commit 6 ships).
