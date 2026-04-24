# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed

- **Welcome banner now renders inside a rounded box** — the ASCII logo, tagline + version, and Stack/Agents status lines are framed with `╭─...─╮` borders (matching the Codex CLI visual style). Auto-sizes to the widest content line. Falls back to the un-boxed layout on terminals narrower than the box width.

### Fixed

- **`npm version` now ships the tag in the same step** — `postversion` script switched from bare `git push` to `git push --follow-tags`. Previously every release required a manual `git push origin vX.Y.Z` follow-up, or the tag stayed local-only.

### Added

- **Curl installer** — one-liner install at `https://lehidalgo.github.io/codi/install.sh` that detects the host environment and installs nvm + Node 24 if missing, then runs `npm install -g codi-cli`. Avoids the EACCES failure mode that hits users with system-managed Node on `/usr/local`. Honors `CODI_VERSION`, `CODI_INSTALL_NVM`, `CODI_DRY_RUN`, `CODI_NO_COLOR` overrides. Published checksum at `install.sh.sha256` for verification. Hosted via the existing GitHub Pages deploy.

### Changed

- **Minimum Node version bumped from 20 to 24** — `engines.node` now `>=24` to match the project's `.nvmrc`, all CI workflows, and release pipeline (npm 11+ for OIDC). Users on Node 20 will see a clear engine error from npm before EACCES instead of a confusing permissions failure.

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
