import {
  PRE_COMMIT_MAX_FILE_LINES,
  PROJECT_CLI,
  PROJECT_DIR,
  PROJECT_NAME,
} from "#src/constants.js";
import type { TemplateCounts } from "../types.js";

export function getTemplate(counts: TemplateCounts): string {
  const RULE_TEMPLATE_COUNT = counts.rules;
  const SKILL_TEMPLATE_COUNT = counts.skills;
  const AGENT_TEMPLATE_COUNT = counts.agents;
  const COMMAND_TEMPLATE_COUNT = counts.commands;
  const FLAG_COUNT = counts.flags;

  return `---
name: {{name}}
description: Comprehensive validation of all ${PROJECT_NAME} features. Use when asked to test, audit, or verify the ${PROJECT_NAME} installation end-to-end. Covers 16 commands, 7 artifact types, preset management (create, validate, export, install, remove), pre-commit hooks, doc-sync, and commit workflow.
category: Code Quality
compatibility: [claude-code, cursor, codex, windsurf, cline]
managed_by: ${PROJECT_NAME}
intentHints:
  taskType: E2E Validation
  examples:
    - "Run end-to-end tests"
    - "Validate the full installation"
---

# {{name}}

## Overview

This skill guides systematic validation of ALL ${PROJECT_NAME} features in a test project. Each step is labeled:
- **[SYSTEM]** — run this CLI command
- **[HUMAN]** — STOP and ask the human to perform this action
- **[CODING AGENT]** — the AI agent performs this

Full details: see docs/guides/testing-guide.md and docs/guides/user-flows.md.

## Suite 1: Setup

**[SYSTEM]** Create a test project and install ${PROJECT_NAME}:
\\\`\\\`\\\`bash
mkdir /tmp/${PROJECT_NAME}-validation && cd /tmp/${PROJECT_NAME}-validation
git init
npm init -y && npm install ${PROJECT_NAME}-cli
npx ${PROJECT_CLI} --version
\\\`\\\`\\\`
Expected: Version prints (e.g., 0.3.1). Git repo initialized (needed for hooks).

## Suite 2: Initialization

**[SYSTEM]** Non-interactive init:
\\\`\\\`\\\`bash
npx ${PROJECT_CLI} init --agents claude-code cursor codex --preset balanced --json
\\\`\\\`\\\`
Expected: ${PROJECT_DIR}/ created with ${PROJECT_NAME}.yaml, flags.yaml (${FLAG_COUNT} flags), rules/, skills/, frameworks/.

**[CODING AGENT]** Verify hooks were installed:
\\\`\\\`\\\`bash
ls .git/hooks/pre-commit .git/hooks/commit-msg
\\\`\\\`\\\`
Expected: Both files exist (pre-commit runner + commit message validator).

**[HUMAN]** Interactive wizard: run \\\`npx ${PROJECT_CLI} init --force\\\` in terminal. Select agents, rules, skills, preset. Verify output matches.

## Suite 3: Artifacts (all 4 types)

**[SYSTEM]** Add all templates:
\\\`\\\`\\\`bash
npx ${PROJECT_CLI} add rule --all --json
npx ${PROJECT_CLI} add skill --all --json
npx ${PROJECT_CLI} add agent --all --json
npx ${PROJECT_CLI} add command --all --json
\\\`\\\`\\\`
Expected: ${RULE_TEMPLATE_COUNT} rules, ${SKILL_TEMPLATE_COUNT} skills, ${AGENT_TEMPLATE_COUNT} agents, ${COMMAND_TEMPLATE_COUNT} commands. All managed_by: ${PROJECT_NAME}.

**[SYSTEM]** Add custom artifacts:
\\\`\\\`\\\`bash
npx ${PROJECT_CLI} add rule my-custom --json
npx ${PROJECT_CLI} add skill my-custom --json
\\\`\\\`\\\`
Expected: managed_by: user.

## Suite 4: Generation & Drift

**[SYSTEM]** Generate and check:
\\\`\\\`\\\`bash
npx ${PROJECT_CLI} generate --json
npx ${PROJECT_CLI} status --json
\\\`\\\`\\\`
Expected: Files generated. hasDrift: false. Hooks re-installed.

**[SYSTEM]** Inject and fix drift:
\\\`\\\`\\\`bash
echo "edit" >> CLAUDE.md
npx ${PROJECT_CLI} status --json
npx ${PROJECT_CLI} generate --json
\\\`\\\`\\\`
Expected: hasDrift true, then false after regenerate.

**[SYSTEM]** Verify per-agent: .claude/rules/, .cursor/rules/*.mdc, AGENTS.md, .codex/agents/*.toml, .windsurfrules, .clinerules, .claude/skills/, .windsurf/skills/.

## Suite 5: Verification & Compliance

**[SYSTEM]**
\\\`\\\`\\\`bash
npx ${PROJECT_CLI} verify --json
npx ${PROJECT_CLI} compliance --json
npx ${PROJECT_CLI} doctor --ci --json
npx ${PROJECT_CLI} ci --json
npx ${PROJECT_CLI} docs-update --json
\\\`\\\`\\\`
Expected: 12-char token deterministic. All checks pass. docs-update reports fixed files (if any).

## Suite 6: Update & Presets

**[SYSTEM]** Preset switching:
\\\`\\\`\\\`bash
npx ${PROJECT_CLI} update --preset strict --json
npx ${PROJECT_CLI} update --preset balanced --json
\\\`\\\`\\\`
Expected: Strict shows restricted instructions. Balanced restores defaults.

**[SYSTEM]** Artifact refresh:
\\\`\\\`\\\`bash
npx ${PROJECT_CLI} update --rules --skills --agents --commands --dry-run --json
\\\`\\\`\\\`
Expected: Managed artifacts listed. Custom (managed_by: user) skipped.

## Suite 7: Preset Management

### 7a: Create & List

**[SYSTEM]**
\\\`\\\`\\\`bash
npx ${PROJECT_CLI} preset create test-preset --json
npx ${PROJECT_CLI} preset list --json
\\\`\\\`\\\`
Expected: Preset directory created at ${PROJECT_DIR}/presets/test-preset/ with preset.yaml and subdirs (rules/, skills/, agents/, commands/). Visible in list.

### 7b: Built-in Presets

**[SYSTEM]**
\\\`\\\`\\\`bash
npx ${PROJECT_CLI} preset list --builtin --json
\\\`\\\`\\\`
Expected: Shows 6 built-in presets: minimal, balanced, strict, fullstack, development, power-user. Each with [builtin] source tag.

### 7c: Validate

**[SYSTEM]**
\\\`\\\`\\\`bash
npx ${PROJECT_CLI} preset validate test-preset --json
\\\`\\\`\\\`
Expected: Preset "test-preset" is valid. Reports version, artifact counts (rules: 0, skills: 0, agents: 0, commands: 0).

### 7d: Export as ZIP

**[SYSTEM]**
\\\`\\\`\\\`bash
npx ${PROJECT_CLI} preset export test-preset --format zip --output /tmp/${PROJECT_NAME}-validation/
ls /tmp/${PROJECT_NAME}-validation/test-preset.zip
\\\`\\\`\\\`
Expected: ZIP file created. File exists at /tmp/${PROJECT_NAME}-validation/test-preset.zip.

### 7e: Remove

**[SYSTEM]**
\\\`\\\`\\\`bash
npx ${PROJECT_CLI} preset remove test-preset --json
npx ${PROJECT_CLI} preset list --json
\\\`\\\`\\\`
Expected: Preset removed. No longer visible in list. Lock file entry cleared.

### 7f: Install from ZIP

**[SYSTEM]**
\\\`\\\`\\\`bash
npx ${PROJECT_CLI} preset install /tmp/${PROJECT_NAME}-validation/test-preset.zip --json
npx ${PROJECT_CLI} preset list --json
npx ${PROJECT_CLI} preset validate test-preset --json
\\\`\\\`\\\`
Expected: Preset installed from ZIP. Visible in list with [zip] source. Validation passes. Lock file has source: "zip:..." entry.

### 7g: Cleanup

**[SYSTEM]**
\\\`\\\`\\\`bash
npx ${PROJECT_CLI} preset remove test-preset --json
rm -f /tmp/${PROJECT_NAME}-validation/test-preset.zip
\\\`\\\`\\\`
Expected: Preset and ZIP cleaned up.

### 7h: GitHub Preset Install

**[HUMAN]** Provide a GitHub repository URL that contains a valid preset (a repo with \\\`preset.yaml\\\` at the root). This can be:
- A public preset repo (e.g., \\\`github:my-org/my-preset\\\`)
- A private repo you have access to (SSH keys or GH_TOKEN configured)
- If none exists, create a small test repo: add a \\\`preset.yaml\\\` with \\\`name: test-gh-preset\\\`, \\\`version: "1.0.0"\\\`, push to GitHub, and provide the org/repo path.

**[SYSTEM]** Install the GitHub preset (substitute the real org/repo):
\\\`\\\`\\\`bash
npx ${PROJECT_CLI} preset install github:<org>/<repo> --json
\\\`\\\`\\\`
Expected: Preset cloned, validated, and installed to ${PROJECT_DIR}/presets/<name>/.

**[CODING AGENT]** Verify the installation:
1. Run \\\`npx ${PROJECT_CLI} preset list --json\\\` — preset must appear with \\\`sourceType: "github"\\\`
2. Read \\\`${PROJECT_DIR}/preset-lock.json\\\` — entry must have \\\`source: "github:..."\\\`, \\\`sourceType: "github"\\\`, and a \\\`commit\\\` hash
3. Verify \\\`${PROJECT_DIR}/presets/<name>/preset.yaml\\\` exists

**[SYSTEM]** Validate and clean up:
\\\`\\\`\\\`bash
npx ${PROJECT_CLI} preset validate <name> --json
npx ${PROJECT_CLI} preset remove <name> --json
\\\`\\\`\\\`
Expected: Validation passes. Preset removed. Lock file entry cleared.

### 7i: Preset Registry Search

**[HUMAN]** Check if a preset registry is configured in \\\`${PROJECT_DIR}/${PROJECT_NAME}.yaml\\\` under \\\`presetRegistry.url\\\`. If not configured, either:
- Add a \\\`presetRegistry\\\` section pointing to a real registry repo, OR
- Confirm this test should be skipped (the agent will note it as skipped)

**[SYSTEM]**
\\\`\\\`\\\`bash
npx ${PROJECT_CLI} preset search test --json
\\\`\\\`\\\`

**[CODING AGENT]** Verify the result:
- If registry is configured: results are returned or "No presets found matching" message (both valid)
- If registry is not configured or unreachable: a clear error message is reported (not a crash or unhandled exception)

### 7j: Preset Update

Prerequisite: A GitHub-sourced preset must be installed (from 7h). If 7h was skipped, skip this test too.

**[SYSTEM]**
\\\`\\\`\\\`bash
npx ${PROJECT_CLI} preset update --dry-run --json
\\\`\\\`\\\`

**[CODING AGENT]** Verify:
- GitHub-sourced presets: reports "up to date" or lists available version changes
- ZIP-sourced presets (if any): skipped with info message (ZIP presets require manual re-install)
- No presets tracked: reports "Nothing to update"

## Suite 8: MCP

**[SYSTEM]** Configure and verify:
\\\`\\\`\\\`bash
cat > ${PROJECT_DIR}/mcp.yaml << 'EOF'
servers:
  test-api:
    type: http
    url: "https://example.com/mcp"
EOF
npx ${PROJECT_CLI} generate --json
\\\`\\\`\\\`
Expected: .claude/mcp.json, .cursor/mcp.json, .codex/mcp.toml, .windsurf/mcp.json contain test-api.

## Suite 9: Backup & Revert

**[SYSTEM]**
\\\`\\\`\\\`bash
npx ${PROJECT_CLI} revert --list --json
npx ${PROJECT_CLI} revert --last --json
\\\`\\\`\\\`
Expected: Backups from prior generates. Restore succeeds.

## Suite 10: Marketplace

**[SYSTEM]**
\\\`\\\`\\\`bash
npx ${PROJECT_CLI} marketplace search test --json
\\\`\\\`\\\`
Note: May fail if no registry configured. This is expected.

## Suite 11: Clean & Reinstall

**[SYSTEM]**
\\\`\\\`\\\`bash
npx ${PROJECT_CLI} clean --json
npx ${PROJECT_CLI} generate --json
npx ${PROJECT_CLI} clean --all --json
\\\`\\\`\\\`
Expected: Clean removes generated. Regenerate works. Clean --all removes ${PROJECT_DIR}/.

## Suite 12: Agent Integration

**[HUMAN]** Open Claude Code in the test project.
**[HUMAN]** Ask: "verify ${PROJECT_NAME}"
**[HUMAN]** Copy response.
**[SYSTEM]** \\\`npx ${PROJECT_CLI} verify --check "<response>"\\\`
Expected: tokenMatch: true.

## Suite 13: Pre-Commit Hooks

**[SYSTEM]** Verify hook scripts exist:
\\\`\\\`\\\`bash
ls .git/hooks/pre-commit .git/hooks/commit-msg .git/hooks/${PROJECT_NAME}-secret-scan.mjs .git/hooks/${PROJECT_NAME}-file-size-check.mjs
\\\`\\\`\\\`
Expected: All 4 files present.

**[SYSTEM]** Test file size check (${PRE_COMMIT_MAX_FILE_LINES} LOC limit):
\\\`\\\`\\\`bash
python3 -c "print('\\n'.join(['line ' + str(i) for i in range(${PRE_COMMIT_MAX_FILE_LINES + 1})]))" > big-file.txt
git add big-file.txt
git commit -m "test: should fail"
\\\`\\\`\\\`
Expected: Commit blocked — "big-file.txt: ${PRE_COMMIT_MAX_FILE_LINES + 2} lines (max: ${PRE_COMMIT_MAX_FILE_LINES})".

**[SYSTEM]** Test secret scan:
\\\`\\\`\\\`bash
printf 'const key = "sk-%s"\\n' "abc123def456ghi789jkl012mno345pqr" > secret-test.js
git add secret-test.js
git commit -m "test: should fail"
\\\`\\\`\\\`
Expected: Commit blocked — "Potential secret found".

**[SYSTEM]** Test commit-msg validation:
\\\`\\\`\\\`bash
echo "hello" > valid-file.txt
git add valid-file.txt
git commit -m "bad message without type"
\\\`\\\`\\\`
Expected: Commit blocked — "Invalid commit message format".

**[SYSTEM]** Valid commit:
\\\`\\\`\\\`bash
git commit -m "test: validate pre-commit hooks work"
\\\`\\\`\\\`
Expected: Commit succeeds (proper format, small file, no secrets).

## Suite 14: Documentation Sync

**[CODING AGENT]** Stale a count to test detection:
\\\`\\\`\\\`bash
# Temporarily edit STATUS.md to say "Rule templates | 9 |"
\\\`\\\`\\\`

**[SYSTEM]**
\\\`\\\`\\\`bash
npx ${PROJECT_CLI} doctor --json
\\\`\\\`\\\`
Expected: W_DOCS_STALE warning — "STATUS.md says Rule templates: 9 but ${RULE_TEMPLATE_COUNT} exist — run: ${PROJECT_CLI} docs-update".

**[SYSTEM]**
\\\`\\\`\\\`bash
npx ${PROJECT_CLI} docs-update --json
\\\`\\\`\\\`
Expected: STATUS.md fixed. Count restored.

**[SYSTEM]**
\\\`\\\`\\\`bash
npx ${PROJECT_CLI} doctor --json
\\\`\\\`\\\`
Expected: No doc-sync warnings.

## Suite 15: Commit Workflow

**[SYSTEM]** Add commit skill and command:
\\\`\\\`\\\`bash
npx ${PROJECT_CLI} add skill commit --template commit --json
npx ${PROJECT_CLI} add command commit --template commit --json
npx ${PROJECT_CLI} generate --json
\\\`\\\`\\\`
Expected: Commit skill and command created. Generated for all agents.

**[CODING AGENT]** Verify the commit skill content includes:
- Conventional commits format (feat, fix, docs, refactor, test, chore)
- Pre-commit checks (formatting, linting, type checking, secret scan, file size)
- Troubleshooting section (tool not found, hooks not installed, message rejected)

## Suite 16: Watch Mode

**[SYSTEM]** Test auto-regeneration:
\\\`\\\`\\\`bash
npx ${PROJECT_CLI} watch --once &
sleep 1
echo "# trigger" >> ${PROJECT_DIR}/rules/my-custom.md
sleep 2
npx ${PROJECT_CLI} status --json
\\\`\\\`\\\`
Expected: Watch detects change and regenerates. Status shows no drift.

## Suite 17: Hook Dependencies & Version Check

**[SYSTEM]** Check hook dependency detection:
\\\`\\\`\\\`bash
npx ${PROJECT_CLI} doctor --json
\\\`\\\`\\\`
**[CODING AGENT]** Verify doctor output includes warnings for any missing hook tools (eslint, prettier, ruff, etc.) with install hints.

**[SYSTEM]** Test version check hook (if requiredVersion set in ${PROJECT_NAME}.yaml):
\\\`\\\`\\\`bash
ls .git/hooks/${PROJECT_NAME}-version-check.mjs
\\\`\\\`\\\`
Expected: File exists when manifest has \\\`${PROJECT_NAME}.requiredVersion\\\`.

## Suite 18: Update --from Source Pull

**[SYSTEM]**
\\\`\\\`\\\`bash
npx ${PROJECT_CLI} update --from ${PROJECT_NAME}/team-config --dry-run --json
\\\`\\\`\\\`
Note: May fail if repo doesn't exist. Verifies the --from flag is accepted and attempts a pull.

## Cleanup

**[SYSTEM]** \\\`rm -rf /tmp/${PROJECT_NAME}-validation\\\`

## References

- docs/guides/testing-guide.md — full testing procedure
- docs/guides/user-flows.md — all 30 user flows
- docs/troubleshooting.md — common issues (including hook troubleshooting)

## Available Agents

For specialized analysis during e2e validation, delegate to these agents (see \\\`agents/\\\` directory):
- **codi-test-generator** — Generate automated tests from e2e findings
- **codi-security-analyzer** — Security validation of auth flows and data handling
`;
}
