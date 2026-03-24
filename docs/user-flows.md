# User Flows

**Date**: 2026-03-24
**Document**: user-flows.md

## Overview

Complete map of user interaction paths with codi. Each flow includes the user type, trigger, concrete commands, expected output, and validation steps.

## User Types

| Type | Description |
|------|-------------|
| **Beginner** | First-time user setting up codi in a project |
| **Daily Developer** | Regular user editing rules, generating configs, checking drift |
| **Team Lead** | Manages presets, centralized config, verification, compliance |
| **CI/CD Engineer** | Integrates codi into pipelines for automated validation |

---

## Scenario 1: Installation & Setup

### Flow 1.1: Install from npm
**User Type:** Beginner | **Goal:** Install codi CLI and confirm it works

**Prerequisites:** Node.js >= 20, a project with `package.json`

**Steps:**
1. `npm install -D codi-cli`
2. `npx codi --version`

**Expected Outcome:** Version number printed, `codi-cli` in `devDependencies`

**Validation:** `npx codi --help` shows full command list. Failure: `command not found` means Node < 20.

**Edge Cases:** Global install may conflict with local. Yarn/pnpm: `pnpm add -D codi-cli` works.

### Flow 1.2: First-time project initialization (wizard)
**User Type:** Beginner | **Goal:** Create `.codi/` with manifest, flags, default rules

**Prerequisites:** codi installed, no existing `.codi/` directory

**Steps:**
1. `codi init`
2. Select agents (e.g., claude-code, cursor)
3. Choose preset (minimal, balanced, strict)
4. Confirm rule selection

**Expected Outcome:** `.codi/` created with `codi.yaml`, `flags.yaml`, `state.json`, rules, and generated agent files.

**Validation:** `ls .codi/` shows expected files. `codi status` reports no drift. Failure: `.codi/` exists without `--force`.

**Edge Cases:** Non-interactive shell falls back to defaults. No `package.json` skips stack detection.

### Flow 1.3: Non-interactive initialization
**User Type:** CI/CD Engineer | **Goal:** Initialize without prompts

**Prerequisites:** codi installed

**Steps:**
1. `codi init --agents claude-code cursor --preset balanced`

**Expected Outcome:** `.codi/` created, config files generated immediately.

**Validation:** `codi validate` exits 0. `codi status --json` returns `{"drift": false}`.

**Edge Cases:** Invalid agent name causes non-zero exit. Missing `--preset` defaults to `balanced`.

### Flow 1.4: Reinitialize existing project
**User Type:** Daily Developer | **Goal:** Add agents without losing custom rules

**Prerequisites:** Existing `.codi/` directory

**Steps:**
1. `codi init --force --agents claude-code cursor codex`

**Expected Outcome:** `codi.yaml` updated, custom rules preserved, generated files regenerated.

**Validation:** `codi validate` passes. Custom rules in `.codi/rules/custom/` unchanged.

**Edge Cases:** Without `--force`, init refuses. Backup created before overwrite (`codi revert --list`).

---

## Scenario 2: Daily Development

### Flow 2.1: Edit a rule and regenerate
**User Type:** Daily Developer | **Goal:** Update rule content across all agent configs

**Prerequisites:** Initialized project with at least one rule

**Steps:**
1. Edit `.codi/rules/custom/security.md`
2. `codi generate`
3. `codi status`

**Expected Outcome:** All agent config files updated. `codi status` reports no drift.

**Validation:** `grep "new content" CLAUDE.md` finds updated text. Drift if generate skipped.

**Edge Cases:** Editing generated files directly causes drift. Invalid frontmatter fails validation.

### Flow 2.2: Add a new custom rule
**User Type:** Daily Developer | **Goal:** Add a rule from template

**Prerequisites:** Initialized project

**Steps:**
1. `codi add rule performance --template performance`
2. Edit `.codi/rules/custom/performance.md`
3. `codi generate`

**Expected Outcome:** Rule file created from template, appears in all generated configs.

**Validation:** `codi validate` passes. `codi status` clean after generate.

**Edge Cases:** Name conflict with existing rule. Missing template falls back to blank scaffold.

### Flow 2.3: Add a skill from template
**User Type:** Daily Developer | **Goal:** Scaffold a reusable workflow

**Prerequisites:** Initialized project

**Steps:**
1. `codi add skill code-review --template code-review`
2. Edit `.codi/skills/code-review/SKILL.md`
3. `codi generate`

**Expected Outcome:** Skill directory created, referenced in generated agent configs.

**Validation:** `ls .codi/skills/code-review/` exists. `codi validate` passes.

**Edge Cases:** Duplicate name skipped. Missing `--template` creates blank scaffold.

### Flow 2.4: Check drift status
**User Type:** Daily Developer | **Goal:** Confirm generated files match source config

**Prerequisites:** Initialized and generated project

**Steps:**
1. `codi status`
2. If drift detected: `codi generate`

**Expected Outcome:** Clean: `All files up to date`. Drifted: lists mismatched files.

**Validation:** `codi status --json` returns structured report. Non-zero exit on drift.

**Edge Cases:** Deleted generated file shows as missing. New agent in `codi.yaml` not yet generated.

### Flow 2.5: Auto-regenerate with watch mode
**User Type:** Daily Developer | **Goal:** File changes trigger automatic regeneration

**Prerequisites:** `auto_generate_on_change` flag enabled in `flags.yaml`

**Steps:**
1. `codi watch`
2. Edit any file in `.codi/rules/custom/`

**Expected Outcome:** Terminal shows regeneration on each save. Files stay in sync.

**Validation:** `codi status` always clean while watch runs. Not triggering means flag disabled.

**Edge Cases:** `codi watch --once` runs one cycle and exits. Rapid edits may batch.

---

## Scenario 3: Artifact Management

### Flow 3.1: Add all rule templates
**User Type:** Team Lead | **Goal:** Bootstrap project with full rule set

**Prerequisites:** Initialized project

**Steps:**
1. `codi add rule --all`
2. `codi generate`

**Expected Outcome:** All template rules in `.codi/rules/custom/`. Generated configs include all.

**Validation:** `ls .codi/rules/custom/` shows all files. `codi validate` passes.

**Edge Cases:** Existing same-name rules are skipped (not overwritten).

### Flow 3.2: Add a custom agent
**User Type:** Team Lead | **Goal:** Add an agent definition

**Prerequisites:** Initialized project

**Steps:**
1. `codi add agent security-analyzer --template security-analyzer`
2. Edit `.codi/agents/security-analyzer.md`
3. `codi generate`

**Expected Outcome:** Agent file created, included in output for Claude Code and Codex.

**Validation:** `codi validate` passes. Agent in `CLAUDE.md` agents section.

**Edge Cases:** Only Claude Code and Codex support agents. Others skip silently.

### Flow 3.3: Add a command
**User Type:** Daily Developer | **Goal:** Create a custom slash command

**Prerequisites:** Initialized project with claude-code agent

**Steps:**
1. `codi add command deploy-check`
2. Edit `.codi/commands/deploy-check.md`
3. `codi generate`

**Expected Outcome:** Command synced to `.claude/commands/deploy-check.md`.

**Validation:** `ls .claude/commands/` shows file. Commands only for Claude Code.

**Edge Cases:** Non-Claude agents ignore commands silently.

### Flow 3.4: Update managed artifacts to latest
**User Type:** Team Lead | **Goal:** Pull latest templates without losing custom content

**Prerequisites:** Initialized project

**Steps:**
1. `codi update --rules --skills --agents`
2. `codi generate --force`

**Expected Outcome:** Managed templates updated. Custom rules untouched. Files refreshed.

**Validation:** `codi doctor` passes. `codi status` clean.

**Edge Cases:** `--regenerate` combines update + generate. `--from <repo>` pulls from specific repo.

---

## Scenario 4: Configuration & Presets

### Flow 4.1: Switch flag preset (balanced to strict)
**User Type:** Team Lead | **Goal:** Switch to stricter enforcement

**Prerequisites:** Project with balanced preset

**Steps:**
1. `codi update --preset strict`
2. `codi generate`

**Expected Outcome:** `flags.yaml` updated with strict values. Stricter enforcement in generated configs.

**Validation:** `grep "require_tests" .codi/flags.yaml` shows `true`. `codi validate` passes.

**Edge Cases:** Custom flag overrides preserved over preset defaults. Invalid preset causes error.

### Flow 4.2: Create a custom preset
**User Type:** Team Lead | **Goal:** Package current config as reusable preset

**Prerequisites:** Configured project with desired flags/rules/skills

**Steps:**
1. `codi preset create my-org-standard`

**Expected Outcome:** Preset saved and available for installation.

**Validation:** `codi preset list` shows `my-org-standard`.

**Edge Cases:** Name conflicts with built-in presets (minimal, balanced, strict).

### Flow 4.3: Install a preset from registry
**User Type:** Team Lead | **Goal:** Install preset from remote repository

**Prerequisites:** Target project initialized

**Steps:**
1. `codi preset install my-org-standard --from org/config-repo`
2. `codi generate`

**Expected Outcome:** Flags, rules, skills from preset applied. Generated files reflect preset.

**Validation:** `codi validate` passes. `codi status` clean after generate.

**Edge Cases:** Network failure shows actionable error. Conflicting rules prompt resolution.

### Flow 4.4: Configure MCP servers
**User Type:** Daily Developer | **Goal:** Define MCP servers for AI agents

**Prerequisites:** Initialized project

**Steps:**
1. Create/edit `.codi/mcp.yaml` with server definitions
2. `codi generate`

**Expected Outcome:** `.claude/mcp.json` and `.cursor/mcp.json` generated in native formats.

**Validation:** `cat .claude/mcp.json` shows valid JSON. `codi validate` passes.

**Edge Cases:** Cline does not support MCP (skipped). Invalid YAML causes validation error.

### Flow 4.5: Set up language-specific overrides
**User Type:** Daily Developer | **Goal:** Different rules per language

**Prerequisites:** Multi-language project

**Steps:**
1. Create `.codi/layers/lang/python.yaml` with overrides
2. `codi generate`

**Expected Outcome:** Language-specific rules merged into generated configs.

**Validation:** `codi validate` passes. Configs reflect merged language rules.

**Edge Cases:** Layer precedence: user > agent > framework > lang > repo > team > org.

---

## Scenario 5: Verification & Compliance

### Flow 5.1: Verify agent loaded configuration
**User Type:** Team Lead | **Goal:** Confirm an AI agent loaded the codi config

**Prerequisites:** Generated project with verification token

**Steps:**
1. `codi verify` (displays token and prompt)
2. Ask the AI agent: "verify codi"
3. `codi verify --check "token: codi-55ccfb9ed7d5, rules: security, code-style"`

**Expected Outcome:** Step 1: shows token and expected sections. Step 3: reports PASS/FAIL per section.

**Validation:** All sections PASS. Token mismatch means config changed since last generate.

**Edge Cases:** Agent response format varies; checker is lenient. Token changes on each generate.

### Flow 5.2: Run health check (doctor)
**User Type:** Daily Developer | **Goal:** Diagnose configuration issues

**Prerequisites:** Initialized project

**Steps:**
1. `codi doctor`

**Expected Outcome:** Pass/fail for: manifest, flags, rules syntax, drift, Node version.

**Validation:** Exit 0: healthy. Non-zero: issues with descriptions.

**Edge Cases:** `--ci` for machine-readable output. Missing `.codi/` is critical error.

### Flow 5.3: Run full compliance report
**User Type:** Team Lead | **Goal:** Comprehensive health report for audit

**Prerequisites:** Initialized and generated project

**Steps:**
1. `codi compliance`

**Expected Outcome:** Combined report: validation + doctor + status + verification with pass/fail counts.

**Validation:** Exit 0: fully compliant. `--ci` for pipeline output.

**Edge Cases:** Partial failures still produce full report (does not stop on first error).

### Flow 5.4: Check verification token programmatically
**User Type:** CI/CD Engineer | **Goal:** Validate token in automation

**Prerequisites:** Generated project

**Steps:**
1. `codi verify --json`

**Expected Outcome:** JSON with `token`, `rules`, `skills`, `agents` fields.

**Validation:** Parse and compare token against expected value.

**Edge Cases:** Token is deterministic: same config produces same token.

---

## Scenario 6: Team & Organization

### Flow 6.1: Pull config from central repository
**User Type:** Team Lead | **Goal:** Sync from central config source

**Prerequisites:** Central repo URL known, local project initialized

**Steps:**
1. `codi update --from org/central-config --regenerate`

**Expected Outcome:** Rules, flags, skills pulled and merged. Generated files regenerated.

**Validation:** `codi status` clean. `codi validate` passes.

**Edge Cases:** Local overrides preserved (central is lower precedence). Network errors show actionable message.

### Flow 6.2: Set up organization-wide locked flags
**User Type:** Team Lead | **Goal:** Enforce flags developers cannot override

**Prerequisites:** Access to create `~/.codi/org.yaml`

**Steps:**
1. Create `~/.codi/org.yaml`:
   ```yaml
   flags:
     allow_force_push: { value: false, locked: true }
     require_tests: { value: true, locked: true }
   ```
2. `codi generate` (in any project)

**Expected Outcome:** Locked flags override project `flags.yaml`. Org policies enforced.

**Validation:** `codi doctor` shows org layer. Overriding locked flag has no effect.

**Edge Cases:** `~/.codi/org.yaml` never committed. Missing file silently ignored.

### Flow 6.3: Create team-specific configuration
**User Type:** Team Lead | **Goal:** Different rules per team

**Prerequisites:** Organization config established

**Steps:**
1. Create `.codi/layers/team/frontend.yaml`
2. Reference team layer in `codi.yaml`
3. `codi generate`

**Expected Outcome:** Team-specific rules merged. Other teams unaffected.

**Validation:** `codi validate` passes.

**Edge Cases:** Team layer precedence: between org and repo.

### Flow 6.4: Search and install marketplace skills
**User Type:** Daily Developer | **Goal:** Find and install community skills

**Prerequisites:** Initialized project

**Steps:**
1. `codi marketplace search docker`
2. `codi marketplace install docker-workflow`
3. `codi generate`

**Expected Outcome:** Skill at `.codi/skills/docker-workflow/SKILL.md`. Available in generated configs.

**Validation:** `codi validate` passes.

**Edge Cases:** Not found returns helpful message. Version conflicts possible.

---

## Scenario 7: CI/CD Integration

### Flow 7.1: Add codi to GitHub Actions
**User Type:** CI/CD Engineer | **Goal:** Enforce compliance on every PR

**Prerequisites:** Project with codi initialized and committed

**Steps:**
1. Add to `.github/workflows/ci.yml`:
   ```yaml
   - name: Codi check
     run: |
       npm ci
       npx codi ci
   ```

**Expected Outcome:** CI runs all checks. Non-zero exit blocks merge on failure.

**Validation:** Green: passes. Red: drift or validation failed. Use `codi ci` for combined check.

**Edge Cases:** `--json` output parseable by CI tools.

### Flow 7.2: Pre-commit hook validation
**User Type:** CI/CD Engineer | **Goal:** Block commits with stale generated files

**Prerequisites:** codi installed, husky or similar configured

**Steps:**
1. Add to `.husky/pre-commit`: `npx codi status`

**Expected Outcome:** Hook blocks commit if drift detected. Developer runs `codi generate` and retries.

**Validation:** Clean status allows commit. Stale files cause non-zero exit.

**Edge Cases:** `--quiet` suppresses verbose output. `--json` for structured output.

### Flow 7.3: Run composite CI check
**User Type:** CI/CD Engineer | **Goal:** Single command for all validation

**Prerequisites:** Initialized and generated project

**Steps:**
1. `codi ci`

**Expected Outcome:** Runs validate + doctor + status sequentially. Non-zero on first failure.

**Validation:** Exit 0: all pass. Equivalent to `codi validate && codi doctor --ci && codi status`.

---

## Scenario 8: Troubleshooting & Recovery

### Flow 8.1: Restore from backup
**User Type:** Daily Developer | **Goal:** Restore previous generated files

**Prerequisites:** Codi creates backups before overwriting

**Steps:**
1. `codi revert --list`
2. `codi revert --last` or `codi revert --backup <timestamp>`

**Expected Outcome:** Generated files restored. Backup timestamp confirmed.

**Validation:** `codi status` may show drift (expected). `git diff` shows restored content.

**Edge Cases:** No backups if just initialized. `--last` picks most recent.

### Flow 8.2: Clean and reinitialize
**User Type:** Daily Developer | **Goal:** Remove generated files and start fresh

**Prerequisites:** Existing codi project

**Steps:**
1. `codi clean --dry-run` (preview removals)
2. `codi clean --force`
3. `codi init --force`
4. `codi generate`

**Expected Outcome:** Generated files removed, fresh config created, files regenerated.

**Validation:** `codi doctor` passes. `codi status` clean.

**Edge Cases:** `--all` removes `.codi/` too (destructive). Without `--force`, asks confirmation.

### Flow 8.3: Debug with verbose output
**User Type:** Daily Developer | **Goal:** Diagnose unexpected generation output

**Prerequisites:** Initialized project

**Steps:**
1. `codi generate --verbose`

**Expected Outcome:** Shows config resolution order, merged flags, adapter transforms, files written.

**Validation:** Reveals which layer overrides specific flags.

**Edge Cases:** `-v` works with all commands. Combine with `--json` for structured debug.

### Flow 8.4: Fix drift
**User Type:** Daily Developer | **Goal:** Bring generated files back in sync

**Prerequisites:** `codi status` reports drift

**Steps:**
1. `codi status` (identify drifted files)
2. To regenerate: `codi generate`
3. To keep edits: move changes to `.codi/rules/custom/`, then `codi generate`

**Expected Outcome:** `codi status` reports no drift.

**Validation:** `codi status --json` returns `{"drift": false}`.

**Edge Cases:** `codi generate` fixes all drifted files at once. Per-file drift reported.
