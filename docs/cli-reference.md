# CLI Reference

Complete reference for all Codi commands, the Command Center, and the init wizard.

## Command Center

Run `codi` with no arguments to launch the interactive Command Center. It uses `@clack/prompts` for a terminal UI with grouped actions.

The menu loops until you select **Exit** or press **Ctrl+C**. Actions that require a `.codi/` directory are hidden until you initialize a project.

**Setup:** Initialize project, Add artifact, Generate configs, Manage presets
**Build:** Export skill, Search marketplace, Contribute to community, Generate documentation
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
| 4. Artifacts | Conditional | Preset: choose a built-in preset. Custom: select individual rules, skills, agents, commands, MCP servers. |

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

```
codi init [options]
```

| Option | Description |
|--------|-------------|
| `--force` | Reinitialize even if `.codi/` exists |
| `--agents <agents...>` | Specify agent IDs (skips wizard) |
| `--preset <preset>` | Flag preset name (skips wizard) |

```sh
# Interactive wizard
codi init

# Non-interactive with specific agents and preset
codi init --agents claude-code cursor --preset balanced
```

---

#### `codi add <type> [name]`

Add resources to the `.codi/` configuration. Supported types: `rule`, `skill`, `agent`, `command`, `brand`, `mcp-server`.

```
codi add <type> [name] [options]
```

| Option | Description |
|--------|-------------|
| `-t, --template <name>` | Use a built-in template |
| `--all` | Add all available templates of this type |

When `name` is omitted in interactive mode, launches a search wizard.

```sh
codi add rule security --template security
codi add skill my-workflow
codi add rule --all
codi add mcp-server memory --template memory
```

---

#### `codi generate`

Generate agent configuration files from `.codi/`. Alias: `gen`.

```
codi generate [options]
```

| Option | Description |
|--------|-------------|
| `--agent <agents...>` | Generate for specific agents only |
| `--dry-run` | Show what would be generated without writing |
| `--force` | Force regeneration even if unchanged |

```sh
codi generate --agent claude-code --dry-run
codi gen --force
```

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
| `search <query>` | `codi preset search typescript` | Search the preset registry |
| `update` | `codi preset update --dry-run` | Update installed presets to latest |

**`create` options:**

| Option | Description |
|--------|-------------|
| `--interactive` | Launch interactive creation wizard |

**`list` options:**

| Option | Description |
|--------|-------------|
| `--builtin` | Include built-in presets |

**`install` options:**

| Option | Description |
|--------|-------------|
| `--from <repo>` | Git repository URL (legacy) |

**`export` options:**

| Option | Description |
|--------|-------------|
| `--format <format>` | Export format (default: `zip`) |
| `--output <path>` | Output path (default: `.`) |

**`update` options:**

| Option | Description |
|--------|-------------|
| `--dry-run` | Show what would change without writing |

```sh
codi preset install github:org/repo
codi preset export my-setup --format zip --output ./dist
codi preset list --builtin
```

---

### Monitoring Commands

#### `codi status`

Show drift status for generated agent files. Reports in-sync, drifted, and missing files.

```
codi status
```

No command-specific options. Uses the global `--json` flag for machine-readable output.

---

#### `codi doctor`

Check project health: config validity, version compatibility, hook installation, drift detection.

```
codi doctor [options]
```

| Option | Description |
|--------|-------------|
| `--ci` | Exit non-zero on any failure (for CI/hooks) |

```sh
codi doctor --ci
```

---

#### `codi validate`

Validate the `.codi/` configuration against schemas.

```
codi validate
```

No command-specific options.

---

#### `codi verify`

Verify that an agent loaded its configuration correctly. Shows the verification token, rules, skills, agents, and flags.

```
codi verify [options]
```

| Option | Description |
|--------|-------------|
| `--check <response>` | Validate a pasted agent response against expected values |

```sh
# Show expected verification data
codi verify

# Validate agent response
codi verify --check "codi-abc123"
```

---

#### `codi compliance`

Run full compliance report: doctor + status + verification combined.

```
codi compliance [options]
```

| Option | Description |
|--------|-------------|
| `--ci` | Exit non-zero on any failure |

```sh
codi compliance --ci
```

---

#### `codi ci`

Composite CI validation. Runs `validate` + `doctor --ci` and reports combined results. Exits non-zero on any failure.

```
codi ci
```

No command-specific options.

---

#### `codi watch`

Watch `.codi/` for changes and auto-regenerate agent configs. Requires `auto_generate_on_change` flag to be enabled.

```
codi watch [options]
```

| Option | Description |
|--------|-------------|
| `--once` | Run one generation cycle and exit |

Long-running process. Press **Ctrl+C** to stop.

```sh
codi watch
codi watch --once
```

---

### Operation Commands

#### `codi update`

Update flags and template-managed artifacts to latest versions. Always auto-regenerates after update.

```
codi update [options]
```

| Option | Description |
|--------|-------------|
| `--preset <preset>` | Reset all flags to a preset |
| `--from <repo>` | Pull artifacts from a GitHub repo (e.g., `org/team-config`) |
| `--rules` | Refresh template-managed rules |
| `--skills` | Refresh template-managed skills |
| `--agents` | Refresh template-managed agents |
| `--commands` | Refresh template-managed commands |
| `--mcp-servers` | Refresh template-managed MCP servers |
| `--dry-run` | Show what would change without writing |

```sh
codi update --rules --skills
codi update --preset strict --dry-run
codi update --from org/shared-config
```

---

#### `codi clean`

Remove generated agent config files. Without `--all`, preserves `.codi/` and hooks.

```
codi clean [options]
```

| Option | Description |
|--------|-------------|
| `--all` | Remove everything including `.codi/` and hooks (full uninstall) |
| `--dry-run` | Show what would be deleted without deleting |
| `--force` | Skip confirmation |

```sh
codi clean --dry-run
codi clean --all --force
```

---

#### `codi revert`

Restore generated files from a previous backup. Backups are created automatically on each `generate`.

```
codi revert [options]
```

| Option | Description |
|--------|-------------|
| `--list` | Show available backups |
| `--last` | Restore the most recent backup |
| `--backup <timestamp>` | Restore a specific backup by timestamp |

```sh
codi revert --list
codi revert --last
codi revert --backup 2026-03-30T10:00:00Z
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

**`export` options:**

| Option | Description |
|--------|-------------|
| `--format <format>` | Export format (default: `standard`) |
| `--output <path>` | Output directory (default: `.`) |
| `--interactive` | Launch interactive wizard |

**`feedback` options:**

| Option | Description |
|--------|-------------|
| `--skill <name>` | Filter by skill name |
| `--limit <n>` | Show last N entries |

**`evolve` options:**

| Option | Description |
|--------|-------------|
| `--dry-run` | Print prompt without saving a version |

**`versions` options:**

| Option | Description |
|--------|-------------|
| `--restore <version>` | Restore SKILL.md from a version number |
| `--diff <v1,v2>` | Show diff between two versions |

---

### Community Commands

#### `codi marketplace <subcommand>`

Search and install skills from the community registry.

| Subcommand | Synopsis | Description |
|------------|----------|-------------|
| `search <query>` | `codi marketplace search testing` | Search for skills |
| `install <name>` | `codi marketplace install my-skill` | Install a skill |

```sh
codi marketplace search "code review"
codi marketplace install community-linter
```

---

#### `codi contribute`

Interactive wizard to share artifacts with the Codi community. Choose artifacts, then either open a PR (requires `gh` CLI) or export as a ZIP preset package.

```
codi contribute
```

No command-specific options. Fully interactive.

---

#### `codi docs`

Generate and validate documentation.

```
codi docs [options]
```

| Option | Description |
|--------|-------------|
| `--json` | Output JSON skill catalog to stdout |
| `--html` | Generate HTML skill catalog site (default) |
| `--generate` | Regenerate code-driven doc sections |
| `--validate` | Check if docs are in sync with code |
| `--output <path>` | Output file path |

```sh
codi docs --json
codi docs --html
codi docs --validate
```

---

#### `codi docs-update`

Sync documentation counts with current templates. Fixes auto-fixable doc drift.

```
codi docs-update
```

No command-specific options.

---

## Global Options

Available on all commands.

| Option | Description |
|--------|-------------|
| `-j, --json` | Output as JSON (for scripting) |
| `-v, --verbose` | Verbose/debug output |
| `-q, --quiet` | Suppress non-essential output |
| `--no-color` | Disable colored output |

`--verbose` and `--quiet` are mutually exclusive.

---

## Exit Codes

| Code | Constant | Meaning |
|------|----------|---------|
| `0` | `SUCCESS` | Command completed successfully |
| `1` | `GENERAL_ERROR` | General error or validation failure |
| `2` | `CONFIG_INVALID` | Configuration schema validation failed |
| `3` | `CONFIG_NOT_FOUND` | No `.codi/` directory found |
| `5` | `GENERATION_FAILED` | Agent config generation failed |
| `7` | `DRIFT_DETECTED` | Generated files drifted from source |
| `9` | `DOCTOR_FAILED` | Health check or CI validation failed |
| `12` | `VERIFY_MISMATCH` | Agent verification token mismatch |
| `13` | `PRESET_ERROR` | Preset operation failed |
