# Workflow-First Skills Optimization Plan

- **Date**: 2026-05-10 18:15
- **Document**: 20260510*181542*[PLAN]\_workflow-skills-optimization.md
- **Category**: PLAN
- **Status**: Approved (15 grilling decisions closed)
- **Scope**: 5 workflow yamls + 83 skills + brain seeder + phase-ref generator + CI validator

## Goal

Optimize all 83 codi skills with a workflow-first lens. Take the best of all worlds across near-duplicate skills. Do not delete or reduce content. Every skill earns its place via either a workflow chain role, a meta self-development role, or a content production role. Pair-collisions resolved via explicit Skip when clauses + role differentiation, not deletion.

## Source-of-truth principles

| Principle                                                                          | Effect                                      |
| ---------------------------------------------------------------------------------- | ------------------------------------------- |
| `src/templates/workflows/*.yaml` is canonical for workflow + chain wiring          | Single source for workflow structure        |
| Skill frontmatter declares `internal: true` flag only; no `workflow_phases` mirror | Avoid drift via dual declaration            |
| Brain `workflow_definitions.definition` JSON blob is derived index                 | Auto-seeded; no manual sync                 |
| `phase-*.md` is generated from yaml + manual discipline sections                   | Auto-managed inside markers; manual outside |

## 15 closed decisions

### Q1 — Single source for chain graph

Decision: extend `src/templates/workflows/*.yaml` per phase with a `chains:` array. The seeder already serializes the yaml to `workflow_definitions.definition` JSON blob. No separate `phase-chains.yaml`. No new SQLite table.

Rationale: workflow definitions already have a database home, version field, managed_by separation, and idempotent seeder. A separate file or table duplicates state.

### Q2 — Role vocabulary

Decision: 3 roles inside chain entries + 1 flag on skills.

| Token            | Lives             | Meaning                                                                |
| ---------------- | ----------------- | ---------------------------------------------------------------------- |
| `required`       | yaml chain entry  | MUST invoke before phase transition                                    |
| `alt-entry`      | yaml chain entry  | Alternative entry under a stated condition                             |
| `optional`       | yaml chain entry  | MAY invoke under a `hint:` predicate                                   |
| `internal: true` | skill frontmatter | Skill cannot be auto-invoked by Claude; user slash command still works |

Rationale: 3 roles map 1:1 to verbs already used in current phase-refs ("MUST invoke", "Alternatively", "When X, invoke"). No aspirational vocabulary. `internal: true` removes a skill from the auto-trigger pool while keeping `user-invocable: true`.

Yaml shape per phase:

```yaml
phases:
  intent:
    gates: [task_described]
    next: [plan, abandoned]
    chains:
      - { skill: discover, role: required }
      - { skill: brainstorming, role: alt-entry, hint: "no workflow context needed" }
      - { skill: step-documenter, role: optional, hint: "domain terms emerge" }
```

### Q3 — Runtime propagation

Decision: phase-ref markdown is generated from the yaml + JSON blob. The agent continues to read `references/phase-*.md` as today. No agent-level awareness of the yaml. No CLI-injected system messages.

Generator pipeline: `src/templates/workflows/*.yaml` → build step → `src/templates/skills/<workflow>/references/phase-*.md` → `pnpm build` → `dist/` → `codi add` → `.codi/skills/...` → `codi generate` → `.claude/skills/...`.

### Q4 — Storage strategy

Decision: extend the yaml schema; reuse the existing JSON blob in `workflow_definitions.definition`. No new table. No new file.

Justification: 5 workflows × ~6 phases × ~3 skills = ~90 chain edges. `JSON_EXTRACT` over 5 blobs is sub-millisecond. A future migration to a relational `workflow_chains` table is a 30-LOC operation that parses the blob — yaml stays canonical, no data is trapped.

Schema changes:

- Extend `WorkflowDefinitionShape` interface in `src/runtime/brain/seed-workflows.ts` with optional `chains?:` per phase.
- Extend `validateShape()` to validate chain entries (skill name string, role enum, optional hint string).
- Bump `_codi_schema_version` only if needed (the JSON blob accepts the new shape without column changes).

### Q5 — Pair routing

Decision: every duplicate-pair gets explicit Skip when clauses in skill descriptions. Auto-trigger pool exclusion via natural language disambiguation. No new dispatcher layer.

Pairs and clauses:
| Pair | Clause |
|------|--------|
| brainstorming / discover | brainstorming skip when codi workflow active; discover use only inside workflow at intent/plan boundaries |
| diagnose / debugging | diagnose first pass; debugging only after diagnose 4-phase 3-strikes failure |
| plan-writing / plan-writer | plan-writing for spec→deterministic; plan-writer for post-brainstorm TDD breakdown |
| refactor-workflow / refactoring | refactor-workflow for structural change; refactoring for dead-code/DRY/cleanup only |
| evidence-gathering | `internal: true` (only callable by audit-fix, guided-execution, diagnose) |
| dispatching-parallel-agents | `internal: true` (decision wrapper around subagent-orchestration) |
| code-review / pr-review / receiving-code-review | already differentiated (uncommitted diff vs gh PR vs incoming feedback); add cross-Skip when |

### Q5b — Three execution paths

Decision: skills retain user-invocability via slash commands regardless of auto-trigger restrictions.

| Path  | Trigger               | Auto rules apply?                 |
| ----- | --------------------- | --------------------------------- |
| Slash | `/codi:<skill>`       | NO — user override                |
| CLI   | `codi run <workflow>` | starts workflow, chains automatic |
| Auto  | description match     | YES — Skip when clauses bind      |

`internal: true` ⇒ `disable-model-invocation: true` AND `user-invocable: true`. The dev can always force-call a skill via slash command.

### Q6 — phase-\*.md migration

Decision: hybrid model with strict markers and hash protection.

```markdown
<!-- BEGIN auto-generated chain — DO NOT EDIT -->

[generated from yaml]

<!-- END auto-generated chain -->

[manual discipline sections, anti-patterns, examples — preserved]
```

Build step computes hash of the BEGIN/END section content. If the hash differs from the expected (regenerated from yaml), build aborts with an explicit error pointing to the offending file. Manual sections outside the markers are free.

Rationale: warning was too soft; drift inside the auto block is a build-blocking error.

### Q7 — Trivial-edit threshold

Decision: introduce `codi quick` mode. Every edit goes through either a full workflow run OR a quick mode run. Ad-hoc edits without manifest are forbidden.

| Mechanism                      | Behavior                                                                                  |
| ------------------------------ | ----------------------------------------------------------------------------------------- |
| `codi quick "<one-line task>"` | Creates `workflow_runs` row with `type='quick'`; only `init` and `done` events; no phases |
| Closed category list           | typo, comment, dep-bump, format, doc-tweak (5 categories)                                 |
| codi-workflow rule update      | "ad-hoc edits without `codi run` or `codi quick` are prohibited"                          |

Rationale: heuristic-based agent classification is fragile. Robust answer = every edit produces an audit trail. Cero "edits invisibles".

### Q8 — Skill version bump strategy

Decision: hash-based auto-bump with normalization, override via commit message tag.

| Layer                                                                       | Function                          |
| --------------------------------------------------------------------------- | --------------------------------- |
| Pre-build hook compares normalized hash of `template.ts` vs last-built hash | Auto-detect content change        |
| Normalization: strip comments, normalize whitespace                         | Avoid bumps from reformatting     |
| Commit message override: `[skill-major]`, `[skill-minor]`                   | Dev-controlled semver when needed |
| CI validator: error if frontmatter changed but version did not              | Coherence guard                   |

Replaces the recurring memory "version bump per edit" failure mode with mechanical enforcement.

### Q9 — CI validator scope

Decision: 9 checks block PR merge.

| #   | Check                                                           |
| --- | --------------------------------------------------------------- |
| 1   | Skill declares valid workflow role OR `[standalone]`            |
| 2   | `internal: true` ⇒ `disable-model-invocation: true`             |
| 3   | Pairs with overlapping triggers carry mutual Skip when clauses  |
| 4   | `chains:` entries reference skills that exist in the catalog    |
| 5   | Workflow yaml schema valid (extended `WorkflowDefinitionShape`) |
| 6   | `version:` bumped if normalized content hash changed            |
| 7   | Snapshot diff: generated `phase-*.md` matches committed file    |
| 8   | Trigger phrase overlap detector (NLP-light tokenization)        |
| 9   | Every `user-invocable: true` skill appears in CLI registry      |

### Q10 — Testing cluster disambiguation

Decision: 5 testing skills retained, each with a decision-tree question at top of description.

| Skill             | Top question                                                                 |
| ----------------- | ---------------------------------------------------------------------------- |
| tdd               | "Are you in a red-green-refactor INNER loop?"                                |
| test-suite        | "Do you need to run/generate the FULL suite without a single feature focus?" |
| dev-e2e-testing   | "Automated CI-only tests, no browser?"                                       |
| webapp-testing    | "BROWSER-driven tests (Playwright/Chrome)?"                                  |
| guided-qa-testing | "QA session with HUMAN present step-by-step?"                                |

Three orthogonal axes: scope (single/full), driver (CI/browser), pacing (auto/human). 5 skills cover all real combinations.

### Q11 — Phase-ref generator

Decision: 3 fixed Mustache-light templates in code, with empty-hint handling, unit tests, snapshot tests.

```
required:   "You **MUST** invoke `codi:<X>`{?: ` (`<hint>`)`}."
alt-entry:  "Alternatively, invoke `codi:<X>` if <hint>."
optional:   "Optionally, invoke `codi:<X>` when <hint>."
```

Validator rule: `optional` and `alt-entry` MUST carry a `hint:` in yaml. `required` MAY carry one.

### Q12 — Backward compat

Decision: per-workflow opt-out flag with explicit error on drift.

| Mechanism                                                   | Behavior                                                            |
| ----------------------------------------------------------- | ------------------------------------------------------------------- |
| `auto_generate_phase_refs: true` (default in workflow yaml) | Generator runs                                                      |
| `auto_generate_phase_refs: false`                           | Generator skips workflow; .md stays manual                          |
| Drift detected with flag true                               | Build fails with diff; user runs `codi build --force` to regenerate |

User never loses manual edits silently.

### Q13 — Description discipline

Decision: hard size cap and structural discipline.

| Rule                                                                                                   | Detail                |
| ------------------------------------------------------------------------------------------------------ | --------------------- |
| `description:` ≤ 1500 chars                                                                            | validator-enforced    |
| description content = trigger phrases + 1-line "Skip when paired skill applies — see body for routing" | Tight routing surface |
| Body section 1: "Skip When" full table                                                                 | Conscious execution   |
| Body section 2: Workflow phases                                                                        | Context               |
| Body section 3+: discipline, anti-patterns, references                                                 | Content               |

Description never inflates. Body has fixed structure.

### Q14 — Workflow-active detection

Decision: query the brain via `codi status --json` once per session start and after each `codi transition`.

No `.codi/state/current-workflow.json` file. Single source of truth = `workflow_runs` table. Reducer already invalidates state at transition.

### Q15 — project-workflow standalone

Decision: `--no-sheet` flag with deferred sync.

| Layer                                                        | Behavior                                |
| ------------------------------------------------------------ | --------------------------------------- |
| `codi run project --no-sheet "..."`                          | Bootstraps locally without Google creds |
| State in `.codi/project.yaml` while `--no-sheet` mode active | Local-first                             |
| `codi project attach-sheet <id>`                             | Migrates yaml to Sheet rows             |
| Validator: yaml-local and Sheet cannot both be active        | Single mode at a time                   |
| E2E test: yaml↔Sheet round-trip without loss                 | Anti-corruption                         |

## Execution phases

| Phase | Work                                                                               | Risk              | Estimated LOC                 |
| ----- | ---------------------------------------------------------------------------------- | ----------------- | ----------------------------- |
| 1     | Extend `WorkflowDefinitionShape` + `validateShape()` for `chains:` (Q1+Q4)         | Low               | ~30                           |
| 2     | Add `chains:` to 5 workflow yamls per phase (Q2)                                   | Low               | ~150 yaml                     |
| 3     | Build phase-ref generator + 3 templates + unit + snapshot tests (Q11)              | Medium            | ~150                          |
| 4     | Add BEGIN/END markers + hash check to all phase-\*.md (Q6)                         | Medium            | content-only across ~25 files |
| 5     | Skip when clauses + decision tree top-of-desc on all paired skills (Q5+Q10+Q13)    | Medium            | content across ~20 skills     |
| 6     | `internal: true` flips on evidence-gathering, dispatching-parallel-agents (Q2/Q5b) | Low               | ~6                            |
| 7     | `codi quick` CLI + workflow_run type='quick' (Q7)                                  | Medium            | ~120                          |
| 8     | `codi status --json` + brain query (Q14)                                           | Low               | ~40                           |
| 9     | `codi run project --no-sheet` + local yaml + migration command (Q15)               | Medium            | ~200                          |
| 10    | Hash-based auto version bump + commit msg parser (Q8)                              | Medium            | ~80                           |
| 11    | CI validator 9 checks (Q9)                                                         | High (blocks PRs) | ~250                          |
| 12    | `auto_generate_phase_refs:` opt-out flag (Q12)                                     | Low               | ~30                           |

Total estimated impact: ~1080 LOC + content edits across 25 phase-refs and 20 skill descriptions.

## What is explicitly NOT changing

| Item                                                   | Reason                           |
| ------------------------------------------------------ | -------------------------------- |
| Number of skills, agents, rules                        | No deletions per user constraint |
| Existing workflow yaml structure (gates, next, flags)  | Extended only, not modified      |
| `seedWorkflowDefinitions()` idempotency model          | Reused as-is                     |
| `managed_by: codi/user` separation                     | Reused as-is                     |
| Skill template `category:` enum                        | Untouched                        |
| Three-layer pipeline (src/templates → .codi → .claude) | Untouched                        |

## Risks

| Risk                                               | Mitigation                                                                                          |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Hash auto-bump triggers on whitespace-only change  | Normalize whitespace + strip comments before hash                                                   |
| Generated phase-\*.md drifts from manual sections  | BEGIN/END markers + hash + build-time error                                                         |
| Skip when clauses become inconsistent across pairs | Validator check 3 (mutual Skip when)                                                                |
| `codi quick` is bypassed by direct edits           | Pre-edit hook is intentionally NOT added (overengineering); rule + CI on PR diff catches violations |
| `--no-sheet` mode diverges from Sheet schema       | Round-trip test in CI; single-mode invariant                                                        |
| Validator becomes too slow                         | Stage gates: cheap checks first, expensive last                                                     |

## Acceptance criteria

| Criterion                                                                          | Measure                                                                     |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Every skill has either workflow role(s) or `[standalone]` declaration              | Validator check 1 passes for all 83                                         |
| Every paired skill has cross-Skip when clauses                                     | Validator check 3                                                           |
| All `phase-*.md` regenerate identically from yaml                                  | Validator check 7 (snapshot)                                                |
| `codi run` and `codi quick` cover 100% of edit categories                          | Audit: count `workflow_runs` rows in 2-week window vs git commits — gap = 0 |
| First-time-dev experience: time from `git clone` to first workflow `done` < 30 min | Measure on fresh dogfood                                                    |

## Out of scope (future work)

- Migration to relational `workflow_chains` table (defer until query patterns demand it)
- Pre-edit hook that blocks Edit/Write without active workflow (intentionally rejected as overengineering)
- LLM-based trigger phrase overlap detector (NLP-light is enough for now)
- Web UI for editing chain graphs in brain-ui (future enhancement)

## References

- `src/templates/workflows/*.yaml` — current workflow definitions
- `src/runtime/brain/seed-workflows.ts` — current seeder
- `src/runtime/brain/schema.ts` — current SQLite schema (workflow_definitions, workflow_runs, workflow_events)
- `.codi/skills/codi-feature-workflow/references/phase-*.md` — example installed phase-refs
- Memory: `feedback_version_bump_per_edit.md` — root cause of the recurring bump-forgotten failure mode
