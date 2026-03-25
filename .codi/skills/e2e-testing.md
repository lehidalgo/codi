---
name: e2e-testing
description: Comprehensive validation of all codi features. Use when asked to test, audit, or verify the codi installation end-to-end. Covers 16 commands, 7 artifact types, preset management (create, validate, export, install, remove), pre-commit hooks, doc-sync, and commit workflow.
compatibility: [claude-code, cursor, codex, windsurf, cline]
managed_by: codi
---

# e2e-testing

## Overview

This skill guides systematic validation of ALL codi features in a test project. Each step is labeled:
- **[SYSTEM]** — run this CLI command
- **[HUMAN]** — STOP and ask the human to perform this action
- **[CODING AGENT]** — the AI agent performs this

Full details: see docs/testing-guide.md and docs/user-flows.md.

## Suite 1: Setup

**[SYSTEM]** Create a test project and install codi:
\`\`\`bash
mkdir /tmp/codi-validation && cd /tmp/codi-validation
git init
npm init -y && npm install codi-cli
npx codi --version
\`\`\`
Expected: Version prints (e.g., 0.3.1). Git repo initialized (needed for hooks).

## Suite 2: Initialization

**[SYSTEM]** Non-interactive init:
\`\`\`bash
npx codi init --agents claude-code cursor codex --preset balanced --json
\`\`\`
Expected: .codi/ created with codi.yaml, flags.yaml (18 flags), rules/, skills/, frameworks/.

**[CODING AGENT]** Verify hooks were installed:
\`\`\`bash
ls .git/hooks/pre-commit .git/hooks/commit-msg
\`\`\`
Expected: Both files exist (pre-commit runner + commit message validator).

**[HUMAN]** Interactive wizard: run \`npx codi init --force\` in terminal. Select agents, rules, skills, preset. Verify output matches.

## Suite 3: Artifacts (all 4 types)

**[SYSTEM]** Add all templates:
\`\`\`bash
npx codi add rule --all --json
npx codi add skill --all --json
npx codi add agent --all --json
npx codi add command --all --json
\`\`\`
Expected: 21 rules, 14 skills, 8 agents, 8 commands. All managed_by: codi.

**[SYSTEM]** Add custom artifacts:
\`\`\`bash
npx codi add rule my-custom --json
npx codi add skill my-custom --json
\`\`\`
Expected: managed_by: user.

## Suite 4: Generation & Drift

**[SYSTEM]** Generate and check:
\`\`\`bash
npx codi generate --json
npx codi status --json
\`\`\`
Expected: Files generated. hasDrift: false. Hooks re-installed.

**[SYSTEM]** Inject and fix drift:
\`\`\`bash
echo "edit" >> CLAUDE.md
npx codi status --json
npx codi generate --json
\`\`\`
Expected: hasDrift true, then false after regenerate.

**[SYSTEM]** Verify per-agent: .claude/rules/, .cursor/rules/*.mdc, AGENTS.md, .codex/agents/*.toml, .windsurfrules, .clinerules, .claude/skills/, .windsurf/skills/.

## Suite 5: Verification & Compliance

**[SYSTEM]**
\`\`\`bash
npx codi verify --json
npx codi compliance --json
npx codi doctor --ci --json
npx codi ci --json
npx codi docs-update --json
\`\`\`
Expected: 12-char token deterministic. All checks pass. docs-update reports fixed files (if any).

## Suite 6: Update & Presets

**[SYSTEM]** Preset switching:
\`\`\`bash
npx codi update --preset strict --json
npx codi update --preset balanced --json
\`\`\`
Expected: Strict shows restricted instructions. Balanced restores defaults.

**[SYSTEM]** Artifact refresh:
\`\`\`bash
npx codi update --rules --skills --agents --commands --dry-run --json
\`\`\`
Expected: Managed artifacts listed. Custom (managed_by: user) skipped.

## Suite 7: Preset Management

### 7a: Create & List

**[SYSTEM]**
\`\`\`bash
npx codi preset create test-preset --json
npx codi preset list --json
\`\`\`
Expected: Preset directory created at .codi/presets/test-preset/ with preset.yaml and subdirs (rules/, skills/, agents/, commands/). Visible in list.

### 7b: Built-in Presets

**[SYSTEM]**
\`\`\`bash
npx codi preset list --builtin --json
\`\`\`
Expected: Shows 6 built-in presets: minimal, balanced, strict, python-web, typescript-fullstack, security-hardened. Each with [builtin] source tag.

### 7c: Validate

**[SYSTEM]**
\`\`\`bash
npx codi preset validate test-preset --json
\`\`\`
Expected: Preset "test-preset" is valid. Reports version, artifact counts (rules: 0, skills: 0, agents: 0, commands: 0).

### 7d: Export as ZIP

**[SYSTEM]**
\`\`\`bash
npx codi preset export test-preset --format zip --output /tmp/codi-validation/
ls /tmp/codi-validation/test-preset.zip
\`\`\`
Expected: ZIP file created. File exists at /tmp/codi-validation/test-preset.zip.

### 7e: Remove

**[SYSTEM]**
\`\`\`bash
npx codi preset remove test-preset --json
npx codi preset list --json
\`\`\`
Expected: Preset removed. No longer visible in list. Lock file entry cleared.

### 7f: Install from ZIP

**[SYSTEM]**
\`\`\`bash
npx codi preset install /tmp/codi-validation/test-preset.zip --json
npx codi preset list --json
npx codi preset validate test-preset --json
\`\`\`
Expected: Preset installed from ZIP. Visible in list with [zip] source. Validation passes. Lock file has source: "zip:..." entry.

### 7g: Cleanup

**[SYSTEM]**
\`\`\`bash
npx codi preset remove test-preset --json
rm -f /tmp/codi-validation/test-preset.zip
\`\`\`
Expected: Preset and ZIP cleaned up.

### 7h: GitHub Preset Install

**[HUMAN]** Provide a GitHub repository URL that contains a valid preset (a repo with \`preset.yaml\` at the root). This can be:
- A public preset repo (e.g., \`github:my-org/my-preset\`)
- A private repo you have access to (SSH keys or GH_TOKEN configured)
- If none exists, create a small test repo: add a \`preset.yaml\` with \`name: test-gh-preset\`, \`version: "1.0.0"\`, push to GitHub, and provide the org/repo path.

**[SYSTEM]** Install the GitHub preset (substitute the real org/repo):
\`\`\`bash
npx codi preset install github:<org>/<repo> --json
\`\`\`
Expected: Preset cloned, validated, and installed to .codi/presets/<name>/.

**[CODING AGENT]** Verify the installation:
1. Run \`npx codi preset list --json\` — preset must appear with \`sourceType: "github"\`
2. Read \`.codi/preset-lock.json\` — entry must have \`source: "github:..."\`, \`sourceType: "github"\`, and a \`commit\` hash
3. Verify \`.codi/presets/<name>/preset.yaml\` exists

**[SYSTEM]** Validate and clean up:
\`\`\`bash
npx codi preset validate <name> --json
npx codi preset remove <name> --json
\`\`\`
Expected: Validation passes. Preset removed. Lock file entry cleared.

### 7i: Preset Registry Search

**[HUMAN]** Check if a preset registry is configured in \`.codi/codi.yaml\` under \`presetRegistry.url\`. If not configured, either:
- Add a \`presetRegistry\` section pointing to a real registry repo, OR
- Confirm this test should be skipped (the agent will note it as skipped)

**[SYSTEM]**
\`\`\`bash
npx codi preset search test --json
\`\`\`

**[CODING AGENT]** Verify the result:
- If registry is configured: results are returned or "No presets found matching" message (both valid)
- If registry is not configured or unreachable: a clear error message is reported (not a crash or unhandled exception)

### 7j: Preset Update

Prerequisite: A GitHub-sourced preset must be installed (from 7h). If 7h was skipped, skip this test too.

**[SYSTEM]**
\`\`\`bash
npx codi preset update --dry-run --json
\`\`\`

**[CODING AGENT]** Verify:
- GitHub-sourced presets: reports "up to date" or lists available version changes
- ZIP-sourced presets (if any): skipped with info message (ZIP presets require manual re-install)
- No presets tracked: reports "Nothing to update"

## Suite 8: MCP

**[SYSTEM]** Configure and verify:
\`\`\`bash
cat > .codi/mcp.yaml << 'EOF'
servers:
  test-api:
    type: http
    url: "https://example.com/mcp"
EOF
npx codi generate --json
\`\`\`
Expected: .claude/mcp.json, .cursor/mcp.json, .codex/mcp.toml, .windsurf/mcp.json contain test-api.

## Suite 9: Backup & Revert

**[SYSTEM]**
\`\`\`bash
npx codi revert --list --json
npx codi revert --last --json
\`\`\`
Expected: Backups from prior generates. Restore succeeds.

## Suite 10: Marketplace

**[SYSTEM]**
\`\`\`bash
npx codi marketplace search test --json
\`\`\`
Note: May fail if no registry configured. This is expected.

## Suite 11: Clean & Reinstall

**[SYSTEM]**
\`\`\`bash
npx codi clean --json
npx codi generate --json
npx codi clean --all --json
\`\`\`
Expected: Clean removes generated. Regenerate works. Clean --all removes .codi/.

## Suite 12: Agent Integration

**[HUMAN]** Open Claude Code in the test project.
**[HUMAN]** Ask: "verify codi"
**[HUMAN]** Copy response.
**[SYSTEM]** \`npx codi verify --check "<response>"\`
Expected: tokenMatch: true.

## Suite 13: Pre-Commit Hooks

**[SYSTEM]** Verify hook scripts exist:
\`\`\`bash
ls .git/hooks/pre-commit .git/hooks/commit-msg .git/hooks/codi-secret-scan.mjs .git/hooks/codi-file-size-check.mjs
\`\`\`
Expected: All 4 files present.

**[SYSTEM]** Test file size check (800 LOC limit):
\`\`\`bash
python3 -c "print('\n'.join(['line ' + str(i) for i in range(801)]))" > big-file.txt
git add big-file.txt
git commit -m "test: should fail"
\`\`\`
Expected: Commit blocked — "big-file.txt: 802 lines (max: 800)".

**[SYSTEM]** Test secret scan:
\`\`\`bash
printf 'const key = "sk-%s"\n' "abc123def456ghi789jkl012mno345pqr" > secret-test.js
git add secret-test.js
git commit -m "test: should fail"
\`\`\`
Expected: Commit blocked — "Potential secret found".

**[SYSTEM]** Test commit-msg validation:
\`\`\`bash
echo "hello" > valid-file.txt
git add valid-file.txt
git commit -m "bad message without type"
\`\`\`
Expected: Commit blocked — "Invalid commit message format".

**[SYSTEM]** Valid commit:
\`\`\`bash
git commit -m "test: validate pre-commit hooks work"
\`\`\`
Expected: Commit succeeds (proper format, small file, no secrets).

## Suite 14: Documentation Sync

**[CODING AGENT]** Stale a count to test detection:
\`\`\`bash
# Temporarily edit STATUS.md to say "Rule templates | 9 |"
\`\`\`

**[SYSTEM]**
\`\`\`bash
npx codi doctor --json
\`\`\`
Expected: W_DOCS_STALE warning — "STATUS.md says Rule templates: 9 but 21 exist — run: codi docs-update".

**[SYSTEM]**
\`\`\`bash
npx codi docs-update --json
\`\`\`
Expected: STATUS.md fixed. Count restored.

**[SYSTEM]**
\`\`\`bash
npx codi doctor --json
\`\`\`
Expected: No doc-sync warnings.

## Suite 15: Commit Workflow

**[SYSTEM]** Add commit skill and command:
\`\`\`bash
npx codi add skill commit --template commit --json
npx codi add command commit --template commit --json
npx codi generate --json
\`\`\`
Expected: Commit skill and command created. Generated for all agents.

**[CODING AGENT]** Verify the commit skill content includes:
- Conventional commits format (feat, fix, docs, refactor, test, chore)
- Pre-commit checks (formatting, linting, type checking, secret scan, file size)
- Troubleshooting section (tool not found, hooks not installed, message rejected)

## Suite 16: Watch Mode

**[SYSTEM]** Test auto-regeneration:
\`\`\`bash
npx codi watch --once &
sleep 1
echo "# trigger" >> .codi/rules/custom/my-custom.md
sleep 2
npx codi status --json
\`\`\`
Expected: Watch detects change and regenerates. Status shows no drift.

## Suite 17: Hook Dependencies & Version Check

**[SYSTEM]** Check hook dependency detection:
\`\`\`bash
npx codi doctor --json
\`\`\`
**[CODING AGENT]** Verify doctor output includes warnings for any missing hook tools (eslint, prettier, ruff, etc.) with install hints.

**[SYSTEM]** Test version check hook (if requiredVersion set in codi.yaml):
\`\`\`bash
ls .git/hooks/codi-version-check.mjs
\`\`\`
Expected: File exists when manifest has \`codi.requiredVersion\`.

## Suite 18: Update --from Source Pull

**[SYSTEM]**
\`\`\`bash
npx codi update --from codi/team-config --dry-run --json
\`\`\`
Note: May fail if repo doesn't exist. Verifies the --from flag is accepted and attempts a pull.

## Cleanup

**[SYSTEM]** \`rm -rf /tmp/codi-validation\`

## References

- docs/testing-guide.md — full testing procedure
- docs/user-flows.md — all 30 user flows
- docs/troubleshooting.md — common issues (including hook troubleshooting)

