# 3. Manifest

**Spec Version**: 1.0

## Overview

The manifest file `codi.yaml` declares project identity, target agents, and optional integrations. It is the only required file for Codi to operate.

## Field Reference

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | Yes | -- | Project name used in generated headers |
| `version` | `"1"` | Yes | -- | Manifest schema version. Currently only `"1"` |
| `description` | string | No | -- | Optional project description |
| `agents` | string[] | No | `[]` | Target agents: `claude-code`, `cursor`, `codex`, `windsurf`, `cline` |
| `team` | string | No | -- | Team name referencing `~/.codi/teams/{name}.yaml` |
| `layers` | object | No | all `true` | Controls which content types are included in output |
| `codi` | object | No | -- | Codi tool constraints |
| `source` | object | No | -- | Remote artifact source for `codi update --from` |
| `marketplace` | object | No | -- | Marketplace registry configuration |
| `presetRegistry` | object | No | -- | Custom preset registry |
| `presets` | string[] | No | -- | Applied preset names |

## Layers Object

Controls which artifact types are included in generated output:

```yaml
layers:
  rules: true      # Include rules in output
  skills: true     # Include skills in output
  commands: true   # Include commands in output
  agents: true     # Include agents in output
  context: true    # Include context sections
```

Setting a layer to `false` suppresses that artifact type across all adapters.

## Codi Constraints

```yaml
codi:
  requiredVersion: ">=0.5.0"
```

When set, `codi generate` and `codi doctor` validate the installed CLI version against this semver range. Mismatches produce an error.

## Remote Source

```yaml
source:
  repo: "org/team-codi-config"
  branch: main
  paths: [rules, skills, agents]
```

Used by `codi update --from` for one-way pull of centralized artifacts. Only artifacts with `managed_by: codi` are updated (see [Chapter 4](04-artifacts.md)).

## Marketplace

```yaml
marketplace:
  registry: "org/codi-skills-registry"
  branch: main
```

Configures the GitHub repository used by `codi marketplace search` and `codi marketplace install`.

## Example

```yaml
name: my-project
version: "1"
agents:
  - claude-code
  - cursor
  - codex
team: frontend
codi:
  requiredVersion: ">=0.5.0"
layers:
  rules: true
  skills: true
  commands: true
  agents: true
```

## Related

- [Chapter 2: Layout](02-layout.md) for directory structure
- [Chapter 5: Generation](05-generation.md) for how the manifest drives generation
- [Chapter 7: Presets](07-presets.md) for preset integration
