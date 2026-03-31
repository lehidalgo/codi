# Configuration

Complete reference for Codi's configuration system: directory structure, manifest, flags, and MCP.

## Directory Structure

```
.codi/
  codi.yaml                    # Project manifest
  flags.yaml                   # Behavioral flags (18 flags)
  state.json                   # Generation state (auto-managed)
  mcp.yaml                     # MCP server configuration
  rules/
    generated/
      common/                  # Auto-generated rules (managed_by: codi)
    custom/                    # Your custom rules (managed_by: user)
  skills/
    {name}/
      SKILL.md                 # Skill definition
      scripts/                 # Skill scripts
      references/              # Reference materials
      assets/                  # Static assets
      evals/                   # Evaluation files
  agents/                      # Agent definitions (Markdown)
  commands/                    # Slash commands (Markdown)
  brands/                      # Brand definitions (BRAND.md + assets)
  presets/                     # Installed presets
  backups/                     # Automatic backups (max 5)
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
  requiredVersion: ">=0.9.0"

# Control which content types are included in generation
layers:
  rules: true       # default: true
  skills: true       # default: true
  commands: true     # default: true
  agents: true       # default: true
  context: true      # default: true

# Presets to load (applied in order)
presets:
  - balanced

# Marketplace registry for skill search/install
marketplace:
  registry: "org/codi-skills-registry"
  branch: main
```

### Manifest Fields

<!-- GENERATED:START:manifest_fields -->
| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | Yes | — | Project name (alphanumeric + hyphens) |
| `version` | `1` | Yes | — | Manifest version (always `1`) |
| `description` | string | No | — | Project description |
| `agents` | string[] | No | — | Agent IDs to generate for |
| `layers` | object | No | — | Toggle content types |
| `layers.rules` | boolean | Yes | `true` | Include rules in generation |
| `layers.skills` | boolean | Yes | `true` | Include skills in generation |
| `layers.commands` | boolean | Yes | `true` | Include commands in generation |
| `layers.agents` | boolean | Yes | `true` | Include agents in generation |
| `layers.context` | boolean | Yes | `true` | Include context in generation |
| `engine` | object | No | — |  |
| `engine.requiredVersion` | string | No | — |  |
| `team` | string | No | — | Team name for team-level config |
| `source` | object | No | — | Remote repo for `codi update --from` |
| `source.repo` | string | Yes | — | Repository identifier |
| `source.branch` | string | Yes | `main` | Branch to pull from |
| `source.paths` | string[] | Yes | `["rules","skills","agents"]` | Artifact paths to sync |
| `marketplace` | object | No | — | Marketplace registry settings |
| `marketplace.registry` | string | Yes | — | Registry repository |
| `marketplace.branch` | string | Yes | `main` | Registry branch |
| `presetRegistry` | object | No | — | Preset registry settings |
| `presetRegistry.url` | string | Yes | — | Registry URL |
| `presetRegistry.branch` | string | Yes | `main` | Registry branch |
| `presets` | string[] | No | — | Presets to load (order matters) |
<!-- GENERATED:END:manifest_fields -->

---

## Flags (`flags.yaml`)

Flags control how AI agents behave in your project. Each flag has a **mode** and a **value**.

```yaml
security_scan:
  mode: enforced
  value: true
  locked: true          # Prevents lower layers from overriding

type_checking:
  mode: conditional
  value: strict
  conditions:
    lang: [typescript]   # Only apply when language is TypeScript
```

### All 18 Flags

<!-- GENERATED:START:flags_table -->
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
| `mcp_allowed_servers` | string[] | `` | — | Allowed MCP server names |
| `require_documentation` | boolean | `false` | — | Require documentation for new code |
| `allowed_languages` | string[] | `["*"]` | — | Allowed programming languages |
| `progressive_loading` | enum | `metadata` | — | Skill inlining strategy for single-file agents |
| `drift_detection` | enum | `warn` | — | Drift detection behavior |
| `auto_generate_on_change` | boolean | `false` | — | Auto-generate on config change |
<!-- GENERATED:END:flags_table -->

Flags with a **Hook** value create pre-commit checks that enforce the flag at commit time.

### Flag Modes

Each flag supports 6 modes that control behavior across the inheritance chain:

<!-- GENERATED:START:flag_modes -->
| Mode | Behavior | Can Override? |
|------|----------|---------------|
| `enforced` | Always active, non-negotiable | No (stops resolution) |
| `enabled` | Active with specified value | Yes |
| `disabled` | Explicitly turned off | Yes |
| `inherited` | Skip — use parent layer's value | Yes |
| `delegated_to_agent_default` | Use the flag's catalog default | Yes |
| `conditional` | Apply only if conditions match | Yes |
<!-- GENERATED:END:flag_modes -->

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
# In .codi/flags.yaml — prevent overriding security scanning
security_scan:
  mode: enforced
  value: true
  locked: true
```

Attempting to override a locked flag produces a validation error.

### Flag-to-Instruction Mapping

Flags are automatically translated into natural-language instructions in generated files:

<!-- GENERATED:START:flag_instructions -->
| Flag | Trigger Value | Generated Instruction |
|------|--------------|----------------------|
| `allow_shell_commands` | `false` | Do NOT execute shell commands. |
| `allow_file_deletion` | `false` | Do NOT delete files. |
| `require_tests` | `true` | Write tests for all new code. |
| `allow_force_push` | `false` | Do NOT use force push (--force) on git operations. |
| `require_pr_review` | `true` | All changes require pull request review before merging. |
| `mcp_allowed_servers` | `[...]` | Only use these MCP servers: {list}. |
| `require_documentation` | `true` | Write documentation for all new code and APIs. |
| `allowed_languages` | `[...]` | Only use these languages: {list}. |
<!-- GENERATED:END:flag_instructions -->

Operational flags (`drift_detection`, `progressive_loading`, `auto_generate_on_change`) control Codi's behavior and do not generate agent instructions.

---

## Configuration Layers

Configuration is resolved from presets and the project's `.codi/` directory:

| Layer | Source | Description |
|-------|--------|-------------|
| **Preset** | Built-in or installed presets | Applied at install time |
| **Repo** | `.codi/` directory | Project-level configuration (source of truth) |
| **User** | `~/.codi/user.yaml` | Personal preferences (never committed) |

See [Architecture](architecture.md) for the full resolution order.

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

  docs:
    command: npx
    args: ["-y", "@anthropic-ai/mcp-docs-server"]

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

MCP config is distributed to each agent in its native format:
- **Claude Code**: `.claude/mcp.json`
- **Cursor**: `.cursor/mcp.json`
- **Codex**: `.codex/config.toml`
