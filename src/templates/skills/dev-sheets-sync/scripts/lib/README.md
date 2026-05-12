# sheets-sync runtime — `lib/`

Source code that implements the Google Sheets + local `.xlsx` persistence
layer used by the `codi-dev-sheets-sync` skill. Moved here from
`src/runtime/sync/` during ISSUE-005 (2026-05-11).

## Why this lives in the skill

The sync layer persists project-planning entities (`BusinessGoal`,
`Requirement`, `UserStory`, `Release`, `Audit`) to a Google Sheet or local
`.xlsx`. It is **not** part of Codi's core platform — it is the runtime
of a specific skill that integrates Codi with a Sheets-based backlog
tracker.

Keeping it inside the skill means:

- Codi's main npm tarball no longer ships `googleapis`,
  `google-auth-library` and `exceljs` (~50 MB).
- Users who do not install this skill pay zero footprint cost.
- Future external integrations (Jira, Linear, Notion) follow the same
  pattern: one skill per integration, each with its own
  `scripts/package.json`.

## Status

**Not yet wired to a runnable entry-point.** The original
`src/runtime/sync/cli.ts` `cmdSheets` dispatcher is preserved in this
directory (`cli.ts`). When the skill is activated and a real
project-planning workflow needs Sheets sync, the next step is to:

1. Add a `scripts/cli.cjs` (or `cli.mjs`) entry-point that loads the
   compiled `lib/cli.js`.
2. Decide whether to ship pre-compiled JS or run TypeScript directly via
   `tsx`.
3. Wire the skill `template.ts` to instruct the agent to invoke the
   entry-point via `node ${CLAUDE_SKILL_DIR}/scripts/cli.cjs <sub>`.

Until that happens, the files in `lib/` are reference-grade source code
preserved for the inevitable moment a real backlog-tracking integration
lands.

## What lives here

| File                                  | Purpose                                                                                |
| ------------------------------------- | -------------------------------------------------------------------------------------- |
| `cli.ts`                              | `cmdSheets` dispatcher (upsert / read / list / sync-draft / daemon / reconcile / etc.) |
| `cli-create.ts`                       | `create-project` subcommand (bootstrap sheet + tabs)                                   |
| `cli-draft.ts`                        | sync-draft / validate / pull / snapshot / diff subcommands                             |
| `cli-safety.ts`                       | restore / archive subcommands                                                          |
| `cli-bridge.ts`                       | push-to-google / pull-from-google bridge                                               |
| `operations.ts`                       | Row-level CRUD against `SheetsClient`                                                  |
| `client.ts`                           | `SheetsClient` impl backed by `googleapis`                                             |
| `xlsx-client.ts`                      | `SheetsClient` impl backed by `exceljs` (local)                                        |
| `bootstrap.ts` / `xlsx-bootstrap.ts`  | First-run setup of spreadsheet + tabs                                                  |
| `auth.ts` / `account-type.ts`         | OAuth user + service-account auth                                                      |
| `schema.ts`                           | AJV-based row schema validation                                                        |
| `types.ts`                            | EntityName, SheetRow, ProjectConfig, error vocab                                       |
| `transactions.ts` / `snapshot.ts`     | Atomic sync-draft semantics                                                            |
| `integrity.ts`                        | Pure draft validator (rules + invariants)                                              |
| `daemon.ts` / `queue.ts`              | Drain `.codi/sheets-queue.jsonl` retries                                               |
| `reconcile.ts`                        | Rebuild a Sheet from the local manifest                                                |
| `diff.ts`                             | `computeDiff` with stale-pull detection                                                |
| `config.ts`                           | Read/write `.codi/project.json`                                                        |
| `bridge.ts`                           | Internal bridge primitives                                                             |
| `external-syncer.ts`                  | `ExternalSyncer` interface + registry (ADR-005)                                        |
| `sheets-syncer.ts` / `xlsx-syncer.ts` | `ExternalSyncer` implementations (scaffolds — Sprint 3 wiring pending)                 |
| `index.ts`                            | Barrel re-export                                                                       |

## Entities

| Entity         | Prefix | Owner                                                  |
| -------------- | ------ | ------------------------------------------------------ |
| `BusinessGoal` | `BG-`  | Product / PM                                           |
| `Requirement`  | `REQ-` | Product / PM                                           |
| `UserStory`    | `US-`  | Product / PM (writes), Codi (writes execution columns) |
| `Release`      | `REL-` | Codi (auto-populated from merge events)                |
| `Audit`        | (free) | Codi (event log)                                       |

## Zone model

Two zones per row:

- `planning` — columns the product team writes (title, priority, acceptance_criteria, …).
- `execution` — columns Codi writes when a workflow runs (branch, commit_shas, pr_url, status, …).

The validator rejects writes to a zone outside the caller's `CallerScope`.
This is what gives Sheets the dual-edited "canvas" behavior described in
the design.
