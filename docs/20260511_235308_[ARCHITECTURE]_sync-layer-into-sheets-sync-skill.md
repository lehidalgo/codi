# Sync layer relocated into `codi-dev-sheets-sync` skill

- **Date**: 2026-05-11 23:53
- **Document**: 20260511*235308*[ARCHITECTURE]\_sync-layer-into-sheets-sync-skill.md
- **Category**: ARCHITECTURE
- **Status**: Accepted
- **Issue**: ISSUE-005 in `20260511_220320_[ROADMAP]_codi-core-improvement-iterative-plan.md`

## Context

`src/runtime/sync/` shipped 27 TypeScript files (~6,700 LOC) implementing a Google Sheets + local `.xlsx` persistence layer for project-planning entities (`BusinessGoal`, `Requirement`, `UserStory`, `Release`, `Audit`). The layer was imported wholesale from a prior project (DevLoop, commits `2f302be5`, `436eaf96`) but never wired to the main CLI: `src/cli.ts` had zero references and `cmdSheets` was orphaned.

Three independent audits flagged this as a CRIT-ARCH issue. Investigation revealed the layer is not "team-sync of the Brain" but rather a PM/PRD tracking integration — column zones (`planning` / `execution`) split row ownership between product team and Codi, mirroring the canvas-style workflow of tools like Jira or Linear backed by a Google Sheet.

## Decision

**Move the sync layer source into the `codi-dev-sheets-sync` skill at `src/templates/skills/dev-sheets-sync/scripts/lib/` instead of deleting or integrating into the core CLI.**

Specifically:

1. The 27 `.ts` files relocate from `src/runtime/sync/` into `src/templates/skills/dev-sheets-sync/scripts/lib/`. They are now part of the skill's own runtime.
2. A `scripts/package.json` inside the skill declares the heavy deps (`googleapis`, `google-auth-library`, `exceljs`, `ajv`, `ajv-formats`, `yaml`). These are no longer shipped in Codi's main npm tarball.
3. The 14 unit-test files for sync (`tests/runtime/sheets-*.test.ts`, `external-syncer.test.ts`) are removed from the core test suite. When the skill activates its own runtime, the skill grows its own test infrastructure (the `content-factory` skill is precedent — it ships its own `scripts/tests/`).
4. The 5 `sheet_*` event types in `src/runtime/types.ts` and `src/runtime/reducer.ts` are removed. They were reducer pass-throughs with no state projection. When the skill emits its own events, they live in the skill's domain.
5. The `sheet_creds_present` deterministic gate in `src/runtime/gate-runner.ts` is removed. Credential checks for Sheets are a skill concern, not a core gate.

## Rationale

### Why not delete

The lib code is non-trivial and represents genuine engineering effort: row schema validation (AJV), zone-based column ownership, atomic sync-draft semantics, snapshot/restore, stale-pull detection. When a real PM/PRD integration lands (Sheets, Jira, Linear, Notion), this code is the right starting point. Deleting and reconstructing later means writing the same patterns twice.

### Why not integrate into the core CLI

The intended consumer is a _workflow_ — `codi workflow run project` for a team that uses Sheets as backlog tracker. That workflow already lives in a skill (`project-workflow`). Integrating sync into core would couple Codi's main CLI to a specific PM tooling choice, violating the three-layer architecture (Source → `.codi/` → Generated). Sheets sync is not a translation of `.codi/` to an agent format, nor an update of templates from source, nor a team-sync of artifacts (git does that). It is a domain-specific runtime that belongs in the skill that uses it.

### Why this fits the architecture

The three-layer pipeline is:

| Layer     | Mechanism              | Direction                             |
| --------- | ---------------------- | ------------------------------------- |
| N1 Source | `codi update`          | Source → user's `.codi/`              |
| N2 User   | git (PRs + `git pull`) | User ↔ team                           |
| N3 Agent  | `codi generate`        | User's `.codi/` → agent native format |

Brain is a separate observability stream (event log + capture). None of these is "PM/PRD tracking in a shared spreadsheet" — that is a fourth concern, served by an opt-in skill.

The `content-factory` skill already demonstrates the pattern: a skill with its own `scripts/package.json`, `node_modules`, and runtime entry-point (`server.cjs`). Heavy deps (docx, playwright) ship only when users install the skill. We are applying the same pattern to sync.

### Why move now rather than later

The 50 MB of `googleapis` + `google-auth-library` + `exceljs` shipped to every Codi installation for code nobody could invoke. Removing them from the main `package.json` is a concrete user-visible win immediately.

## Consequences

### Positive

- Codi's npm tarball loses ~50 MB of unused runtime deps.
- `src/runtime/` is now solely the core runtime (capture, brain, workflow engine, hooks, iron-laws). No dead PM/PRD subtree.
- Pattern established for future external integrations: each integration is a skill with its own `scripts/`. Jira, Linear, Notion follow the same template.
- The skill `codi-dev-sheets-sync` is now self-contained — its runtime code, deps, and (eventually) its tests all live under `src/templates/skills/dev-sheets-sync/`.

### Open work (not in this ADR)

- The skill does not yet have a `scripts/cli.cjs` entry-point. When the first real project-workflow run wants Sheets sync, that entry-point must be added. Two viable approaches:
  1. Pre-compile TS → JS at codi build time, ship `lib/*.js`.
  2. Add `tsx` to `scripts/package.json` dependencies and use it as a runtime loader.
- The `ExternalSyncer` interface (`external-syncer.ts`) and the two scaffold implementations (`sheets-syncer.ts`, `xlsx-syncer.ts` — both labeled "Sprint 3 wiring pending") remain unfinished. Whoever wires the entry-point completes them.
- The `project-workflow` skill needs an update so it knows to chain into `codi-dev-sheets-sync` when a project elects Sheets-based PRD tracking. Not in this ADR.

### Negative

- The `tsconfig.json` `include: ["src"]` plus `exclude: ["src/templates/**/scripts/**/*.ts"]` means the relocated `.ts` files are no longer type-checked by the main project. If `googleapis` or `exceljs` APIs change, only the skill's own (future) typecheck will catch it. This is acceptable because the skill is opt-in and its runtime is independent.

## Pattern for future external integrations

```
src/templates/skills/<integration-name>/
├── template.ts                ← skill body (markdown the agent reads)
├── references/                ← skill internal docs
├── evals/evals.json           ← skill trigger eval cases
├── scripts/
│   ├── package.json           ← deps the integration needs
│   ├── lib/                   ← integration logic
│   ├── cli.cjs / server.cjs   ← entry-point invoked by the skill
│   └── setup-*.sh             ← any setup helpers
```

The skill ships with its own deps, isolated. Users who never activate it pay zero cost. This ADR is the precedent for future Jira / Linear / Notion / GitHub Projects integrations.

## Files changed

- Moved (27): `src/runtime/sync/*.ts` → `src/templates/skills/dev-sheets-sync/scripts/lib/*.ts`
- New (2): `src/templates/skills/dev-sheets-sync/scripts/package.json`, `src/templates/skills/dev-sheets-sync/scripts/lib/README.md`
- Removed (14): `tests/runtime/sheets-*.test.ts`, `tests/runtime/external-syncer.test.ts`
- Edited: `src/runtime/types.ts` (5 event types removed), `src/runtime/reducer.ts` (5 case branches removed), `src/runtime/gate-runner.ts` (`sheet_creds_present` checker removed), `tests/runtime/gate-runner-new-checkers.test.ts` (associated tests removed), `package.json` (removed `googleapis`, `google-auth-library`, `exceljs` deps).

## Test impact

- Before: 3,743 tests pass.
- After: 3,585 tests pass (155 sheet/sync unit tests removed; 3 sheet_creds_present checker tests removed). All remaining tests green; `tsc --noEmit` clean.

## References

- `docs/20260511_220320_[ROADMAP]_codi-core-improvement-iterative-plan.md` — ISSUE-005 in the iterative roadmap
- `docs/20260511_215554_[AUDIT]_codi-spine-audit.md` — original H-01 finding
- `docs/20260511_214500_[AUDIT]_codi-v3-full-reaudit.md` — B11 confirmation
- `docs/20260508_140927_[ARCHITECTURE]_adr-v3ed0-005-sqlite-canonical-external-syncer.md` — superseded ADR (`ExternalSyncer` interface preserved in skill scripts/lib/)
- `docs/20260504_184645_[PLAN]_kodi-devloop-unification.md:326` — original recommendation to extract as opt-in package
