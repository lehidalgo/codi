# Codi Design Documentation

**Date**: 2026-03-24
**Document**: design.md

Comprehensive design reference covering all 33 functionalities in the Codi unified AI agent configuration system.

---

## Table of Contents

### CLI Commands
1. [init](#1-init)
2. [generate](#2-generate)
3. [validate](#3-validate)
4. [status](#4-status)
5. [add](#5-add)
6. [verify](#6-verify)
7. [doctor](#7-doctor)
8. [update](#8-update)
9. [clean](#9-clean)
10. [compliance](#10-compliance)
11. [watch](#11-watch)
12. [ci](#12-ci)
13. [revert](#13-revert)
14. [marketplace](#14-marketplace)

### Core Systems
15. [7-Level Config Resolution](#15-7-level-config-resolution)
16. [Flag System](#16-flag-system)
17. [Verification Token](#17-verification-token)
18. [Backup System](#18-backup-system)
19. [Audit Logging](#19-audit-logging)
20. [Drift Detection](#20-drift-detection)

### Adapters
21. [Claude Code Adapter](#21-claude-code-adapter)
22. [Cursor Adapter](#22-cursor-adapter)
23. [Codex Adapter](#23-codex-adapter)
24. [Windsurf Adapter](#24-windsurf-adapter)
25. [Cline Adapter](#25-cline-adapter)

### Templates
26. [Rule Templates](#26-rule-templates)
27. [Skill Templates](#27-skill-templates)
28. [Agent Templates](#28-agent-templates)

### Governance
29. [Artifact Ownership](#29-artifact-ownership)
30. [One-Way Pull Model](#30-one-way-pull-model)

### Extensions & Security
31. [Preset System](#31-preset-system)
32. [MCP HTTP Transport](#32-mcp-http-transport)
33. [Path Safety Guard](#33-path-safety-guard)

---

## 1. init

### Description
Interactive setup wizard that bootstraps a `.codi/` directory. Detects project stack (node, python, go, rust) by checking for marker files (`package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`). Auto-detects installed AI agents by probing for their config files. Presents an interactive wizard (via `prompts`) where users select agents, choose a preset (minimal/balanced/strict), pick rule and skill templates, and optionally pin the Codi version. In non-interactive mode (when `--agents` or `--json` is passed), skips the wizard and uses CLI arguments directly. Creates `codi.yaml` manifest, `flags.yaml` from the selected preset, scaffolds selected rules/skills, and runs an initial `generate`.

### Importance
Entry point for all new projects. A well-structured init reduces configuration errors and ensures consistent setup across teams.

### Pros
- Auto-detects stack and agents, reducing manual setup
- Three presets cover most governance needs out of the box
- Non-interactive mode enables scripted onboarding

### Cons
- Stack detection is limited to 4 languages (node, python, go, rust)
- Wizard depends on `prompts` library for TTY interaction
- Re-initialization requires explicit `--force` flag

### Status
Implemented | Tested

### Validation
1. Run `codi init` in a new project directory
2. Verify `.codi/codi.yaml`, `.codi/flags.yaml`, and rule files are created
3. Run `codi init --agents claude-code --preset strict` for non-interactive mode
Expected: `.codi/` directory created with correct manifest, flags, and selected rules.

### Contributing
Files: `src/cli/init.ts`, `src/cli/init-wizard.ts`
How to extend: Add new stack indicators to `STACK_INDICATORS` map. Add wizard steps in `init-wizard.ts`. New presets go in `src/core/flags/flag-presets.ts`.

---

## 2. generate

### Description
Resolves the full 7-level configuration, registers all adapters, creates a backup of existing generated files, then invokes each adapter's `generate()` method to produce agent-specific output files. After writing files, updates `state.json` with file hashes (source and generated) and writes an audit log entry. Supports `--agent` to target specific adapters, `--dry-run` to preview without writing, and `--force` to regenerate even if unchanged. Aliased as `gen`.

### Importance
Central command that translates unified `.codi/` configuration into agent-native formats. All adapters converge through this single pipeline.

### Pros
- Single command produces output for all configured agents
- Automatic backup before every generation protects against data loss
- Dry-run mode enables safe previewing
- State tracking enables drift detection

### Cons
- Regenerates all files even when only one rule changes (unless `--agent` is used)
- No incremental generation; always full rebuild

### Status
Implemented | Tested

### Validation
1. Run `codi generate --dry-run` and verify no files are written
2. Run `codi generate` and check that agent config files appear (e.g., `CLAUDE.md`, `.cursorrules`)
3. Verify `.codi/state.json` is updated with file hashes
4. Verify `.codi/audit.jsonl` contains a `generate` entry
Expected: Agent-specific files created, state updated, backup stored.

### Contributing
Files: `src/cli/generate.ts`, `src/core/generator/generator.ts`, `src/core/generator/adapter-registry.ts`
How to extend: Register new adapters in `src/adapters/index.ts`. The generator iterates all registered adapters matching the manifest's agent list.

---

## 3. validate

### Description
Validates the `.codi/` directory structure and configuration. Calls `resolveConfig()` to parse the manifest and flags, then runs `validateConfig()` to check schema compliance, flag value validity, and structural integrity. Returns structured error output with error codes (`E_CONFIG_NOT_FOUND`, `E_CONFIG_INVALID`).

### Importance
First line of defense against malformed configuration. Used standalone and as a building block in `ci` and `compliance` commands.

### Pros
- Fast, read-only operation
- Provides actionable error messages with hints
- Reusable as a sub-check in composite commands

### Cons
- Does not validate generated output files, only source config
- No auto-fix capability

### Status
Implemented | Tested

### Validation
1. Run `codi validate` in an initialized project
2. Intentionally break `codi.yaml` syntax and run `codi validate`
Expected: Clean exit on valid config; structured error with code `E_CONFIG_INVALID` on broken config.

### Contributing
Files: `src/cli/validate.ts`, `src/core/config/validator.ts`
How to extend: Add validation rules in `validator.ts`. Each rule returns a `CodiError[]`.

---

## 4. status

### Description
Drift detection command. Reads `state.json` to find previously generated files, then computes current file hashes and compares against stored hashes. Reports each file as `synced`, `drifted`, or `missing`. Respects the `drift_detection` flag: `off` skips checks entirely, `warn` reports but exits 0, `error` exits non-zero on drift.

### Importance
Ensures generated files stay in sync with source configuration. Catches manual edits or accidental deletions.

### Pros
- Hash-based comparison is fast and reliable
- Three drift modes allow flexible governance
- Per-agent drift reports provide granular visibility

### Cons
- Requires `state.json` to exist (needs at least one prior `generate`)
- Cannot distinguish intentional edits from accidental drift

### Status
Implemented | Tested

### Validation
1. Run `codi generate` then `codi status` — expect no drift
2. Manually edit a generated file, then run `codi status`
Expected: Drifted file reported with `status: drifted` and hash mismatch details.

### Contributing
Files: `src/cli/status.ts`, `src/core/config/state.ts`
How to extend: Add new drift statuses in `DriftFile` interface. Modify `detectDrift()` in `StateManager`.

---

## 5. add

### Description
Scaffolds new rules, skills, or agents into `.codi/`. Supports three sub-commands: `add rule`, `add skill`, `add agent`. Each accepts a name, optional `--template` to use a built-in template, and `--all` to batch-create all available templates. Templates are loaded from `src/templates/` and written to the appropriate `.codi/` subdirectory. Unknown template names are rejected with a list of valid options.

### Importance
Standardized scaffolding ensures consistent file structure and metadata across all artifacts.

### Pros
- Template system provides curated starting points
- `--all` flag enables rapid project setup
- Validates template names before creation

### Cons
- No interactive selection when `--all` is not used and no name is given
- Cannot add from external template sources (use marketplace for that)

### Status
Implemented | Tested

### Validation
1. Run `codi add rule my-rule` — verify `.codi/rules/custom/my-rule.md` created
2. Run `codi add rule --template security` — verify template content applied
3. Run `codi add skill --all` — verify all 5 skill templates created
Expected: Files created in correct locations with proper content.

### Contributing
Files: `src/cli/add.ts`, `src/core/scaffolder/rule-scaffolder.ts`, `src/core/scaffolder/skill-scaffolder.ts`, `src/core/scaffolder/agent-scaffolder.ts`, `src/core/scaffolder/template-loader.ts`, `src/core/scaffolder/skill-template-loader.ts`, `src/core/scaffolder/agent-template-loader.ts`
How to extend: Add new templates in `src/templates/rules/`, `src/templates/skills/`, or `src/templates/agents/` and register them in the corresponding index file.

---

## 6. verify

### Description
Generates a verification token and displays rule/skill/agent/flag lists from the current configuration. The token is a 12-character SHA256 hash prefixed with `codi-`, computed from manifest name, agent list, rule content, skill names, agent names, and active flags. With `--check <response>`, parses a pasted agent response using fuzzy matching to verify the agent has internalized the configuration. Checks token match, rule coverage, and flag awareness.

### Importance
Provides cryptographic proof that an AI agent has loaded and acknowledged the correct configuration. Essential for compliance auditing.

### Pros
- Content-aware hashing (includes rule content, not just names)
- Fuzzy matching tolerates minor formatting differences in agent responses
- Deterministic: same config always produces the same token

### Cons
- 12-character token has theoretical collision space (48 bits)
- Fuzzy matching may produce false positives on ambiguous names
- Requires manual copy-paste workflow for `--check`

### Status
Implemented | Tested

### Validation
1. Run `codi verify` and note the token
2. Ask the AI agent "verify codi" and capture its response
3. Run `codi verify --check "<agent response>"`
Expected: Token matches, all rules found, all flags found.

### Contributing
Files: `src/cli/verify.ts`, `src/core/verify/token.ts`, `src/core/verify/checker.ts`, `src/core/verify/section-builder.ts`
How to extend: Modify hash inputs in `buildVerificationData()`. Add new extraction patterns in `checker.ts`.

---

## 7. doctor

### Description
Runs health checks against the project: config directory existence, manifest validity, Codi version compatibility, and drift status. Delegates to `runAllChecks()` in `version-checker.ts`. Each check produces a `{ check, passed, message }` result. In `--ci` mode, exits non-zero on any failure. Respects `drift_detection` flag for drift-related exit codes.

### Importance
Single diagnostic command for troubleshooting. Integrates into CI/CD for automated health verification.

### Pros
- Comprehensive: covers config, version, and drift in one command
- `--ci` mode provides strict exit codes for pipelines
- Clear per-check pass/fail reporting

### Cons
- Cannot auto-fix detected issues
- Version check requires network access to compare against latest

### Status
Implemented | Tested

### Validation
1. Run `codi doctor` in a healthy project — expect all checks passed
2. Run `codi doctor --ci` with a known issue — expect non-zero exit
Expected: Structured report with per-check results.

### Contributing
Files: `src/cli/doctor.ts`, `src/core/version/version-checker.ts`
How to extend: Add new checks in `runAllChecks()`. Each check follows the `{ check, passed, message }` interface.

---

## 8. update

### Description
Two main modes: **flag updates** and **artifact refresh**. Without `--preset`, adds missing flags from `FLAG_CATALOG` to `flags.yaml`. With `--preset`, resets all flags to the specified preset. With `--rules`, `--skills`, or `--agents`, scans existing files for `managed_by: codi` frontmatter and refreshes them from the latest template versions (user-managed files are skipped). With `--from <repo>`, performs a one-way pull from a remote Git repository. Supports `--dry-run` and `--regenerate` to auto-run `generate` after updating. Writes audit log entry.

### Importance
Keeps configurations current as Codi evolves. Enables centralized governance through the pull model.

### Pros
- Additive flag updates are non-destructive (only adds missing flags)
- Artifact refresh respects `managed_by` ownership
- `--from` enables centralized config distribution

### Cons
- Preset reset is destructive (overwrites all flag values)
- Remote pull requires Git CLI and network access
- Name mapping for template matching is limited

### Status
Implemented | Tested

### Validation
1. Add a new flag to `FLAG_CATALOG`, run `codi update` — verify the flag appears in `flags.yaml`
2. Run `codi update --preset strict --dry-run` — verify flag changes shown without writing
3. Run `codi update --rules` — verify template-managed rules refreshed
Expected: Flags updated, managed artifacts refreshed, user artifacts untouched.

### Contributing
Files: `src/cli/update.ts`
How to extend: Add name mappings in `RULE_NAME_MAPPINGS`. For new artifact types, follow the `refreshManaged*` pattern.

---

## 9. clean

### Description
Removes generated files tracked in `state.json`. Without `--all`, removes only agent output files (e.g., `CLAUDE.md`, `.cursorrules`) and their containing directories. With `--all`, also removes the `.codi/` directory itself (full uninstall). Cleans known agent subdirectories (`.claude/rules`, `.cursor/rules`, etc.) and removes empty parent directories. Supports `--dry-run` to preview deletions.

### Importance
Enables clean teardown for testing, migration, or removing Codi from a project.

### Pros
- State-aware: only removes tracked generated files
- Falls back to known file list when no state exists
- Empty directory cleanup prevents leftover artifacts

### Cons
- `--all` is irreversible (no confirmation prompt in quiet mode)
- Cannot selectively clean a single agent's files

### Status
Implemented | Tested

### Validation
1. Run `codi generate` then `codi clean --dry-run` — verify files listed but not deleted
2. Run `codi clean` — verify generated files removed, `.codi/` preserved
3. Run `codi clean --all` — verify `.codi/` directory removed
Expected: Generated files removed; directories cleaned up.

### Contributing
Files: `src/cli/clean.ts`
How to extend: Add new agent directories to `AGENT_SUBDIRS` and `AGENT_PARENT_DIRS` arrays.

---

## 10. compliance

### Description
Composite command that combines `validate`, `doctor`, and config summary into a single compliance report. Runs all doctor checks, resolves config to count rules/skills/agents/flags, generates the verification token, reads state for generation age, and performs drift detection. Reports all results as a structured list of checks. With `--ci`, exits non-zero on any failure.

### Importance
Single-command compliance gate for CI/CD pipelines. Provides a complete project health snapshot.

### Pros
- All-in-one: config validity, version, drift, and asset counts
- Generation age tracking helps identify stale configs
- Token included for quick verification reference

### Cons
- Slower than individual commands (runs all checks)
- Redundant with running `validate` + `doctor` + `status` separately

### Status
Implemented | Tested

### Validation
1. Run `codi compliance` — verify structured report with all checks
2. Run `codi compliance --ci` with drift detected — expect non-zero exit
Expected: Report includes `configValid`, `versionMatch`, `hasDrift`, asset counts, and token.

### Contributing
Files: `src/cli/compliance.ts`
How to extend: Add new checks to the `checks` array. Follow the `ComplianceCheck` interface.

---

## 11. watch

### Description
File watcher on the `.codi/` directory using Node.js `fs.watch` with recursive mode. On any file change (excluding `state.json` and `audit.jsonl`), debounces for 500ms, then runs a full `resolveConfig` + `generate` cycle. Requires the `auto_generate_on_change` flag to be enabled. With `--once`, runs a single generation and exits. Writes audit entries with `trigger: watch`.

### Importance
Enables live development workflow where config changes are immediately reflected in agent files.

### Pros
- 500ms debounce prevents excessive regeneration during rapid edits
- Ignores state/audit files to prevent infinite loops
- `--once` mode useful for scripted workflows

### Cons
- `fs.watch` behavior varies across operating systems
- No file-level granularity (any change triggers full regeneration)
- Requires `auto_generate_on_change` flag, disabled by default

### Status
Implemented | Tested

### Validation
1. Enable `auto_generate_on_change` flag in `flags.yaml`
2. Run `codi watch` in one terminal
3. Edit a rule file in `.codi/rules/` — observe regeneration
Expected: "Change detected" message followed by "Regeneration complete."

### Contributing
Files: `src/cli/watch.ts`
How to extend: Add file exclusion patterns to the watcher callback. Adjust debounce timing.

---

## 12. ci

### Description
Composite command designed for CI/CD pipelines. Runs `validate` to check config validity, then `doctor --ci` to check health with strict exit codes. Combines errors from both commands. Exits non-zero if either check fails.

### Importance
Minimal, fast validation gate for automated pipelines. Lighter than `compliance`.

### Pros
- Lean: only two checks, fast execution
- Always uses strict exit codes (no soft-fail mode)
- Aggregates errors from both sub-commands

### Cons
- No drift detection (use `compliance --ci` for that)
- No summary report beyond pass/fail

### Status
Implemented | Tested

### Validation
1. Run `codi ci` in a valid project — expect exit code 0
2. Break `codi.yaml` and run `codi ci` — expect non-zero exit
Expected: Combined pass/fail result with aggregated errors.

### Contributing
Files: `src/cli/ci.ts`
How to extend: Add additional sub-checks by importing and calling other handler functions.

---

## 13. revert

### Description
Restores generated files from automatic backups stored in `.codi/backups/{timestamp}/`. Three modes: `--list` shows available backups with timestamps and file counts, `--last` restores the most recent backup, `--backup <timestamp>` restores a specific backup. Reads `backup-manifest.json` from each backup directory to identify files. Copies backup files back to their original project locations.

### Importance
Safety net for undoing bad generations. Backups are created automatically before every `generate`.

### Pros
- Automatic backup creation requires no user action
- Specific backup selection via timestamp
- Manifest-tracked file list ensures accurate restoration

### Cons
- Maximum 5 backups retained (older ones are pruned)
- Only backs up generated files, not `.codi/` source config
- No diff preview before restoration

### Status
Implemented | Tested

### Validation
1. Run `codi generate` twice to create backups
2. Run `codi revert --list` — verify backups listed with timestamps
3. Run `codi revert --last` — verify files restored
Expected: Files restored to their pre-generation state.

### Contributing
Files: `src/cli/revert.ts`, `src/core/backup/backup-manager.ts`
How to extend: Modify `MAX_BACKUPS` constant. Add backup metadata fields to `BackupManifest`.

---

## 14. marketplace

### Description
Two sub-commands: `search` and `install`. Clones a Git registry repository (default: `codi-registry/skills`) with `--depth 1`, reads `index.json` for available skills, and filters by name/description match. `install` copies the matching skill file from the registry into `.codi/skills/`. Registry URL and branch are configurable via `manifest.marketplace` in `codi.yaml`. Temporary clone is cleaned up after operation.

### Importance
Enables community-driven skill distribution. Centralizes discoverable, reusable skill definitions.

### Pros
- Git-based registry is simple and versionable
- Shallow clone minimizes download size
- Configurable registry URL for private registries

### Cons
- Requires Git CLI installed on the system
- No version pinning for installed skills
- No dependency resolution between skills

### Status
Implemented | Tested

### Validation
1. Run `codi marketplace search "review"` — verify matching skills listed
2. Run `codi marketplace install code-review` — verify skill file created
Expected: Skill file installed at `.codi/skills/code-review.md`.

### Contributing
Files: `src/cli/marketplace.ts`
How to extend: Add new sub-commands to the marketplace command group. Support alternative registry backends.

---

## 15. 7-Level Config Resolution

### Description
Hierarchical configuration composition across 7 layers, resolved in order: org, team, repo, lang, framework, agent, user. Each layer is a YAML file providing flag overrides. The `org` layer comes from `~/.codi/org.yaml`, `team` from `~/.codi/teams/{name}.yaml`, `repo` from `.codi/flags.yaml`, `lang` from `.codi/lang/*.yaml`, `framework` from `.codi/frameworks/*.yaml`, `agent` from `.codi/agents/*.yaml`, and `user` from `~/.codi/user.yaml`. Layers are composed via `composeConfig()` which merges flags with later layers overriding earlier ones. Locked flags from higher-priority layers cannot be overridden by lower-priority ones.

### Importance
Enables governance at scale: organizations set baselines, teams customize, and individual developers personalize without breaking constraints.

### Pros
- 7 layers cover all governance scopes (org to individual)
- Locked flags enforce non-negotiable policies
- Each layer is an independent YAML file, easy to manage

### Cons
- Complex mental model with 7 precedence levels
- Debugging flag resolution requires tracing through layers
- Org/team layers depend on home directory conventions

### Status
Implemented | Tested

### Validation
1. Create `~/.codi/org.yaml` with a locked flag
2. Try to override that flag in `.codi/flags.yaml`
3. Run `codi generate` — verify the locked value wins
Expected: Locked flags from higher layers are not overridden.

### Contributing
Files: `src/core/config/resolver.ts`, `src/core/config/composer.ts`, `src/core/config/parser.ts`, `src/core/config/validator.ts`
How to extend: Add new layer types by creating a `build*Layer()` function in `resolver.ts` and inserting it in the `layers` array at the correct precedence position.

---

## 16. Flag System

### Description
18 typed flags with Zod validation, 3 presets, and 6 modes. Flag types: `boolean`, `number`, `enum`, `string[]`. Modes: `enforced` (locked, cannot be overridden), `enabled` (active), `disabled` (inactive), `inherited` (from parent layer), `delegated` (deferred to agent), `conditional` (activated based on context like language or framework). Each flag has a catalog entry (`FlagSpec`) with type, default value, optional hook reference, and description. Presets (minimal/balanced/strict) provide curated flag configurations. Flags are validated with Zod schemas built dynamically from the catalog.

### Importance
Flags are the behavioral contract between Codi and AI agents. They control permissions, quality gates, and workflow constraints.

### Pros
- Strong typing with Zod prevents invalid flag values
- 18 flags cover security, quality, workflow, and context concerns
- Presets eliminate decision fatigue for common setups
- Hook integration enables automated enforcement

### Cons
- Adding new flags requires updating catalog, presets, and flag instructions
- Conditional mode increases complexity of flag resolution
- No UI for browsing or editing flags

### Status
Implemented | Tested

### Validation
1. Run `codi validate` — verify all flag values pass Zod validation
2. Set `type_checking: { mode: enabled, value: "invalid" }` in `flags.yaml`
3. Run `codi validate` — expect validation error
Expected: Invalid enum values rejected by Zod schema.

### Contributing
Files: `src/core/flags/flag-catalog.ts`, `src/core/flags/flag-presets.ts`, `src/core/flags/flag-resolver.ts`, `src/core/flags/flag-validator.ts`
How to extend: Add new flags to `FLAG_CATALOG` with type, default, and description. Update all three presets in `flag-presets.ts`. Add flag instruction text in `src/adapters/flag-instructions.ts`.

---

## 17. Verification Token

### Description
SHA256 hash of configuration content, truncated to 12 hex characters and prefixed with `codi-` (e.g., `codi-55ccfb9ed7d5`). Input includes: manifest name, sorted agent list, rule entries (name + content), skill names, agent names, and active flag instructions. The hash is content-aware: changing rule content changes the token even if rule names stay the same. Deterministic: identical configurations always produce identical tokens.

### Importance
Cryptographic fingerprint for configuration identity. Enables verification that an AI agent has loaded the correct, complete configuration.

### Pros
- Content-aware (hashes rule bodies, not just names)
- Deterministic and reproducible
- Compact 12-char format is easy to compare visually

### Cons
- 48-bit hash space has theoretical collision risk (acceptable for this use case)
- Any config change invalidates the token (no partial matching)

### Status
Implemented | Tested

### Validation
1. Run `codi verify` and note the token
2. Change a rule's content, run `codi verify` again
Expected: Token changes when content changes.

### Contributing
Files: `src/core/verify/token.ts`
How to extend: Modify the `raw` string composition in `buildVerificationData()` to include additional config elements in the hash.

---

## 18. Backup System

### Description
Automatic backup before every `generate` command. Reads `state.json` to identify previously generated files, copies them to `.codi/backups/{timestamp}/`, and writes a `backup-manifest.json` listing all backed-up files. Maximum 5 backups are retained; oldest are pruned automatically via `cleanupOldBackups()`. Timestamps use ISO format with colons/dots replaced by hyphens for filesystem compatibility. Restoration copies files from backup directory back to their original project locations.

### Importance
Provides undo capability for generation operations. Automatic creation means users never forget to back up.

### Pros
- Fully automatic, no user action required
- Manifest-tracked for reliable restoration
- Pruning prevents unbounded disk usage

### Cons
- 5-backup limit may be insufficient for rapid iteration
- Only backs up generated output, not source `.codi/` config
- No compression (stores full file copies)

### Status
Implemented | Tested

### Validation
1. Run `codi generate` multiple times
2. Check `.codi/backups/` — verify timestamped directories exist
3. Run `codi revert --list` — verify backups are discoverable
Expected: Up to 5 backup directories with manifest files.

### Contributing
Files: `src/core/backup/backup-manager.ts`
How to extend: Change `MAX_BACKUPS` constant. Add compression. Extend `BackupManifest` with metadata.

---

## 19. Audit Logging

### Description
Append-only JSONL log at `.codi/audit.jsonl`. Each entry contains `type` (generate, update, clean, init), `timestamp` (ISO 8601), and `details` (freeform object with operation-specific data like agent list, file count, or flag changes). Entries are appended via `writeAuditEntry()` using `fs.appendFile()`.

### Importance
Provides traceability for all configuration operations. Essential for compliance auditing and debugging.

### Pros
- JSONL format is machine-parseable and streamable
- Append-only design prevents data loss
- Minimal overhead (single file append per operation)

### Cons
- No log rotation or size limits
- No query interface (requires external tools to search)
- No log levels or filtering

### Status
Implemented | Tested

### Validation
1. Run `codi generate` then inspect `.codi/audit.jsonl`
2. Verify each line is valid JSON with `type`, `timestamp`, and `details`
Expected: JSONL file with one entry per operation.

### Contributing
Files: `src/core/audit/audit-log.ts`
How to extend: Add new `type` values to the `AuditEntry` type union. Include additional details in the calling code.

---

## 20. Drift Detection

### Description
Compares current file hashes against hashes stored in `state.json` at generation time. Each generated file is tracked with `sourceHash` (hash of input sources), `generatedHash` (hash of output content), and `sources` (list of input files). Detection produces three statuses: `synced` (hash matches), `drifted` (hash differs), `missing` (file deleted). Controlled by the `drift_detection` flag with three modes: `off` (disabled), `warn` (report only), `error` (non-zero exit).

### Importance
Detects when generated files are manually edited or deleted, which would cause agent behavior to diverge from configured intent.

### Pros
- Fast hash comparison (SHA256 via `hashContent()`)
- Per-file granularity with per-agent grouping
- Three modes balance strictness vs. flexibility

### Cons
- Cannot detect the cause of drift (manual edit vs. merge conflict vs. tool modification)
- Requires `state.json` from a prior generation
- Hash comparison treats any change as drift (even whitespace)

### Status
Implemented | Tested

### Validation
1. Run `codi generate` then `codi status` — expect all synced
2. Edit a generated file, run `codi status` — expect drifted
3. Delete a generated file, run `codi status` — expect missing
Expected: Accurate drift reporting per file.

### Contributing
Files: `src/core/config/state.ts`
How to extend: Add new `DriftFile` statuses. Implement content-aware diff for smarter drift analysis.

---

## 21. Claude Code Adapter

### Description
Generates `CLAUDE.md` (main instruction file with permissions and config summary), `.claude/rules/*.md` (one file per rule, no frontmatter), `.claude/skills/{name}/SKILL.md` (skill files), `.claude/agents/{name}.md` (agent files with YAML frontmatter for name, description, tools, model), and `.claude/mcp.json` (MCP server configuration). Detects presence by checking for `CLAUDE.md` or `.claude/` directory. Capabilities: rules, skills, commands, MCP, agents. Max context: 200K tokens.

### Importance
Full-featured adapter for Claude Code, the most capable target agent. Supports all Codi features including MCP and agents.

### Pros
- Complete feature support (rules, skills, commands, MCP, agents)
- Native file-per-rule format aligns with Claude Code's auto-discovery
- MCP configuration via JSON file

### Cons
- Generates many files (one per rule, skill, and agent)
- No frontmatter support (Claude Code does not use it)

### Status
Implemented | Tested

### Validation
1. Run `codi generate --agent claude-code`
2. Verify `CLAUDE.md`, `.claude/rules/`, `.claude/skills/`, `.claude/agents/` created
3. If MCP configured, verify `.claude/mcp.json` created
Expected: All Claude Code configuration files generated with correct content.

### Contributing
Files: `src/adapters/claude-code.ts`
How to extend: Add new file outputs in the `generate()` method. Update `capabilities` for new features.

---

## 22. Cursor Adapter

### Description
Generates `.cursorrules` (main instruction file with flag text and rule list), `.cursor/rules/*.mdc` (rules with YAML frontmatter including `description`, `alwaysApply`, and `globs`), and `.cursor/skills/{name}/SKILL.md` (skill files). The `.mdc` format is Cursor-specific with frontmatter metadata. Detects presence by checking for `.cursor/` directory or `.cursorrules` file. No MCP, commands, or agent support. Max context: 32K tokens.

### Importance
Enables Codi governance for Cursor users with native format support including MDC frontmatter.

### Pros
- MDC frontmatter enables scope-based rule application
- `alwaysApply` and `globs` provide fine-grained control
- Reference-based main file keeps `.cursorrules` lightweight

### Cons
- No MCP or agent support
- Lower context window (32K) limits rule volume
- `.mdc` format is non-standard outside Cursor

### Status
Implemented | Tested

### Validation
1. Run `codi generate --agent cursor`
2. Verify `.cursorrules` and `.cursor/rules/*.mdc` created
3. Check `.mdc` files contain YAML frontmatter with `description` and `alwaysApply`
Expected: Cursor-native configuration files with frontmatter.

### Contributing
Files: `src/adapters/cursor.ts`
How to extend: Add new frontmatter fields in `buildMdcFrontmatter()`. Update `capabilities` for new features.

---

## 23. Codex Adapter

### Description
Generates `AGENTS.md` (inline rules and permissions), `.agents/skills/{name}/SKILL.md` (skill files), and `.codex/agents/{name}.toml` (TOML format with `name`, `description`, `developer_instructions`, and optional `model`). Rules are inlined directly into `AGENTS.md` as sections. Skills live in `.agents/skills/` for auto-discovery. Detects by checking for `AGENTS.md` or `.agents/` directory. Max context: 200K tokens.

### Importance
Supports OpenAI's Codex agent with its TOML-based agent format and inline instruction style.

### Pros
- TOML agent format matches Codex native conventions
- Inline rules simplify single-file consumption
- Full agent support with model specification

### Cons
- No MCP support
- Inline rules make `AGENTS.md` large with many rules
- No frontmatter on rules

### Status
Implemented | Tested

### Validation
1. Run `codi generate --agent codex`
2. Verify `AGENTS.md` contains inline rule sections
3. Verify `.codex/agents/*.toml` files contain TOML agent definitions
Expected: Codex-native files generated.

### Contributing
Files: `src/adapters/codex.ts`
How to extend: Modify TOML format in the `generate()` method. Add new capability support.

---

## 24. Windsurf Adapter

### Description
Generates `.windsurfrules` (inline rules, skills, and permissions in a single file) and `.windsurf/skills/{name}/SKILL.md` (skill files). All rules and skills are concatenated into the main instruction file since Windsurf does not support file-per-rule. Detects by checking for `.windsurfrules` file. No MCP, commands, or agent support. Max context: 32K tokens.

### Importance
Enables Codi governance for Windsurf users despite the tool's simpler configuration model.

### Pros
- Single-file output is simple to manage
- Skills still get individual files for organization

### Cons
- No MCP, commands, or agent support
- All content in one file can become large
- Lower context window (32K) limits content volume
- No frontmatter or scoping

### Status
Implemented | Tested

### Validation
1. Run `codi generate --agent windsurf`
2. Verify `.windsurfrules` contains all rules and skills inline
3. Verify `.windsurf/skills/` directory contains skill files
Expected: Single instruction file with inline content.

### Contributing
Files: `src/adapters/windsurf.ts`
How to extend: Add new content sections in the `generate()` method.

---

## 25. Cline Adapter

### Description
Generates `.clinerules` (inline rules, skills, and permissions) and `.cline/skills/{name}/SKILL.md` (skill files). Identical structure to Windsurf adapter: all content concatenated into a single instruction file. Detects by checking for `.clinerules` file or `.cline/` directory. No MCP, commands, or agent support. Max context: 200K tokens.

### Importance
Extends Codi support to the Cline ecosystem with appropriate format adaptation.

### Pros
- Large context window (200K) allows extensive rule sets
- Simple single-file format
- Skill files maintain organization

### Cons
- No MCP, commands, or agent support
- No frontmatter or rule scoping
- Inline format limits granular rule management

### Status
Implemented | Tested

### Validation
1. Run `codi generate --agent cline`
2. Verify `.clinerules` contains all rules and skills inline
Expected: Single instruction file with all content.

### Contributing
Files: `src/adapters/cline.ts`
How to extend: Add new content sections in the `generate()` method.

---

## 26. Rule Templates

### Description
9 built-in rule templates covering core software engineering practices. Each template is a TypeScript module exporting markdown content with `{{name}}` placeholders. Templates: `security` (secret management, input validation, OWASP), `code-style` (naming, function size, organization), `testing` (TDD, coverage, AAA pattern), `architecture` (modules, dependencies, SOLID), `git-workflow` (conventional commits, branching), `error-handling` (typed errors, logging, resilience), `performance` (N+1 prevention, caching, async), `documentation` (API docs, README, ADRs), `api-design` (REST conventions, versioning, pagination).

### Importance
Curated best practices that can be applied immediately. Reduces the effort of writing rules from scratch.

### Pros
- 9 templates cover most engineering discipline areas
- Consistent format and depth across all templates
- Template placeholders allow name customization

### Cons
- Opinionated content may not match all team preferences
- No parameterization beyond `{{name}}`
- Templates are English-only

### Status
Implemented | Tested

### Validation
1. Run `codi add rule --template security` — verify content matches security template
2. Run `codi add rule --all` — verify all 9 templates scaffolded
Expected: Rule files created with template content.

### Contributing
Files: `src/templates/rules/security.ts`, `src/templates/rules/code-style.ts`, `src/templates/rules/testing.ts`, `src/templates/rules/architecture.ts`, `src/templates/rules/git-workflow.ts`, `src/templates/rules/error-handling.ts`, `src/templates/rules/performance.ts`, `src/templates/rules/documentation.ts`, `src/templates/rules/api-design.ts`, `src/templates/rules/index.ts`
How to extend: Create a new `.ts` file in `src/templates/rules/`, export the template string, and register it in `index.ts`.

---

## 27. Skill Templates

### Description
5 built-in skill templates providing reusable capabilities for AI agents. Templates: `mcp` (Model Context Protocol integration), `code-review` (automated review and feedback), `documentation` (doc generation and maintenance), `rule-management` (rule creation and lifecycle), `e2e-testing` (end-to-end testing workflows). Each template exports markdown content following the `SKILL.md` format convention.

### Importance
Skills extend agent capabilities beyond rules. Templates provide proven patterns for common automation tasks.

### Pros
- Cover key automation scenarios (review, docs, testing)
- MCP template enables Model Context Protocol integration
- Consistent SKILL.md format across all templates

### Cons
- 5 templates is a limited starting set
- No parameterization or configuration options within templates
- Skill capabilities vary significantly by agent

### Status
Implemented | Tested

### Validation
1. Run `codi add skill --template code-review` — verify SKILL.md created
2. Run `codi add skill --all` — verify all 5 skill templates scaffolded
Expected: Skill files created in `.codi/skills/`.

### Contributing
Files: `src/templates/skills/mcp.ts`, `src/templates/skills/code-review.ts`, `src/templates/skills/documentation.ts`, `src/templates/skills/rule-management.ts`, `src/templates/skills/e2e-testing.ts`, `src/templates/skills/index.ts`
How to extend: Create a new `.ts` file in `src/templates/skills/`, export the template string, and register it in `index.ts`.

---

## 28. Agent Templates

### Description
3 built-in agent templates defining specialized AI agent personas. Templates: `code-reviewer` (automated code review agent), `test-generator` (test creation agent), `security-analyzer` (security analysis agent). Each template exports markdown content with frontmatter (name, description, tools, model) following the agent definition format. Agents are generated differently per adapter: Claude Code uses `.md` with YAML frontmatter, Codex uses `.toml` format.

### Importance
Agents represent specialized AI capabilities that can be deployed alongside general-purpose rules and skills.

### Pros
- Pre-built personas for common development workflows
- Adapter-aware output format (MD vs TOML)
- Include tool and model specifications

### Cons
- Only 3 templates available
- Agent support varies by adapter (only Claude Code and Codex)
- No runtime validation of agent tool availability

### Status
Implemented | Tested

### Validation
1. Run `codi add agent --template code-reviewer` — verify agent file created
2. Run `codi generate` — verify agent appears in adapter-specific format
Expected: Agent definition created in `.codi/agents/` and generated in target format.

### Contributing
Files: `src/templates/agents/code-reviewer.ts`, `src/templates/agents/test-generator.ts`, `src/templates/agents/security-analyzer.ts`, `src/templates/agents/index.ts`
How to extend: Create a new `.ts` file in `src/templates/agents/`, export the template string, and register it in `index.ts`.

---

## 29. Artifact Ownership

### Description
Every rule, skill, and agent file can carry a `managed_by` frontmatter field with two values: `codi` (template-managed, eligible for automatic updates) or `user` (custom content, never overwritten). The `update` command's artifact refresh logic checks this field before modifying any file: `managed_by: codi` files are refreshed from the latest template version; `managed_by: user` files are skipped entirely. The same ownership model applies during `--from` pulls from remote repositories. Scaffolders set `managed_by` appropriately when creating files from templates vs. blank.

### Importance
Prevents Codi from overwriting custom configurations while enabling automatic updates for template-managed artifacts.

### Pros
- Clear ownership boundary between Codi and user content
- Consistent model across rules, skills, and agents
- Frontmatter-based: visible and editable by users

### Cons
- No intermediate ownership level (e.g., "merge" mode)
- Changing ownership requires manual frontmatter edit
- No enforcement mechanism if frontmatter is removed

### Status
Implemented | Tested

### Validation
1. Create a rule with `--template security` — verify `managed_by: codi` in frontmatter
2. Create a blank rule — verify `managed_by: user` in frontmatter
3. Run `codi update --rules` — verify codi-managed rules updated, user rules skipped
Expected: Ownership respected during all update operations.

### Contributing
Files: `src/core/scaffolder/rule-scaffolder.ts`, `src/core/scaffolder/skill-scaffolder.ts`, `src/core/scaffolder/agent-scaffolder.ts`, `src/cli/update.ts`
How to extend: Add new ownership levels to the `managed_by` check in update handlers.

---

## 30. One-Way Pull Model

### Description
`codi update --from <repo>` performs a read-only clone of a remote Git repository (shallow, `--depth 1`), reads `.codi/` artifacts (rules, skills, agents), and copies `managed_by: codi` files to the local project. User-managed local files are never overwritten. The remote is never written to. Temporary clone is created in `os.tmpdir()` and cleaned up after operation. Supports any GitHub repository path format (e.g., `org/team-config`). Constructs HTTPS URL from the short-form repo path.

### Importance
Enables centralized governance: a team or organization maintains a canonical `.codi/` configuration, and individual projects pull updates from it.

### Pros
- Read-only: never modifies the remote repository
- Respects `managed_by` ownership during pull
- Shallow clone minimizes bandwidth and disk usage
- Works with any Git repository

### Cons
- Requires Git CLI on the system
- Only supports GitHub HTTPS URLs (constructed from `org/repo` format)
- No conflict detection or merge strategy
- No version pinning (always pulls from HEAD)

### Status
Implemented | Tested

### Validation
1. Create a central config repo with `.codi/rules/custom/security.md` (managed_by: codi)
2. Run `codi update --from org/config-repo` in a project
3. Verify the rule was copied locally
4. Create a local `managed_by: user` file with the same name — re-run pull
Expected: User-managed local file preserved; codi-managed files updated from remote.

### Contributing
Files: `src/cli/update.ts` (function `pullFromSource`)
How to extend: Add support for non-GitHub remotes. Implement version pinning via branch/tag parameters. Add conflict resolution strategies.

---

## 31. Preset System

### Description
Presets are composable configuration packages containing flags + rules + skills + agents + commands + MCP config. They enable teams to share reusable project setups across projects.

**Commands:**
- `codi preset create <name>` — scaffolds `.codi/presets/{name}/` with `preset.yaml` + artifact subdirs
- `codi preset list` — shows installed presets with name and description
- `codi preset install <name> --from <repo>` — installs preset from Git repository
- `codi preset search <query>` — searches preset registry by name/tags/description
- `codi preset update` — checks installed presets against registry for newer versions (`--dry-run` supported)

**Preset format:**
```
preset-name/
  preset.yaml        # name, description, version, extends, tags, flags
  rules/             # Rule markdown files
  skills/            # Skill markdown files
  agents/            # Agent markdown files
  commands/          # Command markdown files
  mcp.yaml           # MCP server config
```

**Resolution:** `org → team → presets → repo → lang → framework → agent → user`. Presets applied in order from `presets:` array in manifest.

**Lock file:** `.codi/preset-lock.json` tracks installed versions for reproducible builds.

**Extends:** Presets can inherit from other presets via `extends: balanced` in `preset.yaml`.

### Importance
Enables multi-tenant team configuration. A React+TypeScript project and a Python+FastAPI project can each use different preset bundles without manual rule configuration.

### Pros
- Composable — multiple presets applied in order
- Full artifact packages (not just flags)
- Built-in presets still work (minimal/balanced/strict)
- Lock file for reproducibility
- Extends for inheritance

### Cons
- Registry requires external Git repo
- No official public registry yet
- Version conflicts between presets resolved by last-wins

### Status
Implemented (Phase 1 MVP + Phase 2 Registry)

### Validation
1. `codi preset create my-setup` — creates preset directory
2. Add rules/skills to the preset directory
3. Add `presets: [my-setup]` to `codi.yaml`
4. `codi generate` — preset artifacts appear in generated output
5. `codi preset list` — shows the preset

### Contributing
Files: `src/cli/preset.ts`, `src/core/preset/preset-loader.ts`, `src/core/preset/preset-registry.ts`, `src/schemas/preset.ts`
Add new preset subcommands in `src/cli/preset.ts`. Preset loading logic in `preset-loader.ts`. Registry operations in `preset-registry.ts`.

---

## 32. MCP HTTP Transport

### Description
MCP schema supports both stdio (command + args) and HTTP (type + url) transports. HTTP transport enables cloud-hosted MCP servers like documentation APIs.

### Importance
Enables integration with remote MCP servers (OpenAI docs, Anthropic docs) without local processes.

### Pros
- Supports both local (stdio) and remote (HTTP) MCP servers
- Compatible with official doc MCPs from OpenAI and Anthropic
- Distributed to all 4 agents that support MCP

### Cons
- HTTP servers require network access
- No authentication support beyond URL-based auth

### Status
Implemented

### Validation
1. Add HTTP server to `.codi/mcp.yaml`: `servers: { docs: { type: http, url: "https://..." } }`
2. `codi generate` — `.claude/mcp.json` contains the HTTP server
3. Verify `.cursor/mcp.json`, `.codex/mcp.toml`, `.windsurf/mcp.json` also generated

### Contributing
Files: `src/schemas/mcp.ts`, `src/types/config.ts` (McpConfig), adapters that generate MCP files.

---

## 33. Path Safety Guard

### Description
`isPathSafe()` utility prevents path traversal attacks in clean, backup, and restore operations. Validates that resolved paths stay within the project root.

### Importance
Critical security measure. Without it, crafted state.json or backup manifests could delete or overwrite files outside the project.

### Pros
- Prevents arbitrary file access via ../ segments
- Applied to clean, backup, and restore operations
- Shared utility — single implementation

### Cons
- Only validates at file operation time, not at config parse time

### Status
Implemented

### Validation
A state.json with `../../.ssh/config` path → clean skips it with warning.

### Contributing
Files: `src/utils/path-guard.ts`. Import and use before any file read/write that uses paths from state.json or backup manifests.
