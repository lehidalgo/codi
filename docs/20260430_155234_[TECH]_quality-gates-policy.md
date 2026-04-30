# Quality Gates Policy

- **Date**: 2026-04-30 15:52
- **Document**: 20260430*155234*[TECH]\_quality-gates-policy.md
- **Category**: TECH
- **Status**: Active as of v2.14.2

## Goal

Catch lint, type, test, and coverage regressions as close to the developer as possible without making local development painful. Every rule below maps a class of failure to the earliest stage at which it can be detected reliably.

## The four enforcement stages

```
git commit              git push                 PR open / update                merge to main
    │                       │                          │                                │
    ▼                       ▼                          ▼                                ▼
┌─────────┐           ┌──────────────┐          ┌──────────────┐               ┌──────────────┐
│ pre-    │           │ pre-push     │          │ CI           │               │ Release      │
│ commit  │           │              │          │ (test job)   │               │ (release.yml)│
├─────────┤           ├──────────────┤          ├──────────────┤               ├──────────────┤
│ ≤ 5s    │           │ ~25–30s      │          │ ~2 min       │               │ ~3 min       │
│ blocks  │           │ blocks       │          │ blocks merge │               │ publishes    │
└─────────┘           └──────────────┘          └──────────────┘               └──────────────┘
```

### Stage 1 — pre-commit (≤ 5 seconds)

**Goal**: catch obvious problems on every `git commit`. Must stay snappy because it runs after every commit.

| Check                                                          | Source                             |
| -------------------------------------------------------------- | ---------------------------------- |
| Conventional-commit message format                             | commitlint via `.husky/commit-msg` |
| Version-bump consistency                                       | `codi-version-bump.mjs`            |
| No `node_modules` / `.DS_Store` / dist staged                  | `codi-staged-junk-check.mjs`       |
| No git merge markers (`<<<<<<<`) outside fenced/example blocks | `codi-conflict-marker-check.mjs`   |
| No file > 800 LOC                                              | `codi-file-size-check.mjs`         |
| No `../../../` deep relative imports in TS/JS                  | `codi-import-depth-check.mjs`      |

**Does NOT run here**: lint, type check, full test suite, coverage. Those are too slow for a per-commit hook.

### Stage 2 — pre-push (~25–30 seconds)

**Goal**: stop broken or under-tested code from leaving the developer's machine. Same gate as CI, run locally so developers see the failure in seconds instead of waiting 2 minutes for a CI round trip.

| Check                                        | Command                      |
| -------------------------------------------- | ---------------------------- |
| Type check                                   | `pnpm lint` (`tsc --noEmit`) |
| Full vitest suite                            | bundled into the next step   |
| Coverage thresholds (global + per-subsystem) | `pnpm test:coverage`         |

Both run in `.husky/pre-push`. Total wall-clock cost ~25–30s on a warm cache.

**Why not at pre-commit**: 25s × every commit is too painful. 25s × every push (typically a few times per day) is acceptable.

**Why not at CI only**: a CI roundtrip is ~2 minutes plus context-switch cost when the developer has moved to another task. Catching the same failure locally is dramatically better DX.

**Does NOT run here**: e2e browser tests, release tarball verification, secret scanning, shellcheck — those are CI-only because they need clean environments or full repo history.

**Bypassing the gate**: `git push --no-verify` is **forbidden** by repository policy (see `CLAUDE.md`). If a check fails, fix the underlying issue. The gate is binding by design.

### Stage 3 — CI on every PR (~2 minutes)

**Goal**: deterministic, authoritative gate before merge. Branch protection blocks merge until it passes.

| Job                                       | What it runs                                                                                        |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `test`                                    | `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm build`, `pnpm test:coverage` (with thresholds) |
| `secrets-scan`                            | `gitleaks` against full history                                                                     |
| `shellcheck`                              | shell-script lint for `src/templates/**/*.sh`                                                       |
| `version-check` (PR to main only)         | confirms `package.json` version is unpublished on npm                                               |
| `installer-test` (when installer changes) | runs `site/install.sh` end-to-end on Ubuntu + macOS                                                 |

CI uses the same `vitest.config.ts` thresholds the pre-push hook uses. Same gate, two enforcement points.

### Stage 4 — Release on push to main (~3 minutes)

**Goal**: actually publish.

| Job          | What runs                                                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `release`    | install → lint → build → test:coverage → check version unpublished on npm → `npm publish --provenance` → create GitHub Release |
| `pages`      | redeploy docs site + regenerate `install.sh.sha256`                                                                            |
| `back-merge` | open `chore/back-merge-main → develop` PR                                                                                      |

## Coverage thresholds

Defined in `vitest.config.ts` `coverage.thresholds`:

| Scope                | Statements | Branches | Functions | Lines |
| -------------------- | ---------- | -------- | --------- | ----- |
| Global               | 75         | 66       | 79        | 76    |
| `src/adapters/**`    | 93         | 90       | 100       | —     |
| `src/core/config/**` | 76         | 64       | 94        | —     |
| `src/core/flags/**`  | 90         | 85       | 100       | —     |
| `src/core/verify/**` | 95         | 94       | 93        | —     |
| `src/schemas/**`     | 100        | 100      | 100       | —     |
| `src/utils/**`       | 95         | 92       | 100       | —     |

These are intentionally aspirational targets that the codebase currently meets. **Thresholds are intended to be raised, not lowered.** When you raise local coverage, raise the threshold in the same PR so it ratchets forward and never slides back.

## What is excluded from coverage measurement

Coverage exclusions are defined in `vitest.config.ts` `coverage.exclude`. Every entry has a documented rationale and falls into one of four categories:

### Pure Commander wiring + interactive `@clack/prompts` UI

Logic lives in matching `*-handlers.ts` / `*-wizard.ts` siblings, which **are** covered. Excluded because the `.action()` callbacks aren't unit-testable without a full TTY harness, and the file's remaining content is just option parsing.

- `src/cli.ts`, `src/cli/watch.ts`, `src/cli/contribute.ts`
- `src/cli/preset.ts`, `src/cli/add.ts`, `src/cli/hub.ts`, `src/cli/skill.ts`

### Heavy `@clack/prompts` orchestration

Files that are >70% prompt-driven control flow (multiselect, confirm, text loops with cancel/edit/skip branches). Unit-testing each branch needs a comprehensive prompt-mock harness that does not yet exist. Pure helpers within each file are tested separately where they exist.

- `src/cli/wizard-prompts.ts`, `src/cli/wizard-summary.ts`
- `src/cli/preset-handlers.ts`, `src/cli/hub-handlers.ts`, `src/cli/preset-wizard.ts`
- `src/utils/conflict-resolver.ts`

### Network / git boundary

Need `msw` + git-fixture infrastructure to test meaningfully. Tracked as test-debt; remove from the exclude list when fixtures land.

- `src/cli/contribute-git.ts`, `src/cli/preset-github.ts`, `src/cli/update-check.ts`

### Browser / worker frontend code

Runs in the user's browser, not server-side. Tested by user acceptance / Playwright at the skill level, not by vitest.

- `src/templates/skills/**/generators/**`
- `src/templates/skills/**/static-dir.ts`
- `src/templates/skills/**/references/**`
- `src/templates/skills/**/scripts/**`

### Other

- `src/**/*.d.ts` — type declarations
- `src/**/index.ts` — barrel re-exports (no runtime code)
- `src/**/types.ts` and `src/types/**` — type-only files
- `src/core/preset/preset-zip.ts` — requires zip/unzip binary
- `src/core/preset/preset-source.ts` — type-only file

## Test debt registry

Items that should eventually return to coverage scope, in priority order:

1. **`@clack/prompts` test harness** — once written, removes 6 files from the exclude list (`wizard-prompts`, `wizard-summary`, `preset-handlers`, `hub-handlers`, `preset-wizard`, `utils/conflict-resolver`'s interactive loop).
2. **`msw` + git fixture infrastructure** — once written, removes 3 files (`contribute-git`, `preset-github`, `update-check`).
3. **Move `register*Command` `.action()` callbacks to a separate excluded file** — so the top-level command files (`preset.ts`, `add.ts`, `hub.ts`, `skill.ts`) can rejoin coverage with their actual logic counted.

## How to raise the bar

When a subsystem's actual coverage exceeds its threshold by ≥ 2 percentage points consistently across several PRs, raise that subsystem's threshold by a smaller increment in a dedicated PR with the title `chore(coverage): raise <subsystem> threshold to <new>%`. Do not lower thresholds without an explicit, documented reason — every lowering creates permanent regression risk.

## How to add tests for the right thing

When writing tests for new code:

1. Test the **handler functions** (`*Handler`) — they encapsulate the logic.
2. Test the **helper functions** in `*-helpers.ts` — pure or near-pure functions are easiest to cover.
3. Test the **registrars** (`register*Command`) lightly — just assert the sub-command is registered with a description (see `tests/unit/cli/register-commands.test.ts` for the pattern).
4. Don't try to test the `.action()` callbacks of `register*Command` — they require a full Commander invocation cycle and process exit. Cover the behavior they represent via the matching `*Handler` test instead.

When writing tests that need filesystem state, use `cleanupTmpDir` from `tests/helpers/fs.ts` and `fs.mkdtemp(path.join(os.tmpdir(), ...))` for isolation.
