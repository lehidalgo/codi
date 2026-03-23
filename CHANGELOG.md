# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

#### Skills
- `codi add skill <name>` with 3 built-in templates (`mcp`, `code-review`, `documentation`)
- Skill parsing from `.codi/skills/` directory
- Skills rendered in Claude Code adapter output (`CLAUDE.md`)
- `codi init` creates `.codi/skills/` directory

#### Version Enforcement
- `codi doctor` command with `--ci` flag for CI/hook usage
- `codi.requiredVersion` field in `codi.yaml` for version pinning
- Semver comparison (`>=` and exact match)
- Pre-commit hook auto-inclusion when `requiredVersion` is set
- `E_VERSION_MISMATCH` and `E_FILES_STALE` error codes

#### Team Sync
- `codi sync` command with `--dry-run` and `--message` options
- `sync` config in `codi.yaml` (repo, branch, paths)
- Git operations module for clone, branch, stage, commit, push
- PR creation via `gh` CLI
- Hash-based change detection between local and remote configs

#### Governance (Phase 2)
- 7-level config inheritance: org → team → repo → lang → framework → agent → user
- Org config (`~/.codi/org.yaml`) for organization-wide policy enforcement
- Team config (`~/.codi/teams/{name}.yaml`) for team-specific overrides
- Framework layer (`.codi/frameworks/*.yaml`) for framework-specific defaults
- `team` field in `codi.yaml` manifest to reference team config
- 10 new behavioral flags (18 total): `lint_on_save`, `allow_force_push`, `require_pr_review`, `mcp_allowed_servers`, `require_documentation`, `allowed_languages`, `max_context_tokens`, `progressive_loading`, `drift_detection`, `auto_generate_on_change`
- String array flag type (`string[]`) for `mcp_allowed_servers` and `allowed_languages`
- Org, team, and repo levels can lock flags (previously only repo)
- `codi doctor` checks org and team config validity
- `codi init` scaffolds `frameworks/` directory
- Flag instruction generation for new flags in all adapters

#### Developer Experience
- 365 tests across 48 test files
- 23 structured error codes with descriptive hints

## [0.1.0] - 2026-03-21

### Added

#### Core
- Layered configuration resolution (repo, lang, agent, user)
- `.codi/` directory structure with `codi.yaml` manifest and `flags.yaml`
- 8 behavioral flags with typed defaults and enforcement modes (`auto_commit`, `test_before_commit`, `security_scan`, `type_checking`, `max_file_lines`, `require_tests`, `allow_shell_commands`, `allow_file_deletion`)
- Zod-based config and flag schema validation
- Hash-based state tracking for generated files

#### CLI
- `codi init` with stack auto-detection (Node, Python, Go, Rust) and agent auto-detection
- `codi generate` (alias: `gen`) with `--dry-run`, `--force`, and per-agent filtering via `--agent`
- `codi validate` for configuration validation
- `codi status` with hash-based drift detection for generated files
- `codi add rule <name>` with 4 built-in templates (`security`, `code-style`, `testing`, `architecture`)
- `codi verify` with token generation and `--check` response validation
- Global options: `--json`, `--verbose`, `--quiet`, `--no-color`
- JSON and human-readable output modes

#### Adapters
- Claude Code adapter — generates `CLAUDE.md`
- Cursor adapter — generates `.cursorrules`
- Codex (OpenAI) adapter — generates `AGENTS.md`
- Windsurf adapter — generates `.windsurfrules`
- Cline adapter — generates `.clinerules`

#### Verification
- Token-based verification system to confirm agents loaded configuration
- `codi verify --check` to validate agent responses against expected token, rules, and flags

#### Developer Experience
- 271 tests across 38 test files
- TypeScript strict mode with ESM
- tsup build with watch mode (`pnpm dev`)
- Vitest with coverage support
- 13 structured exit codes with descriptive error hints
