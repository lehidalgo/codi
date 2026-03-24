# Configuration Guide

Complete reference for codi's configuration system: directory structure, manifest, flags, presets, and flag-to-instruction mapping.

## Directory Structure

```
.codi/
  codi.yaml                    # Project manifest
  flags.yaml                   # Behavioral flags (18 flags)
  state.json                   # Generation state (auto-managed)
  rules/
    generated/
      common/                  # Auto-generated rules
    custom/                    # Your custom rules (Markdown)
  skills/                      # Your custom skills (Markdown)
  lang/                        # Language-specific flag overrides (*.yaml)
  frameworks/                  # Framework-specific flag overrides (*.yaml)
  agents/                      # Agent-specific flag overrides (*.yaml)
```

## Manifest (`codi.yaml`)

The manifest declares your project name, target agents, and optional settings.

```yaml
name: my-project
version: "1"

# Which agents to generate config for
agents:
  - claude-code
  - cursor
  - codex
  - windsurf
  - cline

# Reference a team config (loaded from ~/.codi/teams/frontend.yaml)
team: frontend

# Pin minimum codi version
codi:
  requiredVersion: ">=0.1.0"

# Remote source for centralized team artifacts (used by codi update --from)
source:
  repo: "org/team-codi-config"
  branch: main
  paths: [rules, skills, agents]

# Control which content types are included
layers:
  rules: true
  skills: true
  commands: true
  agents: true
  context: true
```

## Flags (`flags.yaml`)

Flags control how AI agents behave in your project. Each flag has a **mode** and a **value**.

```yaml
security_scan:
  mode: enforced
  value: true
  locked: true          # Prevents lower layers from overriding

max_file_lines:
  mode: enabled
  value: 500

type_checking:
  mode: conditional
  value: strict
  conditions:
    lang: [typescript]   # Only apply when language is TypeScript
```

### All 18 Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `auto_commit` | boolean | `false` | Automatic commits after changes |
| `test_before_commit` | boolean | `true` | Run tests before commit |
| `security_scan` | boolean | `true` | Mandatory security scanning |
| `type_checking` | enum | `strict` | Type checking level (`strict`, `basic`, `off`) |
| `max_file_lines` | number | `700` | Maximum lines per file |
| `require_tests` | boolean | `false` | Require tests for new code |
| `allow_shell_commands` | boolean | `true` | Allow shell command execution |
| `allow_file_deletion` | boolean | `true` | Allow file deletion |
| `lint_on_save` | boolean | `true` | Lint files on save |
| `allow_force_push` | boolean | `false` | Allow force push to remote |
| `require_pr_review` | boolean | `true` | Require PR review before merge |
| `mcp_allowed_servers` | string[] | `[]` | Whitelist of allowed MCP servers |
| `require_documentation` | boolean | `false` | Require documentation for new code |
| `allowed_languages` | string[] | `["*"]` | Allowed programming languages (`*` = all) |
| `max_context_tokens` | number | `50000` | Maximum context token window |
| `progressive_loading` | enum | `metadata` | Loading strategy (`off`, `metadata`, `full`) |
| `drift_detection` | enum | `warn` | Drift behavior (`off`, `warn`, `error`) |
| `auto_generate_on_change` | boolean | `false` | Auto-regenerate on config change |

Flags are translated into natural-language instructions embedded in each agent's config file. For example, `allow_force_push: false` becomes _"Do NOT use force push (--force) on git operations."_

### Flag Modes

Each flag supports 6 modes that control how it behaves across the inheritance chain:

| Mode | Behavior | Can Override? |
|------|----------|---------------|
| `enforced` | Always active, non-negotiable | No (stops resolution) |
| `enabled` | Active with specified value | Yes |
| `disabled` | Explicitly turned off | Yes |
| `inherited` | Skip — use parent layer's value | Yes |
| `delegated_to_agent_default` | Use the flag's catalog default | Yes |
| `conditional` | Apply only if conditions match | Yes |

### Conditional Mode

The `conditional` mode requires a `conditions` block with at least one key:

```yaml
require_tests:
  mode: conditional
  value: true
  conditions:
    lang: [typescript, python]     # Match by language
    framework: [react, nextjs]     # Match by framework
    agent: [claude-code]           # Match by agent
    file_pattern: ["src/**/*.ts"]  # Match by file glob
```

All specified conditions must match for the flag to apply.

### Locking Flags

Flags can be locked at org, team, or repo levels to prevent lower layers from overriding them:

```yaml
# In ~/.codi/org.yaml — nobody can disable security scanning
security_scan:
  mode: enforced
  value: true
  locked: true
```

Attempting to override a locked flag at a lower layer produces a validation error.

### Example `flags.yaml` (balanced preset)

This is what `flags.yaml` looks like after running `codi init` with the balanced preset:

```yaml
auto_commit:
  mode: enabled
  value: false
test_before_commit:
  mode: enabled
  value: true
security_scan:
  mode: enabled
  value: true
type_checking:
  mode: enabled
  value: strict
max_file_lines:
  mode: enabled
  value: 700
allow_force_push:
  mode: enabled
  value: false
require_pr_review:
  mode: enabled
  value: true
drift_detection:
  mode: enabled
  value: warn
# ... and 10 more flags
```

### Flag-to-Instruction Mapping

Flags in `flags.yaml` are automatically translated into natural-language instructions in the generated files:

| Flag YAML | Generated Instruction |
|-----------|----------------------|
| `allow_force_push: false` | "Do NOT use force push (--force) on git operations." |
| `max_file_lines: 700` | "Keep source code files under 700 lines. Documentation files have no line limit." |
| `require_pr_review: true` | "All changes require pull request review before merging." |
| `require_tests: true` | "Write tests for all new code." |
| `allow_shell_commands: false` | "Do NOT execute shell commands." |
| `require_documentation: true` | "Write documentation for all new code and APIs." |
| `mcp_allowed_servers: [github, jira]` | "Only use these MCP servers: github, jira." |
| `allowed_languages: [typescript, python]` | "Only use these languages: typescript, python." |
| `max_context_tokens: 50000` | "Maximum context window: 50000 tokens." |

Flags that are operational (like `drift_detection`, `progressive_loading`, `lint_on_save`) don't generate agent instructions — they control codi's behavior instead.

## Presets

Presets control the flag strictness level. Choose one during `codi init --preset`:

| Preset | Philosophy |
|--------|-----------|
| `minimal` | Permissive — security off, no test requirements, all actions allowed |
| `balanced` | Recommended — security on, type-checking strict, no force-push |
| `strict` | Enforced — security locked, tests required, shell/delete restricted |

<details>
<summary>Preset comparison (click to expand)</summary>

| Flag | Minimal | Balanced | Strict |
|------|---------|----------|--------|
| `security_scan` | `false` | `true` | `true` (enforced, locked) |
| `test_before_commit` | `false` | `true` | `true` (enforced, locked) |
| `type_checking` | `off` | `strict` | `strict` (enforced, locked) |
| `max_file_lines` | `1000` | `700` | `500` |
| `require_tests` | `false` | `false` | `true` (enforced, locked) |
| `allow_shell_commands` | `true` | `true` | `false` |
| `allow_file_deletion` | `true` | `true` | `false` |
| `allow_force_push` | `true` | `false` | `false` (enforced, locked) |
| `require_pr_review` | `false` | `true` | `true` (enforced, locked) |
| `require_documentation` | `false` | `false` | `true` |
| `drift_detection` | `off` | `warn` | `error` |
| `auto_generate_on_change` | `false` | `false` | `true` |

Flags marked "enforced, locked" in the strict preset cannot be overridden by any lower layer.

</details>

## Artifact Ownership

Rules, skills, and agents all use a `managed_by` field in their frontmatter:
- **`managed_by: codi`** — created from a template, updated by `codi update --rules`, `--skills`, or `--agents`
- **`managed_by: user`** — custom artifact, never overwritten by codi

When you run `codi add rule security --template security`, the rule is created with `managed_by: codi`. When you run `codi add rule my-custom-rule` (no template), it's `managed_by: user`. The same applies to skills and agents.

## Commands Directory

```
.codi/commands/           # Custom slash commands (Markdown)
```

Commands are Markdown files in `.codi/commands/` with YAML frontmatter:

```markdown
---
name: review
description: Review recent code changes
---
[Command instructions...]
```

Available templates: `review`, `test-run`. Create with `codi add command <name> --template <template>`.

## MCP Configuration

```yaml
# .codi/mcp.yaml
servers:
  github:
    command: npx
    args: ["-y", "@anthropic-ai/mcp-server-github"]
    env:
      GITHUB_TOKEN: "${GITHUB_TOKEN}"
```

MCP config is distributed to each agent in its native format:
- Claude Code: `.claude/mcp.json`
- Codex: `.codex/mcp.toml`
- Cursor: `.cursor/mcp.json`
- Windsurf: `.windsurf/mcp.json`

## Marketplace Configuration

```yaml
# codi.yaml
marketplace:
  registry: "org/codi-skills-registry"
  branch: main
```
