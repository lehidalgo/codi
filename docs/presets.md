# Presets

Presets are bundles of flags, rules, skills, agents, commands, and MCP configuration packaged for reuse. They provide a one-command way to set up a project with a specific configuration profile.

## Built-in Presets

Codi ships with 9 presets:

<!-- GENERATED:START:preset_table -->
| Preset | Focus | Description |
|:-------|:------|:------------|
| `minimal` | minimal | Permissive — security off, no test requirements, all actions allowed |
| `balanced` | balanced | Recommended — security on, type-checking strict, no force-push |
| `strict` | strict | Enforced — security locked, tests required, delete restricted, no force-push |
| `python-web` | python | Python web development with Django/FastAPI conventions, security, and testing |
| `typescript-fullstack` | typescript | TypeScript fullstack development with React/Next.js, strict typing, and CI best practices |
| `security-hardened` | security | Maximum security enforcement with locked flags, mandatory scans, and restricted operations |
| `codi-development` | codi | Preset for developing the Codi CLI itself — strict TypeScript, anti-hardcoding, safe releases, and full QA tooling |
| `power-user` | workflow | Daily workflow — graph exploration, day tracking, error diagnosis, enhanced commits |
| `data-ml` | data | Data engineering, data science, ML, and AI agent specialists |
<!-- GENERATED:END:preset_table -->

### Flag Comparison (core presets)

<!-- GENERATED:START:preset_flag_comparison -->
| Flag | Minimal | Balanced | Strict |
|------|--------|--------|--------|
| `auto_commit` | `false` | `false` | `false` |
| `test_before_commit` | `false` | `true` | `true` (enforced, locked) |
| `security_scan` | `false` | `true` | `true` (enforced, locked) |
| `type_checking` | `off` | `strict` | `strict` (enforced, locked) |
| `max_file_lines` | `1000` | `700` | `500` |
| `require_tests` | `false` | `false` | `true` (enforced, locked) |
| `allow_shell_commands` | `true` | `true` | `true` |
| `allow_file_deletion` | `true` | `true` | `false` |
| `lint_on_save` | `false` | `true` | `true` |
| `allow_force_push` | `true` | `false` | `false` (enforced, locked) |
| `require_pr_review` | `false` | `true` | `true` (enforced, locked) |
| `mcp_allowed_servers` | `` | `` | `` |
| `require_documentation` | `false` | `false` | `true` |
| `allowed_languages` | `*` | `*` | `*` |
| `max_context_tokens` | `100000` | `50000` | `50000` |
| `progressive_loading` | `off` | `metadata` | `metadata` |
| `drift_detection` | `off` | `warn` | `error` |
| `auto_generate_on_change` | `false` | `false` | `true` |
<!-- GENERATED:END:preset_flag_comparison -->

Flags marked "enforced, locked" in the strict preset cannot be overridden by any lower layer.

---

## Using Presets

### During initialization

```bash
# Use a built-in preset
codi init --preset balanced

# Interactive wizard lets you choose
codi init
```

### In the manifest

Reference presets in `codi.yaml`:

```yaml
presets:
  - balanced
```

Multiple presets can be listed — they are applied in order, with later presets overriding earlier ones.

---

## Creating Presets

### Interactive wizard

```bash
codi preset create my-setup
```

The wizard guides you through selecting flags, rules, skills, agents, and commands.

### Preset structure

A preset is a directory with a manifest and artifacts:

```
my-setup/
  preset.yaml           # Preset manifest
  rules/                # Bundled rules (Markdown)
  skills/               # Bundled skills
  agents/               # Bundled agents
  commands/             # Bundled commands
```

### Preset manifest (`preset.yaml`)

```yaml
name: my-setup
version: "1.0.0"
description: My team's standard configuration
flags:
  security_scan:
    mode: enforced
    value: true
    locked: true
  max_file_lines:
    mode: enabled
    value: 500
rules:
  - security
  - testing
  - typescript
skills:
  - code-review
  - documentation
agents:
  - code-reviewer
  - test-generator
```

---

## Installing Presets

Codi supports installing presets from 3 sources:

### From a ZIP file

```bash
codi preset install ./my-setup.zip
```

### From GitHub

```bash
# Latest from main branch
codi preset install github:org/repo

# Specific version tag
codi preset install github:org/repo@v1.0

# Specific branch
codi preset install github:org/repo#develop
```

### From the registry

```bash
codi preset install my-preset --from registry
```

### Via the Command Center

Run `codi` and select "Manage presets" > "Install from source" for an interactive flow.

---

## Exporting Presets

Package a preset as a ZIP file for sharing:

```bash
# Export as ZIP
codi preset export my-setup --format zip

# Specify output directory
codi preset export my-setup --format zip --output ./exports/
```

---

## Managing Presets

### List installed presets

```bash
# List all (including built-in)
codi preset list

# Custom presets only
codi preset list --no-builtin
```

### Edit a preset

```bash
codi preset edit my-setup
```

### Validate a preset

```bash
codi preset validate my-setup
```

### Remove a preset

```bash
codi preset remove my-setup
```

---

## Preset Lock File

When you install a preset, Codi records it in `.codi/preset-lock.json`:

```json
{
  "presets": {
    "my-setup": {
      "version": "1.0.0",
      "source": "github:org/repo@v1.0",
      "sourceType": "github",
      "installedAt": "2026-03-29T10:00:00.000Z"
    }
  }
}
```

This tracks where each preset came from and when it was installed, enabling reproducible setups.

---

## Presets are Flat

Presets are self-contained — they do not inherit from or extend other presets. If you need to combine configurations, list multiple presets in your `codi.yaml`:

```yaml
presets:
  - balanced
  - my-team-overrides
```

Later presets override flags from earlier ones.
