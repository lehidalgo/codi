export const template = `---
name: {{name}}
description: Comprehensive validation of all codi features. Use when asked to test, audit, or verify the codi installation end-to-end. Covers all 15 commands, 7 artifact types, and 30 user flows.
compatibility: [claude-code, cursor, codex]
managed_by: codi
---

# {{name}}

## Overview

This skill guides systematic validation of ALL codi features in a test project. Each step is labeled:
- **[SYSTEM]** — run this CLI command
- **[HUMAN]** — STOP and ask the human to perform this action
- **[CODING AGENT]** — the AI agent performs this

Full details: see docs/testing-guide.md and docs/user-flows.md.

## Suite 1: Setup

**[SYSTEM]** Create a test project and install codi:
\\\`\\\`\\\`bash
mkdir /tmp/codi-validation && cd /tmp/codi-validation
npm init -y && npm install codi-cli
npx codi --version
\\\`\\\`\\\`
Expected: Version prints (e.g., 0.3.0).

## Suite 2: Initialization

**[SYSTEM]** Non-interactive init:
\\\`\\\`\\\`bash
npx codi init --agents claude-code cursor codex --preset balanced --json
\\\`\\\`\\\`
Expected: .codi/ created with codi.yaml, flags.yaml (18 flags), rules/, skills/, frameworks/.

**[HUMAN]** Interactive wizard: run \\\`npx codi init --force\\\` in terminal. Select agents, rules, skills, preset. Verify output matches.

## Suite 3: Artifacts (all 4 types)

**[SYSTEM]** Add all templates:
\\\`\\\`\\\`bash
npx codi add rule --all --json
npx codi add skill --all --json
npx codi add agent --all --json
npx codi add command --all --json
\\\`\\\`\\\`
Expected: 9 rules, 5 skills, 3 agents, 2 commands. All managed_by: codi.

**[SYSTEM]** Add custom artifacts:
\\\`\\\`\\\`bash
npx codi add rule my-custom --json
npx codi add skill my-custom --json
\\\`\\\`\\\`
Expected: managed_by: user.

## Suite 4: Generation & Drift

**[SYSTEM]** Generate and check:
\\\`\\\`\\\`bash
npx codi generate --json
npx codi status --json
\\\`\\\`\\\`
Expected: Files generated. hasDrift: false.

**[SYSTEM]** Inject and fix drift:
\\\`\\\`\\\`bash
echo "edit" >> CLAUDE.md
npx codi status --json
npx codi generate --json
\\\`\\\`\\\`
Expected: hasDrift true, then false after regenerate.

**[SYSTEM]** Verify per-agent: .claude/rules/, .cursor/rules/*.mdc, AGENTS.md, .codex/agents/*.toml, .windsurfrules, .clinerules, .claude/skills/, .windsurf/skills/.

## Suite 5: Verification & Compliance

**[SYSTEM]**
\\\`\\\`\\\`bash
npx codi verify --json
npx codi compliance --json
npx codi doctor --ci --json
npx codi ci --json
\\\`\\\`\\\`
Expected: 12-char token deterministic. All checks pass.

## Suite 6: Update & Presets

**[SYSTEM]** Preset switching:
\\\`\\\`\\\`bash
npx codi update --preset strict --regenerate --json
npx codi update --preset balanced --regenerate --json
\\\`\\\`\\\`
Expected: Strict shows restricted instructions. Balanced restores defaults.

**[SYSTEM]** Artifact refresh:
\\\`\\\`\\\`bash
npx codi update --rules --skills --agents --commands --dry-run --json
\\\`\\\`\\\`
Expected: Managed artifacts listed. Custom (managed_by: user) skipped.

## Suite 7: Presets

**[SYSTEM]**
\\\`\\\`\\\`bash
npx codi preset create test-preset --json
npx codi preset list --json
\\\`\\\`\\\`
Expected: Preset directory created. Visible in list.

## Suite 8: MCP

**[SYSTEM]** Configure and verify:
\\\`\\\`\\\`bash
cat > .codi/mcp.yaml << 'EOF'
servers:
  test-api:
    type: http
    url: "https://example.com/mcp"
EOF
npx codi generate --json
\\\`\\\`\\\`
Expected: .claude/mcp.json, .cursor/mcp.json, .codex/mcp.toml, .windsurf/mcp.json contain test-api.

## Suite 9: Backup & Revert

**[SYSTEM]**
\\\`\\\`\\\`bash
npx codi revert --list --json
npx codi revert --last --json
\\\`\\\`\\\`
Expected: Backups from prior generates. Restore succeeds.

## Suite 10: Marketplace

**[SYSTEM]**
\\\`\\\`\\\`bash
npx codi marketplace search test --json
\\\`\\\`\\\`
Note: May fail if no registry configured. This is expected.

## Suite 11: Clean & Reinstall

**[SYSTEM]**
\\\`\\\`\\\`bash
npx codi clean --json
npx codi generate --json
npx codi clean --all --json
\\\`\\\`\\\`
Expected: Clean removes generated. Regenerate works. Clean --all removes .codi/.

## Suite 12: Agent Integration

**[HUMAN]** Open Claude Code in the test project.
**[HUMAN]** Ask: "verify codi"
**[HUMAN]** Copy response.
**[SYSTEM]** \\\`npx codi verify --check "<response>"\\\`
Expected: tokenMatch: true.

## Cleanup

**[SYSTEM]** \\\`rm -rf /tmp/codi-validation\\\`

## References

- docs/testing-guide.md — full testing procedure
- docs/user-flows.md — all 30 user flows
- docs/troubleshooting.md — common issues
`;
