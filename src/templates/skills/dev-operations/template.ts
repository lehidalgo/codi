import {
  PROJECT_CLI,
  PROJECT_DIR,
  PROJECT_NAME,
  PROJECT_NAME_DISPLAY,
  PLATFORM_CATEGORY,
  SUPPORTED_PLATFORMS_YAML,
} from "#src/constants.js";
import type { TemplateCounts } from "../types.js";

export function getTemplate(counts: TemplateCounts): string {
  return `---
name: {{name}}
description: Unified ${PROJECT_NAME} operations skill. Use when managing rules, skills, agents, configuration, verification, or troubleshooting ${PROJECT_NAME} setup.
category: ${PLATFORM_CATEGORY}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 13
---

# ${PROJECT_NAME_DISPLAY} Operations

## When to Activate

- User wants to add, update, or remove rules, skills, or agents
- User needs to configure flags, presets, or MCP servers
- User asks to verify, diagnose, or troubleshoot the ${PROJECT_NAME} installation
- User asks about drift, backups, or regenerating agent config files

## Artifact Lifecycle

${PROJECT_NAME_DISPLAY} manages 3 artifact types with identical lifecycle:

| Type | Location | Create | Templates |
|------|----------|--------|-----------|
| Rules | ${PROJECT_DIR}/rules/ | ${PROJECT_CLI} add rule | ${counts.rules} templates |
| Skills | ${PROJECT_DIR}/skills/ | ${PROJECT_CLI} add skill | ${counts.skills} templates |
| Agents | ${PROJECT_DIR}/agents/ | ${PROJECT_CLI} add agent | ${counts.agents} templates |

### Creating Artifacts

\`\`\`bash
${PROJECT_CLI} add rule <name> --template <template>    # From template (managed_by: ${PROJECT_NAME})
${PROJECT_CLI} add rule <name>                          # Blank skeleton (managed_by: user)
${PROJECT_CLI} add rule --all                           # All templates at once
\`\`\`

Same pattern for skill, agent.

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
compatibility: ${SUPPORTED_PLATFORMS_YAML}
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
${PROJECT_CLI} preset list --builtin             # Include built-in presets (minimal, balanced, strict, fullstack, power-user)
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

## Conflict Resolution

When \`${PROJECT_CLI} generate\` exits with code 2, it means one or more files have conflicts that could not be auto-merged. The command writes a JSON payload to stdout:

\`\`\`json
{
  "type": "conflicts",
  "items": [
    {
      "label": "CLAUDE.md",
      "fullPath": "/absolute/path/CLAUDE.md",
      "currentContent": "... your local version ...",
      "incomingContent": "... new template version ..."
    }
  ]
}
\`\`\`

### When you detect exit code 2

**[CODING AGENT]** Do the following immediately — do NOT show the raw JSON or exit code to the user:

1. Parse the JSON payload from stdout.
2. Tell the user in plain language:

> "I ran \`${PROJECT_CLI} generate\` and found conflicts in N file(s): [comma-separated labels].
> These files have local customizations that differ from the updated templates.
> How would you like to resolve this?"

3. Offer two options:

> **[A] Let me handle it** — I will read both versions, merge them preserving your customizations, and continue automatically.
>
> **[B] I'll do it manually** — I will open the files with conflict markers so you can choose each change yourself.

4. Wait for the user's choice before proceeding.

### Path A — Agent resolves

For each item in the payload:

1. Read \`currentContent\` (your local version) and \`incomingContent\` (the new template).
2. Produce a merged version:
   - Keep all content unique to \`currentContent\` (your customizations).
   - Add all sections present in \`incomingContent\` but absent from \`currentContent\`.
   - For sections present in both where the template changed: keep \`currentContent\` unless it matches the old template exactly, in which case take \`incomingContent\`.
3. Write the merged content to \`fullPath\`.

After writing all resolved files, re-run \`${PROJECT_CLI} generate\`:
- If it exits 0: report success to the user.
- If it exits 2 again: switch to Path B — the semantic merge was not sufficient. Tell the user: "The automatic merge could not fully resolve these conflicts. I've opened the files with conflict markers — please resolve them manually and confirm."

### Path B — Manual resolve

For each item in the payload:

1. Write the file at \`fullPath\` with git-style conflict markers:
\`\`\`
<<<<<<< current (your version)
[currentContent]
=======
[incomingContent]
>>>>>>> incoming (new template)
\`\`\`

2. Open the file in the user's editor (use \`$VISUAL\` → \`$EDITOR\` → \`code\` → \`vi\` resolution order).

3. Tell the user:
> "I've opened [label] with conflict markers. Choose the version you want for each section, remove the markers, save the file, and let me know when you're done."

4. When the user confirms, re-run \`${PROJECT_CLI} generate\`. If it exits 0, report success.

### Version bump reminder

After any successful \`${PROJECT_CLI} generate\` run that writes new content, remind the user:
> "Generation complete. If this was triggered by a template update, consider running \`${PROJECT_CLI} update\` to check for other stale artifacts."

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

## Related Skills

- **${PROJECT_NAME}-compare-preset** — Compare local artifacts against upstream templates
- **${PROJECT_NAME}-error-recovery** — Recover from repeated agent mistakes during operations
`;
}
