# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.3.1] - 2026-03-24

### Added

#### New Templates (23→48 total)
- 9 language/framework rule templates: `golang`, `java`, `kotlin`, `rust`, `swift`, `csharp`, `nextjs`, `django`, `spring-boot`
- 6 skill templates: `security-scan`, `test-coverage`, `refactoring`, `codebase-onboarding`, `presentation`, `mobile-development`
- 5 agent templates: `docs-lookup`, `refactorer`, `onboarding-guide`, `performance-auditor`, `api-designer`
- 5 command templates: `security-scan`, `test-coverage`, `refactor`, `onboard`, `docs-lookup`
- `artifact-creator` skill template — guides AI agents through writing quality artifact content

#### Content Validation
- `codi doctor` warns when artifacts exceed 6K chars or total exceeds 12K chars (Windsurf limit)
- `W_CONTENT_SIZE` warning code for non-blocking size alerts

#### Documentation Sync
- `codi docs-update` — dedicated command to auto-correct stale template counts in STATUS.md and CONTRIBUTING.md
- `codi doctor` reports `W_DOCS_STALE` warnings when documentation counts are out of sync, with guidance to run `codi docs-update`
- Doc-sync detects missing template entries in docs/writing-rules.md and stale source files, reporting them with guidance

#### ACS Compatibility
- SKILL.md format verified compatible with Agentic Collaboration Standard (ACS) v1.0 and agentskills.io
- Compatibility documented in docs/writing-rules.md

### Changed
- Centralized 30 hardcoded constants into `src/constants.ts` — sizes, patterns, filenames, presets, token config, context limits, git clone depth
- Agent and command description schemas now enforce max 512 chars (matching rules)
- All schemas, scaffolders, validators, adapters, and CLI commands import from constants
- `docs/writing-rules.md` rewritten with per-agent size budgets, content best practices, anti-patterns, quality checklist
- Skills `code-review`, `documentation`, `mcp` expanded from stubs (~260 chars) to full workflows (~1500-2500 chars)
- Commands follow skills-first pattern: thin triggers that invoke corresponding skills

### Fixed
- Agent/command description fields had no max length (now 512 chars)
- Hardcoded magic numbers scattered across 35+ files (now centralized)
- Documentation counts going stale when templates are added (now auto-detected and fixable)

## [0.2.0] - 2026-03-23

### Added

#### Rule Lifecycle
- Template-created rules now use `managed_by: codi` (updatable by `codi update --rules`)
- User-custom rules use `managed_by: user` (never overwritten)
- `codi update --rules` refreshes all `managed_by: codi` rules to latest template versions
- `codi add rule --all` adds all 9 template rules at once (skips existing)

#### Commands Support
- `codi add command <name>` with 2 built-in templates (`review`, `test-run`)
- `codi add command --all` to add all command templates
- Command scanner reads `.codi/commands/*.md` during config resolution
- Claude Code: generates `.claude/commands/*.md`

#### MCP Distribution
- MCP config (`.codi/mcp.yaml`) now distributed to all supporting agents:
  - Claude Code: `.claude/mcp.json`
  - Codex: `.codex/mcp.toml`
  - Cursor: `.cursor/mcp.json`
  - Windsurf: `.windsurf/mcp.json`

#### Agent (Subagent) Support
- `codi add agent <name>` with 3 built-in templates (`code-reviewer`, `test-generator`, `security-analyzer`)
- `codi add agent --all` to add all agent templates at once
- Agent scanner reads `.codi/agents/*.md` during config resolution
- Claude Code: generates `.claude/agents/*.md` (Markdown + YAML frontmatter)
- Codex: generates `.codex/agents/*.toml` (TOML format)

#### Template Organization
- Extracted all 16 templates to individual TypeScript modules in `src/templates/`
- One file per template for easy editing, review, and contribution
- Loader files simplified from 671 LOC to 73 LOC

#### Lifecycle Commands
- `codi update` — add missing flags from catalog or reset to a preset (`--preset minimal|balanced|strict`)
- `codi update --regenerate` — update flags and regenerate in one step
- `codi clean` — remove all generated files (CLAUDE.md, .cursorrules, etc.) and agent rule dirs
- `codi clean --all` — full uninstall including `.codi/` directory
- Both commands support `--dry-run` for preview

#### Reference-Based Generation
- CLAUDE.md and .cursorrules now reference rules instead of inlining them
- Rules live in `.claude/rules/` and `.cursor/rules/` with full content
- Central config files are lightweight indexes (flags + rule list + verification)

#### Production-Grade Rule Templates
- Rewrote 4 existing templates (security, code-style, testing, architecture) with actionable, detailed content
- Added 5 new templates: git-workflow, error-handling, performance, documentation, api-design
- 9 total rule templates covering all major development concerns

#### Interactive Init Wizard
- `codi init` now runs an interactive wizard by default: select agents, rules, flag preset, version pinning
- 3 flag presets: `minimal` (permissive), `balanced` (recommended), `strict` (enforced)
- `--preset <name>` flag for non-interactive preset selection
- Rules from templates are created during init when selected in wizard
- Version pinning (`codi.requiredVersion`) configured during init
- Wizard auto-skips in non-interactive environments (`--json`, `--quiet`, `--agents`)

#### Skills
- `codi add skill <name>` with 4 built-in templates (`mcp`, `code-review`, `documentation`, `rule-management`)
- Skill parsing from `.codi/skills/` directory
- Skills rendered in Claude Code adapter output (`CLAUDE.md`)
- `codi init` creates `.codi/skills/` directory

#### Version Enforcement
- `codi doctor` command with `--ci` flag for CI/hook usage
- `codi.requiredVersion` field in `codi.yaml` for version pinning
- Semver comparison (`>=` and exact match)
- Pre-commit hook auto-inclusion when `requiredVersion` is set
- `E_VERSION_MISMATCH` and `E_FILES_STALE` error codes

#### Remote Config Pull
- `codi update --from <repo>` pulls centralized artifacts from a team GitHub repository
- `source` config in `codi.yaml` (repo, branch, paths)
- One-way pull: reads from remote, never writes to it
- Respects `managed_by` ownership — only updates `managed_by: codi` artifacts

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
- 385 tests across 52 test files
- 23 structured error codes with descriptive hints

### Changed

- Removed `codi sync` command (pushed local changes to remote — violated governance model). Replaced with `codi update --from <repo>` which pulls centralized artifacts from the team repository without writing to it.
- Renamed `sync` config key to `source` in `codi.yaml`

### Fixed

- `createError()` message now includes error code prefix for clarity
- Agent name validation enforces regex matching rules/skills
- Skill schema validates `disableModelInvocation`, `argumentHint`, `allowedTools`
- Console.log replaced with Logger in init wizard
- Rule/skill creation in init logs warnings on failure
- Path resolution standardized to `path.resolve()` in state manager
- Scaffold names limited to 64 characters
- Type guards added for array flag value casting
- Removed undeclared `type: skill` from skill template frontmatter
- Consolidated duplicate template-matching functions in update command
- Added `satisfiesVersion` to utils barrel export

#### Release Infrastructure
- MIT LICENSE file
- GitHub Actions CI workflow (lint, test, build on push/PR)
- GitHub Actions publish workflow (npm publish on GitHub release with provenance)
- `prepublishOnly` script (lint + test + build)
- Package metadata: repository, homepage, bugs, author, exports
- `.nvmrc` for Node 20 version consistency

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
