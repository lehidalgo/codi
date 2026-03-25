# 8. Flags

**Spec Version**: 1.0

## Overview

Flags are behavioral controls that govern how AI agents operate in a project. Each flag has a type, a default value, and a mode that determines its behavior in the 7-layer resolution chain. Flags are defined in `.codi/flags.yaml`.

## All 18 Flags

| Flag | Type | Default | Generates Instruction | Description |
|------|------|---------|----------------------|-------------|
| `auto_commit` | boolean | `false` | Yes | Automatic commits after changes |
| `test_before_commit` | boolean | `true` | Yes | Run tests before commit |
| `security_scan` | boolean | `true` | Yes | Mandatory security scanning |
| `type_checking` | enum | `strict` | Yes | Type checking level: `strict`, `basic`, `off` |
| `max_file_lines` | number | `700` | Yes | Maximum lines per source file |
| `require_tests` | boolean | `false` | Yes | Require tests for new code |
| `allow_shell_commands` | boolean | `true` | Yes | Allow shell command execution |
| `allow_file_deletion` | boolean | `true` | Yes | Allow file deletion |
| `lint_on_save` | boolean | `true` | No | Lint files on save (operational) |
| `allow_force_push` | boolean | `false` | Yes | Allow force push to remote |
| `require_pr_review` | boolean | `true` | Yes | Require PR review before merge |
| `mcp_allowed_servers` | string[] | `[]` | Yes | Whitelist of allowed MCP servers |
| `require_documentation` | boolean | `false` | Yes | Require documentation for new code |
| `allowed_languages` | string[] | `["*"]` | Yes | Allowed programming languages (`*` = all) |
| `max_context_tokens` | number | `50000` | Yes | Maximum context token window |
| `progressive_loading` | enum | `metadata` | No | Loading strategy: `off`, `metadata`, `full` (operational) |
| `drift_detection` | enum | `warn` | No | Drift behavior: `off`, `warn`, `error` (operational) |
| `auto_generate_on_change` | boolean | `false` | No | Auto-regenerate on config change (operational) |

Flags marked "operational" control Codi's own behavior and do not produce agent instructions.

## Flag Modes

Each flag entry supports 6 modes:

| Mode | Behavior | Overridable by Lower Layer? |
|------|----------|-----------------------------|
| `enforced` | Always active, non-negotiable | No (halts resolution) |
| `enabled` | Active with specified value | Yes |
| `disabled` | Explicitly turned off | Yes |
| `inherited` | Skip, use parent layer's value | Yes |
| `delegated_to_agent_default` | Use the flag's catalog default | Yes |
| `conditional` | Apply only if conditions match | Yes |

## Flag Entry Format

```yaml
flag_name:
  mode: enabled           # Required: one of the 6 modes
  value: true             # Required: the flag value
  locked: false           # Optional: prevents lower-layer overrides
  conditions:             # Required when mode is "conditional"
    lang: [typescript]
    framework: [react]
    agent: [claude-code]
    file_pattern: ["src/**/*.ts"]
```

## Conditional Mode

When `mode: conditional`, all specified conditions MUST match for the flag to apply:

- `lang` -- matches detected project language
- `framework` -- matches detected framework
- `agent` -- matches target agent being generated
- `file_pattern` -- matches file globs

## Locking

Flags can be locked at any layer. A locked flag halts resolution -- no lower layer can change its value:

```yaml
# In ~/.codi/org.yaml
security_scan:
  mode: enforced
  value: true
  locked: true    # No project or user can disable this
```

## Flag-to-Instruction Examples

| Flag YAML | Generated Natural-Language Instruction |
|-----------|----------------------------------------|
| `allow_force_push: false` | "Do NOT use force push (--force) on git operations." |
| `max_file_lines: 700` | "Keep source code files under 700 lines." |
| `require_pr_review: true` | "All changes require pull request review before merging." |
| `max_context_tokens: 50000` | "Maximum context window: 50000 tokens." |
| `allowed_languages: [ts, py]` | "Only use these languages: ts, py." |

## Related

- [Chapter 5: Generation](05-generation.md) for how flags flow through the pipeline
- [Chapter 6: Hooks](06-hooks.md) for flags that generate Git hook scripts
- [Chapter 7: Presets](07-presets.md) for preset-level flag configurations
