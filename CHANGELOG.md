# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### v3 install blockers (Linux + non-primary Mac field reports)

#### Fixed

- `.claude/settings.json` deep-merge — `codi init` and `codi generate` now merge codi runtime hooks (`Stop`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`) into a pre-existing user `settings.json` instead of letting the line-based JSON conflict resolver clobber them. Brain capture pipeline now wires up reliably for users coming from FastAPI / template starters that already ship a `settings.json`.
- `codi brain ui --foreground` now polls `/healthz` before reporting success — a child crash during startup (missing `better-sqlite3` native binding, port conflict) no longer silently reports `[OK]` while nothing listens at the bound port.
- Binary skill assets (fonts, PDFs, archives) are now hashed via `hashBuffer(bytes)` instead of `hashContent("")` — `codi status` stops reporting `.claude/skills/**/*.{ttf,pdf,tar.gz}` as drifted on every run for fresh installs.
- Drift detection (`detectDrift`, `detectPresetArtifactDrift`, `detectHookDrift`) treats `EMPTY_INPUT_SHA256` as a sentinel meaning "synced" — migration safety net for state.json files written by older codi versions.

#### Changed

- `package.json` — added `playwright` to `pnpm.onlyBuiltDependencies` so pnpm 11 runs its postinstall (browser engine download) automatically alongside `better-sqlite3` and `esbuild`.

### Workflow adaptive intake + modular adapters

#### Added

- Per-workflow adaptive intake — every workflow type accepts a profile and 5-7 questions that compress the phase pipeline. Profiles: `quick`/`standard`/`deep`/`incident` for bug-fix, `prototype`/`standard`/`deep` for feature, `deadcode`/`standard`/`deep` for refactor, `schema`/`data`/`deep` for migration, `no-sheet`/`standard`/`absorb` for project.
- `src/runtime/workflows/<id>/` module structure — each workflow ships a `WorkflowAdapter` exposing types, profile defaults, resolver, skip-rules, CLI flag parsing, and (optionally) an interactive intake.
- Adapter registry at `src/runtime/workflows/registry.ts` — adding a new workflow type is a directory + one-line registration.
- CLI flags on `codi workflow run`: `--profile`, `--severity`, `--reproducer-exists`, `--root-cause-known`, `--scope`, `--execute-mode`, `--grill`, `--interactive`, `--carryover-from`, plus workflow-specific `--complexity`/`--design-exists`/`--tdd-strict`/`--kind`/`--risk-level`/`--rollback-tested`/`--mode`/`--no-sheet`.
- Bug-fix interactive intake via `@clack/prompts` — `--interactive` walks the dev through 7 questions, then runs the resolved workflow.
- Cross-workflow conversion — `--carryover-from <prior-id>` materializes a compact context summary (task, scope files, decisions count, knowledge terms) into the new run's init payload.
- Two new bug-fix gate enforcers — `reproducer_event_exists` and `tdd_first_test_exists` — read the adaptive intake or look for marker `decision_recorded` events.

#### Changed

- Workflow definitions extended (`bug-fix`, `feature`, `refactor`, `migration`, `project` — all bumped to v3) with `flags.adaptive`, `flags.profiles`, and `flags.skip_phases_when` declarations.
- `cli-handlers/workflow.ts` slimmed down by dispatching adaptation through the adapter registry; per-workflow types and resolvers no longer live in the lifecycle module.
- Init event schema accepts `bug_fix_adaptation`, `feature_adaptation`, `refactor_adaptation`, `migration_adaptation`, `project_adaptation`, and `carryover_context` payload fields.

### Team Consolidation workflow + legacy consolidate retire

#### Added

- New workflow `team-consolidation` — agent-driven cross-dev brain analysis producing a consensus-candidate markdown report. Use `codi run team-consolidation` to start. The workflow reads N brain.db files from a shared directory, lets the code agent analyze them in sequential or parallel mode, and writes a free-form markdown report at `docs/YYYYMMDD_HHMMSS_[REPORT]_team-consolidation.md` for async team consensus review.
- New companion skill `codi-team-consolidation-workflow` with 4 phase docs (intent, collect, analyze, consolidate) + a brain DB schema reference.
- `refine-rules` skill — new `REPORT-DRIVEN` mode (v8) that consumes team consolidation reports and applies APPROVED domain findings to `.codi/rules/`.
- `artifact-contributor` skill — new `REPORT-DRIVEN` mode (v14) that opens upstream PRs from APPROVED meta-pipeline findings.

#### Removed

- Legacy auto-detection consolidation pipeline at `src/runtime/consolidate/` — replaced by the agent-driven `team-consolidation` workflow.
- Pattern detectors P1 through P9 and the LLM enrichment loop in `runConsolidation`.
- `proposals` table from the brain DB schema (dropped in v10 migration).
- `/proposals` page and navigation entry in the brain UI.
- `/api/v1/consolidation/*` and `/api/v1/proposals/*` endpoints from the brain UI server.
- `src/runtime/llm/` LLM provider abstraction (orphan after consolidate removal — only consumer was the runner).
- `src/templates/consolidation/` prompt templates (P1-P9 LLM prompts).

#### Deprecated

- `codi brain export` command — now prints a deprecation message and exits cleanly. Will be removed in the next minor release.

#### Migration notes

- Brain DBs migrate automatically on first open: schema version bumps from 9 to 10; the `proposals` table is dropped via `applyMigrations`. Idempotent on DBs without the table (fresh DBs never create it).
- Teams that scripted `codi brain export` should switch to `codi run team-consolidation` and consume the generated `[REPORT]_team-consolidation.md`.

### Workflow-first skills optimization

#### Added

- `chains:` field per phase in workflow yamls — declares which skills run in each phase with role (required / alt-entry / optional) and optional hint.
- `codi quick "<task>" --category <cat>` (and top-level `codi quick` alias) — trivial-edit fast path. Closed category list: typo, comment, dep-bump, format, doc-tweak.
- `codi workflow status --slim` — minimal JSON shape for agent session-start polling.
- `pnpm regen:phase-refs` — rebuilds auto-generated chain sections between BEGIN/END markers in every `phase-*.md`. Build-error on drift; `--force` repairs.
- `pnpm validate:codi` — CI validator with 5 checks (internal-flag consistency, chain skill existence, yaml schema, version-bump-on-content-change, phase-ref drift).
- `auto_generate_phase_refs:` opt-out flag per workflow yaml.
- New `quick` workflow type with its yaml definition.

#### Changed

- Skill descriptions (14 skills) carry mutual Skip-when clauses for paired skills and a DECISION TREE preamble for the testing cluster.
- `evidence-gathering` and `dispatching-parallel-agents` flipped to `internal: true` — invokable only via slash, not auto-trigger.
- `codi-workflow.md` rule v3 — adds Manifest Discipline section requiring every edit to run under a workflow (full or quick).

### Consolidator cold-start guard + artifact tracking + proposals UI

#### Added

- `tool-hook.ts` records `Skill` and `Agent` invocations into `artifacts_used` so the consolidator's P2 / P3 / P8 detectors finally have real signal. Other tool names remain no-ops.
- Proposals page replaces plain text links with elegant icon buttons (Accept / Reject / Delete / Restore) and 2-step Alpine modals matching the captures-page pattern. Reject and Accept modals accept an optional reason that goes into `decision_reason`.

#### Changed

- P2 (`p2UnusedSkill`) and P8 (`p8UnusedRule`) gain a cold-start guard: if `artifacts_used` has zero rows of the matching kind in the analysis window, the detector returns no proposals. Absence of evidence is no longer treated as evidence of absence — the entire catalog used to get flagged for deprecation on every fresh install.

### Workflow advisory gates + brain-ui detail + capture rule v5

#### Added

- Brain-ui workflow detail page: type-aware event cards (one per `workflow_event`), quality metrics ribbon (duration / phases / transitions / gate health / scope changes / subagents / linked captures / rejections), Gantt-style phase timeline, and linked captures section grouped by type.
- `docs/CONTEXT.md` minimal project glossary and `docs/adr/README.md` placeholder so `codi workflow run` no longer fails on first use.

#### Changed

- Workflow file/scope gates are now ADVISORY, not blocking. Edits outside `files_in_plan` and edits to source files in `intent / plan / decompose` phases pass through with a stderr advisory instead of `exit 2`. Friction removed; the post-tool-use flow records `incidental_change_recorded` for retrospective review in the brain UI.
- `BashRule` schema gained an `enforcement: "block" | "advisory"` field. `git push` and `gh pr create` are advisory in their pre-phase windows (Iron Law 7 still gates the actual push with the `ok` token); `rm -rf /`, `git reset --hard`, and `git push --force` remain hard-blocked as universal data-loss rules.
- Capture rule template `capture-everything` bumped v4 → v5 with three new sections: a Long-term value test (3 questions before every marker), a Hard reject patterns table (8 shapes that NEVER emit), and Worked examples covering FEEDBACK-as-prompt-restatement, agent's own QUESTIONs, and approval-token PREFERENCEs.

### Codex parity — tokens, hooks, agent_text capture

#### Added

- Token + cost telemetry parity for Codex CLI sessions. `transcript-codex.ts` reads `event_msg/token_count` events (`info.total_token_usage`) and folds reasoning output tokens into the output bucket.
- OpenAI / Codex pricing rows: `gpt-5-5`, `gpt-5-4`, `gpt-5-4-mini`, `gpt-5-3-codex`, `gpt-5-codex`. Family fallback in `resolvePricing` for unknown `gpt-*` ids.
- Codex hooks adapter writes the correct schema (root `hooks` object + `matcher` + nested `hooks` array) and gates it behind `[features] codex_hooks = true`.
- `--agent <id>` flag on `codi hook` so each hook fires under the right adapter; auto-detect chain (flag → env → fallback).
- Project identity columns on `projects` (`git_user_name`, `git_user_email`, `host_user`, `host_machine`); migration v7.
- `tokens_max_prefix` (largest single-message prefix) and `tokens_messages_count` (assistant API calls) on `sessions`; migrations v5 / v6.
- Per-session metrics card (Verbosity / Efficiency / Behavior / Productivity) and dashboard aggregate metrics across sessions.

#### Changed

- Iron Law 4 + 7 share a single approval token: literal `ok` / `OK` / `Ok` (3 casings). Long-token list (`commit`, `push`, `merge`, `tag`, `release`) removed — brittle on typos and unicode.
- Anthropic price table refreshed for Opus 4.7 / 4.6 / Sonnet 4.6 (1M context at standard pricing, no `-1m` tier).
- `agent_model` on `sessions` is overwritten with the resolved id (no `COALESCE`) so stale Anthropic ids don't survive on Codex sessions.
- Generated `.codex/config.toml` sets `suppress_unstable_features_warning = true` and `check_for_update_on_startup = false` to silence startup nags.

#### Fixed

- Stop-hook `extractAssistantText` only matched Anthropic transcript shape; Codex sessions persisted empty `agent_text`. Added `response_item / payload.role=assistant` and `event_msg / agent_message` cases.
- TOML order bug in Codex adapter: root keys after a `[section]` header were parsed as section keys. `developer_instructions` now emits before any section.
- `largest prefix` in tokens card was a cumulative sum across calls; now tracks the maximum single-message prefix.

### Workflow gates wired as advisory + cwd filter + handbook

#### Added

- `gate-runner-bridge.ts` connects the existing `gate-runner` deterministic checkers to `approveTransition`. Phase transitions now run the configured gates as advisory (no hard block).
- `buildGateAdvisoryBlock` surfaces gate failures in the next `UserPromptSubmit` until the next approval supersedes them.
- `[GUIDE]_workflow-handbook.md` covering decision tree, lifecycle, CLI cheatsheet, gate semantics, brain visibility, Iron Laws summary, common pitfalls, and supervision contract.
- `gate_check_started` / `gate_check_passed` / `gate_check_failed` events now persisted on every phase transition (previously declared as event types but never emitted).
- `BrainEventLog.getActiveWorkflowIdForCwd(cwd)` filters the active workflow by current project root.

#### Changed

- `approveTransition` no longer hardcodes `gate_passed: true`. The flag in the emitted `phase_completed` event reflects the real verdict from the gate run.
- `codi workflow status` is filtered by current `cwd`. Workflows from other projects on the same machine no longer surface in this project's status output.
- `workflow_init` payload now includes `cwd`. Manifest event schema updated to allow the optional field.

#### Fixed

- Gate-runner code path was unreachable in production; the 6 deterministic checkers now run on every phase transition as advisory.
- `tests/runtime/brain-ui-pages.test.ts` captures-page test updated to match the current Alpine.js modal-confirm pattern (was asserting the deprecated `hx-delete` HTMX attribute).

### Brain UI — tokens telemetry + restore + Human/Agent layout

#### Added

- **Token + cost telemetry per session** sourced from the Claude Code transcript JSONL (input / output / cache_create / cache_read / pre-loaded / largest single-message prefix) with cost computed from a local price table.
- **`gpt-tokenizer` fallback** for sessions without a transcript; rows are flagged `estimated`.
- **Auto-promote to 1M context tier** when the largest observed prefix exceeds 200K tokens, even if the model id does not carry the `-1m` suffix.
- **`/tool-call/:id` and `/capture/:id`** detail pages with anchor links from the session timeline.
- **Backup detail pages** (`/backup/local/:ts` and `/backup/archive/:hash/:ts`) — show manifest, file list, total size, and a Restore action.
- **Restore endpoints**: `POST /api/v1/backups/local/:ts/restore` and `POST /api/v1/backups/archive/:hash/:ts/restore` overlay files from the snapshot manifest onto the project root.
- **Reconciliation banner** on session detail showing the gap between codi-captured turns and assistant API calls in the transcript.
- **Per-tool description as inline title** (extracted from `input.description`) on the session timeline, the tool-calls list, and the tool-call detail header.

#### Changed

- **Session timeline restructured** into Human + Agent blocks per turn, with tool calls and captures rendered as compact sub-blocks inside the agent card. Tool blocks default collapsed; click expands input + output + error.
- **Capture row buttons** replaced with icon buttons; delete now opens an Alpine modal with a two-step confirmation.
- **Settings backup rows are clickable** with inline Restore icon. Restore is gated behind a two-step modal.
- **Sidebar fixed** (only the right panel scrolls) and Alpine `[x-cloak]` CSS added to suppress the modal flash on refresh.
- **Context-window fill bar** now reads `tokens_max_prefix` (largest single-message prefix) instead of summing `cache_read` cumulatively across turns.

#### Fixed

- **Tool-call header double dash** — `fmtDuration(null)` no longer emits a placeholder `—` that competed with the title separator.
- **Capture edit modal** fetches content from the API on click instead of embedding JSON in the `x-on:click` attribute, eliminating the HTML-attribute escape bug that broke the row layout for captures containing `"`.
- **Tool-output JSON unescape** — known string fields (`stdout`, `stderr`, etc.) now render with real newlines instead of `\n` escapes; the previous in-place decoder re-escaped via `JSON.stringify` and was effectively a no-op.

### Hooks — post-reinit fixes

#### Fixed

- State path mismatch: hook readers and adapters used `.codi/.state/state.json` (with leading dot) but `STATE_DIR` is `state`. Reads silently returned null after a fresh `codi init`, so adapter heartbeat gating and runtime hook selection always defaulted on. Path corrected across `agent-hooks`, `hooks-list/add/remove`, and the `claude-code` and `codex` adapters.
- `codi init` did not persist the wizard's git/runtime hook selection — `WizardResult.gitHooks` and `runtimeHooks` were captured but never written to `state.json`. Added `StateManager.updateSelectedHooks` and a call from `init.ts` after the wizard returns.
- Test fixtures for adapter emission and CLI hook commands now write to the canonical `.codi/state/` path.

### Hooks as first-class artifacts

#### Added

- **`HookArtifact` discriminated union** under `src/core/hooks/hook-artifact.ts` covering both buckets (`git`, `runtime`).
- **Unified registry helpers** — `getAllHooks`, `getGitHooks`, `getRuntimeHooks`, `getDefaultGitHookNames`, `getDefaultRuntimeHookNames`.
- **`security-reminder` runtime hook** — clean-room PreToolUse hook with nine patterns (gha-injection, child-process-exec, new-function, eval-call, dangerously-set-html, document-write, inner-html-assign, pickle-deserialize, os-system). Per-pattern extension allowlists, comment-line heuristic, per-session dedupe at `~/.codi/security/`.
- **Five wrapper artifacts** for existing runtime hooks: `iron-laws-enforcer`, `workflow-classifier`, `capture-markers`, `skill-tracker`, `skill-observer`. They surface in the registry without changing their underlying behaviour.
- **CLI surface** — `codi hooks list [--git|--runtime|--enabled]`, `codi hooks add <bucket> <name>`, `codi hooks remove <bucket> <name>`, `codi update --hooks` next-step printer.
- **Init wizard** — two new `wizardMultiselect` steps for git and runtime hook selection, persisted to `state.selectedHooks`.
- **Optional `phaseFilter` and `dispatchSkill`** on every hook for workflow-phase gating and skill delegation. Both default to undefined (no behavioural change for existing hooks).
- **Adapter heartbeat gating** — claude-code and codex adapters skip emission of `skill-tracker` / `skill-observer` scripts and settings entries when not in `state.selectedHooks.runtime`.
- **Pre-commit config filter** — `hook-config-generator` honours `state.selectedHooks.git` to filter the emitted `.pre-commit-config.yaml`. Codi-internal meta hooks (`version-bump`, `secret-scan`, etc.) remain regardless.

#### Changed

- 16 per-language pre-commit registries (`typescript`, `javascript`, `python`, `go`, `rust`, `java`, `kotlin`, `swift`, `csharp`, `cpp`, `php`, `ruby`, `dart`, `shell`, `global`) migrated to emit `GitHookArtifact[]`. Same shape as before plus `bucket`, `description`, `version`, `managed_by`, `default`. No behavioural change.
- `HookSpec.HookCategory` widened to include `"enforcement"` and `"observation"`.
- `StateData` gains optional `selectedHooks` field. Reader fills defaults at the boundary — no migrator required.
- `runPreToolUse` in `cli/agent-hooks.ts` is now async and dispatches the runtime hook runner for `Edit / Write / MultiEdit / NotebookEdit` calls.

### Brain UI — detail pages + anchored navigation + larger output cap

#### Added

- **`/tool-call/:id` detail page** — full input + output + error blocks, link back to `/session/:id#tool-:id`.
- **`/capture/:id` detail page** — content (markdown), files, raw_marker, link back to `/session/:id#capture-:id`.
- **Anchored navigation** in the session timeline. Each tool-call event gets `id="tool-<id>"` and each capture event gets `id="capture-<id>"`. The kind label and the `#id` footer in list views link directly to the timeline anchor and to the detail page.
- **Strip canonical capture markers** from `agent_text` when rendering the timeline so the marker text does not duplicate alongside its parsed `capture` row.

#### Changed

- **Tool output storage cap raised**: `output_summary` 200 → 16,384 chars; `error` 500 → 8,192 chars. The brain UI was correctly rendering everything it received; the truncation was happening at the hook write path, so prior calls show the old limit.

### Brain UI — robust tool output + expand/collapse + edit fix

#### Added

- **Per-block expand / collapse** on every tool-call output (sessions timeline + tool-calls page) via Alpine.js. Default expanded; click to collapse the body.
- **Formatted / raw toggle** for JSON outputs. `formatted` mode keeps the per-field stdout / stderr / error / output / result blocks; `raw` mode shows the full pretty-printed JSON.
- **`GET /api/v1/captures/:id`** returns a single capture row (used by the new editor modal to fetch fresh content).

#### Changed

- **Capture editor modal** now fetches content from the API on click instead of embedding JSON in the `x-on:click` attribute. Eliminates the HTML-attribute escape bug that broke the row layout when captures contained `"`.
- **Tool output rendering** is unified through `renderToolPayload(prefix, payload)` shared by sessions timeline and tool-calls page. The previous in-place `\n` decoder was a no-op (re-escaped via `JSON.stringify`); the new path extracts known string fields cleanly.

#### Fixed

- Tool outputs that started with prefixes other than `Bash:` now expand correctly (the prefix detection no longer collapses raw text).
- Capture rows whose content contained `"` no longer leak `})">` into the visible label and no longer collapse the markdown column to one character per line.

### Brain UI — markdown rendering + no truncation

#### Added

- **Markdown rendering** for prompts, turn agent_text, and capture content via the `marked` library (GFM + breaks). Tables, fenced code blocks, headings, and inline emphasis now render natively in the timeline and captures list.
- **Tool output decoder** — JSON envelopes (e.g. `{"stdout":"…","stderr":"…"}`) are unwrapped and the well-known string fields (`stdout`, `stderr`, `error`, `output`, `result`) render in dark code blocks with real newlines instead of `\n` escapes.
- **Tailwind typography plugin** loaded from CDN with a small `prose` skin (dark code, inline code chips, scrollable tables).

#### Changed

- **No truncation** anywhere in the UI: session timeline events, captures list, and tool-calls list show the full content; long blocks scroll horizontally inside `pre` rather than getting clipped.

### Brain UI — observability + CRUD

#### Added

- **Sidebar nav with 8 sections**: Dashboard, Sessions, Captures, Tool calls, Workflows, Proposals, Artifacts, Settings.
- **Dashboard** — count cards, captures-by-type bar, top tools, recent activity feed.
- **Captures page** — type / session / FTS5 search filters, Alpine.js inline edit modal, soft-delete + trash view + restore.
- **Sessions detail** — chronological timeline merging prompts, turns, tool calls, and captures into one feed.
- **Tool calls page** — per-tool aggregate with error rate + avg duration, filterable list with full output_summary preview.
- **Workflows detail** — Mermaid phase graph with current_phase highlighted + event log.
- **Proposals page** — accept / reject / soft-delete, filter by pattern + status, evidence + patch accordions.
- **Artifacts usage page** — aggregate of `artifacts_used` by name with success rate + recent invocations.
- **Settings page** — project metadata, brain DB stats, local backups list, external archives list with size summary.
- **Soft-delete on `captures` and `proposals`** — `deleted_at INTEGER` column with idempotent v3 schema migration.
- **Write API**: `PATCH /api/v1/captures/:id`, `DELETE /api/v1/captures/:id`, `POST /api/v1/captures/:id/restore`, `POST /api/v1/captures/bulk-delete`, `DELETE /api/v1/proposals/:id`, `POST /api/v1/proposals/:id/restore`.
- **Read API additions**: `GET /api/v1/dashboard/metrics` and `GET /api/v1/captures.csv` (full export, RFC 4180 quoting).

#### Changed

- **Brain schema bumped to v3**. Versioned-migration runner replaces the previous bootstrap-only logic — fresh DBs hit `CURRENT_SCHEMA_VERSION` in one step; existing DBs apply only the missing ALTERs.
- **Brain-ui server runs read-write**. Localhost-only bind (127.0.0.1) is the auth boundary for CRUD endpoints.
- **`pages.ts` is now a thin registry** that delegates to one module per page in `src/runtime/brain-ui/pages/`.
- **Captures session API** filters `deleted_at IS NULL` by default; pass `?trash=1` to include soft-deleted rows.

#### Removed

- The Sprint 5 placeholder `/findings` route. Proposals UI now lives at `/proposals`.
- The legacy `/live` polling page and `/partials/live-captures` HTMX partial. Live updates fold into Dashboard "Recent captures".

### Brain durability + capture grammar refinements

#### Added

- **`.codi/state/` subdir** for precious persistent data (`brain.db`, `operations.json`, `state.json`). Anything under `state/` is never touched by `codi init`, `codi generate`, or orphan pruning.
- **External archive on `clean --all`** — snapshots the full `.codi/` to `~/.codi/archive/<sha-basename>/<timestamp>/` before the wipe so brain history survives uninstalls.
- **`DEFECT` capture type** added to the canonical set (now 11 types) — aligns with the existing `DEFECT-XXX` nomenclature used internally.
- **Auto-promotion of non-canonical markers** — markers with shape `|TYPE: "..."|` whose TYPE is unknown are now persisted as `OBSERVATION` with the original type preserved in `content` (`[unknown_type=<RAW>]`) and `raw_marker`. Stderr warning emitted for visibility.
- **Per-marker `file_paths` auto-extraction** in `persist.ts` — mines path-like tokens from each marker's content (filtering semver, IPs).

#### Changed

- **`brain.db` / `operations.json` / `state.json` paths** moved from `.codi/<file>` to `.codi/state/<file>`. Auto-migration on first read: legacy files are renamed transparently the first time the resolver runs.
- **`capture-everything` rule v4** — documents the auto-promote behaviour, lists `DEFECT` and the canonical synonyms to avoid (`BUG`, `ERROR`, `NOTE`, `TODO`).
- **Brain UI server entrypoint** moved from `scripts/runtime/brain-ui-server.ts` to `src/runtime/brain-ui/cli-server.ts` and bundled into `dist/brain-ui-server.js` so the spawn runs plain Node — no `--experimental-strip-types`.

#### Fixed

- **`codi brain ui` spawn died silently on Node 24** — the detached child invoked `process.execPath --experimental-strip-types` against a `.ts` script importing `.js` specifiers, which Node 24 cannot resolve. The CLI now spawns the bundled `.js` from `dist/` and falls back to the local `tsx` binary when running from source.

### v3 zero closure (F1–F11)

The eleven-step closure that takes Codi v3 from "v2-shaped legacy underneath" to a brain-canonical, devloop-dissolved zero-mode core. Single backend (SQLite), single CLI namespace (`codi workflow ...`), single capture grammar (Iron Law 9). All tests green: 3395 pass + 2 skipped across 281 files.

#### Added

- **Workflow definitions in brain (F1+F2)** — new `workflow_definitions` table seeded from `src/templates/workflows/{feature,bug-fix,refactor,migration,project}.yaml`. Phase graphs / gates / flags now live in SQLite, not in code.
- **Phase graph enforcement (F4)** — `proposeTransition` rejects illegal phase moves against `workflow_definitions[type].phases[from].next`. Graceful degrade for tmp brains without seeded definitions.
- **Capture pipeline (F6)** — `prompts` / `turns` / `captures` / `tool_calls` / `artifacts_used` populated end-to-end:
  - `processPromptSubmit` opens a turn on every UserPromptSubmit
  - `processPostToolUse` records every tool call (`ok` / `error` / `blocked`)
  - `processStopHook` parses `|TYPE: "verbatim"|` markers, persists captures, closes the turn
  - New `scripts/runtime/hook-stop.ts` + `src/templates/hooks/runtime/stop.sh` wired into `hooks.json`
- **Iron Laws live wiring (F7)**:
  - L4 — `phase_transition_proposed` flips `workflow_runs.status` to `pending_approval`; UserPromptSubmit emits the hard-gate banner; only literal `ok` / `OK` / `Ok` passes
  - L5 — PreToolUse warns (advisory) on mutating edits when last brain read is older than 60s
  - L7 — PreToolUse blocks (exit 2) `git commit/push/merge/tag/reset --hard/push --force` when no approval token is found in recent prompts
  - L8 — UserPromptSubmit reads `.codi/preferences.json` and emits the caveman directive
- **`codi workflow` CLI namespace (F9)** — 10 subcommands: `run`, `status`, `abandon`, `recover`, `transition`, `scope {propose,approve,reject}`, `elevate`, `handover`, `stats`. Every action accepts `--as-agent` to attribute to the agent rather than the human user.
- **P9 detector (F10)** — turns `|OBSERVATION: "..."|` captures naming an installed artifact into `OPTIMIZE_EXISTING_ARTIFACT` proposals (case-insensitive match against rules + skills + agents catalog, ≥minEvidence threshold, sorted by evidence count).
- **Brain-backed compactor (F11)** — `compactWorkflows` collapses old terminal `workflow_events` into a `workflow_runs.metadata.compacted` summary blob (preserves init / decisions / scope-approvals / handovers / lifecycle events verbatim) and deletes the redundant rows. Idempotent; supports dry-run.
- **`CODI_BRAIN_DB` env var** — `defaultBrainPath` honors it before falling back to `~/.codi/brain.db`. Test harness uses this for per-test brain isolation.

#### Changed

- **Real gate checks (F8)** — three checks that previously fake-passed are now wired to evidence:
  - `no_unresolved_scope_proposals` — walks events per-file, fails listing each unresolved proposal
  - `validation_passes` — finds the most recent `validation_run` event and requires `exit_code === 0`
  - `all_planned_files_modified` — shells out to `git status --porcelain` for each scope file; untracked files count as modified
- **System author renamed `devloop` → `codi`** in every event written by transitions / elevation / scope handlers and in auto-commit messages.
- **Hook-emitted strings reference `codi workflow ...`** instead of `devloop ...` (state block, scope-violation messages, transition reminders, abandon hint).
- **Child-workflow branch prefix** flipped from `devloop/<parent>/<child>` to `codi/<parent>/<child>`.
- **PR summary marker** flipped from `<!-- devloop-summary-hash:` to `<!-- codi-summary-hash:`.
- **Project preferences relocated** from `.devloop/preferences.json` to `.codi/preferences.json`. `DevloopPreferences` type renamed `CodiPreferences`.
- **Hook classifier** allows `.codi/*.json|jsonl` artifacts in any phase (was `.devloop/`).
- **`codi workflow` reaches the brain DB in production builds** — `findSchemaPath` searches multiple candidate paths so the same source code resolves correctly in dev (`src/schemas/...`) and dist (`dist/schemas/...`); the post-build asset copier now ships `src/schemas/` to `dist/schemas/`.
- **Iron Law 9 capture grammar (F10)** — agent-facing rule (`improvement.ts`) and skill (`rule-feedback`) now instruct the unified `|OBSERVATION: "..."|` marker. The legacy `[CODI-OBSERVATION: artifact | category | text]` grammar is no longer documented in agent-facing artifacts; the gap-category vocabulary lives inside the verbatim text where P9 detects it.

#### Removed (F5 + F11)

- `src/runtime/event-log.ts`, `event-log-factory.ts`, `paths.ts` and their tests — the legacy filesystem-archive event log (`.workflow/active/` + `.workflow/archives/`). Every handler now goes through `BrainEventLog`.
- `scripts/runtime/{devloop,classify,gate,manifest,pre-squash}.ts` — broken legacy CLI scripts (imported `../lib/*` paths that never existed); zero callers.
- `tests/runtime/e2e/` — stale shell harness pinned at `/Users/laht/projects/devloop`.
- Legacy filesystem compactor (`compactAllArchives`) — replaced by brain-backed `compactWorkflows`.

#### Internal

- 33 new tests across `capture-session`, `stop-hook`, `prompt-hook`, `iron-laws-wiring`, `gate-fixes`, `p9-detector`, `unit/cli/workflow`, plus the brain-backed compactor block in `m5-features`.
- Net diff across F1–F11: ~+3000 / −2400 lines, including ~600 lines of dead code purged.

## [3.0.0] - 2026-05-08

Major release — Codi v3 ed.0 zero-mode. Introduces the canonical SQLite brain, the capture protocol (Iron Law 9), the brain-ui Hono server, the consolidation pipeline with LLM enrichment (Gemini + OpenAI), the Capabilities Matrix, the `codi migrate v2-to-v3` planner + executor, the `codi plugin publish` dual-track distribution, and the v3 Diataxis docs. v2 users upgrade via `codi migrate v2-to-v3 --apply`; the migration backs up `.codi/` before any rewrite.

### BREAKING

- **SQLite brain at `~/.codi/brain.db` is now the canonical persistence**. v2 was a stateless generator; v3 captures everything the user says into 12 structured tables. v2 users MUST run `codi migrate v2-to-v3` before upgrading the dependency. The migration creates `.codi.v2.backup-<ts>/` before any rewrite, so rolling back is a `mv` away.
- **DevLoop event-log layout (`.devloop/active/`) is deprecated.** Workflows can opt into the new brain backend via `CODI_USE_BRAIN_BACKEND=1`; legacy file-based event log stays the default in v3.0.0 to keep ~30 DevLoop tests green during the migration window. v3.1+ will flip the default.
- **`engines.node` continues to require `>= 20.19`.** No change versus v2.14, listed here for explicitness.
- **Tier 2 adapters (Cursor, Windsurf, Cline, Copilot, Gemini) emit the SAME artifacts they emitted in v2.x.** The new Capabilities Matrix is OPT-IN; legacy adapters are GRANDFATHERED. v3.1+ may migrate them with their own release notes.
- **`/api/v1/consolidation/run-with-llm`** now returns a real proposal-enrichment response when `CODI_LLM_PROVIDER` + the matching API key are configured. Previously a 501 stub.

### Migration

See `docs/src/content/docs/guides/upgrade-from-v2.md`.

```bash
codi migrate v2-to-v3            # dry-run
codi migrate v2-to-v3 --apply    # 5-step plan: backup, brain bootstrap, yaml, regen, summary
codi generate --force            # refresh per-agent output
```

### Added — Codi v3 ed.0

- **DevLoop merge** — copied DevLoop libs/hooks/schemas/scripts into `src/runtime/`, integrated 32 DevLoop test files into the main vitest suite, and migrated all 22 DevLoop skills into Codi v2 standard layout (`template.ts` + `index.ts`). Catalog: 67 → 84 skills.
- **SQLite canonical brain** (`src/runtime/brain/`) — 11-table schema (`projects`, `sessions`, `prompts`, `turns`, `captures`, `tool_calls`, `corrections`, `artifacts_used`, `_codi_schema_version`, `workflow_runs`, `workflow_events`) with FTS5 mirrors over `captures` and `prompts`. Drizzle ORM for typed access; idempotent bootstrap migration with WAL + foreign-keys + busy-timeout.
- **Capture markers protocol** (Iron Law 9) — `src/runtime/capture/` parses `|TYPE: "..."|` markers across the 10 canonical capture types (RULE, PROHIBITION, PREFERENCE, FEEDBACK, INSIGHT, OBSERVATION, DECISION, QUESTION, PROMPT, CORRECTION) and persists deduplicated rows to the brain. New `codi-capture-everything` rule enforces emission; `UserPromptSubmit` hook injects a per-turn reminder.
- **ExternalSyncer interface** (ADR-005) — `src/runtime/sync/external-syncer.ts` contract + `SyncerRegistry`. Sheets and Xlsx sync targets are now opt-in adapters behind the same surface; SQLite stays the source of truth.
- **Hono-based brain-ui server** (`src/runtime/brain-ui/`) — read-only HTTP API (9 endpoints: projects, sessions, captures, FTS5 search, workflows + events, proposals list/accept/reject) plus HTMX pages (sessions, session detail, live polling, workflows, findings stub). Spawn-or-attach lifecycle via `~/.codi/brain-ui.pid` so multiple agent sessions share one server. Default port 4477.
- **Consolidation pipeline scaffold** (`src/runtime/consolidate/`) — `proposals` table, typed `Proposal` / `Proposal{Type,Status}` / `ProposalEvidence` records, and three pattern detectors: P1 (repeated correction → PROMOTE_TO_RULE), P2 (unused skill → DEPRECATE_ARTIFACT), P5 (consistent new pattern → CREATE_NEW_ARTIFACT). Remaining patterns P3/P4/P6/P7/P8 follow the same `PatternDetector` contract.
- **Capabilities Matrix** (`src/core/capabilities/`) — per-target feature flags: Tier 1A (Claude Code) supports the full surface, Tier 1B (Codex CLI) everything except UI integration, Tier 2 (Cursor / Windsurf / Cline / Copilot / Gemini) skills + rules + MCP only. Generators consult `supports(target, feature)` before emitting output.
- **`codi migrate v2-to-v3` planner** (`src/core/migration/v2-to-v3.ts`) — pure-function `detectV2Layout` + `planMigration` + `formatPlan`. Dry-run by default; the executor is gated on explicit `ok` and writes a timestamped backup of `.codi/` before any rewrite.
- **10 ADRs** documenting the v3 ed.0 decisions: rebrand-in-place, DevLoop merge, tiered capabilities, workflows as artifacts, SQLite canonical, catalog of 77 artifacts, four architectural features, DDD internal layout, plugin distribution dual track, install modes (zero / lite / standard / full).

### Fixed

- **Unselecting an agent during `codi init --customize` now fully removes its directories** — three independent bugs combined to leave `.cursor/`, `.windsurf/`, `.cline/` (and similar) on disk after the deselected agent's files were "pruned":
  1. `detectOrphans` read every file as UTF-8 then SHA-256'd the string. Binary assets (skill fonts, PDFs, .tar.gz) corrupted, hashes mismatched, files were misclassified as drifted (preserved). Now reads as `Buffer` and hashes raw bytes via the new `hashBuffer`. Files whose stored `generatedHash` is the empty-input sentinel (binaries the generator skipped hashing) are auto-classified as clean orphans.
  2. `updateAgentsBatch` only overwrote keys present in the new map, so a fully-removed agent's stale entries persisted in `state.json` indefinitely. New `StateManager.removeAgents(ids)` is invoked from `applyConfiguration` for every agent in `prevAgentIds` not in `nextAgentIds`.
  3. Empty husk dirs (`.cursor/`, `.cursor/rules/`, `.cursor/skills/`) were never removed. New `pruneEmptyAdapterDirs` walks parents of every deleted file plus the removed agent's declared root dirs and `fs.rmdir`s deepest-first; non-empty dirs survive via `ENOTEMPTY` so user files are preserved.
- **Destructive operations now take a recoverable snapshot** — `codi init`, `codi init --customize`, `codi update`, `codi clean` (non-`--all`), `codi preset install`, and the "Add from external" wizard all open a backup before mutating files and finalise it only on success. Captures `.codi/` source, state-tracked output, and pre-existing files (e.g. a hand-written `CLAUDE.md` from before `codi init`). Restorable via `codi revert`.
- **Conflict-marker validator no longer flags documentation examples** — the v2.14.0 `E_CONFLICT_MARKERS` check (in `codi validate` and the `codi-conflict-marker-check.mjs` pre-commit hook) matched markers inside skill documentation that teaches conflict resolution (e.g. the `codi-dev-operations` skill, default in `codi-dev` and `codi-power-user` presets), causing `codi init` to silently set `generated: false` / `hooksInstalled: false` with no human-readable error. The scanner now skips markers inside fenced code blocks (` ``` ` and `~~~`) and `<example>` tag regions. Same logic mirrored into the inlined pre-commit hook script.
- **`codi init` now surfaces validation errors** — when `resolveConfig` rejects the freshly scaffolded `.codi/` (e.g. a corrupted template or a real merge conflict in user-edited content), `init` previously skipped `applyConfiguration` and `installHooks` without printing anything, leaving the user with `generated: false` and no clue why. The handler now prints each `ProjectError`'s code, message, and hint, points to `codi generate` for recovery, and includes the errors in a new `validationErrors` field on the JSON output for non-interactive callers.
- **Curl installer no longer force-upgrades users on Node 20.19+ to Node 24** — `site/install.sh` was checking `NODE_MAJOR < CODI_NODE_VERSION` (default `24`), routing every Node 20 / 22 user through an unnecessary `nvm install 24` even though codi-cli@2.14.1 already supports Node 20.19+. Split the single variable into two: `CODI_NODE_MIN_MAJOR` (default `20`, the floor accepted as already-good) and `CODI_NODE_VERSION` (default `24`, the version installed when an upgrade is needed). Banner, error messages, exit-code descriptions, and `docs/20260424_1327_SPEC_curl-installer.md` updated to match. Closes the gap between the package's `engines.node` and the installer.

### Added

- **Backup lifecycle** — `openBackup` -> `handle.append` -> `handle.finalise` replaces single-shot `createBackup`. Callers can append paths mid-operation (e.g. orphans before deletion); manifest is written LAST as a commit marker, so a crash before `finalise()` leaves a partial dir that the next `openBackup` sweeps via `pruneIncompleteBackups`. Legacy `createBackup` kept as a thin wrapper for `generate.ts`. New types: `BackupTrigger`, `BackupScope`, `SnapshotOptions`, `BackupManifestV2`, `BackupHandle`, `OpenBackupResult`.
- **Manifest v2** — records `trigger`, `codiVersion`, and per-file `scope` (source/output) plus `preExisting` / `deleted` flags. v1 manifests are auto-upgraded on read with `scope: "output"`.
- **Retention** — TUI eviction with double-confirm when at the 50-backup cap (raised from 5); cancellation aborts the destructive op with `E_BACKUP_CANCELLED`. Non-interactive runs evict oldest. Partial dirs swept on next `openBackup`.
- **Source + pre-existing capture** — backup can include `.codi/` source files (excluding `.codi/backups`, `.codi/.session`, `.codi/feedback`) and pre-existing files at adapter target paths not yet in `state.json` (e.g. a hand-written `CLAUDE.md` from before `codi init`).
- **`pruneEmptyAdapterDirs`** removes empty adapter dirs (`.cursor/`, `.claude/`) after orphan deletion when an agent is unselected. Threaded into `applyConfiguration` alongside the optional `BackupHandle`; orphan paths are recorded as `deleted: true` in the open backup before removal so revert can restore them.
- **`codi backup` command** (`--list`, `--delete <ts...>`, `--prune`) for backup management without restoring.
- **`codi revert` overhaul** — interactive TUI picker when no flag is given, `--dry-run` flag, automatic pre-revert snapshot (revert is itself reversible), restore via the artifact-selection wizard for backups with `.codi/` source plus a direct-file fallback for legacy output-only backups. `--list`, `--last`, `--backup <ts>` preserved.
- **User guide** at `docs/src/content/docs/guides/backups-and-recovery.md`; architecture and hooks-reference docs updated.
- **Shared `src/core/scanner/literal-blocks.ts` module** — pure, line-oriented scanner that returns the line ranges in a text body that should be treated as illustrative content (fenced code blocks, `<example>` tag regions). Used by the conflict-marker scanner and the inlined hook template; available for any future safety scanner that needs the same "ignore documentation examples" semantics. Unclosed fences and tags extend literal coverage to end of input, matching how Markdown renderers handle truncated documents and preventing a stray fence from silently disabling the safety check. Tag matching is case-insensitive and the tag list is configurable; the default is `["example"]`.
- **Shared `src/core/scanner/literal-blocks.ts` module** — pure, line-oriented scanner that returns the line ranges in a text body that should be treated as illustrative content (fenced code blocks, `<example>` tag regions). Used by the conflict-marker scanner and the inlined hook template; available for any future safety scanner that needs the same "ignore documentation examples" semantics. Unclosed fences and tags extend literal coverage to end of input, matching how Markdown renderers handle truncated documents and preventing a stray fence from silently disabling the safety check. Tag matching is case-insensitive and the tag list is configurable; the default is `["example"]`.
- **Coverage quality gate enforced at pre-push and in CI** — new `.husky/pre-push` runs `pnpm lint && pnpm test:coverage` before every `git push`, and the CI `test` job now uses `pnpm test:coverage` instead of bare `pnpm test`. Both consumers enforce the thresholds defined in `vitest.config.ts` (global lines ≥ 76%, statements ≥ 75%, functions ≥ 79%, branches ≥ 66%, plus tighter per-subsystem bars for `src/adapters`, `src/core/config`, `src/core/flags`, `src/core/verify`, `src/schemas`, `src/utils`). Pre-commit remains <5s with file-level checks only — full tests + coverage stay at the pre-push stage as documented in the v2.14.0 architectural decision. Bypassing pre-push with `--no-verify` is project-policy-forbidden (see CLAUDE.md).
- **Codecov integration for PR coverage comments** — `.github/workflows/ci.yml`'s `test` job uploads `coverage/lcov.info` to Codecov after running `pnpm test:coverage`. Codecov posts a sticky PR comment with project-level coverage delta plus file-level annotations on the diff itself, and runs an informational patch-coverage check (target: 80% on PR-touched lines). The authoritative gate stays the CI `test` job's own exit code (driven by vitest thresholds in `vitest.config.ts`); Codecov's checks are informational. Configuration in `codecov.yml` mirrors the vitest exclude list so the dashboard, local runs, and CI all see the same numbers. `vitest.config.ts` `coverage.reporter` extended with `lcov` (Codecov input) and `json-summary` (machine-readable totals for future PR-comment scripts), keeping the existing `text`, `text-summary`, and `html` reporters.
- **Pull-request template** at `.github/PULL_REQUEST_TEMPLATE.md` — pre-fills new PRs with sections for Summary / Why / Approach / Test plan / Risk / Verification before merge / Notes for the next session. Aligned with the patterns used in 2.14.0 and 2.14.1 promotion PRs (#89, #91, #93).
- **Coverage scope clarified via principled excludes** in `vitest.config.ts`:
  - Top-level Commander wiring + interactive `@clack/prompts` UI files (`cli.ts`, `cli/watch.ts`, `cli/contribute.ts`, `cli/preset.ts`, `cli/add.ts`, `cli/hub.ts`, `cli/skill.ts`) — testable logic lives in matching `*-handlers.ts` / `*-wizard.ts` siblings, which are covered.
  - Heavy `@clack/prompts` orchestration files (`cli/wizard-prompts.ts`, `cli/wizard-summary.ts`, `cli/preset-handlers.ts`, `cli/hub-handlers.ts`, `cli/preset-wizard.ts`, `utils/conflict-resolver.ts`'s interactive loop) — pure helpers within these files are tested where they exist; the prompt-driven control flow needs a comprehensive prompt-mock harness that does not yet exist (tracked as test-debt; commented in the config).
  - Network/git boundary files (`cli/contribute-git.ts`, `cli/preset-github.ts`, `cli/update-check.ts`) — need `msw` + git-fixture infrastructure.
  - Browser/worker frontend code (`templates/skills/**/generators/**`, `templates/skills/**/static-dir.ts`, `templates/skills/**/references/**`) — runs in the user's browser, not server-side.

### Changed

- **Test coverage uplift across the codebase** — added unit and integration tests covering: `validate.ts` (CONFIG_NOT_FOUND vs CONFIG_INVALID branches, content-size warnings), `verify.ts` (CONFIG_INVALID branch, missing-rules check), `status.ts` (drift_detection=off short-circuit, drift_detection=error exit code, hook drift, preset-artifact drift with --diff), `semver.ts` (parse-failure paths under `>=`), `yaml-serialize.ts` (empty-string + special-char rejection branches), `diff.ts` `extractConflictHunks` (all four branch shapes), `project-context-preserv.ts` (anchor-replacement + mid-doc H2 branches), `fs.ts` (safeRm catch branch), `section-builder.ts` (multi-var sort comparator), plus new test files for `docs-stamp.ts`, `docs-check.ts`, `wizard-legend.ts`, and a smoke matrix exercising every top-level `register*Command` registrar. Coverage moved from 65% lines / 64% functions / 63% statements / 55% branches to **88% / 90% / 86% / 75%**, comfortably above all thresholds.

## [2.14.1] - 2026-04-30

### Fixed

- **Node engine requirement lowered from `>=24` to `>=20.19.0`** — the codi-cli runtime uses only `structuredClone` (Node 17+), `fetch` (Node 18+), and other APIs available since Node 20. The previous `>=24` floor produced an `EBADENGINE` warning for every Node 20 / 22 LTS user even though `codi` ran correctly on those versions. tsup `target` lowered from `node24` to `node20` to match. Documentation (`README.md`, `docs/project/getting-started.md`, `docs/project/troubleshooting.md`, `docs/src/content/docs/guides/getting-started.md`) updated to state the new minimum. (Note: the curl installer was _intended_ to keep installing Node 24 in this release but in fact still hard-required Node 24 on existing-Node-20 users; that gap was closed in 2.14.2.)

### Changed

- **`@clack/core` promoted to a direct `dependencies` entry (pinned to `1.2.0`)** — `src/cli/group-multiselect.ts` and `src/cli/wizard-prompts.ts` import from `@clack/core` directly, but the package was only available as a transitive of `@clack/prompts`. npm (with auto-hoisting) masked the missing dep; pnpm with strict `node_modules` isolation surfaced it as a `TS2307: Cannot find module '@clack/core'` build failure on CI. Pinning at `1.2.0` matches the version `@clack/prompts` ships with, so pnpm dedupes to a single copy.
- **`exceljs` and `pptxgenjs` moved from `dependencies` to `devDependencies`** — both packages are imported only by skill template scripts (`src/templates/skills/xlsx/scripts/ts/generate_xlsx.ts`, `src/templates/skills/pptx/scripts/ts/generate_pptx.ts`) that run inside the user's project after scaffolding, never by the CLI runtime (`src/cli.ts` / `src/index.ts`). End users running `npm install -g codi-cli` now skip 91 transitive packages and 6 deprecation warnings (`fstream`, `glob@7`, `inflight`, `lodash.isequal`, `rimraf@2`, `uuid@8`) inherited from the legacy `archiver@5` / `unzipper@0.10` dep chains. Users who run the bundled TypeScript generators must install the packages in their own project first: `npm install exceljs` or `npm install pptxgenjs`. The `codi-xlsx` and `codi-pptx` skill READMEs document this prerequisite.
- **CI workflows migrated from npm to pnpm** — `.github/workflows/{ci,release,pages}.yml` now use `pnpm/action-setup@v4`, `cache: pnpm` on `actions/setup-node`, and `pnpm install --frozen-lockfile`. Matches the project's canonical package manager. `npm publish --provenance` is retained in `release.yml` (the npm CLI publishes pnpm projects without modification). `node -p 'require(...)'` patterns replaced with `jq` (preinstalled on `ubuntu-latest`).

### Removed

- **`package-lock.json`** — pnpm is the canonical package manager (`pnpm-lock.yaml` is the source of truth). The stale `package-lock.json` (last seen at version 2.12.0) was deleted to prevent drift between two lockfile formats.

## [2.14.0] - 2026-04-29

### Fixed

- **Per-language pre-commit hooks no longer lint vendored agent content** in `.agents/`, `.claude/`, `.codex/`, `.cursor/`, `.windsurf/`, `.cline/`. The YAML `exclude:` regex previously covered only `.codi/`; the six other agent dirs are now part of a single source of truth (`src/core/hooks/exclusions.ts`) consumed by both the YAML renderer and the file-size check template.
- **Pre-commit YAML insertion no longer corrupts `.pre-commit-config.yaml`** when the project already had `repos:` entries with nested `hooks:` lists. The legacy text-based renderer (`findReposInsertionPoint`) overwrote `listIndent` on every nested list item, causing the generated Codi block to land **inside** the external repo's `hooks:` list and produce invalid YAML. The function now locks `listIndent` to the first list item it encounters under `repos:` and never reassigns it. The renderer was subsequently superseded by a YAML AST round-trip implementation (see Changed).

### Changed

- **Pre-commit framework runner emits canonical upstream `repo:` references with pinned `rev:` and `additional_dependencies` where required** — `astral-sh/ruff-pre-commit`, `pre-commit/mirrors-mypy`, `PyCQA/bandit`, `pre-commit/mirrors-prettier`, `gitleaks/gitleaks`, `alessandrojcm/commitlint-pre-commit-hook`, `koalaman/shellcheck-precommit`. Codi's own `.mjs` scripts remain `repo: local`. Users now get isolated tool envs, `pre-commit autoupdate` compatibility, and proper version pinning out of the box.
- **`.pre-commit-config.yaml` write path is now a YAML AST round-trip via the `yaml` package** — Codi-managed entries carry a `# managed by codi` comment marker on their `repo:` line. On regeneration: non-marked entries pass through untouched, marked entries are rebuilt from the registry, and **user-edited `rev:` pins on marked entries are preserved**. Malformed YAML triggers a `.pre-commit-config.yaml.codi-backup` write before regeneration. Idempotent: re-running with no changes produces byte-identical output and skips the write.
- **Default Python type checker is now `basedpyright`** (PyPI wheel, no npm dependency) when no project signals point elsewhere. Auto-detection picks `mypy` when `[tool.mypy]` / `mypy.ini` / Django / SQLAlchemy / `django-stubs` is present, `basedpyright` for FastAPI / pydantic / SQLModel projects or codebases over 20k Python LOC. The previous default was `npx pyright`, which forced an npm dependency on pure-Python repos.
- **Type-checking (`tsc`, `mypy`, `basedpyright`, `pyright`, `dotnet-build`, `phpstan`) and full test suites default to `pre-push` stage** instead of `pre-commit`. Override via the new `commit_type_check` / `commit_test_run` flags or by editing `.codi/flags.yaml` directly. Industry consensus is to keep commits under 5s; the upstream `pre-commit` project explicitly rejects pytest as a pre-commit hook.
- **Bandit invoked with `-lll` (high severity only)** by default and `additional_dependencies: ["bandit[toml]"]` so `[tool.bandit]` configuration in `pyproject.toml` works without separate setup. Install hint corrected to `pip install "bandit[toml]"`.
- **Prettier scope expanded** to `**/*.{ts,tsx,js,jsx,mjs,cjs,json,md,mdx,yaml,yml,css,scss,html}` (was `*.{ts,tsx,js,jsx}`).
- **Generated `.pre-commit-config.yaml` includes top-level keys**: `default_install_hook_types: [pre-commit, commit-msg, pre-push]`, `default_language_version: {python: python3.12, node: '22'}`, `minimum_pre_commit_version: '3.5.0'`, and a global `exclude:` derived from the `VENDORED_DIRS` SSoT (see Fixed entry above). Existing user values are never overwritten.
- **Hook registry split into per-language modules** under `src/core/hooks/registry/` (one file per language plus `global.ts` and a barrel `index.ts`). `src/core/hooks/hook-registry.ts` becomes a thin backward-compat shim. New `HookSpec` shape replaces flat `HookEntry` (`HookEntry` retained as a type alias). Each spec carries explicit `shell` and `preCommit` emission descriptors so each renderer reads its own field instead of sharing ambiguous fields.

### Added

- **Conflict-marker detection** in `codi validate` and as a new global pre-commit hook (`conflict-marker-check`). `validate` scans rule, skill, and agent content for `<<<<<<<` / `=======` / `>>>>>>>` / `|||||||` (diff3) markers and emits `E_CONFLICT_MARKERS` with file and line. The pre-commit hook script (`codi-conflict-marker-check.mjs`) blocks commits containing markers in any non-binary staged file. Both consumers share a pure scanner in `src/core/hooks/conflict-markers.ts`.
- **`codi doctor --hooks`** mode that lists per-hook tool availability with severity (ok / warning / error), category, and install hint. Exits non-zero if any required hook tool is missing. Uses the existing `checkHookDependencies` infrastructure; complements `installMissingDeps` which runs at `codi init` time.
- **Batched install hints in `installMissingDeps`**: missing pip / brew / gem / go / cargo / rustup tools are now grouped into single commands per package manager (`pip install ruff pyright` instead of two separate fragments). cargo and rustup are kept as separate groups since rustup components are not crates.
- **Four new tooling-default flags**, all with default value `auto`:
  - `python_type_checker`: `auto | mypy | basedpyright | pyright | off`
  - `js_format_lint`: `auto | eslint-prettier | biome | off`
  - `commit_type_check`: `auto | on | off` (default resolves to `off` — defer to pre-push)
  - `commit_test_run`: `auto | on | off` (default resolves to `off` — industry default)

  `auto` is resolved at `codi init` / `codi generate` time by `src/core/hooks/auto-detection.ts`, which reads `pyproject.toml`, `requirements.txt`, `package.json` (deps + workspaces signal), counts python/ts/js LOC, and probes for `mypy.ini`, `pyrightconfig.json`, `biome.json`, `.eslintrc`, `.prettierrc`. The four flags are added to all six builtin presets (minimal, balanced, strict, fullstack, development, power-user).

- **Biome registry entry** as the alternative to eslint+prettier for JS/TS lint and format. Upstream hook is `biomejs/pre-commit` v0.6.1 with `additionalDependencies: ["@biomejs/biome@2.3.0"]`. When `js_format_lint=biome` is set, the hook-config-generator drops eslint and prettier from the spec list and emits the Biome `biome-check --write` hook instead.

- **Interactive wizard summary screen** at the end of `codi init`. After language detection, Codi shows the four auto-resolved tooling defaults with their reasoning signals, then offers `Accept (Enter)` / `Customize each` / `Skip pre-commit hooks entirely`. Customize walks one prompt per flag with the auto-pick pre-highlighted; Skip bypasses hook installation entirely. The accepted picks are merged into `.codi/flags.yaml` so subsequent `codi generate` runs honour them.

- **Commitlint global hook** (`alessandrojcm/commitlint-pre-commit-hook` with `additionalDependencies: [@commitlint/config-conventional]`) wired to the `commit-msg` stage, gated by the existing commit-msg-validation infrastructure.

- **Polyglot integration test** (`tests/integration/hook-install-precommit.test.ts`) covering: TS+Python managed-entries emission, migration from the legacy text-marker block, user-pinned `rev:` preservation, and malformed-YAML backup behaviour.

- **E2E test** (`tests/e2e/precommit-multilanguage.test.ts`) that pipes the rendered config through `pre-commit validate-config`. Auto-skipped when `pre-commit` is not on PATH; CI now installs it via `pip install pre-commit` in `.github/workflows/ci.yml`.

### Migration

On first `codi generate` after upgrading, Codi:

1. Strips any legacy `# Codi hooks: BEGIN ... END` text-marker block from your `.pre-commit-config.yaml` (and the older column-zero broken form).
2. If your `.pre-commit-config.yaml` is malformed, copies it to `.pre-commit-config.yaml.codi-backup` and rewrites from scratch.
3. Re-emits Codi-managed entries with the new layout (upstream `repo:` references for canonical tools, pinned `rev:`, top-level keys). Your manually-edited `rev:` values on Codi-managed entries are preserved.

The four new flags default to `auto` — existing projects do not need to set them. To override the auto-resolved values, either run the interactive wizard during `codi init` (Customize / Skip options) or edit `.codi/flags.yaml` directly between runs.

- **Hub: "Customize codi setup" entry** — when `.codi/` exists, the first hub entry now reads "Customize codi setup" and routes directly into the modify menu, skipping the previous "Force reinitialize? Yes/No" prompt that hid the modify-mode wizard. When `.codi/` is absent, the entry stays "Initialize project". Selecting "Customize codi setup" opens a top-level dispatcher: customize current artifacts, add from local directory / ZIP / GitHub repo, or replace preset (advanced).
- **Add artifacts from external source** — new workflow under "Customize codi setup". Connect to a local directory, ZIP file, or public GitHub repository; codi walks the source for `rules/`, `skills/`, `agents/`, `mcp-servers/` and lists every artifact found. Per-type sequential multi-select (Rules → Skills → Agents → MCP servers) matching the regular init wizard's pattern. Per-collision prompts (keep current / overwrite / rename with `-from-<source>` suffix) with an "apply to remaining" affordance. Externally-added artifacts are recorded in `artifact-manifest.json` with `managedBy: user` and a new `source:` provenance field, so subsequent `codi update` runs leave them untouched.
- **Depth-aware preset discovery** — `findArtifactRoots` walks the source tree up to 2 levels deep, so a GitHub-zip layout like `repo-name/{rules,skills,…}` or a multi-preset bundle like `repo-name/{preset-a,preset-b}/{rules,skills,…}` is discovered automatically. When multiple candidate presets are found in one source, the user is prompted to pick one. Skips dotfiles, `node_modules`, `.git`, `dist`, `build`.
- **Init: "Import from local directory" option** — the regular `codi init` wizard's Configuration step now offers the same external-source import as `Customize codi setup`. Picking it routes through the artifact-selection workflow (skips the preset-style installer for local paths, since they are user-pointed paths rather than packaged presets).
- **Init: artifact-selection fallback for ZIP / GitHub without `preset.yaml`** — when the regular preset-style installer fails because the source has no `preset.yaml` (community bundles like `codi-presets-main.zip`), codi now re-attempts via the same artifact-selection workflow rather than silently falling back to the default preset.
- **Auto-generate after Add from external** — `runAddFromExternal` now triggers `regenerateConfigs(projectRoot)` automatically when at least one artifact is installed. Falls back to a clear "run codi generate manually" warning if auto-generate fails. The user no longer has to type `codi generate` after every external import.
- **Curl installer** — one-liner install at `https://lehidalgo.github.io/codi/install.sh` that detects the host environment and installs nvm + Node 24 if missing, then runs `npm install -g codi-cli`. Avoids the EACCES failure mode that hits users with system-managed Node on `/usr/local`. Honors `CODI_VERSION`, `CODI_INSTALL_NVM`, `CODI_DRY_RUN`, `CODI_NO_COLOR` overrides. Published checksum at `install.sh.sha256` for verification. Hosted via the existing GitHub Pages deploy.

### Changed

- **Generate respects the project's configured agents** — `codi hub` → "Generate configs" now lists and pre-selects only the agents declared in `.codi/codi.yaml`'s `agents:` field, instead of always offering all six registered adapters. Unknown adapters in the manifest are skipped with a warning. If the manifest is unreadable, falls back to all-adapters with a warning. If zero usable agents are configured, errors out before prompting.
- **GitHub URL parser uses canonical resolver** — the "Add from GitHub" flow now resolves the repo via `parsePresetIdentifier` (the same parser the rest of the CLI uses), so it accepts every form codi accepts elsewhere: `org/repo`, `org/repo@v1.2.0`, `github:org/repo#branch`, `https://github.com/org/repo[.git]`, and `https://github.com/org/repo/tree/branch`. Bare `org/repo` no longer fails with "Not a GitHub identifier".
- **Welcome banner now renders inside a rounded box** — the ASCII logo, tagline + version, and Stack/Agents status lines are framed with `╭─...─╮` borders (matching the Codex CLI visual style). Auto-sizes to the widest content line. Falls back to the un-boxed layout on terminals narrower than the box width.
- **Artifact manifest schema** — `ArtifactEntry` gained an optional `source` field (e.g. `"github:org/repo@ref"`, `"zip:bundle.zip"`, `"local:/abs/path"`). Additive — existing manifests parse unchanged.

### Fixed

- **`npm version` now ships the tag in the same step** — `postversion` script switched from bare `git push` to `git push --follow-tags`. Previously every release required a manual `git push origin vX.Y.Z` follow-up, or the tag stayed local-only.

## [2.9.0] - 2026-04-18

### Added

- **GitHub Copilot support (6th agent platform)** — `codi generate` now emits `.github/copilot-instructions.md`, path-scoped `.github/instructions/{name}.instructions.md`, VS Code Prompt Files in `.github/prompts/`, Agent Skills in `.github/skills/{name}/SKILL.md`, custom agents in `.github/agents/{name}.agent.md`, MCP config at `.vscode/mcp.json`, and heartbeat hooks via `.github/hooks/codi-hooks.json`. Supports both Copilot Chat (IDE) and Copilot CLI / Coding Agent (Agent Skills) in a dual-format single pass.
- **`sanitizeNameForPath()` shared utility** — single source of truth for adapter-level filename sanitization across all 6 adapters; prevents path traversal via artifact names (`../`, `/`, special chars).
- **Adapter-derived `codi clean`** — `AGENT_SUBDIRS` / `AGENT_FILES` / `knownFiles` now derived from `ALL_ADAPTERS` so new adapters auto-register for cleanup. `isSafeSubdir` guard prevents recursive deletion of the project root when an adapter declares `paths.rules = "."` (Codex).
- **content-factory — plan-first operating system** — six-phase validation-gated workflow (Discovery → Master → Validation → Planning → Validation → Generation) with Markdown anchor, Markdown variant plans, and HTML rendering only after explicit user approval
- **content-factory — platform subfolder structure** — `content/{linkedin,instagram,facebook,tiktok,x,blog,deck}/` scaffolded per project with per-platform playbooks and traversal-safe path resolution
- **content-factory — My Work tab** — promoted from Gallery filter to top-level tab
- **content-factory — external-skill soft deps** — integration with `marketingskills`, `claude-blog`, `claude-seo`, `banana-claude`
- **content-factory — UI polish** — format picker gated by type, preview-bar card controls, scrollable filmstrip, 3× export resolution, default light palette
- **`codi generate` prunes orphaned files** — files that were generated in a previous run but are no longer present in the source templates are now automatically deleted. Files with local edits are preserved unless `--on-conflict keep-incoming` (or `--force`) is passed. Implemented via new `StateManager.detectOrphans()` + `deleteOrphans()` methods with unit test coverage.
- **`codi update --on-conflict <strategy>`** — `codi update` now accepts the same `keep-current` / `keep-incoming` strategies as `codi generate` for non-interactive conflict resolution.
- **`--on-conflict` flag** — `codi init` and `codi generate` accept `--on-conflict keep-current|keep-incoming` to control conflict resolution in non-interactive/CI mode; `--force` remains an alias for `keep-incoming`
- **heartbeat hooks** — `codi generate` writes `codi-skill-tracker.cjs` and `codi-skill-observer.cjs` to `.codi/hooks/` and wires them into `.claude/settings.json` and `.codex/hooks.json`
- **skill-observer** — Stop hook extracts `[CODI-OBSERVATION: ...]` markers from the transcript and writes feedback JSON to `.codi/feedback/`
- **skill-tracker** — InstructionsLoaded hook records active Codi skills to `.codi/.session/active-skills.json`
- **core-platform** — all 6 built-in presets now include the self-improvement rule and 5 self-improvement skills by default (verification, session-recovery, rule-feedback, refine-rules, compare-preset)
- **refine-rules** — two-mode skill (REVIEW + REFINE) that reads `.codi/feedback/` and edits rule files with approval
- **brand-creator** — new skill replacing `brand-identity`; generates brand skills with `brand/tokens.json` (themes, fonts, assets, voice)
- **content-factory** — brand API endpoints (`/api/brands`, `/api/active-brand`) and brand template support
- **content-factory** — campaign pipeline: `/api/active-card`, `/api/brief`, brief-driven variant propagation, promote-to-template workflow
- **manifest** — `project_context` field: free-form markdown injected into the AI instruction file
- **generate** — auto-injects self-development mode warning into CLAUDE.md when `manifest.name === "codi"`
- **skill READMEs** — setup guides added for 17 complex skills

### Changed

- **skills consolidation (66 → 60)** — six merges collapse redundant skills while preserving all functionality:
  - `skill-feedback-reporter` absorbed into `refine-rules` as REVIEW mode
  - `session-handoff` + `daily-log` → `session-log` (HANDOFF / LOG / RESUME modes, markdown journal in `docs/sessions/`)
  - `diagnostics` absorbed into `debugging` as Phase 5 (MCP-powered deep diagnosis)
  - `test-run` + `test-coverage` → `test-suite` (RUN / COVERAGE / GENERATE modes)
  - `plan-executor` + `subagent-dev` → `plan-execution` (INLINE / SUBAGENT modes, always asks user)
  - `doc-engine` absorbed into `content-factory` (business documents as a reference template)
- **rule-feedback** — `user-invocable: false`; uses `[CODI-OBSERVATION: ...]` markers instead of writing JSON files
- **improvement rule** — agent emits observation markers instead of writing files; max 3 per session
- **settings.json** — always generated; always includes heartbeat hook wiring
- **content-factory** — named project workspace, export stack, DOCX fidelity improvements, A4 page discipline

### Fixed

- **`codi generate` / `codi update` — conflict flag name collision** — `GenerateOptions` and `ConflictOptions` used a misnamed `json` field that meant "skip conflicts silently", colliding with the CLI's global `--json` output flag. Passing `--json` for JSON output silently activated skip-conflicts mode, causing unintended preservation of stale files. Renamed to `keepCurrent` throughout the codebase. The CLI's `--json` flag now controls output format only; `--on-conflict keep-current` controls conflict behavior independently.
- **content-factory — per-file type inference** — preview header derives type/canvas from the active file's card class, not the project-level preset
- **content-factory — subfolder path handling** — content/session-content/persist-style routes accept relative paths like `linkedin/carousel.html` with a path-traversal guard
- **content-factory — gallery grid renders empty when templates load after gallery init** — force rebuild after `loadTemplates()` resolves
- **conflict resolver** — unresolvable conflict data in non-TTY mode now writes to stderr instead of stdout, preventing raw JSON from polluting piped output
- **conflict resolver error message** — `UnresolvableConflictError` hint now references `--on-conflict keep-incoming` / `--on-conflict keep-current` instead of the misleading `--force` / `--json` pair.
- **heartbeat hooks** — use `.cjs` extension so CommonJS `require()` works in ESM projects
- **run-eval** — creates temp skills in `.claude/skills/` instead of deprecated `.claude/commands/`
- **settings.json hooks** — wrap hook commands in `{ matcher, hooks: [...] }` objects to match Claude Code's required format
- **wizard pre-selection** — custom path no longer pre-selects all rules and agents; only Codi Platform artifacts are pre-selected by default across all paths

### Added (docs site)

- **search** — results now show artifact type badge (skill/rule/agent/preset) and file path hint
- **search** — matched terms highlighted in excerpts via Pagefind's `<mark>` tags

### Removed

- **brand-identity** — replaced by `brand-creator`
- **content-factory** — removed example brand templates (BBVA/RL3) and dead preset JS stubs

---

## [2.6.1] - 2026-04-10

### Fixed

- **content-factory** — fixed glyph clipping in gradient italic elements across all presets
- **content-factory** — PNG exports at 2× retina resolution via Playwright
- **content-factory** — static assets served with `Cache-Control: no-cache` to prevent stale browser cache

### Added

- **content-factory** — viewport-fit scaling keeps full 1080px social cards visible without scrolling
- **content-factory** — typography safety rules documented in `style-presets.md` and `SKILL.md`

---

## [2.5.3] - 2026-04-09

### Changed

- **site** — replaced initials placeholder with profile photo in "Who made this" section

---

## [2.5.2] - 2026-04-09

### Fixed

- **GitHub Pages** — removed broken `site/site` symlink that caused artifact upload to fail

---

## [2.5.1] - 2026-04-09

### Fixed

- **GitHub Pages** — upgraded Node.js to 22 in deploy workflow; Astro requires >=22.12.0

---

## [2.5.0] - 2026-04-09

### Added

- **staged junk check** — pre-commit hook blocks OS noise files and build cache dirs from entering the repo
- **shellcheck** — pre-commit hook for staged shell scripts on projects where shell is detected

### Fixed

- **GitHub Pages** — added `npm run build` before `docs:build` so the CLI is compiled before the catalog runs

---

## [2.4.0] - 2026-04-09

### Added

- **artifact catalog** — 123 built-in artifacts browsable at `/docs/catalog/` with filters, search, and per-artifact pages
- **`codi docs --catalog`** — generates per-artifact markdown pages; runs as part of `docs:build`
- **`branch-finish` skill** — deterministic branch completion: verify, choose merge/PR/keep/discard, clean up
- **`worktrees` skill** — evaluates isolation strategy and sets up the workspace before plan execution
- **`codi onboard`** — prints a structured onboarding guide with the full artifact catalog
- **multi-preset repo support** — `preset install` from GitHub discovers multiple presets and presents interactive selection
- **`codi contribute --repo`** — opens PRs to any GitHub repository, not just the official codi repo
- **built-in eval cases** — 14 skill templates ship with 5-7 eval cases each
- **`import-depth-check` hook** — blocks `../../` relative imports in TS/JS files
- **`#src/*` path aliases** — all cross-module imports in `src/core/` converted to subpath aliases

### Changed

- **agent descriptions** — all 22 agent templates rewritten with trigger-oriented descriptions
- **baseline drift check** — moved from pre-commit to pre-push

### Fixed

- **scoped rules** — Claude Code adapter now emits `paths:` frontmatter for rules with a `scope` field
- **skill files always contain full content** — `progressive_loading` no longer produces metadata stubs

### Removed

- **command artifact type** — `.claude/commands/` generation, `codi add command`, and all command infrastructure removed
- **marketplace module** — `codi marketplace` command removed; GitHub repo import covers the same use case

---

## [2.0.0] - 2026-04-01

Breaking release. All 0.x and 1.x versions are deprecated.

### Changed

- **config resolution** — removed 8-layer composition system; `.codi/` is now the single source of truth

### Added

- **template registry integrity guard** — CLI startup validates all templates load with non-empty content
- **shared conflict resolver** — interactive diff/conflict resolution reusable across `init`, `update`, and `preset install`
- **preset flag merge** — `preset install` writes preset flags to `flags.yaml` with locked-flag protection
- **hook drift detection** — `codi status` reports drift in generated hook files
- **smart pre-commit test command** — detects `test:pre-commit` npm script before falling back to `npm test`

### Fixed

- **default preset artifact gaps** — all presets now include supporting artifacts for every enabled flag
- **binary assets copied** — fonts, images, PDFs, and archives now copied via `fs.copyFile`

---

## [1.0.0] - 2026-03-30 [DEPRECATED]

Deprecated — superseded by 2.0.0.

### Core

- 5-agent generation for Claude Code, Cursor, Codex, Windsurf, and Cline from a single `.codi/` directory
- 18 behavioral flags validated with Zod and enforced across all agents
- Hash-based drift detection via `codi status`
- 6 built-in presets: minimal, balanced, strict, fullstack, power-user, development
- 12 language hook registries with secret scanning, file size limits, and conventional commit validation
- Directory-based skill system with scripts, references, assets, evals, and agents subdirectories
- 100+ built-in templates: 25+ rules, 40+ skills, 20+ agents
- 1546 tests across 130 files; 78% statement coverage
