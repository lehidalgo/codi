# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed

- **Single source of truth for project naming** — all hardcoded "codi"/"Codi" references across 313 files now derive from `constants.ts`. Renaming the project requires changing only `PROJECT_NAME` and `package.json`
- **Schema field rename** — manifest `codi.requiredVersion` → `engine.requiredVersion`; preset compatibility `codi` → `engine` (breaking change for existing configs)
- **Internal identifier renames** — `CodiManifest` → `ProjectManifest`, `CodiError` → `ProjectError`, `resolveCodiDir` → `resolveProjectDir`, `scanCodiDir` → `scanProjectDir`, and 12 other identifier renames for consistency
- **Template content now interpolated** — `managed_by`, tmpdir prefixes, hook filenames, skill prose, and adapter prefixes all derive from constants at runtime

### Added

- **Dual-language scripts for skill templates** — skills with helper scripts now ship both TypeScript (`scripts/ts/`) and Python (`scripts/python/`) variants; the coding agent detects runtime availability and chooses the appropriate variant. TypeScript is always available via `npx tsx`, Python is used when installed
- **Skill-creator TypeScript eval pipeline** — 8 TypeScript scripts mirror the Python eval tools: `run-eval.ts`, `run-loop.ts`, `improve-description.ts`, `generate-report.ts`, `aggregate-benchmark.ts`, `package-skill.ts`, `quick-validate.ts`, `utils.ts`
- **Skill-creator security scanner** — `security-scan.ts` programmatic scanner for imported skills: prompt injection detection, malicious script patterns, data exfiltration checks, magic bytes validation, content size limits
- **Skill-creator security reviewer agent** — `agents/security-reviewer.md` subagent definition for contextual security review of imported skills
- **Skill migration workflow** — `references/migration-workflow.md` 6-phase import guide: Acquire → Discover → Validate → Security Review → Adapt → Install
- **Security checklist reference** — `references/security-checklist.md` with 5 categories and severity classification for imported skill review
- **PDF TypeScript scripts** — 8 TypeScript equivalents using `pdf-lib`, `sharp`, `pdfjs-dist` for form field extraction, filling, validation, and PDF-to-image conversion
- **Slack GIF Creator TypeScript scripts** — 4 TypeScript equivalents: easing functions (pure math), frame composer (SVG-based), GIF builder (sharp + ImageMagick), validators
- **Webapp-testing TypeScript script** — `with-server.ts` for spawning dev servers, polling ports, running commands with cleanup
- **Skill template directory structure** — all 42 skill templates migrated from flat `.ts` files to directory-based structure with `SkillTemplateDescriptor`, `staticDir`, and supporting files (scripts/, references/, assets/, evals/, agents/)
- **`codi skill export` command** — export skills as Agent Skills standard, Claude Code plugin, Codex plugin, or ZIP bundle for marketplace distribution
- **Skill export wizard** — interactive wizard with format selection, output directory, and confirmation
- **Command Center hub** — bare `codi` launches an interactive menu routing to all 17 commands with full option parity
- **Official frontmatter fields** — skill generation now supports `model`, `effort`, `context`, `agent`, `user-invocable`, `paths`, `shell`
- **Supporting file propagation** — skill generation copies scripts/, references/, assets/ from .codi/skills/ to agent directories
- **Skill skeleton in output** — generated skills always include scripts/, references/, assets/ directories with .gitkeep markers
- **Language detection for 5 new languages** — PHP (composer.json), Ruby (Gemfile), Dart (pubspec.yaml), C++ (CMakeLists.txt), C# (_.csproj/_.sln) now auto-detected
- **Language selection in init wizard** — users can add/remove languages for pre-commit hooks during `codi init`
- **Hook dependency auto-install** — prompts to install missing npm packages (eslint, prettier, tsc) during init
- **Per-hook file filtering** — husky pre-commit hooks now filter staged files per tool via grep, with `passFiles` flag for project-config tools (tsc, pyright, cargo clippy)
- **Error-recovery skill** — activates after 2+ agent error corrections, generates diagnostic REVIEW report with pattern analysis, recommends session reset to prevent context contamination
- **Permission enforcement for all agents** — shared `permission-builder.ts` provides RESTRICTIONS (ENFORCED) sections with BLOCKED/REQUIRED prefixes for Windsurf, Cline, and Codex adapters
- **Permission enforcement integration test** — verifies all 5 agents produce correct enforcement from the same flags
- **Scaffolder unit tests** — rule, agent, command scaffolders and all 3 template loaders now tested (91% coverage)
- **Utils unit tests** — paths, frontmatter, hash utilities now tested (100% line coverage)
- **Stats collector test** — validates `collectStats()` output against source-of-truth registries
- **Output snapshot tests** — vitest snapshots for generated instruction files across all 5 adapters
- **Testing analysis report** — comprehensive coverage analysis with gap identification and improvement roadmap
- **Auto-restage after formatters** — pre-commit hooks with `modifiesFiles: true` automatically re-stage fixed files, preventing formatter changes from being left as unstaged diffs
- **Brands as first-class artifact type** — `codi add brand <name>` creates `.codi/brands/<name>/` with BRAND.md template, assets/, and references/ directories. Brands define design tokens (CSS variables, typography, logos, tone of voice) consumed by engine skills
- **Brand injection in all 5 adapters** — brands are injected into generated output for Claude Code, Cursor, Codex, Windsurf, and Cline
- **`deck-engine` skill template** — comprehensive presentation engine with slide components (title, section divider, bullet list, card grid, metric cards, code block, split layout, flow diagram), CSS foundation with brand token integration, and JS navigation (keyboard/wheel/touch)
- **`doc-engine` skill template** — document generation engine for reports, proposals, one-pagers, and case studies with branded HTML templates, print CSS for A4 PDF export, and component library (callouts, metrics, tables)

### Deprecated

- **`presentation` skill template** — replaced by `deck-engine` which adds brand integration, richer component catalog, and full navigation engine

### Fixed

- **Skill staticDir resolution in bundled output** — `resolveStaticDir()` utility finds skill template source directories from both dev (tsx) and bundled (tsup) contexts by walking up to package root. Fixes skill init producing empty scripts/, references/, assets/ directories
- **Secret scanner false-positive filter** — line-by-line scanning with `FALSE_POS` regex skips env var placeholders (`${VAR}`, `"your-*"`, `process.env`) while still catching real secrets
- **Secret scanner covers skill templates** — removed `/src/templates/` exclusion; skills are scanned for credentials. Only `/references/` (documentation examples) excluded
- **File size hook resource exclusions** — assets, references, office scripts, fonts, PDFs, XSD, and HTML files excluded from LOC check while skill code scripts are still checked
- **Contribution ZIP round-trip** — exported ZIP now includes `preset.yaml` manifest, making it re-importable via `codi init`
- **PR pathway uses clone+push** — contributions clone official repo, push to user's GitHub, open PR to `develop` (no fork required)
- **Skill discovery in contribute** — directory-based skills (`skills/{name}/SKILL.md`) are now properly discovered and exported with supporting files
- **Preset validator handles skill directories** — validation counts and checks directory-based skills alongside flat .md artifacts
- **Secret scan excludes test files** — prevents false positives on test fixtures containing mock API keys
- **File size check excludes lock files** — package-lock.json no longer triggers size warnings
- **Skill-creator scaffold description** — now shows all 5 directories (evals/, scripts/, references/, assets/) matching actual scaffolder output
- **Default skill template frontmatter** — removed non-standard `compatibility` and `tools` fields, improved placeholder text
- **Binary file corruption in skill export** — supporting file copy now skips binary files (images, fonts, archives) that corrupt when read as UTF-8

### Changed

- **Project identity centralized** — `PROJECT_NAME`, `PROJECT_DIR`, `PROJECT_REPO`, `PROJECT_TARGET_BRANCH` constants in `constants.ts` replace hardcoded strings
- **Codi meta-artifacts prefixed** — 7 skills renamed with `codi-` prefix: `codi-contribute`, `codi-compare-preset`, `codi-preset-creator`, `codi-skill-creator`, `codi-rule-creator`, `codi-agent-creator`, `codi-command-creator`
- **Contribute skill template rewritten** — comprehensive guide with GitHub CLI setup, GitHub MCP config, 4 contribution methods, quality checklist
- **Init wizard UX improved** — all flags show detailed hints, enum values explain each option, artifacts show descriptions from templates, version pinning explained
- **Flag catalog enriched** — all 17 flags now have `hint` text; enum flags have `valueHints` per value
- **Skill frontmatter stripping** — generated SKILL.md no longer contains `managed_by`, `compatibility`, or `metadata-*` fields (Codi-internal only)
- **`cli.ts` entry point** — replaced `createRequire` with ESM-native `readFileSync` + `JSON.parse`
- **`parseSkillFile` exported** — now reusable outside parser.ts for skill validation
- **`SKIP_DIRS`/`SKIP_FILES` exported** — reusable filtering constants from skill-generator.ts
- **Skill creator template** — updated with official Claude Code spec: frontmatter fields table, $ARGUMENTS substitutions, context:fork, dynamic injection, context budget awareness
- **Hook commands use `npx` prefix** — Node-based tools (eslint, prettier, tsc, pyright) now resolve from node_modules/.bin in any shell context
- **Init wizard extracted** — wizard path handlers moved to init-wizard-paths.ts for modularity (530 → 119 lines)
- **Rules directory flattened** — removed `rules/generated/common/` + `rules/custom/` split; all rules now live in flat `.codi/rules/` directory, consistent with skills/, agents/, commands/
- **MCP servers directory flattened** — removed `mcp-servers/generated/` + `mcp-servers/custom/` split; all configs now in flat `.codi/mcp-servers/`; `managed_by` field handles ownership

## [0.8.0] - 2026-03-27

### Added

- **Standalone preset template modules** — minimal, balanced, strict presets extracted into individual files under `src/templates/presets/`
- **`resolvePreset()` with inheritance** — presets can extend a base preset and override specific flags
- **Unified `BUILTIN_PRESETS` registry** — single source of truth for all built-in presets via `src/templates/presets/index.ts`
- **Preset registry tests** — new `tests/unit/templates/presets/registry.test.ts`
- **codi-development preset** — dedicated preset for codi's own development with npm lifecycle hooks

### Changed

- **Init wizard simplified** — uses unified preset registry instead of duplicated definitions
- **Preset handlers refactored** — consume `BUILTIN_PRESETS` registry directly
- **Flag presets consolidated** — removed inline preset definitions from `flag-presets.ts`
- **Stats collector updated** — reads preset metadata from registry

### Fixed

- **Version check** — compares against npm registry instead of git tags
- **Shell commands in codi-development** — preset now correctly allows shell commands
- **Init output** — shows actual preset name, not base preset name
- **Hook install** — cleans stale hooks, writes `.mjs` scripts correctly
- **`clean --all`** — fully removes codi-owned husky hook files
- **Node 22 in CI** — CI uses Node 22, allows publishing in detached HEAD
- **npm publish restricted to main** — enforced publish-only-from-main guard
- **Codex config.toml** — removed from git tracking
- **Clean command** — catches codex config.toml + husky commit-msg without marker

## [0.7.0] - 2026-03-26

### Added

- **Native flag enforcement for Claude Code** — `permissions.deny` rules in `.claude/settings.json` hard-block `git push --force`, `rm -rf`, and shell commands based on flags
- **Native flag enforcement for Codex** — `features.shell_tool` and `model_context_window` in `.codex/config.toml` for machine-enforced settings
- **Cursor hooks.json generation** — `.cursor/hooks.json` with `beforeShellExecution` hook to deny force push and file deletion
- **MCP allowlist for Claude Code** — `enabledMcpjsonServers` in settings.json from `mcp_allowed_servers` flag
- **770 tests** across 72 files — integration tests for full pipeline (clean, multi-agent, drift, hooks, revert)
- **QA testing methodology** — Group 37 in QA checklist with AGENT vs HUMAN tester differentiation
- **Preset loader test** — new `tests/unit/core/preset/preset-loader.test.ts`

### Changed

- **README redesigned** — commercial-style with table-based feature overview, supported agents matrix, preset comparison
- **STATUS.md updated** — synced to v0.7.0 with correct stats (770 tests, 23 rules, 18 skills, 6 presets)
- **"Generated by Codi" casing** — fixed from lowercase "codi" to proper name "Codi" across all source and generated files

### Fixed

- **Skill preset resolution bug** — `loadSkillFromDir` read `skills/<name>.md` (flat file) instead of `skills/<name>/SKILL.md` (directory structure), silently dropping skills from presets
- **Windsurf MCP generation** — removed `.windsurf/mcp.json` generation (Windsurf does not read project-level MCP config, only user-global)
- **Stale documentation** — README badge (407→770 tests), preset count (3→6), preset subcommands (5→9), QA checklist stats

## [0.6.0] - 2026-03-26

### Added

- **Full skills spec compliance** — skills now scaffold as directories with evals/, scripts/, references/, assets/ subdirectories
- **Progressive loading** — `progressive_loading` flag wired to all 5 adapters; metadata-only SKILL.md for auto-discovery agents, skill catalog for inline agents
- **Specialized creator skills** — rule-creator (7-step), agent-creator (9-step), command-creator (6-step), skill-creator (8-step with eval lifecycle)
- **Interactive `codi add` wizard** — launches searchable template selector when no args provided; backward compatible with flags
- **Enriched adapter output** — CLAUDE.md/AGENTS.md now include Project Overview, Architecture, Key Commands, Development Notes, Workflow sections
- **Workflow section** — all adapters generate agent behavior guidelines (understand→search→propose, self-evaluation checklist, commit discipline)
- **Codex `config.toml` generation** — developer_instructions from flags + unified MCP server config
- **17 MCP servers** — 6 essential (docs, memory, sequential-thinking, context7) + 11 popular tools (Stripe, Supabase, Vercel, Neon, Sentry, Linear, Notion, Prisma, GitHub, Upstash, Cloudflare)
- **MCP schema extensions** — `headers` field for HTTP auth, `enabled` field for toggling servers
- **2 new rule templates** — production-mindset (production-grade standards) and simplicity-first (YAGNI, minimal complexity)
- **Development hooks** — husky pre-commit (lint) and commit-msg (conventional commits) for codi itself
- **Documentation overhaul** — 11 spec chapters (docs/spec/), 3 new guides (artifact-lifecycle, cloud-ci, security), writing-artifacts.md comprehensive guide
- **Documentation naming convention** — YYYYMMDD*HHMM*[CATEGORY]\_filename.md with 10 categories
- **Skills analysis document** — 1008-line research report on Claude Code Skills architecture

### Changed

- Replaced `prompts` library with `@clack/prompts` — modern wizard UI with intro/outro framing, built-in spinner
- Dynamic template counts — removed 7 hardcoded constants, replaced with runtime calculations
- CLAUDE.md is now lean (no inline rules) — rules auto-discovered from .claude/rules/
- .cursorrules is now lean (no rule list) — rules auto-discovered from .cursor/rules/
- Codex MCP unified into .codex/config.toml (no separate .codex/mcp.toml)
- Docs reorganized into subdirectories: spec/, guides/, reference/, qa/
- All doc references updated across README.md, STATUS.md, templates, and tests
- Agent templates enhanced with confidence filtering, severity matrices, approval criteria
- Skill templates enhanced with "When to Activate" sections
- Rule templates enhanced with rationale annotations and BAD/GOOD examples
- Security rule adds RLS/RBAC, untrusted code validation, CAPTCHAs
- Documentation rule adds Mermaid-only, file naming convention, document types table
- Removed artifact-creator skill (replaced by 4 specialized creators)

### Fixed

- Circular dependency in skill template loaders (factory function pattern)
- Stale doc path references after docs/ reorganization

## [0.5.1] - 2026-03-25

### Added

- Preset selection shows all artifacts pre-checked — user sees exactly what's included
- Modifying a preset's artifacts auto-converts to custom preset with user-provided name

## [0.5.0] - 2026-03-25

### Added

- **Preset-first init wizard** — choose built-in preset, import from ZIP/GitHub, or custom selection
- **Searchable artifact selection** — `autocompleteMultiselect` with type-to-filter in all wizards
- **Presets as artifact references** — `artifacts:` field in preset.yaml lists names, no file duplication
- **`codi preset edit <name>`** — interactive add/remove artifacts from a preset
- **`codi contribute`** — share artifacts via PR to upstream or ZIP export
- **`contribute` skill template** — AI-guided contribution workflow with troubleshooting
- **Init: ZIP/GitHub import** — import presets during project setup
- **Init: save custom as preset** — save artifact selection as named preset for reuse
- **CODI branding** — banner and section headers in all interactive wizards
- 52 artifacts (21 rules, 15 skills, 8 agents, 8 commands) + 6 built-in presets

### Changed

- Preset manifest uses `artifacts:` references instead of subdirectory file copies
- All multiselect prompts upgraded to searchable `autocompleteMultiselect`
- Single preset behavior — no old dir-based fallback

### Removed

- Old directory-based preset loading (presets are reference-based only)
- 56 lines of dead preset loader code

## [0.4.2] - 2026-03-25

### Added

- Auto-generate after every mutating command (`add`, `update`, `revert`) — no need to run `codi generate` manually
- `codi generate` only needed after manual `.codi/` file edits

### Removed

- `--regenerate` flag from `update` command (now always-on unless `--dry-run`)

## [0.4.1] - 2026-03-25

### Added

- Init wizard now offers agent definition and command template selection (all 4 artifact types)
- Agent and command templates selected by default in wizard
- CI workflow runs on develop branch pushes and PRs
- Auto-release workflow: merge to main triggers GitHub Release + npm publish

### Changed

- Hook scripts use `.mjs` extension and ESM imports for Node 20 compatibility
- File-size pre-commit hook excludes codi-generated files (.clinerules, .windsurfrules, etc.)

## [0.4.0] - 2026-03-25

### Added

#### Preset Management System

- Presets elevated to first-class artifact bundles (rules, skills, agents, commands, flags, MCP configs)
- 3 built-in full presets: `python-web`, `typescript-fullstack`, `security-hardened`
- ZIP packaging: `codi preset export <name> --format zip` and `codi preset install ./preset.zip`
- GitHub repo support: `codi preset install github:org/repo[@tag]` with commit tracking
- `codi preset validate <name>` — validates preset structure and schema
- `codi preset remove <name>` — removes installed preset and lock entry
- `codi preset list --builtin` — shows built-in presets with source type indicators
- `codi preset create --interactive` — guided wizard for preset creation
- `preset-creator` skill template — AI-guided 7-step preset creation workflow
- Unified install command auto-detects source type (ZIP, GitHub, registry, local)
- Enhanced `preset-lock.json` with `sourceType`, `commit` hash tracking
- Expanded `PresetManifestSchema` with `author`, `license`, `tags`, `compatibility`, `dependencies`
- 6 new error codes for preset operations (`E_PRESET_NOT_FOUND`, `E_PRESET_INVALID`, etc.)

#### E2E Testing Skill Expansion

- Suite 7 expanded from 2 to 10 test steps covering full preset lifecycle
- Tests: create, list --builtin, validate, export ZIP, remove, install from ZIP
- Network-dependent tests (GitHub install, registry search, update) with human-guided steps
- All hardcoded artifact counts replaced with auto-derived values from template loaders

#### Constants Extraction

- `GIT_COMMIT_FIRST_LINE_LIMIT`, `MIN_CODE_COVERAGE_PERCENT`, `MAX_FUNCTION_LINES`, `MAX_COMPONENT_LINES`
- Template counts auto-derived from loader arrays (no manual count maintenance)
- 10 template files updated to import and interpolate constants

### Changed

- `codi-operations` skill updated with full preset management command reference
- `preset-loader.ts` refactored to use `preset-builtin.ts` materializer
- `preset-registry.ts` lock entries now include `sourceType` field
- CLI `preset.ts` split into `preset.ts` + `preset-handlers.ts` (700-line limit)

## [0.3.1] - 2026-03-25

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

#### Pre-Commit Hooks

- Hook infrastructure wired into `codi init` and `codi generate` (previously dead code)
- 12 language hook registries: TypeScript, JavaScript, Python, Go, Rust, Java, Kotlin, Swift, C#, C++, PHP, Ruby, Dart
- File size check (800 LOC hard limit), secret scan, commit-msg validation (conventional commits)
- Dependency checker reports missing tools with per-language install hints
- `codi doctor` warns when no hooks detected
- `commit` skill template — 5-step workflow with troubleshooting
- `commit` command template — thin trigger for commit skill

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
