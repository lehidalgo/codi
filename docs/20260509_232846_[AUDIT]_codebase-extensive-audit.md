# Codebase Extensive Audit

- **Date**: 2026-05-09 23:28
- **Document**: 20260509*232846*[AUDIT]\_codebase-extensive-audit.md
- **Category**: AUDIT
- **Branch**: feature/codi-v3-harness
- **Scope**: full repo (src/, tests/, scripts/, docs/, .codi/, root configs)
- **Method**: 5 parallel specialized agents (architecture, security, performance, code quality, refactor) + `pnpm test:coverage` baseline
- **Codebase size**: 1107 src/.ts files, 268 tests/.ts files, 619 production TS files (excluding templates/scripts)

---

## 1. Executive Summary

| Domain                   | Verdict            | Critical | High | Medium | Low  |
| ------------------------ | ------------------ | -------- | ---- | ------ | ---- |
| Architecture             | WARN               | 4        | 12   | 8      | many |
| Security                 | FAIL               | 2        | 5    | 6      | 4    |
| Performance              | WARN               | 2        | 4    | 4      | 2    |
| Code Quality             | PASS w/ follow-ups | 0        | 5    | 8      | 8    |
| Refactor (opportunities) | INFO               | —        | —    | —      | —    |
| Test Coverage            | PASS thresholds    | —        | —    | —      | —    |

**Headline numbers:**

- Test coverage: statements 78.55%, branches 67.06%, functions 83.87%, lines 80.07% — passes vitest thresholds (75/66/79/76).
- 6 source files exceed the 700-line cap; 4 of them sit in `src/cli/`.
- 2 CRITICAL security findings: brain-ui server binds to all interfaces (despite log claiming loopback); state-changing POST endpoints have no auth, CSRF, or rate limit.
- Hook startup tax: ~2 s per Claude turn from spawning 4 separate `tsx`-loaded TypeScript hooks.
- 9 files redefine `ArtifactType` with 3 different vocabularies; 5 files redefine the artifact-layout map.
- `unsafeMode(true)` removes the SQLite defensive backstop on the main brain handle.
- 3 known CVEs in production deps (`yaml`, `fast-uri` x2).

**Top 5 actions to take this week:**

1. Bind brain-ui to loopback (1 line, fixes C-01).
2. `pnpm update yaml` and pin patched `fast-uri` (closes 3 CVEs).
3. Add `(turn_id, raw_marker)` index on `captures` table (5 min, prevents O(N) dedup at scale).
4. Pre-compile hooks to JS in `dist/hooks/` (1 day, saves ~1.5 s per Claude turn).
5. Quote `$CWD` properly in `session-start.sh` Python heredoc (fixes H-02 RCE pre-condition).

---

## 2. Test Coverage

### 2.1 Aggregate

| Metric     | Coverage             | Threshold | Status |
| ---------- | -------------------- | --------- | ------ |
| Statements | 78.55% (10833/13790) | 75%       | PASS   |
| Branches   | 67.06% (5481/8173)   | 66%       | PASS   |
| Functions  | 83.87% (1576/1879)   | 79%       | PASS   |
| Lines      | 80.07% (10103/12617) | 76%       | PASS   |

### 2.2 Files with 0% coverage (untested production code)

| File                                 | Lines | Note                                                                |
| ------------------------------------ | ----- | ------------------------------------------------------------------- |
| `src/cli/agent-hooks.ts`             | 104   | Diagnostic stderr hooks — needs hook-payload fixture harness        |
| `src/cli/backup.ts`                  | 36    | Top-level commander wiring; logic tested in `backup-cli-helpers.ts` |
| `src/cli/brain.ts`                   | 98    | Brain CLI dispatcher — needs subprocess test                        |
| `src/cli/migrate.ts`                 | 24    | v2-to-v3 migration command                                          |
| `src/cli/plugin.ts`                  | 33    | Plugin install/list — needs registry mock                           |
| `src/runtime/auto-commit.ts`         | 15    | Workflow auto-commit — needs git fixture                            |
| `src/runtime/sync/cli*.ts` (5 files) | 658   | Google Sheets sync CLI — entire surface untested                    |

### 2.3 Files with critically low coverage (<50%)

| File                                     | Coverage | Lines |
| ---------------------------------------- | -------- | ----- |
| `src/cli/hooks.ts`                       | 5.55%    | 54    |
| `src/runtime/brain-ui/sse.ts`            | 8.33%    | 12    |
| `src/runtime/sync/bootstrap.ts`          | 12.24%   | 98    |
| `src/runtime/sync/account-type.ts`       | 12.5%    | 8     |
| `src/runtime/sync/client.ts`             | 9.09%    | 33    |
| `src/cli/workflow.ts`                    | 15.51%   | 116   |
| `src/cli/docs-stamp.ts`                  | 26.66%   | 15    |
| `src/cli/docs-check.ts`                  | 27.77%   | 18    |
| `src/core/hooks/pre-commit-framework.ts` | 35.05%   | 97    |
| `src/cli/revert.ts`                      | 38.54%   | 96    |

### 2.4 Test infrastructure observations

- 124 test files reimplement the same `mkdtemp` setup boilerplate inline — `tests/helpers/fs.ts` already has `cleanupTmpDir()` but no setup helper.
- `tests/fixtures/` only contains `external-presets/`, `inheritance/`, `migration/` — no canonical fixtures for rules/skills/agents/configs.
- The whole `src/runtime/sync/` cluster (Google Sheets) is functionally untested at the CLI layer; only the underlying queue/snapshot logic has unit tests.
- vitest excludes `src/runtime/**` from the test glob — runtime tests live in `tests/runtime/` and `tests/e2e/` only.

### 2.5 Coverage actions

| Priority | Action                                                                                            |
| -------- | ------------------------------------------------------------------------------------------------- |
| HIGH     | Add subprocess fixture harness for `cli/agent-hooks.ts`, `cli/brain.ts` (covers ~200 lines)       |
| HIGH     | Cover the `src/runtime/sync/cli*.ts` cluster — currently 0% across 658 lines                      |
| MEDIUM   | Add `withTmpDir(label, fn)` + fixture builders to `tests/helpers/` (kills ~250 boilerplate lines) |
| MEDIUM   | Reorganize `tests/fixtures/` into `rules/`, `skills/`, `agents/`, `configs/` subdirs              |
| LOW      | Cover `cli/workflow.ts` (116 lines @ 15.5%) — workflow CLI command logic                          |

---

## 3. Architecture & Inconsistencies

### 3.1 File size violations (>=700 LOC project rule)

| Lines | Path                                                 |
| ----: | ---------------------------------------------------- |
|   791 | `src/cli/update.ts`                                  |
|   786 | `src/cli/init.ts`                                    |
|   775 | `src/templates/skills/dev-skill-creator/template.ts` |
|   755 | `src/cli/init-wizard-paths.ts`                       |
|   738 | `src/templates/skills/content-factory/template.ts`   |
|   713 | `src/core/hooks/hook-templates.ts`                   |

Warning zone (500-700 lines, refactor before they cross): `cli/contribute.ts:694`, `cli/hub-handlers.ts:691`, `cli/preset-handlers.ts:678`, `core/hooks/hook-installer.ts:668`, `cli/preset.ts:638`, `core/hooks/hook-config-generator.ts:632`.

The `src/cli/init*.ts` cluster totals 2,948 lines across 5 files — the init flow is structurally too large for one feature slice.

### 3.2 Critical naming collisions

Two file-vs-directory pairs share the same base name in the same parent (NodeNext resolution confusion):

| File                          | Sibling directory           |
| ----------------------------- | --------------------------- |
| `src/cli.ts`                  | `src/cli/`                  |
| `src/runtime/cli-handlers.ts` | `src/runtime/cli-handlers/` |

`runtime/cli-handlers.ts` is a barrel — it violates the project's own no-barrels rule and could be deleted (only 2 callers).

Same-named files across modules: `cli.ts` (2x), `agent.ts` (types vs schemas), `preset.ts` (cli vs schemas), `migrate.ts` (cli vs runtime/brain), `schema.ts` (runtime/brain vs runtime/sync), plus `lifecycle.ts`, `workflow.ts`, `config.ts`, `diff.ts`, `git.ts`, `github.ts`, `hooks.ts`, `types.ts` each with 2+ locations.

### 3.3 Layering violations (utils to core, core to cli)

| From                                                    | To                               | Issue                                       |
| ------------------------------------------------------- | -------------------------------- | ------------------------------------------- |
| `src/utils/conflict-resolver.ts:13`                     | `src/core/output/logger.ts`      | utils should be a leaf layer                |
| `src/types/result.ts`                                   | `src/core/output/types.ts`       | types should be the most foundational layer |
| `src/adapters/copilot.ts`                               | `src/core/output/logger.ts`      | adapters should accept injected logger      |
| `src/adapters/skill-generator.ts`                       | `src/core/output/logger.ts`      | same                                        |
| `src/core/onboard/catalog-renderer.ts:15`               | `src/cli/artifact-categories.ts` | core depending on cli inverts the layer     |
| `src/core/docs/docs-generator.ts:23`                    | `src/cli/hub.ts`                 | same                                        |
| `src/core/docs/renderers/infrastructure-renderers.ts:6` | `src/cli/hub.ts`                 | same                                        |
| `src/core/version/artifact-manifest.ts:12`              | `src/cli/init-wizard.ts`         | same                                        |

### 3.4 Path alias adoption (project rule: use `#src/*` over `../`)

| Directory        | `../` count | `#src/` count | Adoption |
| ---------------- | ----------: | ------------: | -------: |
| `src/cli/`       |         435 |             3 |      <1% |
| `src/runtime/`   |          44 |             0 |       0% |
| `src/adapters/`  |          47 |             3 |       6% |
| `src/schemas/`   |           7 |             0 |       0% |
| `src/types/`     |           2 |             0 |       0% |
| `src/utils/`     |           2 |             1 |      33% |
| `src/templates/` |         121 |           144 |      54% |
| `src/core/`      |         104 |           265 |      72% |

`src/cli/` makes 435 single-level relative imports; 130+ cross module boundaries (`../core/...`, `../runtime/...`).

### 3.5 Single-source-of-truth drift — CRITICAL

**`ArtifactType` redefined 9 times** with 3 different vocabularies:

- Canonical: `"rule" | "skill" | "agent" | "mcp-server"`
- Capabilities-extended: adds `"hook" | "slash-command"`
- Add-wizard variant: adds `"brand"`
- `audit/operations-ledger.ts:32` uses `"mcp"` instead of `"mcp-server"`
- `runtime/capture/session.ts:230` uses `"command"` instead of `"slash-command"`

Locations: `src/core/preset/preset-applier.ts:45`, `src/core/external-source/discovery.ts:5`, `src/core/version/template-hash-registry.ts:20`, `src/core/capabilities/plugin-manifest.ts:17`, `src/core/audit/operations-ledger.ts:32`, `src/core/version/artifact-manifest.ts:19`, `src/core/hooks/hook-logic/types.ts:32`, `src/runtime/capture/session.ts:230`, `src/runtime/consolidate/patterns.ts:415`, `src/cli/add-wizard.ts:7`.

**`ARTIFACT_TYPES` constant defined 3 times** with different values:

- `src/constants.ts:197` -> `["rules", "skills", "agents"]`
- `src/core/docs/artifact-catalog-generator.ts:250` -> `["skills", "rules", "agents", "presets"]`
- `src/core/hooks/hook-templates.ts:154` -> array of objects

**Artifact directory layout map duplicated 5 times**: `src/core/external-source/discovery.ts:25`, `src/core/external-source/installer.ts:19`, `src/core/version/artifact-manifest.ts:140`, `src/core/preset/preset-applier.ts:103`, `src/core/backup/backup-source.ts:7`.

**Agent-list duplication** with subtle drift: `src/adapters/index.ts` (canonical 6 adapters), `src/core/hooks/exclusions.ts:13` (7 dirs incl. `.agents`), `src/cli/clean.ts:149` (6 dirs, missing copilot), `src/schemas/feedback.ts:5` (6 ids), `src/runtime/capture/agent-memory.ts:166` (only 2 agents).

**`.codi` directory hardcoded** in 17+ sites instead of using `PROJECT_DIR` from `src/constants.ts:12` — full list in §6.

**Two divergent `CURRENT_SCHEMA_VERSION`** constants:

- `src/runtime/types.ts:175` -> `"1.0.0"` (string)
- `src/runtime/brain/migrate.ts:198` -> `2` (number)

### 3.6 TypeScript strictness gaps

| Directory        | `: any`/`as any` | `as unknown as` | `@ts-ignore`/`@ts-expect-error` |
| ---------------- | ---------------: | --------------: | ------------------------------: |
| `src/adapters/`  |                0 |               0 |                               0 |
| `src/cli/`       |                2 |               1 |                               0 |
| `src/core/`      |                7 |               5 |                               0 |
| `src/runtime/`   |                0 |               7 |                               0 |
| `src/utils/`     |                0 |               0 |                               0 |
| `src/schemas/`   |                0 |               0 |                               0 |
| `src/types/`     |                0 |               0 |                               0 |
| `src/templates/` |                2 |               0 |      7 (intentional, peer-deps) |

Worst spots: `src/core/docs/renderers/schema-renderers.ts` (Zod `_def` introspection), `src/runtime/sync/snapshot.ts:144` (validation bypass), `src/runtime/sync/reconcile.ts:131-143` (repeated `as unknown as` widening).

### 3.7 Three-layer pipeline drift

Compared `src/templates/` (source) against `.codi/` (installed):

- Skills: 0 drifts. PASS
- Agents: 0 drifts. PASS
- Rules: `src/templates/rules/improvement.ts` exists but installed copy is `.codi/rules/codi-improvement-dev.md` — name mismatch.

### 3.8 Other structural notes

- `src/cli/` is a flat directory of 52 files with no subdirectories — the "by file type" anti-pattern flagged in the project's own architecture rule.
- `src/runtime/sync/` has 6 files prefixed `cli-`/`bridge` with unclear relationships (`cli.ts`, `cli-bridge.ts`, `cli-create.ts`, `cli-draft.ts`, `cli-safety.ts`, `bridge.ts`).
- Empty placeholder directories with only README.md: `src/brain/`, `src/db/`. Either populate or remove.
- 3 skill scripts use snake_case file names (project rule: kebab-case): `xlsx/scripts/ts/generate_xlsx.ts`, `pptx/scripts/ts/generate_pptx.ts`, `docx/scripts/ts/generate_docx.ts`.
- `tsconfig.json` declares `#src/*` alias but is missing `#tests/*` (which `package.json#imports` does declare).

---

## 4. Security

### 4.1 CRITICAL — brain-ui binds to all interfaces (CWE-668, CWE-200)

- **File**: `scripts/runtime/brain-ui-server.ts:54`, `src/runtime/brain-ui/server.ts:34-64`
- **Evidence**: `serve({ fetch, port })` is called with no `hostname` parameter, so `@hono/node-server` falls through to Node's `net.Server.listen(port, undefined, cb)`, which binds to all interfaces (`::` on dual-stack, equivalent to `0.0.0.0` for IPv4). The console log claims loopback, but the bind address is global.
- **Impact**: any LAN-reachable attacker can read every brain.db row (sessions, captures, prompts, tool-call telemetry), search FTS5, exfiltrate via SSE.
- **Fix**: pass `hostname: process.env["CODI_BRAIN_UI_BIND"] ?? "127.0.0.1"`.
- **Test**: assert non-loopback IP is unreachable.

### 4.2 CRITICAL — POST endpoints have no auth, CSRF, CORS, or rate limit (CWE-352, CWE-306)

- **File**: `src/runtime/brain-ui/routes-api.ts:199-326`
- **Endpoints**: `/api/v1/proposals/:id/accept`, `/api/v1/proposals/:id/reject`, `/api/v1/consolidation/run`, `/api/v1/consolidation/run-with-llm`
- **Evidence**: ripgrep for `cors|csrf|rateLimit` in `src/` returns zero matches.
- **Impact**: drive-by CSRF from any web page the developer visits while brain-ui runs; LAN-driven LLM cost burn through `consolidation/run-with-llm`; proposal tampering.
- **Fix**:
  1. Bind to loopback (closes the LAN vector).
  2. Add Origin/Referer check on POSTs (reject anything not from loopback).
  3. Per-process CSRF token in HTMX shell + required `X-CSRF-Token` on POSTs.
  4. Token-bucket rate limit on `/api/v1/consolidation/*`.

### 4.3 HIGH findings

| ID   | File                                                 | Issue                                                                                                                           | Fix                                                                      |
| ---- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| H-01 | `src/runtime/brain/db.ts:104`                        | `unsafeMode(true)` removes SQLite defensive backstop on main handle                                                             | Open second handle for FTS5 trigger maintenance only; scope unsafeMode   |
| H-02 | `src/templates/hooks/runtime/session-start.sh:50-90` | Unquoted `$CWD` interpolated inside Python heredoc — single quote in path enables arbitrary code path                           | Pass path as argv\[1\] or stdin                                          |
| H-03 | `src/core/hooks/runner-template.ts:101-110`          | Synchronous shell-string runner invokes interpolated cmd from `.codi/hooks/*.json`                                              | Document trust boundary; refuse `$()`/backticks unless `dangerous: true` |
| H-04 | `package.json`                                       | 3 known CVEs: `yaml@2.8.2` (CVE-2026-33532, DoS), `fast-uri@3.1.0` (CVE-2026-6321 path traversal, CVE-2026-6322 host confusion) | `pnpm update yaml`, pin patched `fast-uri` via overrides                 |
| H-05 | `src/cli/preset-github.ts:96-99`                     | `descriptor.path` joined to `tmpDir` without `..` validation                                                                    | Use existing `assertPathsContained` helper                               |

### 4.4 MEDIUM findings

| ID   | File                                                 | Issue                                                                           |
| ---- | ---------------------------------------------------- | ------------------------------------------------------------------------------- |
| M-01 | `src/runtime/brain-ui/routes-api.ts:127-144`         | FTS5 `MATCH ?` accepts unbounded prefix wildcards -> DoS                        |
| M-02 | `src/runtime/consolidate/runner.ts:140-150`          | LLM `result.text` persisted unsanitized -> second-order prompt injection        |
| M-03 | `src/runtime/consolidate/runner.ts:135-143`          | `evidence_sample` from brain DB inlined into LLM prompts without delimiters     |
| M-04 | `src/cli/preset-github.ts:88-91`                     | `descriptor.ref` passed to git clone without ref regex validation               |
| M-05 | `src/runtime/llm/openai.ts:39-48`, `gemini.ts:41-50` | No timeout/AbortController on LLM provider calls                                |
| M-06 | `src/core/hooks/hook-installer.ts:271,518,535`       | Hook scripts written `0o755` (world-readable); reveal local node_modules layout |

### 4.5 LOW findings

- `src/runtime/brain-ui/pages.ts:13-24` — Tailwind/HTMX loaded from CDN without SRI hashes.
- `src/runtime/brain/db.ts:62-63` — `CODI_BRAIN_DB` env override resolved with `path.resolve` only.
- `src/cli/preset-github.ts:118` — `path.basename(descriptor.path)` on `..` returns `..`.
- `src/cli/update-check.ts` excluded from coverage gates — auto-update flow can ship regressions undetected.

### 4.6 Confirmed safe

- No hardcoded secrets in source or git history; API keys read from `CODI_*_API_KEY` env vars.
- All subprocess calls use array-arg variants (no shell interpretation) outside `runner-template.ts` (H-03).
- All SQL is parameterized with `?` placeholders. No string-concatenated SQL anywhere in `src/runtime/`.
- ZIP-slip guarded by `assertPathsContained` re-walking realpath after extraction.
- WAL mode + `busy_timeout = 5000` on brain-ui handle. (Recommend adding to short-lived hook handles too.)
- Zero dynamic-code-evaluation primitives in `src/`.

---

## 5. Performance

### 5.1 Quantified baseline (M-class Mac, warm cache)

| Operation                               | Measured   |
| --------------------------------------- | ---------- |
| `node` baseline                         | 25 ms      |
| `node` + `openBrain()` + WAL            | 58 ms      |
| `tsx` empty import                      | 226 ms     |
| `tsx` + `openBrain` + `applyMigrations` | 473 ms     |
| **Stop hook end-to-end**                | **520 ms** |
| **PostToolUse hook end-to-end**         | 460-720 ms |
| **UserPromptSubmit hook end-to-end**    | 470-530 ms |
| `codi --help` cold                      | 580 ms     |
| `codi generate --dry-run`               | 1,330 ms   |

### 5.2 CRITICAL findings

**F-01 — Hooks shell out to `tsx` on every invocation**

- Files: all `src/templates/hooks/runtime/*.sh`, `scripts/runtime/hook-*.ts`
- Evidence: 4 hooks \* ~250 ms tsx startup = ~2 s plumbing per Claude turn.
- Fix: ship pre-compiled JS hooks via tsup, point `.sh` wrappers at `node dist/hooks/hook-stop.js`. Adds a tsup entry per hook.
- Expected gain: per-turn overhead from ~2 s down to ~250 ms.

**F-03 — `captures` dedup query does a full table scan**

- File: `src/runtime/capture/persist.ts:40-42`
- Query: `SELECT capture_id FROM captures WHERE turn_id = ? AND raw_marker = ?`
- Evidence: `EXPLAIN QUERY PLAN` shows `SCAN captures`. Today (13 captures): instant. At 100k: 50-200 ms per Stop. At 1M: timeouts.
- Fix: `CREATE INDEX IF NOT EXISTS idx_captures_turn_marker ON captures(turn_id, raw_marker)`. Bump `CURRENT_SCHEMA_VERSION`.

### 5.3 HIGH findings

| ID   | File                                                                                    | Issue                                                                              | Fix                                                                        |
| ---- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| F-02 | `src/runtime/brain/migrate.ts:204-222`                                                  | `applyMigrations` runs 30 SQL statements per `openBrain()` even when DB is current | Fast-path `SELECT MAX(version)` check                                      |
| F-04 | `scripts/runtime/hook-user-prompt-submit.ts`, `src/runtime/hook-logic.ts`               | `BrainEventLog.open()` called 5x per UserPromptSubmit                              | Pass `BrainHandle` through call chain                                      |
| F-05 | `src/runtime/iron-laws-enforcer.ts:39-49,248-251`, `src/runtime/capture/session.ts:117` | `readGateState` and `recentPrompts` queries miss their indexes                     | Add `(status, started_at DESC)` and `(session_id, prompt_id DESC)` indexes |
| F-06 | `src/runtime/capture/stop-hook.ts:159-189`                                              | `readLastAssistantMessage` synchronously reads entire transcript file              | Stream from EOF backwards with 64 KB buffer                                |
| F-07 | `src/runtime/brain-ui/routes-api.ts` (all handlers), `sse.ts:40-48`                     | Every request re-prepares the same SQL; SSE re-prepares per poll                   | Hoist prepared statements to closure scope                                 |

### 5.4 MEDIUM findings

| ID   | File                                                            | Issue                                                                  | Fix                                      |
| ---- | --------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------- |
| F-08 | `src/runtime/llm/registry.ts:11`, `openai.ts:8`, `gemini.ts:10` | OpenAI + Google SDKs eager-imported into 936 KB main bundle            | Lazy `await import()` per provider       |
| F-09 | `src/core/security/content-scanner.ts:325-447`                  | `scanDirectory` reads files sequentially (~50-200 ms per skill import) | `pLimit(8)` parallel                     |
| F-10 | `src/adapters/skill-generator.ts:316-370`                       | `collectSupportingFiles` recurses sequentially per skill               | Replace with `fast-glob` (already a dep) |
| F-11 | `src/core/generator/generator.ts:133-155`                       | Conflict-detection reads ~7,000 files sequentially                     | `pLimit(16)` parallel reads              |

### 5.5 LOW findings

- F-12: SSE polls SQLite every 1 s with no backoff (`src/runtime/brain-ui/sse.ts:39-58`).
- F-13: `update-check` blocks every interactive CLI invocation up to 3 s (`src/cli/update-check.ts:113-153`) — should defer with `setImmediate`.
- F-14: `refreshCaptureCount` does full `COUNT(*)` per Stop hook instead of incrementing.
- F-15: `googleapis` (194 MB on disk) shipped as runtime dep but only sync commands use it. Switch to `@googleapis/sheets` (~10 MB).
- F-16: tsup config has no `minify`, no `treeshake`. 936 KB main chunk is unminified.

### 5.6 Bundle / dependency footprint

- `dist/` total: ~21 MB
- Largest chunk: `dist/chunk-WQUMCS7D.js` = 936 KB (contains both OpenAI + Gemini SDKs)
- `node_modules` size dominated by `openai` (32 MB) + `googleapis` (194 MB)

### 5.7 Confirmed performant

- WAL mode enabled, `synchronous = NORMAL` correct.
- FTS5 triggers correctly defined (the `unsafeMode(true)` workaround is the documented pattern but see security H-01).
- Capture parser `parseMarkers`: 36 us/call — well under any threshold.
- Generator main loop already uses `Promise.all` for writes (only the read phase is sequential — F-11).
- `fs.watch` debouncing in `watch.ts` is correct.
- Migration idempotency works; only wasteful (F-02).

---

## 6. Code Quality

### 6.1 Aggregate metrics

| Metric                                     | Count                                             | Status                          |
| ------------------------------------------ | ------------------------------------------------- | ------------------------------- |
| `: any` annotations                        | 4 (real, all gated by eslint-disable + rationale) | OK                              |
| `as any` casts                             | 6 (3 in `schema-renderers.ts` for Zod `_def`)     | OK                              |
| `as unknown as` casts                      | 13 (all with rationale)                           | OK                              |
| `// @ts-expect-error`                      | 6 (all in templates for user-supplied peer deps)  | OK                              |
| `// @ts-ignore`                            | 0                                                 | PASS                            |
| `console.log/warn/error` outside templates | 239                                               | WARN                            |
| Empty `catch {}` blocks (non-template)     | 0                                                 | PASS                            |
| Silent `.catch(() => null)`                | 36                                                | OK (mostly best-effort cleanup) |
| Files > 700 LOC                            | 6                                                 | WARN                            |
| Functions > 60 lines                       | ~25                                               | INFO                            |
| `process.exit` calls in CLI                | 146                                               | OK (standard pattern)           |
| TODO/FIXME/HACK without ticket ref         | 0                                                 | PASS                            |
| Commented-out code blocks (3+ lines)       | 0                                                 | PASS                            |
| `index.ts` barrels outside templates       | 21                                                | WARN (rule violation)           |
| Deep relative imports (`../../`)           | 8 (mostly false positives in string literals)     | OK                              |

### 6.2 HIGH severity

**H1 — `.codi` directory hardcoded in 17+ sites instead of `PROJECT_DIR`**

`PROJECT_DIR` is exported from `src/constants.ts:12`. Bypassed at:

- `src/constants.ts:166-168` (BACKUP_EXCLUDE_DIRS — uses literal in same file)
- `src/runtime/preferences.ts:24` (PREFERENCES_RELATIVE_PATH)
- `src/runtime/sync/queue.ts:20`, `auth.ts:279`, `cli-create.ts:103`, `config.ts:15`, `cli-bridge.ts:187`, `snapshot.ts:25`
- `src/runtime/brain-ui/lifecycle.ts:16`
- `src/runtime/brain/db.ts:37,66`
- `src/cli/plugin.ts:36`
- `src/core/migration/v2-to-v3.ts:31`
- `src/core/backup/backup-source.ts:30`
- `src/core/hooks/exclusions.ts:21`, `hook-config-generator.ts:268,397`

**H2 — `ARTIFACT_TYPES` redefined**: `src/constants.ts:197` vs `src/core/docs/artifact-catalog-generator.ts:250` (different orderings, different membership).

**H3 — `console.log/warn/error` as primary output channel**

- `src/runtime/sync/cli.ts`: 40 calls
- `src/runtime/sync/cli-draft.ts`: 37 calls
- `src/runtime/sync/cli-bridge.ts`: 18 calls
- `src/runtime/sync/cli-create.ts`: 11 calls

The codebase has a structured `Logger` (used in 38 files) and `createCommandResult` formatter — this cluster bypasses both. Hard to add `--quiet` or test deterministically.

**H4 — Multiple artifact-type lists with subtle drift** (combines with H2). Spot-checked at `src/cli/init-helpers.ts:164` (adds `mcpServers`), `src/core/preset/preset-applier.ts`.

**H5 — 21 barrel `index.ts` files violate `codi-typescript` rule** ("no index.ts barrel files for re-exporting"). Worst offenders: `src/types/index.ts`, `src/utils/index.ts`, `src/runtime/sync/index.ts` (used as ESM-CJS interop), 17 others.

### 6.3 MEDIUM severity

| ID  | Issue                                                                                           | Location                                                                                                                                                                                                                                         |
| --- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| M1  | Functions over 60 lines (genuinely complex)                                                     | `src/runtime/reducer.ts:90` (187 lines), `src/runtime/classifier.ts:73` (163 lines), `src/core/docs/markdown-converter.ts:55` (155 lines), `src/core/security/content-scanner.ts:325` (134 lines), `src/adapters/claude-code.ts:314` (128 lines) |
| M2  | 72 exported functions take 4+ positional params                                                 | Worst: `src/cli/init-helpers.ts` (5 functions), `src/cli/preset-handlers.ts:315`, `src/cli/preset-github.ts:74`, `src/utils/conflict-resolver.ts:290`                                                                                            |
| M3  | `as unknown[]` cast pattern in 9 brain-UI SQL routes — DB rows escape with no schema validation | `src/runtime/brain-ui/routes-api.ts:44,59,95,109,123,142,151,154,168`                                                                                                                                                                            |
| M4  | `as unknown as Result` widening in error propagation                                            | `src/core/preset/preset-loader.ts:95`, `src/core/backup/backup-manifest.ts:34`                                                                                                                                                                   |
| M5  | 7 unsafe `as <Type>` casts on `data[key]` after `parseFrontmatter` instead of Zod parse         | `src/core/preset/preset-loader.ts:370-378,392-397`                                                                                                                                                                                               |
| M6  | Duplicated catch-and-return-null collapses two distinct error conditions                        | `src/core/preset/preset-loader.ts:380-383,399-402`                                                                                                                                                                                               |
| M7  | Magic numbers without named constants: `10000`, `5000`, `5000`                                  | `src/runtime/sync/daemon.ts:97`, `src/runtime/consolidate/patterns.ts:278`, `src/runtime/brain-ui/server.ts:39`                                                                                                                                  |
| M8  | `Promise.all` fan-out with no concurrency limit over user-supplied collections                  | `src/cli/installed-artifact-inventory.ts:83,109,135`; `src/core/config/parser.ts:118,144,165,359`; `src/core/preset/preset-applier.ts:250,258,266`; `src/core/docs/artifact-catalog-generator.ts:260,315`                                        |

### 6.4 LOW severity

- `safeRmDir` is a single-line wrapper that adds nothing (`src/cli/clean.ts:48-50`).
- 4 `catch {}` blocks have ambiguous comments — replace `/* ignore */` with explicit reason.
- Local `DEFAULT_LIMIT` and `MAX_LIMIT` in `src/runtime/brain-ui/routes-api.ts` should join `src/constants.ts`.
- Inconsistent boolean prefix style: `aborted` (should be `isAborted`), `force` (should be `isForce` or `forceOverwrite`).
- Zod v4 published proper public types in `zod/v4/core` — `schema-renderers.ts` could replace its `_def` walking.

### 6.5 What looks healthy

- **Strict typing**: no `// @ts-ignore`, no untracked TODOs, no commented-out code.
- **Path aliases work in core/**: `#src/*` widely used (428 imports), only 1 deep relative import in real code.
- **Error types are typed**: 20+ `extends Error` subclasses with discriminating fields, no thrown strings.
- **`process.env` reads centralized**: only 1 occurrence in non-template code.
- **All `ts-expect-error` annotations carry rationale**.

---

## 7. Refactor Opportunities

Read-only analysis, biased toward DELETE and CONSOLIDATE per stated user preference.

### 7.1 Highest-payoff quick wins

| #   | Action                                                                                                                      | Effort  | Risk | Payoff                               |
| --- | --------------------------------------------------------------------------------------------------------------------------- | ------- | ---- | ------------------------------------ |
| 1   | Delete `addGeneratedHeader` deprecated alias + `src/utils/index.ts` barrel                                                  | TRIVIAL | LOW  | -50 LOC, removes confusion           |
| 2   | Replace 4 hardcoded preset agent arrays with `[...SUPPORTED_PLATFORMS]`                                                     | TRIVIAL | LOW  | Prevents drift forever               |
| 3   | Replace `z.enum(["codi", "user"])` in `artifact-manifest.ts` with `MANAGED_BY_VALUES`                                       | TRIVIAL | LOW  | Single source of truth restored      |
| 4   | Add `writeJsonAtomic()` to `utils/fs.ts`, replace 8 sites of duplicated atomic-write boilerplate                            | SMALL   | LOW  | -80 LOC, error-handling consistency  |
| 5   | Move `interface SkillFrontmatter` + `interface RuleFrontmatter` from `skill-docs-generator.ts` to import from `src/schemas` | SMALL   | LOW  | -30 LOC, kills type drift            |
| 6   | Delete `pyrightconfig.json` (empty self-disabling config) and `.codi_output_BKP/` directory                                 | TRIVIAL | LOW  | Cleanup                              |
| 7   | Move `core/docs/docs-generator.ts:23` import of `NORMAL_MENU/ADVANCED_MENU` out of `cli/hub.js`                             | SMALL   | LOW  | Fixes core-to-cli boundary violation |
| 8   | Split `core/hooks/hook-templates.ts` into one-file-per-template                                                             | TRIVIAL | LOW  | Drops 713-LOC file under cap         |
| 9   | Add `withTmpDir()` + fixture builders to `tests/helpers/`                                                                   | SMALL   | LOW  | -250 LOC of test setup               |
| 10  | Delete `src/runtime/cli-handlers.ts` barrel + migrate 2 callers                                                             | SMALL   | LOW  | Removes file/dir collision           |

### 7.2 Files to split (>700 lines)

Each candidate has a documented split sketch:

- `cli/update.ts:791` -> `update-pull.ts` + `update-refresh.ts` + `update.ts`
- `cli/init.ts:786` -> `init-interactive.ts` + `init-noninteractive.ts` + `init-postinit.ts` + `init.ts`
- `cli/init-wizard-paths.ts:755` -> split each `handleXPath()` (zip/github/local/preset/custom) into siblings
- `core/hooks/hook-templates.ts:713` -> one file per template constant
- `cli/contribute.ts:694` -> `contribute-discover.ts` + `contribute-pr.ts` + `contribute.ts`
- `cli/hub-handlers.ts:691` -> `hub-handlers/{init,customize,add,generate,doctor}.ts`
- `cli/preset-handlers.ts:678` -> `preset-handlers/{install,export,validate,remove,list,edit}.ts`
- `core/hooks/hook-installer.ts:668` -> `hook-installer/{templates-fill,runners,install}.ts`
- `cli/preset.ts:638` -> `preset-cmd/{create,install,search,update,snapshot}.ts`
- `core/hooks/hook-config-generator.ts:632` -> one builder per hook category

### 7.3 Dead code candidates (HIGH confidence)

- `addGeneratedHeader` alias (`src/adapters/generated-header.ts:15` — `@deprecated`, zero importers)
- `src/utils/index.ts` barrel (zero importers — all callers go direct)
- `src/db/README.md`, `src/brain/README.md` (placeholder dirs, no source)
- `_BKP` directory (`.codi_output_BKP/` — 456 KB)
- `RuleFrontmatterInput/Output`, `SkillFrontmatterInput/Output`, `AgentFrontmatterInput/Output` from schemas — no consumers outside schema files + `index.ts` barrel
- `pyrightconfig.json` — `{"include":[],"exclude":["**"]}` — self-disabling

### 7.4 Module-boundary violations to fix

Already covered in §3.3 — the most actionable:

1. Move `utils/conflict-resolver.ts` out of `utils/` (it depends on Logger + clack — not a pure utility) OR inject Logger.
2. Extract shared types from `cli/hub.ts`, `cli/init-wizard.ts`, `cli/artifact-categories.ts` into `core/` so dependencies point inward.

### 7.5 Type sprawl

- `NormalizedRule/Skill/Agent` (in `src/types/config.ts`) and `RuleFrontmatterOutput/...` (Zod-inferred in `src/schemas/`) are parallel — fields overlap, naming differs (`managedBy` vs `managed_by`). Decide on one set; today the Zod variants are exported but unused.
- `SkillExport*` family: 4 interfaces (`SkillExportOptions`, `SkillExportResult`, `SkillExportWizardResult`, `SkillExportData`) scattered across 3 files — consolidate into one `core/skill/skill-export-types.ts`.

### 7.6 Configuration consolidation

- `package.json` parsed at runtime in `src/cli.ts:42` — replace with build-time `__PKG_VERSION__` define (already injected for tsup/vitest).
- Shared excludes between `tsconfig.json`, `vitest.config.ts`, `.gitignore` could live in `scripts/excludes.mjs` if drift becomes a problem (low priority).
- `tsconfig.paths` + `package.json#imports` + `vitest.alias` all define `#src/*` independently — a 5-line `derive-aliases.mjs` could keep them aligned.

---

## 8. Consolidated Top Priorities

### 8.1 This week (security + correctness)

| #   | Action                                                                          | Impact                              |
| --- | ------------------------------------------------------------------------------- | ----------------------------------- |
| 1   | Bind brain-ui to loopback (1-line fix, `scripts/runtime/brain-ui-server.ts:54`) | Closes C-01 (LAN exposure)          |
| 2   | `pnpm update yaml` + override `fast-uri` to patched                             | Closes 3 CVEs (H-04)                |
| 3   | Add `idx_captures_turn_marker(turn_id, raw_marker)` index + bump schema version | Prevents O(N) dedup at scale (F-03) |
| 4   | Quote `$CWD` properly in `session-start.sh` Python heredoc                      | Closes H-02 (RCE pre-condition)     |
| 5   | Add `assertPathsContained` to `preset-github.ts:96`                             | Closes H-05 (path traversal)        |

### 8.2 This sprint (performance + structure)

| #   | Action                                                                                                | Impact                           |
| --- | ----------------------------------------------------------------------------------------------------- | -------------------------------- |
| 6   | Pre-compile hooks to JS in `dist/hooks/`                                                              | -1.5 s per Claude turn           |
| 7   | CSRF + Origin check on brain-ui POST endpoints                                                        | Closes C-02                      |
| 8   | Pass `BrainHandle` through hook chain instead of re-opening                                           | -10 ms/turn + cleaner code       |
| 9   | Stream transcript backwards in `readLastAssistantMessage`                                             | -50 ms/Stop on large transcripts |
| 10  | Lazy-load LLM SDKs                                                                                    | -150 ms cold CLI, -300 KB bundle |
| 11  | Add `(status, started_at DESC)` and `(session_id, prompt_id DESC)` indexes                            | Hot-path query optimization      |
| 12  | Centralize `ArtifactType` + `ARTIFACT_TYPES` + `ARTIFACT_LAYOUTS` into `src/core/artifact-layouts.ts` | Closes 9-way drift               |

### 8.3 Backlog (refactor + tests)

| #   | Action                                                                | Impact                                |
| --- | --------------------------------------------------------------------- | ------------------------------------- |
| 13  | Path-alias codemod across `src/cli/`, `src/runtime/`, `src/adapters/` | -130 cross-module relative imports    |
| 14  | Split 6 oversize files                                                | Brings every src/.ts file under 700   |
| 15  | Add subprocess fixture harness for `agent-hooks.ts` + `brain.ts`      | +200 lines covered                    |
| 16  | Cover `src/runtime/sync/cli*.ts` cluster                              | +658 lines covered                    |
| 17  | Replace `.codi` literals with `${PROJECT_DIR}` template (17 sites)    | Closes H1 single-source-of-truth      |
| 18  | Route `runtime/sync/cli*.ts` output through `Logger`                  | Closes H3 + L8                        |
| 19  | Add `withTmpDir()` + fixture builders to `tests/helpers/`             | -250 boilerplate LOC across 124 tests |
| 20  | Delete deprecated aliases, dead barrels, placeholder dirs             | -50 LOC, navigation clarity           |

### 8.4 Suggested commit slicing

A single "constants & barrels cleanup" PR could close ~13 of 21 HIGH-severity findings:

1. `refactor(constants): derive .codi/* paths from PROJECT_DIR` (closes H1)
2. `refactor(constants): unify ARTIFACT_TYPES, remove local redefinitions` (closes H2 + H4)
3. `refactor(barrels): remove index.ts re-exports per codi-typescript rule` (closes H5)
4. `refactor(sync): route runtime/sync/cli output through Logger` (closes H3 + L8)
5. `refactor(loaders): replace cast-chains with Zod parse, return Result` (closes M5 + M6)

---

## 9. Files most worth a deep second pass

- `src/runtime/reducer.ts` (187-line switch — extract per-event handlers)
- `src/runtime/classifier.ts` (163-line rule cascade — data-driven candidate)
- `src/core/preset/preset-loader.ts` (multiple cast chains, two-error collapse to null)
- `src/runtime/brain-ui/routes-api.ts` (9 SQL handlers without row schemas, no auth, no CSRF)
- `src/cli/init-helpers.ts` (5 functions exceed 4-param limit)
- `src/constants.ts` (uses literal `.codi` instead of its own `PROJECT_DIR`)
- `src/templates/hooks/runtime/session-start.sh` (Python heredoc with unquoted `$CWD`)

---

## 10. Method & Limitations

**Method**: 5 specialized subagents ran in parallel — codi-codebase-explorer (architecture), codi-security-analyzer (security), codi-performance-auditor (performance), codi-code-reviewer (code quality), codi-refactorer (refactor opportunities, read-only). Each agent received a self-contained brief covering the audit scope. Coverage data was gathered separately via `pnpm test:coverage` (vitest with v8 provider).

**Limitations**:

- The performance audit's latency numbers are local benchmarks on a single machine — not production-representative.
- Static dead-code analysis cannot detect dynamic `import()` or runtime string-based references. Confidence levels are reported per finding.
- Coverage exclusions in `vitest.config.ts` skip ~20 files (interactive @clack/prompts UI, pure Commander wiring, network/git boundaries) — these are flagged in the config with rationale.
- The security audit ran `pnpm audit --prod` for CVE detection but did not perform dynamic analysis (fuzzing, runtime instrumentation) — defects in async code paths may be undercounted.

**Reproducibility**: re-run with `pnpm test:coverage` for the coverage baseline; re-launch the 5 agents (definitions in `src/templates/agents/`) for fresh findings.
