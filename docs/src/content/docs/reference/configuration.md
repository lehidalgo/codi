---
title: Configuration
description: Complete reference for Codi's configuration system — directory structure, manifest, flags, and MCP
sidebar:
  order: 2
---

Complete reference for Codi's configuration system: directory structure, manifest, flags, and MCP.

## Directory Structure

```
.codi/
  codi.yaml                    # Project manifest
  flags.yaml                   # Behavioral flags (16 flags)
  state.json                   # Generation state (auto-managed)
  mcp.yaml                     # MCP server configuration
  rules/                       # All rules (managed_by: codi or user)
  skills/
    {name}/
      SKILL.md                 # Skill definition
      scripts/                 # Skill scripts
      references/              # Reference materials
      assets/                  # Static assets
      evals/                   # Evaluation files
  agents/                      # Agent definitions (Markdown)
  brands/                      # Brand definitions (BRAND.md + assets)
  presets/                     # Installed presets
  backups/                     # Automatic backups (max 5)
  hooks/
    codi-skill-tracker.cjs     # InstructionsLoaded hook (Claude Code)
    codi-skill-observer.cjs    # Stop hook (Claude Code + Codex)
  .session/
    active-skills.json         # Per-session skill tracking (auto-managed)
  feedback/
    {timestamp}-{artifact}-{id}.json  # One file per collected observation
  operations-ledger.json       # Audit trail of all CLI operations
```

---

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

# Pin minimum Codi version
codi:
  requiredVersion: ">=2.0.0"

# Control which content types are included in generation
layers:
  rules: true       # default: true
  skills: true      # default: true
  agents: true      # default: true
  context: true     # default: true

# Presets to load (applied in order)
presets:
  - balanced
```

### Manifest Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | Yes | — | Project name (alphanumeric + hyphens) |
| `version` | `1` | Yes | — | Manifest version (always `1`) |
| `description` | string | No | — | Project description |
| `agents` | string[] | No | — | Agent IDs to generate for |
| `layers` | object | No | — | Toggle content types |
| `layers.rules` | boolean | No | `true` | Include rules in generation |
| `layers.skills` | boolean | No | `true` | Include skills in generation |
| `layers.agents` | boolean | No | `true` | Include agents in generation |
| `layers.context` | boolean | No | `true` | Include context in generation |
| `presets` | string[] | No | — | Presets to load (order matters) |

---

## Flags (`flags.yaml`)

Flags control how AI agents behave in your project. Each flag has a **mode** and a **value**.

```yaml
security_scan:
  mode: enforced
  value: true
  locked: true          # Prevents overriding

type_checking:
  mode: conditional
  value: strict
  conditions:
    agent: [claude-code]       # Only apply for this agent
    file_pattern: ["src/**/*.ts"]  # Only apply to these files
```

### All Flags

| Flag | Type | Default | Hook | Description |
|------|------|---------|------|-------------|
| `auto_commit` | boolean | `false` | — | Automatic commits after changes |
| `test_before_commit` | boolean | `true` | tests | Run tests before commit |
| `security_scan` | boolean | `true` | secret-detection | Mandatory security scanning |
| `type_checking` | enum | `strict` | typecheck | Type checking level |
| `require_tests` | boolean | `false` | — | Require tests for new code |
| `allow_shell_commands` | boolean | `true` | — | Allow shell command execution |
| `allow_file_deletion` | boolean | `true` | — | Allow file deletion |
| `lint_on_save` | boolean | `true` | — | Lint files on save |
| `allow_force_push` | boolean | `false` | — | Allow force push to remote |
| `require_pr_review` | boolean | `true` | — | Require PR review before merge |
| `mcp_allowed_servers` | string[] | `[]` | — | Allowed MCP server names |
| `require_documentation` | boolean | `false` | doc-check | Require documentation for new code |
| `doc_protected_branches` | string[] | `["main","develop","release/*"]` | doc-check | Branch patterns requiring documentation verification |
| `allowed_languages` | string[] | `["*"]` | — | Allowed programming languages |
| `progressive_loading` | enum | `metadata` | — | Skill inlining strategy for single-file agents |
| `drift_detection` | enum | `warn` | — | Drift detection behavior |
| `auto_generate_on_change` | boolean | `false` | — | Auto-generate on config change |

Flags with a **Hook** value create pre-commit checks that enforce the flag at commit time.

### Flag Modes

Each flag supports 6 modes that control behavior across the inheritance chain:

| Mode | Behavior | Can Override? |
|------|----------|---------------|
| `enforced` | Always active, non-negotiable | No (stops resolution) |
| `enabled` | Active with specified value | Yes |
| `disabled` | Explicitly turned off | Yes |
| `inherited` | Skip — use parent layer's value | Yes |
| `delegated_to_agent_default` | Use the flag's catalog default | Yes |
| `conditional` | Apply only if conditions match | Yes |

### Conditional Flags

The `conditional` mode requires a `conditions` block with at least one key:

```yaml
require_tests:
  mode: conditional
  value: true
  conditions:
    agent: [claude-code]           # Match by agent
    file_pattern: ["src/**/*.ts"]  # Match by file glob
```

All specified conditions must match for the flag to apply.

### Locking Flags

Flags can be locked at the repo level to prevent overrides:

```yaml
security_scan:
  mode: enforced
  value: true
  locked: true
```

Attempting to override a locked flag produces a validation error.

### Flag-to-Instruction Mapping

Flags are automatically translated into natural-language instructions in generated files:

| Flag | Trigger Value | Generated Instruction |
|------|--------------|----------------------|
| `allow_shell_commands` | `false` | Do NOT execute shell commands. |
| `allow_file_deletion` | `false` | Do NOT delete files. |
| `require_tests` | `true` | Write tests for all new code. |
| `allow_force_push` | `false` | Do NOT use force push (--force) on git operations. |
| `require_pr_review` | `true` | All changes require pull request review before merging. |
| `require_documentation` | `true` | Write documentation for all new code and APIs. |

Operational flags (`drift_detection`, `progressive_loading`, `auto_generate_on_change`) control Codi's behavior and do not generate agent instructions.

---

## Configuration Layers

Configuration is resolved from presets and the project's `.codi/` directory:

| Layer | Source | Description |
|-------|--------|-------------|
| **Preset** | Built-in or installed presets | Applied at install time |
| **Repo** | `.codi/` directory | Project-level configuration (source of truth) |
| **User** | `~/.codi/user.yaml` | Personal preferences (never committed) |

---

## MCP Configuration

Define MCP servers in `.codi/mcp.yaml`:

```yaml
servers:
  github:
    command: npx
    args: ["-y", "@anthropic-ai/mcp-server-github"]
    env:
      GITHUB_TOKEN: "${GITHUB_TOKEN}"

  memory:
    command: npx
    args: ["-y", "@anthropic-ai/mcp-memory-server"]
    enabled: false   # Disable without removing
```

### MCP Server Fields

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"stdio"` or `"http"` | Server transport type |
| `command` | string | Command to start the server |
| `args` | string[] | Command arguments |
| `env` | Record | Environment variables |
| `url` | string | HTTP URL (for `http` type) |
| `headers` | Record | HTTP headers (for `http` type) |
| `enabled` | boolean | Toggle server on/off (default: `true`) |

### Built-in MCP Server Templates

33 server templates available via `codi add mcp-server <name>`, organized into three categories:

| Category | Examples |
|:---------|:---------|
| `official` | github, anthropic-docs, memory, filesystem, fetch |
| `vendor` | neon-cloud (HTTP), graph-code, chrome-devtools, openai-developer-docs |
| `community` | Various community-contributed servers |

```bash
codi add mcp-server github --template github
```

### Output Locations

MCP config is distributed to each agent in its native format:

| Agent | Config File |
|-------|-------------|
| Claude Code | `.mcp.json` |
| Cursor | `.cursor/mcp.json` |
| Codex | `.codex/config.toml` |

---

## Hooks (Heartbeat Feedback Loop)

`codi generate` writes two hook scripts to `.codi/hooks/` and registers them automatically in the agent's settings file. You do not configure hooks manually.

### Claude Code — `.claude/settings.json`

`settings.json` is always generated. It contains:

```json
{
  "hooks": {
    "InstructionsLoaded": [
      {
        "type": "command",
        "command": ".codi/hooks/codi-skill-tracker.cjs",
        "timeout": 5,
        "async": true
      }
    ],
    "Stop": [
      {
        "type": "command",
        "command": ".codi/hooks/codi-skill-observer.cjs",
        "timeout": 15
      }
    ]
  }
}
```

If you need personal hooks that run alongside Codi's, add them to `.claude/settings.local.json`. Claude Code auto-merges that file with `settings.json` at startup. Never edit `settings.json` directly — it is overwritten by `codi generate`.

### Codex — `.codex/hooks.json`

Codex has no `InstructionsLoaded` event. Only the Stop observer is wired:

```json
{
  "Stop": [
    {
      "type": "command",
      "command": ".codi/hooks/codi-skill-observer.cjs",
      "timeout": 15
    }
  ]
}
```

### What the hooks do

| Hook script | Trigger | Action |
|-------------|---------|--------|
| `codi-skill-tracker.cjs` | InstructionsLoaded | Records which Codi skills loaded in this session to `.codi/.session/active-skills.json` |
| `codi-skill-observer.cjs` | Stop | Reads the transcript, extracts `[CODI-OBSERVATION: ...]` markers, writes feedback JSON to `.codi/feedback/` |

See the [self-improvement guide](/guides/self-improvement) for a full explanation of how the feedback loop works.
