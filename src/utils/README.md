# src/utils/ — Pure side-effect-free helpers

Small, single-purpose utility modules consumable from any layer
(`cli/`, `core/`, `adapters/`, `runtime/`). No domain knowledge, no
brain access, no Commander imports. Many of these wrap a Node
built-in (`fs/promises`, `child_process`) with a typed/Result-shaped
interface.

## Layout

- **`paths.ts`** — `resolveProjectDir(cwd)` (locates `.codi/`),
  `ensureWithinRoot(parent, child)`, path normalization.
- **`fs.ts`** — async filesystem helpers used by scaffolders +
  validators (atomic write, `readJsonIfExists`, `removeIfPresent`).
- **`path-guard.ts`** — guards against absolute-path / parent-
  traversal attacks (used by preset installers).
- **`hash.ts`** — `hashContent(buf)` SHA-256 + the special-case
  `EMPTY_INPUT_SHA256` placeholder for binary assets that the
  generator does not text-hash.
- **`semver.ts`** — semver compare + range checks; used by the
  version-pin guard + the doctor command.
- **`frontmatter.ts`** — `parseFrontmatter<T>(raw)` — YAML
  frontmatter reader (single-dep replacement for `gray-matter`).
- **`yaml-serialize.ts`** — `fmStr(value)` — YAML scalar emission
  that picks plain vs single-quoted form. Avoids YAML double-
  quoted scalars because Codex CLI (Rust) mishandles them.
- **`diff.ts`** — `renderColoredDiff`, `countChanges`,
  `buildConflictMarkers`, `extractConflictHunks`. The diff
  primitives the conflict resolver builds on.
- **`conflict-resolver.ts`** — 5-strategy dispatcher
  (force / keep-current / union-merge / non-tty / interactive)
  after CORE-021. Resolves write conflicts during `update` /
  `generate`. Returns `Result.err` with `unresolvable[]` in
  non-interactive mode (CORE-007).
- **`editor-utils.ts`** — `resolveEditor()`, `openInEditor()`,
  `isCommandAvailable()`. Used by the `interactive` strategy of
  `conflict-resolver`; CORE-021 extracted them so other callers
  (`codi onboard`, future skill editing) can re-use without
  pulling the resolver loop.
- **`exec.ts`** — `execFileWithTimeout()` — `execFile` with an
  AbortSignal-based wall-clock timeout. The canonical exec wrapper
  for `gh` / `git` calls (use named `EXEC_TIMEOUTS.GIT_LOCAL` /
  `GH_API` constants).
- **`git.ts`** — promise-wrapped `git status`, `git rev-parse`,
  `git log` etc. Each takes a `cwd` + `timeoutMs` (defaults to
  `EXEC_TIMEOUTS.GIT_LOCAL`).
- **`git-utils.ts`** (in `src/runtime/`) — the runtime-layer git
  wrapper used by `gate-runner.ts`. Separate from `src/utils/git.ts`
  because runtime callers want a different timeout profile.
- **`github.ts`** — `gh` CLI wrappers (`ghFork`, `ghRepoClone`,
  `ghRepoExists`).
- **`codi-dir-diff.ts`** — recursive diff over `.codi/` used by
  the verify command + by preset-applier to compute pruning sets.
- **`project-context-preserv.ts`** — `extractProjectContext` /
  `injectProjectContext` / `ensureProjectContextAnchor`. Preserves
  the user-authored `<!-- BEGIN project-context -->` block across
  regenerations.

## Conventions

- **No side effects beyond their narrow contract**: helpers do
  exactly what their name promises and nothing more.
- **Async by default** when there's I/O. Sync versions only when
  the caller is a hot path that cannot afford an event-loop hop
  (e.g. `existsSync` inside the path resolver).
- **Result return when fallible**: helpers that can fail return
  `Result<T, ProjectError[]>` rather than throwing. Throws are
  reserved for programmer errors (`assert`-style).
- **No `Logger.getInstance()`**: `src/utils/**` is below the
  `core/output/logger.ts` boundary. Callers pass a logger in via
  parameter when needed (see `conflict-resolver`, `editor-utils`).

## Coverage threshold

`vitest.config.ts` enforces `src/utils/** branches: 94`
(CORE-029). `conflict-resolver.ts` + `editor-utils.ts` are
excluded from coverage because their interactive @clack flows
need a prompt-mock harness we don't yet have. The pure helpers
inside each (`makeConflictEntry`, `resolveEditor`, …) are tested
individually.
