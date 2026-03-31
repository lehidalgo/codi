# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed

- **Simplified config resolution** — removed 8-layer composition system (org, team, preset, repo, lang, framework, agent, user). `.codi/` is now the single source of truth; `codi generate` reads only from `.codi/` and writes agent config files
- **Registry update handler** — now runs security scan and conflict resolution before applying updates, matching the behavior of install from ZIP/GitHub

### Added

- **Status diff display** — `codi status --diff` renders colored unified diffs for drifted preset artifacts by reloading the source preset
- **Preset flag merge on install** — `preset install` (ZIP and GitHub) now writes preset flags to `flags.yaml` with locked-flag protection
- **Preset remove cleanup** — `preset remove` lists orphaned artifacts and cleans up stale state entries
- **Built-in preset commands and MCP** — `materializeBuiltinPreset` now materializes commands and MCP server configs instead of returning empty arrays
- **Locked flag protection in extends** — child presets can no longer silently override `locked: true` flags from parent presets
- **Circular extends guard at load time** — `detectCircularExtends` now runs during `loadPresetFromDir` to prevent stack overflow
- **MCP server conflict resolution** — `preset install` and `preset update` now detect and diff MCP server config changes instead of silently overwriting
- **Preset category field** — presets can now declare a `category` (engineering, design, data, platform, security, custom) for organizational classification
- **Hook drift detection** — `codi status` now reports drift in generated hook files alongside agent config files
- **Preset artifact drift tracking** — records hashes of installed artifacts; `codi status` reports when users have modified preset-installed files
- **Conflict detail metadata** — `ApplyResult` now includes `conflictDetails` with per-file addition/removal counts for CI consumption
- **Missing artifact warnings** — preset loader logs warnings when artifacts listed in `preset.yaml` cannot be resolved
- **Cross-skill Related Skills sections** — added to 7 skills to improve discoverability of complementary workflows
- **Orphaned helper scripts documented** — `add_slide.py`, `clean.py` (pptx), and 25 skill-creator scripts now referenced in SKILL.md

### Removed

- **Marketplace module** — removed `codi marketplace` command and all related code; GitHub repo import (`preset install github:org/repo`) covers the same use case
- **Old governance layers** — removed dead code for org, team, lang, and framework layers: `resolveOrgFile()`, `resolveTeamFile()`, `checkOrgConfig()`, `checkTeamConfig()`, multi-layer `resolveFlags()`, `validateFlags()`, `LOCKABLE_LEVELS`, 8 error codes, `team`/`source` manifest fields, and orphaned test fixtures

### Fixed

- **Preset artifact drift affects exit code** — `codi status` with `drift_detection: "error"` now returns non-zero exit for drifted preset artifacts, enabling CI enforcement
- **Skill files always contain full content** — `progressive_loading` flag no longer produces metadata stubs in agent skill directories; flag now only controls whether Windsurf/Cline inline skills in their main config file
- **Binary assets copied to agent directories** — fonts (.woff2, .ttf), images (.png), PDFs, and archives (.tar.gz) are now properly copied via `fs.copyFile` instead of being skipped
- **Skill resource path fixes** — fixed broken references in 8 skills (wrong directory names, missing prefixes, hardcoded paths)
- **`__pycache__` excluded from skill propagation** — Python bytecode cache no longer copied to agent directories

## [1.0.0] - 2026-03-30

First stable release. All 0.x versions are deprecated.

### Core

- **5-agent generation** — generates native config files for Claude Code (`CLAUDE.md`), Cursor (`.cursorrules`), Codex (`AGENTS.md`), Windsurf (`.windsurfrules`), and Cline (`.clinerules`) from a single `.codi/` directory
- **Single-source config resolution** — `.codi/` is the single source of truth; presets are consumed at install time, `generate` reads only from `.codi/`
- **18 behavioral flags** — typed, validated, and enforced across all agents (e.g., `test_before_commit`, `allow_force_push`, `max_file_lines`, `security_scan`)
- **Zod schema validation** — all config, manifests, presets, and skills validated at parse time
- **Hash-based drift detection** — `codi status` detects when generated files diverge from source config
- **Auto-generate** — mutating commands (`add`, `update`, `revert`) regenerate output automatically

### CLI Commands

20 commands available via `codi <command>` or the interactive Command Center (`codi` with no args):

`init` | `generate` | `status` | `validate` | `verify` | `add` | `update` | `revert` | `clean` | `doctor` | `preset create` | `preset install` | `preset export` | `preset remove` | `preset list` | `preset validate` | `preset edit` | `skill export` | `docs` | `docs-update` | `contribute`

### Templates (100+ built-in)

| Type | Count | Examples |
|------|-------|---------|
| Rules | 25+ | security, code-style, testing, architecture, git-workflow, 11 languages/frameworks |
| Skills | 40+ | code-review, documentation, security-scan, test-coverage, deck-engine, doc-engine, content-factory, skill-creator |
| Agents | 20+ | code-reviewer, test-generator, security-analyzer, performance-auditor, api-designer, data-science-specialist |
| Commands | 15+ | review, test-run, security-scan, refactor, onboard, docs-lookup, open-day, close-day |

### Presets

6 built-in presets with clear differentiation:

| Preset | Purpose |
|--------|---------|
| `minimal` | Permissive defaults, no rules or skills |
| `balanced` | Recommended starting point with core rules and skills |
| `strict` | Enforced security policies, locked flags, mandatory testing |
| `fullstack` | Broad rules + testing for multi-language projects |
| `power-user` | Workflow tooling, graph tools, daily commands |
| `development` | Codi's own development preset with npm lifecycle hooks |

Presets can be created, installed from ZIP/GitHub, exported, and shared.

### Pre-commit Hooks

- Husky-based hook infrastructure installed during `codi init`
- 12 language hook registries (TypeScript, Python, Go, Rust, Java, Kotlin, Swift, C#, C++, PHP, Ruby, Dart)
- Per-hook file filtering with staged-file grep
- Secret scanning, file size limits (800 LOC), conventional commit validation
- Hook dependency auto-install for npm packages
- Auto-restage after formatters run

### Skill System

- **Directory-based skills** — each skill has scripts/, references/, assets/, evals/, agents/ subdirectories
- **Dual-language scripts** — TypeScript (`npx tsx`) and Python variants for skill helper scripts
- **Skill export** — export as Agent Skills standard, Claude Code plugin, Codex plugin, or ZIP bundle
- **Skill routing table** — generated config includes intent-to-skill mapping from `intentHints` frontmatter
- **Skill feedback loop** — `codi skill stats` aggregates usage data from agent-reported feedback
- **Supporting file propagation** — scripts, references, and assets copied to agent directories during generation

### Security

- Content scanner for secrets in skill templates
- Permission enforcement across all 5 agents (BLOCKED/REQUIRED prefixes)
- Native flag enforcement: Claude Code `permissions.deny`, Codex `features.shell_tool`, Cursor hooks.json
- MCP server allowlisting via `mcp_allowed_servers` flag

### Testing

- 1546 tests across 130 test files
- 78% statement coverage, 70% branch coverage
- Per-path coverage thresholds for adapters (93%), schemas (100%), utils (95%), and core modules
- Integration tests for full pipeline: init, generate, verify, docs, skill management

### Documentation

11 guides ship with the project: Getting Started, Feature Inventory, CLI Reference, Architecture, Configuration, Artifacts, Presets, Workflows, Migration, Troubleshooting, Maintaining Docs.
