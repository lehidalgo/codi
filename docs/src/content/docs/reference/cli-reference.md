---
title: CLI Reference
description: Complete reference for all Codi commands, the Command Center, and the init wizard
sidebar:
  order: 1
---

Complete reference for all Codi commands, the Command Center, and the init wizard.

## Command Center

Run `codi` with no arguments to launch the interactive Command Center. It uses `@clack/prompts` for a terminal UI with grouped actions.

The menu loops until you select **Exit** or press **Ctrl+C**. Actions that require a `.codi/` directory are hidden until you initialize a project.

**Setup:** Initialize project, Add artifact, Generate configs, Manage presets  
**Build:** Export skill, Contribute to community, Generate documentation  
**Monitor:** Project status, Health check, Validate config, Verify agent awareness, Compliance report, CI checks, Clean generated files, Update templates, Revert to backup, Watch for changes, Update docs counts

---

## Init Wizard

Launched by `codi init` (interactive mode) or from the Command Center. Guides you through 4 steps with backward navigation (**Ctrl+C** goes back, exits at step 1).

### Steps

| Step | Prompt | Details |
|------|--------|---------|
| 1. Languages | Multiselect | Choose project languages for pre-commit hooks. Pre-selects detected stack. |
| 2. Agents | Multiselect | Target agents: `claude-code`, `cursor`, `codex`, `windsurf`, `cline`. Pre-selects detected agents. |
| 3. Config Mode | Select one | `preset` / `custom` / `zip` import / `github` import |
| 4. Artifacts | Conditional | Preset: choose a built-in preset. Custom: select individual rules, skills, agents, MCP servers. |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `space` | Toggle selection |
| `a` | Select / deselect all |
| Arrow keys | Move up / down |
| `enter` | Confirm |
| `ctrl+c` | Go back (exit at first step) |

---

## Command Reference

### Setup Commands

#### `codi init`

Initialize a new `.codi/` configuration directory.

```bash
codi init [options]
```

| Option | Description |
|--------|-------------|
| `--force` | Reinitialize even if `.codi/` exists |
| `--agents <agents...>` | Specify agent IDs (skips wizard) |
| `--preset <preset>` | Flag preset name (skips wizard) |

```bash
# Interactive wizard
codi init

# Non-interactive with specific agents and preset
codi init --agents claude-code cursor --preset balanced
```

---

#### `codi add <type> [name]`

Add resources to the `.codi/` configuration. Supported types: `rule`, `skill`, `agent`, `brand`, `mcp-server`.

```bash
codi add <type> [name] [options]
```

| Option | Description |
|--------|-------------|
| `-t, --template <name>` | Use a built-in template |
| `--all` | Add all available templates of this type |

When `name` is omitted in interactive mode, launches a search wizard.

```bash
codi add rule security --template security
codi add skill my-workflow
codi add rule --all
codi add mcp-server memory --template memory
```

---

#### `codi generate`

Generate agent configuration files from `.codi/`. Alias: `gen`.

```bash
codi generate [options]
```

| Option | Description |
|--------|-------------|
| `--agent <agents...>` | Generate for specific agents only |
| `--dry-run` | Show what would be generated without writing |
| `--force` | Skip no-op detection and rewrite every generated file (implies `--on-conflict keep-incoming`) |
| `--on-conflict <strategy>` | How to resolve local edits to generated files: `keep-current` (skip) or `keep-incoming` (overwrite). Defaults to interactive prompts on a TTY, auto-merge off-TTY. |

```bash
codi generate --agent claude-code --dry-run
codi gen --force
codi generate --on-conflict keep-incoming   # overwrite any local edits
codi generate --on-conflict keep-current    # preserve all local edits, skip incoming
```

**Pruning:** `codi generate` automatically deletes generated files that no longer exist in the source templates. Files with local edits are preserved unless you pass `--on-conflict keep-incoming` or `--force`.

---

#### `codi preset <subcommand>`

Manage configuration presets.

| Subcommand | Synopsis | Description |
|------------|----------|-------------|
| `create [name]` | `codi preset create my-setup` | Create a new preset scaffold |
| `list` | `codi preset list --builtin` | List installed presets |
| `install <source>` | `codi preset install ./preset.zip` | Install from ZIP, GitHub URL, or registry |
| `export <name>` | `codi preset export my-setup` | Export as ZIP file |
| `validate <name>` | `codi preset validate my-setup` | Validate structure and schema |
| `remove <name>` | `codi preset remove my-setup` | Remove an installed preset |
| `edit <name>` | `codi preset edit my-setup` | Interactively edit artifact selection |
| `update` | `codi preset update --dry-run` | Update installed presets to latest |

```bash
codi preset install github:org/repo
codi preset export my-setup --format zip --output ./dist
codi preset list --builtin
```

---

### Monitoring Commands

#### `codi status`

Show drift status for generated agent files. Reports in-sync, drifted, and missing files.

```bash
codi status [--diff]
```

| Option | Description |
|--------|-------------|
| `--diff` | Show colored unified diffs for drifted preset artifacts |

---

#### `codi doctor`

Check project health: config validity, version compatibility, hook installation, drift detection. With `--hooks`, switches to a per-hook tool availability diagnostic.

```bash
codi doctor [options]
```

| Option | Description |
|--------|-------------|
| `--ci` | Exit non-zero on any failure (for CI/hooks) |
| `--hooks` | List per-hook tool availability with severity, category, and install hint. Exits non-zero when any required tool is missing. |

---

#### `codi validate`

Validate the `.codi/` configuration against schemas.

```bash
codi validate
```

---

#### `codi verify`

Verify that an agent loaded its configuration correctly. Shows the verification token, rules, skills, agents, and flags.

```bash
codi verify [options]
```

| Option | Description |
|--------|-------------|
| `--check <response>` | Validate a pasted agent response against expected values |

```bash
# Show expected verification data
codi verify

# Validate agent response
codi verify --check "codi-abc123"
```

---

#### `codi compliance`

Run full compliance report: doctor + status + verification combined.

```bash
codi compliance [options]
```

| Option | Description |
|--------|-------------|
| `--ci` | Exit non-zero on any failure |

---

#### `codi ci`

Composite CI validation. Runs `validate` + `doctor --ci` and reports combined results. Exits non-zero on any failure.

```bash
codi ci
```

---

#### `codi watch`

Watch `.codi/` for changes and auto-regenerate agent configs. Requires `auto_generate_on_change` flag to be enabled.

```bash
codi watch [options]
```

| Option | Description |
|--------|-------------|
| `--once` | Run one generation cycle and exit |

---

### Operation Commands

#### `codi update`

Update flags and template-managed artifacts to latest versions. Always auto-regenerates after update.

```bash
codi update [options]
```

| Option | Description |
|--------|-------------|
| `--preset <preset>` | Reset all flags to a preset |
| `--from <repo>` | Pull artifacts from a GitHub repo |
| `--rules` | Refresh template-managed rules |
| `--skills` | Refresh template-managed skills |
| `--agents` | Refresh template-managed agents |
| `--mcp-servers` | Refresh template-managed MCP servers |
| `--dry-run` | Show what would change without writing |
| `--force` | Accept all incoming changes without prompting (overwrites local edits) |
| `--on-conflict <strategy>` | How to resolve local edits: `keep-current` (skip) or `keep-incoming` (overwrite). Defaults to interactive on a TTY. |

```bash
codi update --rules --skills
codi update --preset strict --dry-run
codi update --from org/shared-config
codi update --skills --on-conflict keep-incoming   # accept upstream changes
```

---

#### `codi clean`

Remove generated agent config files. Without `--all`, preserves `.codi/` and hooks.

```bash
codi clean [options]
```

| Option | Description |
|--------|-------------|
| `--all` | Remove everything including `.codi/` and hooks (full uninstall) |
| `--dry-run` | Show what would be deleted without deleting |
| `--force` | Skip confirmation |

---

#### `codi revert`

Restore generated files from a previous backup. Backups are created automatically on each `generate`.

```bash
codi revert [options]
```

| Option | Description |
|--------|-------------|
| `--list` | Show available backups |
| `--last` | Restore the most recent backup |
| `--backup <timestamp>` | Restore a specific backup by timestamp |

```bash
codi revert --list
codi revert --last
```

---

#### `codi skill <subcommand>`

Manage skills: export, feedback, stats, evolve, versions.

| Subcommand | Synopsis | Description |
|------------|----------|-------------|
| `export [name]` | `codi skill export my-skill` | Package for distribution |
| `feedback` | `codi skill feedback --skill my-skill` | List usage feedback |
| `stats [name]` | `codi skill stats` | Show skill health dashboard |
| `evolve <name>` | `codi skill evolve my-skill` | Generate improvement prompt from feedback |
| `versions <name>` | `codi skill versions my-skill` | Manage version history |

---

### Onboarding

#### `codi onboard`

Print an AI-guided onboarding guide to stdout. The guide contains three sections: a full artifact catalog, a built-in presets reference, and a step-by-step agent playbook.

The intended workflow: tell your coding agent to run `codi onboard`, and the agent reads the output, explores your codebase, recommends a preset and artifact selection, iterates with you until approved, then executes the full setup.

```bash
codi onboard
```

---

### Community Commands

#### `codi contribute`

Interactive wizard to share artifacts via GitHub PR or ZIP export.

```bash
codi contribute [--repo <owner/repo>] [--branch <name>]
```

| Option | Description |
|--------|-------------|
| `--repo <owner/repo>` | Target GitHub repository |
| `--branch <name>` | Target branch for the PR base |

---

#### `codi docs`

Generate and validate documentation.

```bash
codi docs [options]
```

| Option | Description |
|--------|-------------|
| `--json` | Output JSON skill catalog to stdout |
| `--html` | Generate HTML skill catalog site |
| `--generate` | Regenerate code-driven doc sections |
| `--validate` | Check if docs are in sync with code |
| `--output <path>` | Output file path |

---

## Global Options

Available on all commands.

| Option | Description |
|--------|-------------|
| `-j, --json` | Output as JSON (for scripting) |
| `-v, --verbose` | Verbose/debug output |
| `-q, --quiet` | Suppress non-essential output |
| `--no-color` | Disable colored output |

---

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Command completed successfully |
| `1` | General error or validation failure |
| `2` | Configuration schema validation failed |
| `3` | No `.codi/` directory found |
| `5` | Agent config generation failed |
| `7` | Generated files drifted from source |
| `9` | Health check or CI validation failed |
| `12` | Agent verification token mismatch |
| `13` | Preset operation failed |
