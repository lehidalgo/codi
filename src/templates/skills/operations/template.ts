import {
  PROJECT_CLI,
  PROJECT_DIR,
  PROJECT_NAME,
  PROJECT_NAME_DISPLAY,
} from "#src/constants.js";
import type { TemplateCounts } from "../types.js";

export function getTemplate(counts: TemplateCounts): string {
  return `---
name: {{name}}
description: Unified ${PROJECT_NAME} operations skill. Use when managing rules, skills, agents, commands, configuration, verification, or troubleshooting ${PROJECT_NAME} setup.
category: ${PROJECT_NAME_DISPLAY} Platform
managed_by: ${PROJECT_NAME}
---

# ${PROJECT_NAME_DISPLAY} Operations

## Artifact Lifecycle

${PROJECT_NAME_DISPLAY} manages 4 artifact types with identical lifecycle:

| Type | Location | Create | Templates |
|------|----------|--------|-----------|
| Rules | ${PROJECT_DIR}/rules/ | ${PROJECT_CLI} add rule | ${counts.rules} templates |
| Skills | ${PROJECT_DIR}/skills/ | ${PROJECT_CLI} add skill | ${counts.skills} templates |
| Agents | ${PROJECT_DIR}/agents/ | ${PROJECT_CLI} add agent | ${counts.agents} templates |
| Commands | ${PROJECT_DIR}/commands/ | ${PROJECT_CLI} add command | ${counts.commands} templates |

### Creating Artifacts

\`\`\`bash
${PROJECT_CLI} add rule <name> --template <template>    # From template (managed_by: ${PROJECT_NAME})
${PROJECT_CLI} add rule <name>                          # Blank skeleton (managed_by: user)
${PROJECT_CLI} add rule --all                           # All templates at once
\`\`\`

Same pattern for skill, agent, command.

### Ownership (managed_by)

- \`managed_by: ${PROJECT_NAME}\` — template-managed, updated by \`${PROJECT_CLI} update\`
- \`managed_by: user\` — custom, never overwritten by ${PROJECT_NAME}

### Frontmatter Format

Rules:
\`\`\`yaml
name: rule-name
description: What this rule does
priority: high | medium | low
alwaysApply: true
managed_by: ${PROJECT_NAME} | user
\`\`\`

Skills:
\`\`\`yaml
name: skill-name
description: What this skill does
compatibility: [claude-code, cursor]
managed_by: ${PROJECT_NAME} | user
\`\`\`

Agents:
\`\`\`yaml
name: agent-name
description: When to use this agent
tools: [Read, Grep, Glob, Bash]
model: inherit
managed_by: ${PROJECT_NAME} | user
\`\`\`

Commands:
\`\`\`yaml
name: command-name
description: What this command does
managed_by: ${PROJECT_NAME} | user
\`\`\`

## Configuration

### Flag Presets
\`\`\`bash
${PROJECT_CLI} update --preset minimal     # Permissive
${PROJECT_CLI} update --preset balanced    # Recommended (default)
${PROJECT_CLI} update --preset strict      # Enforced + locked
\`\`\`

### Preset Management
\`\`\`bash
${PROJECT_CLI} preset create <name>              # Scaffold a new preset directory
${PROJECT_CLI} preset create --interactive       # Interactive preset creation wizard
${PROJECT_CLI} preset list                       # List installed presets
${PROJECT_CLI} preset list --builtin             # Include built-in presets (python-web, typescript-fullstack, security-hardened)
${PROJECT_CLI} preset validate <name>            # Validate preset structure and schema
${PROJECT_CLI} preset export <name> --format zip # Export as ZIP for private distribution
${PROJECT_CLI} preset install ./preset.zip       # Install from local ZIP file
${PROJECT_CLI} preset install github:org/repo    # Install from GitHub repository
${PROJECT_CLI} preset remove <name>             # Remove an installed preset
${PROJECT_CLI} preset search <query>            # Search preset registry
${PROJECT_CLI} preset update                    # Update GitHub-sourced presets
\`\`\`

### Update Artifacts
\`\`\`bash
${PROJECT_CLI} update --rules --skills --agents    # Refresh managed_by: ${PROJECT_NAME} artifacts (auto-generates)
${PROJECT_CLI} update --from org/team-repo         # Pull from central repo (read-only)
${PROJECT_CLI} update --dry-run                    # Preview changes without writing
\`\`\`

### MCP Configuration
Place MCP servers in \`${PROJECT_DIR}/mcp.yaml\`. Distributed to all agents automatically.

## Verification & Diagnostics

\`\`\`bash
${PROJECT_CLI} verify                # Show verification token + artifact list
${PROJECT_CLI} verify --check "..."  # Validate agent response
${PROJECT_CLI} compliance            # Full health check (validate + doctor + drift)
${PROJECT_CLI} doctor --ci           # CI-mode health check (exit non-zero on failure)
${PROJECT_CLI} status                # Check for drift in generated files
\`\`\`

## Generation & Maintenance

\`\`\`bash
${PROJECT_CLI} generate              # Regenerate all agent config files (only needed after manual ${PROJECT_DIR}/ edits)
${PROJECT_CLI} generate --dry-run    # Preview without writing
${PROJECT_CLI} docs-update           # Auto-fix stale documentation counts
${PROJECT_CLI} doctor                # Detect remaining doc issues — act on ACTION prompts
${PROJECT_CLI} clean                 # Remove generated files (keep ${PROJECT_DIR}/)
${PROJECT_CLI} clean --all           # Full uninstall (remove ${PROJECT_DIR}/ too)
${PROJECT_CLI} revert --list         # Show available backups
${PROJECT_CLI} revert --last         # Restore most recent backup
${PROJECT_CLI} watch                 # Auto-regenerate on ${PROJECT_DIR}/ changes
\`\`\`

## Troubleshooting

**Config validation fails:** Run \`${PROJECT_CLI} validate --json\` to see specific errors.

**Drift detected:** Run \`${PROJECT_CLI} generate\` to regenerate from current config.

**Token mismatch:** Config changed since last generate. Run \`${PROJECT_CLI} generate\`, then \`${PROJECT_CLI} verify\`.

**Agent doesn't see rules:** Check \`${PROJECT_CLI} status\` for drift. Verify generated files exist.

**Update didn't change anything:** Check \`managed_by\` field — only \`${PROJECT_NAME}\` artifacts are updated.

**Backup needed:** Backups are automatic before each generate. Use \`${PROJECT_CLI} revert --list\` to see history.
`;
}
