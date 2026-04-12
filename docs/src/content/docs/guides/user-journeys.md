---
title: User Journeys
description: Step-by-step guides for every Codi scenario — first setup, updating, preset management, CI integration, migration, debugging, and more.
sidebar:
  order: 2
---

All documented user journeys in the Codi framework. Each journey describes a concrete scenario: who the user is, what they want, the exact commands to run, and what to expect.

---

## Table of Contents

1. [First-Time Setup](#1-first-time-setup)
2. [Re-initialize with a Different Preset](#2-re-initialize-with-a-different-preset)
3. [Non-Interactive Setup for CI](#3-non-interactive-setup-for-ci)
4. [Generate Agent Configs](#4-generate-agent-configs)
5. [Watch for Changes and Auto-Regenerate](#5-watch-for-changes-and-auto-regenerate)
6. [Add a Rule](#6-add-a-rule)
7. [Add a Skill](#7-add-a-skill)
8. [Add an Agent](#8-add-an-agent)
9. [Add an MCP Server](#9-add-an-mcp-server)
10. [Add a Brand](#10-add-a-brand)
11. [Check Drift Status](#11-check-drift-status)
12. [Update Artifacts to Latest Templates](#12-update-artifacts-to-latest-templates)
13. [Reset Flags to a Preset](#13-reset-flags-to-a-preset)
14. [Pull Centralized Artifacts from a GitHub Repo](#14-pull-centralized-artifacts-from-a-github-repo)
15. [Upgrade the Codi CLI and Refresh Everything](#15-upgrade-the-codi-cli-and-refresh-everything)
16. [Create a Custom Preset](#16-create-a-custom-preset)
17. [Install a Preset from GitHub or ZIP](#17-install-a-preset-from-github-or-zip)
18. [Search the Preset Registry](#18-search-the-preset-registry)
19. [Update Installed Presets](#19-update-installed-presets)
20. [Export a Preset as ZIP](#20-export-a-preset-as-zip)
21. [Remove a Preset](#21-remove-a-preset)
22. [Validate a Preset](#22-validate-a-preset)
23. [Check Project Health](#23-check-project-health)
24. [Validate Configuration](#24-validate-configuration)
25. [Full Compliance Check](#25-full-compliance-check)
26. [Verify Agent Loaded the Config](#26-verify-agent-loaded-the-config)
27. [Export a Skill for Distribution](#27-export-a-skill-for-distribution)
28. [Review Skill Feedback](#28-review-skill-feedback)
29. [View Skill Performance Stats](#29-view-skill-performance-stats)
30. [Evolve a Skill from Feedback](#30-evolve-a-skill-from-feedback)
31. [Manage Skill Versions](#31-manage-skill-versions)
32. [Contribute Artifacts via PR or ZIP](#32-contribute-artifacts-via-pr-or-zip)
33. [Clean Generated Files](#33-clean-generated-files)
34. [Revert to a Previous Backup](#34-revert-to-a-previous-backup)
35. [Adopt Codi in an Existing Project (Migration)](#35-adopt-codi-in-an-existing-project-migration)
36. [Debug Configuration Issues](#36-debug-configuration-issues)
37. [Run Codi in a CI Pipeline](#37-run-codi-in-a-ci-pipeline)
38. [Launch the Interactive Command Center](#38-launch-the-interactive-command-center)
39. [Set Up an AI Agent to Initialize Codi](#39-set-up-an-ai-agent-to-initialize-codi)

---

## 1. First-Time Setup

**Situation:** You have a new project and no `.codi/` directory. You want to set up Codi and get AI agent config files generated.

```bash
npm install -g codi-cli@latest
codi init
codi generate
```

**What the wizard does:**

1. Detects your tech stack (TypeScript, Python, Go, etc.)
2. Detects which AI agents are installed on your machine (Claude Code, Cursor, etc.)
3. Asks you to choose a preset or build a custom selection of rules, skills, agents, and MCP servers
4. Creates `.codi/` with all selected artifacts
5. Writes `flags.yaml`, `state.json`, and `.artifact-manifest.yaml`
6. Generates `CLAUDE.md`, `.cursorrules`, `AGENTS.md`, `.windsurfrules`, `.clinerules`
7. Installs pre-commit hooks into `.git/hooks/` (or Husky, if present)

**What you commit:**

Both the `.codi/` source directory and the generated agent config files. Agents read the generated files from the repository.

**Conflict resolution (interactive terminal):**

If generated files (`CLAUDE.md`, `.cursorrules`, etc.) have local changes, Codi shows a per-file diff and prompts:
- Accept incoming (overwrite local)
- Keep current (skip this file)
- Merge (interactive hunk-by-hunk in terminal)
- Merge in editor (opens `$EDITOR` or VS Code)
- Accept ALL / Keep ALL (bulk options)

**Non-interactive / CI conflict strategy:**

Use `--on-conflict` to skip the prompt:
```bash
codi init --preset codi-balanced --agents claude-code --on-conflict keep-current   # keep your files (default)
codi init --preset codi-balanced --agents claude-code --on-conflict keep-incoming  # overwrite with new versions
```
`--force` is an alias for `--on-conflict keep-incoming`.

**Gotchas:**

- Hooks require a git repository. Run `git init` first if the project is not yet a repo.
- Use `codi init --force` to reinitialize an existing `.codi/` directory (overwrites everything).

---

## 2. Re-initialize with a Different Preset

**Situation:** You set up Codi with `codi-minimal` but now want stricter rules. You want to switch presets.

```bash
codi init --force --preset codi-strict
```

**What happens:**

- Loads the existing `.codi/` directory (does not delete it)
- Resets `flags.yaml` to the `codi-strict` preset values
- Overwrites existing preset artifacts with the new preset versions (no prompting with `--force`)
- Regenerates all agent config files

**Gotchas:**

- Without `--force`, the command runs but skips existing `.codi/` artifacts (shows warnings). Use `--force` to overwrite them.
- Custom artifacts you added (not from a preset template) are always preserved — they are not part of any preset's artifact list, so `--force` does not affect them.
- Flags already marked `locked: true` cannot be overridden.
- Use `--on-conflict keep-incoming` instead of `--force` when you want to overwrite only the generated agent files but not the `.codi/` artifacts.

---

## 3. Non-Interactive Setup for CI

**Situation:** You want to automate Codi setup in a CI pipeline or a bootstrap script with no user input.

```bash
codi init --preset codi-balanced --agents claude-code cursor
```

**What happens:**

- Skips the wizard entirely
- Creates `.codi/` with the `codi-balanced` preset
- Generates configs for Claude Code and Cursor only
- Exits with code `0` on success, non-zero on error

**Options:**

| Flag | Purpose |
|:-----|:--------|
| `--preset <name>` | Required — which preset to use |
| `--agents <agents...>` | Required — which agents to generate for |
| `--json` | Machine-readable output |
| `--quiet` | Suppress progress and info log messages |
| `--force` | Reinitialize even if `.codi/` exists |

**Gotchas:**

- Both `--preset` and `--agents` are required to bypass the wizard fully.
- Pre-commit hooks still install if the preset enables them.

---

## 4. Generate Agent Configs

**Situation:** You changed something in `.codi/` and want to regenerate your agent config files.

```bash
codi generate
```

**What happens:**

1. Reads `.codi/` as the single source of truth (flags, rules, skills, agents, MCP servers)
2. Passes the result through adapters for each detected agent
3. Backs up existing generated files to `.codi/backups/{timestamp}/`
5. Writes new `CLAUDE.md`, `.cursorrules`, `AGENTS.md`, etc.
6. Updates `state.json` with new hashes
7. Re-installs pre-commit hooks

**Options:**

| Flag | Purpose |
|:-----|:--------|
| `--agent <agents...>` | Generate for specific agents only |
| `--dry-run` | Preview changes without writing |
| `--force` | Regenerate even if files are unchanged |

**Gotchas:**

- Generated files are owned by Codi. Manual edits show as "drifted" on `codi status`.
- Each agent only gets the artifact types it supports. Skills, for example, do not generate into Cursor's config.

---

## 5. Watch for Changes and Auto-Regenerate

**Situation:** You are actively editing `.codi/` rules or skills and want agent configs to update automatically.

```bash
codi watch
```

**What happens:**

- Watches the `.codi/` directory for file changes
- Debounces 500ms and runs `codi generate` on each change
- Continues until you press `Ctrl+C`

**Options:**

| Flag | Purpose |
|:-----|:--------|
| `--once` | Run one generation pass and exit (useful in scripts) |

**Requirement:**

The `auto_generate_on_change` flag must be enabled in `flags.yaml`. If it is not, the command warns and exits.

**Gotchas:**

- Does not watch generated files — only `.codi/` — to prevent infinite loops.
- Changes to `state.json` and `operations.json` are ignored.

---

## 6. Add a Rule

**Situation:** You want to enforce a new coding standard, security policy, or workflow guideline across all AI agents.

```bash
# From a built-in template:
codi add rule my-api-security --template codi-security

# Blank rule:
codi add rule my-custom-rule

# Add all available rule templates at once:
codi add rule --all
```

**What happens:**

1. Loads the selected template (or creates a blank frontmatter file)
2. Injects the rule name into the template
3. Writes `.codi/rules/<name>.md`
4. Runs `codi generate` automatically

**Gotchas:**

- The rule file name must match the `name` field in the frontmatter.
- If a rule with that name already exists, the command exits with an error. Delete the file first or use a different name.
- Rules managed by Codi have `managed_by: codi` in frontmatter. Do not remove this field — it controls update behavior.

---

## 7. Add a Skill

**Situation:** You want to add a reusable capability (a workflow guide, a process document, or an API integration pattern) that AI agents can invoke by name.

```bash
# From a template:
codi add skill my-deploy-guide --template codi-doc-engine

# Blank skill:
codi add skill my-skill

# Add all skill templates:
codi add skill --all
```

**What happens:**

1. Creates `.codi/skills/<name>/` directory
2. Copies `SKILL.md` and any bundled resource files into it
3. Injects the skill name into `SKILL.md` frontmatter
4. Runs `codi generate` automatically

**Gotchas:**

- Skills are directories, not single files. The `SKILL.md` file must exist at the root of the directory.
- Resource files (JSON, YAML, markdown references) are copied as-is.
- Skills only generate into agents that support them (currently: Claude Code, Cursor, Codex, Windsurf, Cline).

---

## 8. Add an Agent

**Situation:** You want to add a custom AI sub-agent definition that your main agent can invoke for specialized tasks.

```bash
# From a template:
codi add agent my-reviewer --template codi-code-reviewer

# Blank:
codi add agent my-agent

# Add all agent templates:
codi add agent --all
```

**What happens:**

1. Loads the selected template or creates a blank definition
2. Writes `.codi/agents/<name>.md`
3. Runs `codi generate` automatically

**Gotchas:**

- Not all AI platforms support sub-agent delegation. Custom agents generate primarily for Claude Code and Codex.

---

## 9. Add an MCP Server

**Situation:** You want to connect an external tool (GitHub, Neon DB, Stripe, etc.) to your AI agent via the Model Context Protocol.

```bash
# From a template:
codi add mcp-server github --template github

# Blank:
codi add mcp-server my-internal-api

# Add all MCP templates:
codi add mcp-server --all
```

**What happens:**

1. Loads the MCP server template (YAML structure with name, command, args, env, URL, headers)
2. Writes `.codi/mcp-servers/<name>.yaml` with `managed_by: codi`
3. Runs `codi generate` to wire the MCP server into `.mcp.json`, `.cursor/mcp.json`, etc.

**Gotchas:**

- MCP servers are YAML files, not Markdown.
- Only Claude Code, Cursor, and Codex fully support MCP.
- The `managed_by: codi` field is how `codi update --mcp-servers` knows which servers to refresh. Do not remove it.

---

## 10. Add a Brand

**Situation:** You want to define a brand identity (colors, fonts, logo, voice) that content-generation skills can reference.

```bash
codi add brand my-company
```

**What happens:**

- Creates `.codi/skills/<name>/` using the `brand-creator` skill template
- Injects the brand name into `SKILL.md` frontmatter and description
- Brand tokens (colors, fonts, voice guidelines) are defined inside the skill directory

**Gotchas:**

- Brand output depends on the skill that reads the brand tokens.
- Brands are skills, not YAML config files. They do not generate into agent config files directly.

---

## 11. Check Drift Status

**Situation:** You want to know if any generated agent config files have been edited manually or are out of sync with `.codi/`.

```bash
codi status

# Show content diffs for drifted files:
codi status --diff
```

**What you see:**

- A table: agent | file | status (synced / drifted / missing)
- With `--diff`: the actual content difference between what is on disk and what Codi would generate

**Gotchas:**

- Drift detection can be configured in `flags.yaml` (`drift_detection` flag).
- `--diff` only shows diffs for preset-sourced artifacts. Custom rules may not have a reference source.

---

## 12. Update Artifacts to Latest Templates

**Situation:** A new version of Codi ships with improved rule, skill, or agent templates. You want to pull those improvements into your project.

```bash
# Update everything:
codi update --rules --skills --agents --mcp-servers

# Preview first:
codi update --rules --skills --agents --mcp-servers --dry-run

# Accept all changes without prompting:
codi update --rules --skills --agents --mcp-servers --force
```

**What happens:**

1. For each artifact in `.codi/rules/`, `.codi/skills/`, `.codi/agents/`, `.codi/mcp-servers/`:
   - Checks if it is `managed_by: codi`
   - Compares current content to the latest template
   - If different: shows a conflict resolution prompt (keep / accept / merge)
2. Writes accepted changes
3. Runs `codi generate` automatically
4. Updates `artifact-manifest.json` and `preset-lock.json`
5. Writes an audit log entry

**What is skipped:**

- Artifacts with `managed_by: <anything else>` — those are yours; Codi does not touch them.
- Artifacts that are already identical to the latest template.

**Gotchas:**

- There is no `--all` shorthand yet. You must pass all four flags manually.
- `--force` accepts all incoming changes without prompting. Use it carefully if you have customized any managed artifacts.

---

## 13. Reset Flags to a Preset

**Situation:** A new Codi release updated the recommended flag defaults for a preset, or you want to switch strictness level.

```bash
codi update --preset codi-strict
```

**What happens:**

- Rewrites `flags.yaml` entirely with the preset's flag values
- For user-installed (non-builtin) presets: also re-applies that preset's artifacts with conflict resolution
- Runs `codi generate` automatically

**Gotchas:**

- This overwrites your current flag customizations.
- Flags already marked `locked: true` in the preset cannot be overridden by later operations.

---

## 14. Pull Centralized Artifacts from a GitHub Repo

**Situation:** Your team maintains a shared GitHub repo with centralized rules and skills. You want to pull the latest versions into your project.

```bash
codi update --from owner/shared-codi-config
```

**What happens:**

1. Clones the GitHub repo (shallow, depth 1) to a temp directory
2. Reads `.codi/rules/`, `.codi/skills/`, `.codi/agents/` from the cloned repo
3. For each file with `managed_by: codi`: compares to your local version, runs conflict resolution
4. Writes accepted changes
5. Runs `codi generate`
6. Removes the temp clone

**Gotchas:**

- Requires `git` installed and network access.
- Only files with `managed_by: codi` in their frontmatter are pulled.
- Your custom artifacts are never touched.

---

## 15. Upgrade the Codi CLI and Refresh Everything

**Situation:** A new version of `codi-cli` was published. You want to update both the tool and all your managed artifacts.

```bash
# Step 1: update the CLI
npm install -g codi-cli@latest

# Step 2: update all managed artifacts to new templates
codi update --rules --skills --agents --mcp-servers

# Step 3: verify everything is healthy
codi doctor
```

**Why two steps:**

Installing the new CLI does not automatically update the artifacts in your project's `.codi/` directory. `codi update` reads the new template versions that shipped with the CLI and syncs your local copies.

**Gotchas:**

- No "new version available" banner appears when running Codi commands. Check npm manually or use Dependabot / Renovate.
- Major version releases may introduce breaking changes that require `codi init --force` rather than just `codi update`.

---

## 16. Create a Custom Preset

**Situation:** You have refined your project's `.codi/` config and want to snapshot it as a reusable preset you can apply to other projects.

```bash
codi preset create my-team-preset
```

**What happens:**

1. Scans `.codi/rules/`, `.codi/skills/`, `.codi/agents/`
2. Copies all artifacts to `.codi/presets/my-team-preset/`
3. Copies `flags.yaml` into the preset directory
4. Generates `preset.yaml` manifest

**What you get:**

- `.codi/presets/my-team-preset/` — a self-contained directory you can export or share

**Next step:**

Export the preset as a ZIP to share: `codi preset export my-team-preset`

---

## 17. Install a Preset from GitHub or ZIP

**Situation:** A colleague shared a preset ZIP, or you found a preset on GitHub. You want to install it in your project.

```bash
# From a GitHub repo:
codi preset install https://github.com/owner/presets

# From a ZIP file:
codi preset install /path/to/my-team-preset.zip

# From a registry name:
codi preset install awesome-preset
```

**What happens:**

1. Downloads or extracts the preset to a temp directory
2. Validates `preset.yaml` structure
3. Runs a security scan — warns about suspicious patterns
4. Copies to `.codi/presets/<name>/`
5. Updates `presets.lock.json` with source and version
6. Logs the operation

**Gotchas:**

- Security scan warnings require your confirmation before installation proceeds.
- Installing a preset does not apply it. To apply the artifacts and flags, run: `codi update --preset <name>`
- Source is recorded in the lock file so `codi preset update` can check for new versions.

---

## 18. Search the Preset Registry

**Situation:** You want to discover community presets by keyword.

```bash
codi preset search "nextjs typescript"
```

**What you see:**

- Matched preset names, versions, descriptions, and tags from the registry

---

## 19. Update Installed Presets

**Situation:** The presets you installed from the registry have new versions. You want to pull the updates.

```bash
codi preset update

# Preview without applying:
codi preset update --dry-run
```

**What happens:**

1. Reads `presets.lock.json` for all installed presets and their sources
2. Queries the registry for the latest version of each
3. For presets with new versions: runs a security scan, applies artifact changes with conflict resolution, updates the lock file

---

## 20. Export a Preset as ZIP

**Situation:** You want to share a preset with someone who does not use the registry.

```bash
codi preset export my-team-preset

# Save to a specific directory:
codi preset export my-team-preset --output /path/to/share/
```

**What you get:**

- `my-team-preset.zip` containing the full preset directory — importable with `codi preset install`

---

## 21. Remove a Preset

**Situation:** You no longer use a preset and want to remove it from the project.

```bash
codi preset remove my-old-preset
```

**What happens:**

- Deletes `.codi/presets/my-old-preset/`
- Removes the entry from `presets.lock.json`
- Logs the operation

**Note:** Removing a preset does not remove the artifacts that were applied from it. Those live in `.codi/rules/`, `.codi/skills/`, etc.

---

## 22. Validate a Preset

**Situation:** You built a preset and want to check it is valid before sharing.

```bash
codi preset validate my-team-preset
```

**What is checked:**

- `preset.yaml` exists and parses
- Required fields are present: `name`, `version`, `artifacts`
- All referenced artifact files exist inside the preset directory

---

## 23. Check Project Health

**Situation:** Something seems wrong — configs look off, hooks are not running, or you want a general health check before a release.

```bash
codi doctor

# For CI: fail the pipeline on any issue
codi doctor --ci
```

**What is checked:**

| Check | What it looks for |
|:------|:-----------------|
| Version match | CLI version vs. project pin in manifest |
| Generated files | Exist, are readable, match source hashes |
| Drift status | Any generated file changed outside of Codi |
| File size | Warn if any generated file exceeds 1 MB |
| Documentation sync | Doc stamp up to date (if docs enabled) |
| Pre-commit hooks | Hooks installed and executable |

**Gotchas:**

- `--ci` flag causes a non-zero exit on any failure or warning, which fails the pipeline.
- Hook warnings are informational in normal mode; they are failures in `--ci` mode.

---

## 24. Validate Configuration

**Situation:** You edited `flags.yaml` or a rule file and want to check for schema errors before regenerating.

```bash
codi validate
```

**What is checked:**

- `flags.yaml` parses and all flag keys match the known schema
- Every rule `.md` has valid frontmatter (name, description, managed_by fields)
- Every skill `SKILL.md` has valid frontmatter
- Every agent `.md` has valid frontmatter
- No single generated output would exceed 1 MB

**Exit code:** `0` if valid, `1` if any error found.

---

## 25. Full Compliance Check

**Situation:** You want a single command that covers validation, health, drift, and artifact counts before a release.

```bash
codi compliance

# For CI:
codi compliance --ci
```

**What you see:**

- Config valid: yes/no
- Version match: current vs. expected
- Drift status: number of drifted files
- Artifact counts: rules / skills / agents / flags enabled
- Verification token: a hash of the current config state

---

## 26. Verify Agent Loaded the Config

**Situation:** You want to confirm that your AI agent has actually loaded and is using the config you generated.

```bash
# Step 1: get your verification token
codi verify

# Step 2: ask the agent in the chat:
# "Run codi verify and paste the output here"

# Step 3: check the agent's response
codi verify --check "<agent response text>"
```

**What the token is:**

A deterministic hash of your active rules, skills, and enabled flags. If the agent reports the same token, its config matches yours exactly.

**Gotchas:**

- The token changes any time you add, remove, or edit an artifact or flag.
- The agent must report exact artifact names and the token for the check to pass.

---

## 27. Export a Skill for Distribution

**Situation:** You built a skill that others on your team or community would find useful.

```bash
codi skill export my-deploy-guide

# Choose format and output path:
codi skill export my-deploy-guide --format standard --output ./exports/

# Interactive wizard:
codi skill export --interactive
```

**What you get:**

- An archive of the skill directory, importable via `codi add skill --template <path>`

---

## 28. Review Skill Feedback

**Situation:** Claude Code's skill-observer hook has been collecting observations from your sessions. You want to review them.

```bash
codi skill feedback

# Filter by skill:
codi skill feedback --skill codi-commit

# Limit entries shown:
codi skill feedback --limit 10
```

**What you see:**

- Feedback entries: timestamp | skill name | category | observation text
- Observations come from `[CODI-OBSERVATION: ...]` markers emitted by the agent during sessions

---

## 29. View Skill Performance Stats

**Situation:** You want a summary of which skills are used most and which have the most correction feedback.

```bash
# Summary for all skills:
codi skill stats

# Detail for one skill:
codi skill stats codi-debugging
```

**What you see:**

- Usage count, feedback count, error rate, and a quality signal per skill

---

## 30. Evolve a Skill from Feedback

**Situation:** A skill has accumulated feedback and you want to generate an LLM prompt to improve it.

```bash
# Generate an improvement prompt:
codi skill evolve codi-debugging

# Preview without saving a new version:
codi skill evolve codi-debugging --dry-run
```

**What happens:**

1. Reads feedback entries for the skill
2. Analyzes failure patterns
3. Generates an improvement prompt you can paste into Claude
4. If not `--dry-run`: saves the current `SKILL.md` as a versioned backup (`SKILL.md.v2`, etc.)

---

## 31. Manage Skill Versions

**Situation:** You updated a skill and want to compare it to an old version, or roll back.

```bash
# List all saved versions:
codi skill versions codi-debugging

# Show diff between version 1 and version 2:
codi skill versions codi-debugging --diff "1,2"

# Restore version 1:
codi skill versions codi-debugging --restore 1
```

**What happens on restore:**

- Copies the selected version back to `SKILL.md`
- Does NOT run `codi generate` automatically. Run it manually after verifying the restored content.

---

## 32. Contribute Artifacts via PR or ZIP

**Situation:** You built rules, skills, or a preset that you want to share back to the official Codi repository or a team repository.

```bash
# Interactive (prompts for what to contribute and where):
codi contribute

# Target a specific repo:
codi contribute --repo owner/repo --branch develop
```

**What happens:**

1. Lists all artifacts in `.codi/` and asks which to include
2. Validates selected artifacts against the schema
3. Asks: PR or ZIP?

**If PR:**
- Checks GitHub CLI (`gh`) authentication
- Clones target repo and creates a branch
- Packages artifacts into a preset structure
- Creates a PR from your fork to the target repo

**If ZIP:**
- Bundles selected artifacts into a portable ZIP
- Saves to your project root

**Gotchas:**

- PR workflow requires `gh` CLI installed and authenticated (`gh auth login`).
- The ZIP format is a valid preset — it can be installed with `codi preset install`.

---

## 33. Clean Generated Files

**Situation:** You want to remove all generated agent config files, or fully uninstall Codi from a project.

```bash
# Remove generated files only (.codi/ stays):
codi clean

# Full uninstall (.codi/ removed):
codi clean --all

# Preview what would be deleted:
codi clean --dry-run
```

**What is removed by `codi clean`:**

- `CLAUDE.md`, `.cursorrules`, `AGENTS.md`, `.windsurfrules`, `.clinerules`
- Agent subdirectories: `.claude/`, `.cursor/`, `.codex/`, `.windsurf/`, `.cline/`
- Empty parent directories

**What is additionally removed by `codi clean --all`:**

- `.codi/` directory (source config, artifacts, backups, audit logs)
- Pre-commit hook files

**Gotchas:**

- `codi clean` (without `--all`) keeps `.codi/`, so you can run `codi generate` again at any time.
- `codi clean --all` is a full uninstall and cannot be undone without a backup.

---

## 34. Revert to a Previous Backup

**Situation:** You ran `codi generate` and the output is wrong. You want to restore the previous state.

```bash
# List available backups:
codi revert --list

# Restore the most recent backup:
codi revert --last

# Restore a specific backup:
codi revert --backup 2026-04-12T18:30:00Z
```

**What happens:**

- Copies agent config files from `.codi/backups/{timestamp}/` back to the project root
- Runs `codi generate` after restore to ensure consistency

**Note:** Codi creates a backup before every `codi generate` run. Backups are timestamped ISO strings.

---

## 35. Adopt Codi in an Existing Project (Migration)

**Situation:** You have a project with an existing `CLAUDE.md` or `.cursorrules`. You want to bring it under Codi management without losing your current config.

**Recommended steps:**

```bash
# 1. Back up existing configs
cp CLAUDE.md CLAUDE.md.backup

# 2. Initialize Codi
codi init

# 3. Review conflicts — keep your existing content where it matters
# (the conflict resolver prompts file by file)

# 4. Move any custom rules you had in CLAUDE.md into .codi/rules/
codi add rule my-existing-rule

# 5. Paste or retype the content into .codi/rules/my-existing-rule.md

# 6. Regenerate
codi generate

# 7. Check the result
codi status
```

**What Codi handles automatically:**

- Detects old template name mappings (e.g., `code-quality` → `codi-code-style`) during `codi update`
- Preserves any artifact with `managed_by: <anything other than codi>` — those are yours

**Gotchas:**

- Codi will overwrite `CLAUDE.md` during `codi generate`. Put your custom rules in `.codi/rules/` before the first generate, or use the conflict resolver during `codi init`.

---

## 36. Debug Configuration Issues

**Situation:** Something is not working right — rules are not being applied, hooks are failing, or configs look unexpected.

**Start here:**

```bash
# 1. Check schema errors
codi validate

# 2. Check file health and drift
codi doctor

# 3. See what changed
codi status --diff

# 4. Full audit
codi compliance
```

**Add verbose output to any command:**

```bash
codi generate --verbose
codi init -v
```

**Verbose mode** prints detailed error traces, config resolution steps, and adapter decisions.

**Common issues:**

| Symptom | First check |
|:--------|:-----------|
| Agent not picking up rules | `codi status` — check for drift |
| Hooks not running | `codi doctor` — checks hook installation |
| Config looks wrong | `codi validate` — schema errors in flags.yaml |
| Unknown flag in flags.yaml | `codi update` — adds missing flags from new releases |
| Generated file is too large | `codi validate` — warns on files > 1 MB |

---

## 37. Run Codi in a CI Pipeline

**Situation:** You want CI to fail if generated configs drift from `.codi/` source, or if configuration is invalid.

```bash
# In your CI YAML (GitHub Actions example):
- name: Install Codi
  run: npm install -g codi-cli@latest

- name: Check drift and health
  run: codi doctor --ci

# Or for a full compliance gate:
- name: Compliance check
  run: codi compliance --ci
```

**Both `--ci` flags:**

- Exit with non-zero if any check fails or any drift is detected
- Print machine-parseable output compatible with CI log formatters

**As a dev dependency (no global install):**

```bash
npm install -D codi-cli
npx codi doctor --ci
```

---

## 38. Launch the Interactive Command Center

**Situation:** You want a menu-driven interface to all Codi commands without remembering subcommand names.

```bash
codi
```

**What opens:**

A TUI menu listing every available command: init, generate, add, status, doctor, validate, update, preset, watch, contribute, compliance, clean, revert, onboard, verify. Select one and it runs with an interactive prompt for any required options.

---

## 39. Set Up an AI Agent to Initialize Codi

**Situation:** You are using Claude Code or another AI coding agent and want it to handle the Codi setup for you.

**In the chat:**

```
Run codi onboard in the terminal and follow the instructions.
```

**What `codi onboard` outputs:**

A structured plain-text guide (formatted for AI consumption) that tells the agent:
- How to run `codi init`
- How to pick a preset based on the project's tech stack
- How to add specific artifact types
- How to run `codi generate` and commit the result

The agent reads the guide and runs the setup steps on your behalf.

---

## Quick Reference

| I want to… | Command |
|:-----------|:--------|
| Set up Codi for the first time | `codi init` |
| Regenerate agent configs | `codi generate` |
| Add a rule / skill / agent / MCP server | `codi add <type> <name>` |
| See if anything has drifted | `codi status` |
| Update artifacts to latest templates | `codi update --rules --skills --agents --mcp-servers` |
| Switch preset | `codi update --preset <name>` |
| Install a preset from GitHub | `codi preset install <url>` |
| Share my config as a preset | `codi preset create <name>` then `codi preset export <name>` |
| Check project health | `codi doctor` |
| Full compliance gate (for CI) | `codi compliance --ci` |
| Verify agent loaded my config | `codi verify` |
| Remove Codi entirely | `codi clean --all` |
| Undo last generate | `codi revert --last` |
| Watch for changes and auto-regenerate | `codi watch` |
| Get help from an AI agent | `codi onboard` |
