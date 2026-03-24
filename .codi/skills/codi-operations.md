---
name: codi-operations
description: Unified codi operations skill. Use when managing rules, skills, agents, commands, configuration, verification, or troubleshooting codi setup.
managed_by: codi
---

# Codi Operations

## Artifact Lifecycle

Codi manages 4 artifact types with identical lifecycle:

| Type | Location | Create | Templates |
|------|----------|--------|-----------|
| Rules | .codi/rules/custom/ | codi add rule | 9 templates |
| Skills | .codi/skills/ | codi add skill | 5 templates |
| Agents | .codi/agents/ | codi add agent | 3 templates |
| Commands | .codi/commands/ | codi add command | 2 templates |

### Creating Artifacts

```bash
codi add rule <name> --template <template>    # From template (managed_by: codi)
codi add rule <name>                          # Blank skeleton (managed_by: user)
codi add rule --all                           # All templates at once
```

Same pattern for skill, agent, command.

### Ownership (managed_by)

- `managed_by: codi` — template-managed, updated by `codi update`
- `managed_by: user` — custom, never overwritten by codi

### Frontmatter Format

Rules:
```yaml
name: rule-name
description: What this rule does
priority: high | medium | low
alwaysApply: true
managed_by: codi | user
```

Skills:
```yaml
name: skill-name
description: What this skill does
compatibility: [claude-code, cursor]
managed_by: codi | user
```

Agents:
```yaml
name: agent-name
description: When to use this agent
tools: [Read, Grep, Glob, Bash]
model: inherit
managed_by: codi | user
```

Commands:
```yaml
name: command-name
description: What this command does
managed_by: codi | user
```

## Configuration

### Presets
```bash
codi update --preset minimal     # Permissive
codi update --preset balanced    # Recommended (default)
codi update --preset strict      # Enforced + locked
```

### Update Artifacts
```bash
codi update --rules --skills --agents    # Refresh managed_by: codi artifacts
codi update --from org/team-repo         # Pull from central repo (read-only)
codi update --regenerate                 # Also regenerate after update
```

### MCP Configuration
Place MCP servers in `.codi/mcp.yaml`. Distributed to all agents automatically.

## Verification & Diagnostics

```bash
codi verify                # Show verification token + artifact list
codi verify --check "..."  # Validate agent response
codi compliance            # Full health check (validate + doctor + drift)
codi doctor --ci           # CI-mode health check (exit non-zero on failure)
codi status                # Check for drift in generated files
```

## Generation & Maintenance

```bash
codi generate              # Regenerate all agent config files
codi generate --dry-run    # Preview without writing
codi clean                 # Remove generated files (keep .codi/)
codi clean --all           # Full uninstall (remove .codi/ too)
codi revert --list         # Show available backups
codi revert --last         # Restore most recent backup
codi watch                 # Auto-regenerate on .codi/ changes
```

## Troubleshooting

**Config validation fails:** Run `codi validate --json` to see specific errors.

**Drift detected:** Run `codi generate` to regenerate from current config.

**Token mismatch:** Config changed since last generate. Run `codi generate`, then `codi verify`.

**Agent doesn't see rules:** Check `codi status` for drift. Verify generated files exist.

**Update didn't change anything:** Check `managed_by` field — only `codi` artifacts are updated.

**Backup needed:** Backups are automatic before each generate. Use `codi revert --list` to see history.

