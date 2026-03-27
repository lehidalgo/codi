# QA Progress Report
**Date**: 2026-03-27 12:05 (updated)
**Document**: 20260327_0030_REPORT_qa_progress.md
**Category**: REPORT

## Summary

Iterative QA testing of codi CLI across versions 0.7.5 through 0.9.2 (develop branch). Multiple bugs found and fixed during QA. Testing resumed on 2026-03-27 at v0.9.2, completing all phases except Phase 12 (IDE integration, requires human in IDE).

## QA Phase Status

| Phase | Type | Status | Notes |
|-------|------|--------|-------|
| 0: Pre-Test Setup | AGENT | COMPLETED | Clean baseline established |
| 1: Init Wizard | HUMAN | COMPLETED | Multiple bugs found and fixed (v0.7.x) |
| 2: Generate & Output Verification | AGENT | COMPLETED | |
| 3: Native Flag Enforcement | AGENT | COMPLETED | |
| 4: Hook Lifecycle | AGENT | COMPLETED | 4.1-4.4 all passed |
| 5: Validation & Doctor | AGENT | COMPLETED | validate OK, doctor OK (doc staleness warnings) |
| 6: Artifact Management | AGENT | COMPLETED | status shows all agents synced, no drift |
| 7: Preset Management | AGENT | COMPLETED | `preset list --builtin` works, `preset show` does not exist |
| 8: Update Command | AGENT | COMPLETED | Runs clean, regenerates files |
| 9: Watch Mode | AGENT | COMPLETED | Starts, watches .codi/, responds to SIGTERM |
| 10: Revert (Backup/Restore) | AGENT | COMPLETED | Command works, no backups after clean --all (expected) |
| 11: Commit Hooks Enforcement | AGENT | COMPLETED | commit-msg and pre-commit hooks verified |
| 12: Agent Integration | HUMAN | PENDING | Requires IDE testing (Cursor, Windsurf, Claude Code) |
| 13: Edge Cases & Error Handling | AGENT | COMPLETED | 1 bug found and fixed (invalid preset accepted) |
| 14: Marketplace & Community | AGENT | COMPLETED | Correct: "no artifacts" when no custom artifacts exist |
| 15: JSON Output Mode | AGENT | COMPLETED | validate --json and doctor --json produce structured output |
| 16: MCP Configuration | AGENT | COMPLETED | N/A — MCP config is optional, not configured |
| 17: Pre-commit & Hooks Verification | AGENT | COMPLETED | 1 bug found and fixed (hooks didn't pass staged files) |

## Phase Results Detail

### Phase 4: Hook Lifecycle (COMPLETED)

| Test | Result | Detail |
|------|--------|--------|
| 4.1 Hooks installed during init | PASS | .husky/pre-commit and commit-msg created |
| 4.2 No duplicates after 3 generates | PASS | `grep -c "Codi hooks"` = exactly 1 |
| 4.3 Clean preserves hooks & .codi/ | PASS | Both present after `clean --force` |
| 4.4 Clean --all removes everything | PASS | Both gone after `clean --all --force` |

### Phase 5: Validation & Doctor (COMPLETED)

| Test | Result | Detail |
|------|--------|--------|
| `codi validate` | PASS | `valid: true`, 0 errors |
| `codi doctor` | PASS | All checks pass. Doc staleness warnings (non-blocking) |

**Note**: QA report originally listed `codi health` — this command does not exist. The correct command is `codi doctor`.

**Doc staleness warnings** (fixed by `codi docs-update`):
- STATUS.md: skills 18→19, commands 8→9, error codes 25→31, CLI commands 16→17
- CONTRIBUTING.md: rules 21→23, skills 13→19, commands 8→9
- `docs/guides/writing-rules.md`: 10 missing template entries (manual fix needed, tracked separately)

### Phase 6: Artifact Management (COMPLETED)

| Test | Result | Detail |
|------|--------|--------|
| `codi status` | PASS | All 5 agents synced, `hasDrift: false` |

Agents tracked: claude-code (CLAUDE.md, .claude/settings.json), cursor (.cursorrules, .cursor/hooks.json), codex (AGENTS.md, .codex/config.toml), windsurf (.windsurfrules), cline (.clinerules).

### Phase 7: Preset Management (COMPLETED)

| Test | Result | Detail |
|------|--------|--------|
| `codi preset list --builtin` | PASS | 7 presets listed with descriptions |
| `codi preset show` | N/A | Command does not exist — not a bug, just not implemented |

Available subcommands: create, list, install, export, validate, remove, edit, search, update.

### Phase 8: Update Command (COMPLETED)

| Test | Result | Detail |
|------|--------|--------|
| `codi update` | PASS | Regenerated files, no changes needed |

### Phase 9: Watch Mode (COMPLETED)

| Test | Result | Detail |
|------|--------|--------|
| `codi watch` starts | PASS | Watches .codi/ for changes |
| Responds to kill signal | PASS | Exit code 143 (SIGTERM) |

### Phase 10: Revert (COMPLETED)

| Test | Result | Detail |
|------|--------|--------|
| `codi revert --list` | PASS | No backups (expected after clean --all) |
| Error messaging | PASS | Clear hint: "Use --list, --last, or --backup <timestamp>" |

### Phase 13: Edge Cases & Error Handling (COMPLETED)

| Test | Result | Detail |
|------|--------|--------|
| Generate outside project | PASS | npx can't find codi executable (expected) |
| Init with invalid preset | BUG → FIXED | Was accepted silently, now errors with known preset list |

**Bug fixed**: `codi init --preset nonexistent` now returns `E_CONFIG_INVALID` with message listing valid presets. Fix in `src/cli/init.ts` — added `getBuiltinPresetNames()` validation mirroring existing agent validation pattern.

### Phase 14: Marketplace & Community (COMPLETED)

| Test | Result | Detail |
|------|--------|--------|
| `codi contribute` | PASS | Correctly reports "no artifacts" when only builtin templates used |

### Phase 15: JSON Output Mode (COMPLETED)

| Test | Result | Detail |
|------|--------|--------|
| `codi validate --json` | PASS | Structured JSON with success, command, data, errors, warnings, exitCode, timestamp, version |
| `codi doctor --json` | PASS | Same structured format with drift checks per agent |

### Phase 16: MCP Configuration (N/A)

MCP configuration is optional. No `mcp.json` is created during init unless explicitly configured. Not a bug.

### Phase 11: Commit Hooks Enforcement (COMPLETED)

| Test | Result | Detail |
|------|--------|--------|
| Commit-msg rejects bad format | PASS | `git commit -m "bad message"` → "Invalid commit message format" error |
| Commit-msg accepts valid format | PASS | `git commit -m "test(qa): ..."` → commit succeeds |

### Phase 17: Pre-commit & Hooks Verification (COMPLETED)

| Test | Result | Detail |
|------|--------|--------|
| Secret scan catches staged secrets | BUG → FIXED | Was no-op (no files passed), now blocks commits with secrets |
| File size check catches large files | BUG → FIXED | Was no-op (no files passed), now blocks files > 800 lines |

**Bug found and fixed**: Both `codi-secret-scan.mjs` and `codi-file-size-check.mjs` expected file paths via `process.argv.slice(2)`, but the husky pre-commit hook invoked them without arguments. Fix: `installHusky()` now appends `$(git diff --cached --name-only --diff-filter=ACMR)` to hooks that declare a `stagedFilter`. Also set `stagedFilter: '**/*'` on secret-scan and file-size-check hooks in `hook-config-generator.ts`.

## Remaining Human-Only Phases

### Phase 12: Agent Integration (HUMAN — IDE)
- Open project in Cursor, verify `.cursorrules` loads and agent follows rules
- Open project in Windsurf, verify `.windsurfrules` loads
- Verify Claude Code reads `CLAUDE.md` permissions correctly
- Verify Codex reads `AGENTS.md` and `.codex/config.toml`

## Bugs Found and Fixed During QA

| # | Bug | Fix | Version |
|---|-----|-----|---------|
| 1 | Stale dist build (codex config.toml path) | npm lifecycle hooks (preversion/prepublishOnly) | 0.7.5 |
| 2 | npm version commit message format | `.npmrc` with conventional commit message | 0.7.8 |
| 3 | Publishing from non-main branch | Branch guard in prepublishOnly | 0.7.9 |
| 4 | Branch guard blocks CI (detached HEAD) | `$CI` env var bypass | 0.7.10 |
| 5 | removeCodiSectionFromFile partial strip | Delete entire file when codi owns it | 0.7.10 |
| 6 | getBasePreset hardcoded switch | Derive dynamically from BUILTIN_PRESETS | 0.7.11 |
| 7 | Missing .mjs scripts for husky | writeAuxiliaryScripts() for all runners | 0.7.11 |
| 8 | Stale standalone hooks when switching runners | cleanStaleHooksFromOtherRunner() | 0.7.11 |
| 9 | Init output showed base preset name | displayPresetName = saveAsPreset ?? selectedPresetName | 0.7.12 |
| 10 | Extended preset flags lost during init | Merge extended preset flag overrides in createCodiStructure | 0.7.12 |
| 11 | allow_shell_commands false in codi-development | Added override in preset | 0.7.13 |
| 12 | version-check CI compared git tags (always exist) | Compare against npm registry instead | 0.7.15 |
| 13 | allow_shell_commands false in STRICT base | Changed to true in all presets | 0.9.x |
| 14 | Invalid preset name accepted silently | Added getBuiltinPresetNames() validation in init.ts | 0.9.2+ |
| 15 | Pre-commit hooks don't pass staged files (husky) | installHusky() appends `$(git diff --cached)`, set stagedFilter on aux hooks | 0.9.2+ |

## Doc Corrections Found During QA

| Issue | Correction |
|-------|-----------|
| QA doc referenced `codi health` | Correct command is `codi doctor` |
| QA doc referenced `codi preset show` | Command does not exist; use `codi preset list --builtin` |
| QA doc referenced `codi list` | Correct command is `codi status` |
| QA doc referenced `codi health --json` | Correct: `codi doctor --json` |

## Doc Maintenance Items (non-blocking)

- `docs/guides/writing-rules.md` — 10 missing template entries (production-mindset, simplicity-first, preset-creator, contribute, skill-creator, rule-creator, agent-creator, command-creator, guided-qa-testing, session-handoff)
- STATUS.md and CONTRIBUTING.md counts — fixed via `codi docs-update`

## Future Spec

Update command sync improvements documented in:
`docs/20260326_2340_SPEC_update_sync_improvements.md`

## Environment Notes

- **Node version**: Must use Node 22 (`nvm use 22`)
- **Branch**: `develop` (PR to `main` for releases)
- **Current version**: 0.9.2
- **npm lifecycle**: preversion runs lint+test, postversion pushes + tags, prepublishOnly guards main-only + rebuilds
