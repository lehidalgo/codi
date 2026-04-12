# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- **heartbeat hooks** — `codi generate` writes `codi-skill-tracker.cjs` and `codi-skill-observer.cjs` to `.codi/hooks/` and wires them into `.claude/settings.json` and `.codex/hooks.json`
- **skill-observer** — Stop hook extracts `[CODI-OBSERVATION: ...]` markers from the transcript and writes feedback JSON to `.codi/feedback/`
- **skill-tracker** — InstructionsLoaded hook records active Codi skills to `.codi/.session/active-skills.json`
- **core-platform** — all 6 built-in presets now include the self-improvement rule and 6 feedback-loop skills by default
- **skill-feedback-reporter** — repurposed to read `.codi/feedback/` and show the top 3 most actionable observations
- **brand-creator** — new skill replacing `brand-identity`; generates brand skills with `brand/tokens.json` (themes, fonts, assets, voice)
- **content-factory** — brand API endpoints (`/api/brands`, `/api/active-brand`) and brand template support
- **manifest** — `project_context` field: free-form markdown injected into the AI instruction file
- **generate** — auto-injects self-development mode warning into CLAUDE.md when `manifest.name === "codi"`
- **skill READMEs** — setup guides added for 17 complex skills

### Changed

- **rule-feedback** — `user-invocable: false`; uses `[CODI-OBSERVATION: ...]` markers instead of writing JSON files
- **improvement rule** — agent emits observation markers instead of writing files; max 3 per session
- **settings.json** — always generated; always includes heartbeat hook wiring
- **content-factory** — named project workspace, export stack, DOCX fidelity improvements, A4 page discipline

### Fixed

- **heartbeat hooks** — use `.cjs` extension so CommonJS `require()` works in ESM projects
- **run-eval** — creates temp skills in `.claude/skills/` instead of deprecated `.claude/commands/`

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
