# Multi-Tenant Design: Presets, Plugins, and Stacks for Codi

## Problem Framing

Codi currently supports 7-level flag inheritance (org→team→repo→lang→framework→agent→user) but artifact sharing (rules, skills, agents, commands) is limited to repo-local definitions. Teams can't share reusable project setups across projects. A React+TypeScript project and a Python+FastAPI project must each manually configure their rules from scratch.

**What's missing:** A way to package and distribute complete project configurations (flags + rules + skills + agents + commands + MCP) as reusable, composable units.

## Proposed Architecture

### Core Insight: Presets ARE the Solution

Don't introduce plugins, stacks, and presets as three separate concepts. **Unify them as "presets"** — a preset is a complete, composable configuration package.

```
Preset = Flags + Rules + Skills + Agents + Commands + MCP config
```

A "plugin" is just a small preset. A "stack" is just a preset that bundles other presets. Keep one concept.

### Entity Model

```
Tenant (Organization)
  └── Teams
       └── Projects
            └── Presets (composable, from registry or local)
                 ├── Flags
                 ├── Rules
                 ├── Skills
                 ├── Agents
                 ├── Commands
                 └── MCP servers
```

**Tenant** = an organization. Owns `~/.codi/org.yaml`. Sets locked flags and mandatory presets.

**Team** = a subdivision. Owns `~/.codi/teams/{name}.yaml`. Can extend org presets with team-specific overrides.

**Project** = a repo. Owns `.codi/`. Selects presets, adds local customizations.

**Preset** = a reusable configuration package. Can be:
- **Built-in**: shipped with codi (minimal, balanced, strict — currently flags-only, extend to include artifacts)
- **Registry**: published to a Git-based registry (like current marketplace)
- **Local**: defined in `.codi/presets/` for project-specific compositions

### Configuration Model

**codi.yaml (enhanced manifest):**
```yaml
name: my-frontend-app
version: "1"
team: frontend

# Presets: applied in order (later overrides earlier)
presets:
  - balanced                          # Built-in preset
  - "@org/react-typescript"           # From org registry
  - "@org/strict-security"            # Composable — adds rules on top

# Project-level overrides (applied after all presets)
agents:
  - claude-code
  - cursor

# MCP servers (merged with preset MCP)
mcp:
  servers:
    internal-api:
      command: npx
      args: ["-y", "@company/mcp-internal"]

# Source for centralized updates
source:
  repo: "org/team-codi-config"
  branch: main
```

### Preset Package Format

A preset is a directory (local or in registry) with this structure:

```
preset-name/
  preset.yaml           # Metadata: name, description, extends, flags
  rules/                # Rule files (optional)
    security.md
    react-patterns.md
  skills/               # Skill files (optional)
    code-review.md
  agents/               # Agent files (optional)
    react-specialist.md
  commands/             # Command files (optional)
    deploy.md
  mcp.yaml              # MCP servers (optional)
```

**preset.yaml:**
```yaml
name: react-typescript
description: React + TypeScript project with strict frontend rules
version: "1.0.0"
extends: balanced                     # Inherits from another preset
tags: [react, typescript, frontend]

flags:
  type_checking:
    mode: enforced
    value: strict
    locked: true
  allowed_languages:
    mode: enabled
    value: [typescript, javascript, css]
  max_file_lines:
    mode: enabled
    value: 500
```

### Resolution Strategy

```
1. Load built-in defaults (18 flags, no artifacts)
2. Apply each preset in order (presets: [...])
   - For flags: later preset overrides earlier (unless locked)
   - For rules/skills/agents/commands: merge (append)
   - For MCP: merge servers
3. Apply org layer (if exists) — can lock flags
4. Apply team layer (if exists) — can override non-locked
5. Apply repo-local .codi/ — project-specific overrides
6. Apply lang/framework/agent layers
7. Apply user layer — personal preferences
```

**Conflict handling:**
- Flags: last writer wins, unless locked by a higher-priority layer
- Artifacts (rules/skills/agents/commands): merge by name. If two presets define the same rule name, last preset wins.
- MCP servers: merge by server name. Last definition wins.

### Installation Flows

**Install a preset:**
```bash
# From registry
codi preset install @org/react-typescript

# This clones the registry, copies preset to .codi/presets/react-typescript/
# Adds "react-typescript" to codi.yaml presets list
# Runs codi generate
```

**Create a custom preset:**
```bash
# Initialize a new preset
codi preset create my-team-setup

# Creates .codi/presets/my-team-setup/ with preset.yaml + empty dirs
# User adds rules/skills/agents/commands manually
```

**List available presets:**
```bash
codi preset list              # Show installed presets
codi preset search react      # Search registry
```

**Compose presets:**
```yaml
# codi.yaml
presets:
  - balanced                    # Base flags
  - "@org/react-typescript"     # React + TS rules
  - "@org/strict-security"      # Security rules (additive)
```

### Examples

**Example 1: React + TypeScript Frontend**
```yaml
# codi.yaml
name: my-react-app
version: "1"
team: frontend
presets:
  - balanced
  - "@company/react-typescript"
agents:
  - claude-code
  - cursor
```

`@company/react-typescript` preset includes:
- Flags: `type_checking: strict`, `allowed_languages: [typescript, javascript, css]`, `max_file_lines: 500`
- Rules: `react-patterns.md`, `typescript-strict.md`, `component-testing.md`
- Skills: `react-component-generator.md`
- Commands: `create-component.md`

**Example 2: Python + FastAPI Backend**
```yaml
# codi.yaml
name: my-api
version: "1"
team: backend
presets:
  - strict
  - "@company/python-fastapi"
agents:
  - claude-code
  - codex
```

`@company/python-fastapi` preset includes:
- Flags: `type_checking: strict` (mypy), `allowed_languages: [python]`
- Rules: `fastapi-patterns.md`, `sqlalchemy-conventions.md`, `api-versioning.md`
- Skills: `migration-runner.md`, `api-testing.md`
- Agents: `db-migration-specialist.md`

### MVP Proposal

**Phase 1 (MVP):** Extend current presets to include artifacts

1. Change presets from flags-only to flags + rules + skills + agents + commands + MCP
2. Store presets as directories in `.codi/presets/{name}/` with `preset.yaml`
3. Add `presets:` field to manifest (array of preset names)
4. Resolver loads presets in order before repo layer
5. `codi preset create <name>` scaffolds a new preset
6. `codi preset install <name> --from <repo>` installs from Git registry
7. `codi preset list` shows installed presets
8. Existing 3 built-in presets (minimal/balanced/strict) remain but are enhanced with rule templates

**Phase 2:** Registry and distribution

1. Official preset registry with index.json
2. `codi preset publish` to contribute presets
3. Versioning (semver) for presets
4. Lock files for reproducible preset pulls

**Phase 3:** Organization-level governance

1. Org/team layers can mandate presets (not just flags)
2. Org can lock mandatory presets that projects can't remove
3. Team-level preset inheritance

### Risks and Trade-offs

| Risk | Mitigation |
|------|-----------|
| Complexity — presets add another config layer | Keep MVP simple: just directory + preset.yaml |
| Name conflicts between presets | Last-in-wins with warning log |
| Preset versioning drift | Lock files (Phase 2) |
| Preset trust (security) | managed_by field + review workflow |
| Over-abstraction — users create too many presets | Document: "use presets for cross-project sharing, local rules for project-specific" |

### Final Recommendation

**Unify under "presets" — don't introduce plugins and stacks as separate concepts.**

A preset IS a plugin (small, focused). A preset CAN compose other presets (which is what a "stack" is). One concept, infinite composition.

The MVP is straightforward: extend the existing preset system from flags-only to full artifact packages, add a `presets:` field to the manifest, and implement `codi preset create/install/list`. This builds on everything already working (flag presets, marketplace, source pulling) without introducing new abstractions.
