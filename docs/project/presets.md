# Presets

Presets are bundles of flags, rules, skills, agents, and MCP configuration packaged for reuse. They provide a one-command way to set up a project with a specific configuration profile.

## Built-in Presets

Codi ships with 6 presets:

<!-- GENERATED:START:preset_table -->
| Preset | Focus | Description |
|:-------|:------|:------------|
| `codi-minimal` | minimal | Permissive — security off, no test requirements, all actions allowed |
| `codi-balanced` | balanced | Recommended — security on, type-checking strict, no force-push |
| `codi-strict` | strict | Enforced — security locked, tests required, delete restricted, no force-push |
| `codi-fullstack` | fullstack | Comprehensive web/app development — broad rules, testing, and security. Language-agnostic. |
| `codi-dev` | codi | Preset for developing the Codi CLI itself — strict TypeScript, anti-hardcoding, safe releases, and full QA tooling |
| `codi-power-user` | workflow | Daily workflow — graph exploration, day tracking, error diagnosis, enhanced commits |
<!-- GENERATED:END:preset_table -->

## Language Customization

Presets are language-agnostic. Add language-specific rules after choosing a preset:

```bash
# Python project
codi add rule python --template python
codi add rule django --template django
codi add agent python-expert --template python-expert

# TypeScript project
codi add rule typescript --template typescript
codi add rule react --template react
codi add rule nextjs --template nextjs
codi add agent nextjs-researcher --template nextjs-researcher

# Data/ML project
codi add agent ai-engineering-expert --template ai-engineering-expert
codi add agent data-science-specialist --template data-science-specialist
codi add agent mlops-engineer --template mlops-engineer
```

### Flag Comparison (core presets)

<!-- GENERATED:START:preset_flag_comparison -->

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

The wizard guides you through selecting flags, rules, skills, and agents.

### Preset structure

A preset is a directory with a manifest and artifacts:

```
my-setup/
  preset.yaml           # Preset manifest
  rules/                # Bundled rules (Markdown)
  skills/               # Bundled skills
  agents/               # Bundled agents
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

## Preset Composition

Presets support two composition strategies:

### Stacking (recommended for simple overrides)

List multiple presets in `codi.yaml` — they are applied in order and later presets override earlier ones:

```yaml
presets:
  - balanced
  - my-team-overrides
```

### Inheritance (for preset authors)

A preset can extend another using the `extends` field in `preset.yaml`:

```yaml
name: my-strict-variant
extends: codi-strict
flags:
  require_documentation:
    mode: enforced
    value: true
    locked: true
```

Child preset flags are merged on top of parent flags. Flags marked `locked: true` in the parent cannot be overridden by the child.
