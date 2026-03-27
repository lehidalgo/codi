# QA Progress Report
**Date**: 2026-03-27 00:30
**Document**: 20260327_0030_REPORT_qa_progress.md
**Category**: REPORT

## Summary

Iterative QA testing of codi CLI v0.7.15 (develop branch). Multiple bugs found and fixed during QA. A pending commit for `allow_shell_commands` fix needs to be released before continuing.

## Pending Release (MUST DO FIRST)

**Uncommitted source changes** on `develop` branch — must commit and release before continuing QA:

```bash
git add src/core/flags/flag-presets.ts src/templates/presets/codi-development.ts src/templates/presets/security-hardened.ts tests/unit/flags/flag-presets.test.ts
git commit -m "fix: allow_shell_commands always true across all presets"
source ~/.nvm/nvm.sh && nvm use 22 && npm version patch
```

Then create PR to main, merge, and `npm publish`.

**Changes in this commit:**
- `src/core/flags/flag-presets.ts`: STRICT `allow_shell_commands` changed from `false` to `true`. Description updated.
- `src/templates/presets/security-hardened.ts`: `allow_shell_commands` changed from `false` to `true` (still locked).
- `src/templates/presets/codi-development.ts`: Removed redundant `allow_shell_commands` override (inherits `true` from strict now).
- `tests/unit/flags/flag-presets.test.ts`: Updated assertion to expect `true`.

**Generated config files already updated manually** (will be regenerated properly on next `codi init`):
- `.codi/flags.yaml` — `allow_shell_commands: true`
- `CLAUDE.md` — "Shell commands are allowed."
- `AGENTS.md` — same
- `.cursorrules` — same
- `.clinerules` — same
- `.windsurfrules` — same
- `.codex/config.toml` — `shell_tool = true`

## QA Phase Status

| Phase | Status | Notes |
|-------|--------|-------|
| 0: Pre-Test Setup | COMPLETED | Clean baseline established |
| 1: Init Wizard (HUMAN) | COMPLETED | Multiple bugs found and fixed |
| 2: Generate & Output Verification | COMPLETED | |
| 3: Native Flag Enforcement | COMPLETED | |
| **4: Hook Lifecycle** | **IN PROGRESS** | 4.1 passed, 4.2-4.4 pending |
| 5: Validation & Health Commands | PENDING | |
| 6: Artifact Management | PENDING | |
| 7: Preset Management | PENDING | |
| 8: Update Command | PENDING | |
| 9: Watch Mode | PENDING | |
| 10: Revert (Backup/Restore) | PENDING | |
| 11: Commit Hooks Enforcement | PENDING | |
| 12: Agent Integration (HUMAN) | PENDING | |
| 13: Edge Cases & Error Handling | PENDING | |
| 14: Marketplace & Community | PENDING | |
| 15: JSON Output Mode | PENDING | |
| 16: MCP Configuration Verification | PENDING | |
| 17: Pre-commit & Hooks Verification | PENDING | |

## Phase 4: Hook Lifecycle — Remaining Tests

### 4.2 — No duplicates after 3 generates
```bash
npx codi generate && npx codi generate && npx codi generate
grep -c "Codi hooks" .husky/pre-commit
```
**Expected**: count = exactly `1`

### 4.3 — Clean preserves hooks
```bash
npx codi clean --force
ls .husky/pre-commit
ls .codi/
```
**Expected**: hooks and `.codi/` still exist

### 4.4 — Clean --all removes everything
```bash
npx codi generate
npx codi clean --all --force
ls .husky/pre-commit 2>&1
ls .codi/ 2>&1
```
**Expected**: both gone (file not found errors)

## Phase 5: Validation & Health Commands
```bash
npx codi validate
npx codi health
```
**Expected**: both report green/passing status

## Phase 6: Artifact Management
```bash
# List artifacts
npx codi list

# Check generated files match what was selected during init
# Compare .codi/codi.yaml artifacts against actual files on disk
```

## Phase 7: Preset Management
```bash
npx codi preset list
npx codi preset show codi-development
npx codi preset show security-hardened
```

## Phase 8: Update Command
```bash
# After changing codi.yaml, run update to sync
npx codi update
```

## Phase 9: Watch Mode
```bash
npx codi watch
# Modify a rule or skill file and verify auto-regeneration
```

## Phase 10: Revert (Backup/Restore)
```bash
npx codi revert
# Check if backups exist and restore works
```

## Phase 11: Commit Hooks Enforcement
```bash
# Make a bad commit (no tests, bad message format) and verify hooks reject it
echo "test" > /tmp/test.txt
git add /tmp/test.txt
git commit -m "bad message"
```
**Expected**: pre-commit hook runs lint/tests, commit-msg hook validates format

## Phase 12: Agent Integration (HUMAN — IDE)
- Open project in Cursor, verify `.cursorrules` loads
- Open project in Windsurf, verify `.windsurfrules` loads
- Verify Claude Code reads `CLAUDE.md` permissions correctly

## Phase 13: Edge Cases & Error Handling
```bash
# Run commands outside a codi project
cd /tmp && npx codi generate 2>&1
# Run with invalid flags
npx codi init --preset nonexistent 2>&1
```

## Phase 14: Marketplace & Community
```bash
npx codi contribute
# Test sharing workflow
```

## Phase 15: JSON Output Mode
```bash
npx codi validate --json
npx codi health --json
npx codi list --json
```

## Phase 16: MCP Configuration Verification
```bash
# Check .codi/mcp.json exists and is valid
cat .codi/mcp.json
# Verify MCP servers listed match what was selected
```

## Phase 17: Pre-commit & Hooks Verification
```bash
# Full hook chain test
# 1. Stage a file with lint errors
# 2. Attempt commit — should fail at lint
# 3. Fix lint, attempt with bad commit message — should fail at commit-msg
# 4. Fix message — should succeed
```

## Bugs Found and Fixed During QA

| Bug | Fix | Version |
|-----|-----|---------|
| Stale dist build (codex config.toml path) | npm lifecycle hooks (preversion/prepublishOnly) | 0.7.5 |
| npm version commit message format | `.npmrc` with conventional commit message | 0.7.8 |
| Publishing from non-main branch | Branch guard in prepublishOnly | 0.7.9 |
| Branch guard blocks CI (detached HEAD) | `$CI` env var bypass | 0.7.10 |
| removeCodiSectionFromFile partial strip | Delete entire file when codi owns it | 0.7.10 |
| getBasePreset hardcoded switch | Derive dynamically from BUILTIN_PRESETS | 0.7.11 |
| Missing .mjs scripts for husky | writeAuxiliaryScripts() for all runners | 0.7.11 |
| Stale standalone hooks when switching runners | cleanStaleHooksFromOtherRunner() | 0.7.11 |
| Init output showed base preset name | displayPresetName = saveAsPreset ?? selectedPresetName | 0.7.12 |
| Extended preset flags lost during init | Merge extended preset flag overrides in createCodiStructure | 0.7.12 |
| allow_shell_commands false in codi-development | Added override in preset | 0.7.13 |
| version-check CI compared git tags (always exist) | Compare against npm registry instead | 0.7.15 |
| allow_shell_commands false in STRICT base | Changed to true in all presets | **PENDING** |

## Future Spec

Update command sync improvements documented in:
`docs/20260326_2340_SPEC_update_sync_improvements.md`

## Environment Notes

- **Node version**: Must use Node 22 (`nvm use 22`)
- **Branch**: `develop` (PR to `main` for releases)
- **Current published version**: 0.7.15
- **npm lifecycle**: preversion runs lint+test, postversion pushes + tags, prepublishOnly guards main-only + rebuilds
