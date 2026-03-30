# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.0] - 2026-03-30

First stable release. All 0.x versions are deprecated.

### Core

- **5-agent generation** — generates native config files for Claude Code (`CLAUDE.md`), Cursor (`.cursorrules`), Codex (`AGENTS.md`), Windsurf (`.windsurfrules`), and Cline (`.clinerules`) from a single `.codi/` directory
- **Layered config resolution** — 7-level inheritance (org, team, repo, lang, framework, agent, user) with flag locking at any level
- **18 behavioral flags** — typed, validated, and enforced across all agents (e.g., `test_before_commit`, `allow_force_push`, `max_file_lines`, `security_scan`)
- **Zod schema validation** — all config, manifests, presets, and skills validated at parse time
- **Hash-based drift detection** — `codi status` detects when generated files diverge from source config
- **Auto-generate** — mutating commands (`add`, `update`, `revert`) regenerate output automatically

### CLI Commands

20 commands available via `codi <command>` or the interactive Command Center (`codi` with no args):

`init` | `generate` | `status` | `validate` | `verify` | `add` | `update` | `revert` | `clean` | `doctor` | `preset create` | `preset install` | `preset export` | `preset remove` | `preset list` | `preset validate` | `preset edit` | `skill export` | `docs` | `docs-update` | `contribute`

### Templates (120 built-in)

| Type | Count | Examples |
|------|-------|---------|
| Rules | 28 | security, code-style, testing, architecture, git-workflow, 11 languages/frameworks |
| Skills | 46 | code-review, documentation, security-scan, test-coverage, deck-engine, doc-engine, content-factory, skill-creator |
| Agents | 23 | code-reviewer, test-generator, security-analyzer, performance-auditor, api-designer |
| Commands | 17 | review, test-run, security-scan, refactor, onboard, docs-lookup |
| Brands | 6 | brand-identity, bbva-brand, rl3-brand, algorithmic-art, canvas-design, theme-factory |

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
