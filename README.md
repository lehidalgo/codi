# @codi/cli

Unified configuration platform for AI coding agents.

[![npm version](https://img.shields.io/npm/v/@codi/cli)](https://www.npmjs.com/package/@codi/cli)
[![license](https://img.shields.io/npm/l/@codi/cli)](./LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/lehidalgo/codi/ci.yml?label=CI)](https://github.com/lehidalgo/codi/actions)

## What is Codi?

Codi is a single source of truth for AI coding agent configurations. Define your rules, flags, and settings once in a `.codi/` directory, and Codi generates the correct configuration file for each agent: `CLAUDE.md`, `.cursorrules`, `AGENTS.md`, `.windsurfrules`, and `.clinerules`.

No more maintaining separate config files that drift apart. One config, every agent.

## Supported Agents

| Agent | Generated File |
|-------|---------------|
| Claude Code | `CLAUDE.md` |
| Cursor | `.cursorrules` |
| Codex (OpenAI) | `AGENTS.md` |
| Windsurf | `.windsurfrules` |
| Cline | `.clinerules` |

## Quick Start

**Prerequisites:** Node.js >= 20, pnpm

```bash
# Install
pnpm add -D @codi/cli

# Initialize — creates .codi/ with auto-detected agents and stack
codi init --agents claude-code cursor

# Add a rule from a template
codi add rule security --template security

# Add a skill from a template
codi add skill review --template code-review

# Generate agent configuration files
codi generate

# Verify agents loaded the configuration
codi verify
```

## CLI Reference

| Command | Description | Key Options |
|---------|-------------|-------------|
| `codi init` | Initialize a new `.codi/` configuration directory | `--force`, `--agents <agents...>` |
| `codi generate` (alias: `gen`) | Generate agent configuration files | `--agent <agents...>`, `--dry-run`, `--force` |
| `codi validate` | Validate the `.codi/` configuration | — |
| `codi status` | Show drift status for generated agent files | — |
| `codi add rule <name>` | Add a new custom rule | `-t, --template <template>` |
| `codi add skill <name>` | Add a new custom skill | `-t, --template <template>` |
| `codi doctor` | Check project health: version, drift, config validity | `--ci` |
| `codi sync` | Sync local rules and skills to team config repo via PR | `--dry-run`, `-m, --message <msg>` |
| `codi verify` | Verify agent configuration awareness | `--check <response>` |

### Global Options

| Option | Description |
|--------|-------------|
| `-j, --json` | Output as JSON |
| `-v, --verbose` | Verbose output |
| `-q, --quiet` | Suppress non-essential output |
| `--no-color` | Disable colored output |

## Configuration

### Directory Structure

```
.codi/
  codi.yaml              # Project manifest
  flags.yaml             # Behavioral flags
  rules/
    generated/
      common/            # Auto-generated common rules
    custom/              # User-defined rules
  skills/                # User-defined skills
```

### Manifest (`codi.yaml`)

```yaml
name: my-project
version: "1"
agents:
  - claude-code
  - cursor
  - codex

# Optional: pin minimum codi version
codi:
  requiredVersion: ">=0.2.0"

# Optional: sync to a shared team config repo
sync:
  repo: "org/team-codi-config"
  branch: main
  paths: [rules, skills]
```

### Flags (`flags.yaml`)

Flags control agent behavior and enforcement modes.

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `auto_commit` | boolean | `false` | Automatic commits after changes |
| `test_before_commit` | boolean | `true` | Run tests before commit |
| `security_scan` | boolean | `true` | Mandatory security scanning |
| `type_checking` | enum (`strict`, `basic`, `off`) | `strict` | Type checking level |
| `max_file_lines` | number | `700` | Max lines per file |
| `require_tests` | boolean | `false` | Require tests for new code |
| `allow_shell_commands` | boolean | `true` | Allow shell command execution |
| `allow_file_deletion` | boolean | `true` | Allow file deletion |
| `lint_on_save` | boolean | `true` | Lint files on save |
| `allow_force_push` | boolean | `false` | Allow force push to remote |
| `require_pr_review` | boolean | `true` | Require PR review before merge |
| `mcp_allowed_servers` | string[] | `[]` | Allowed MCP server names |
| `require_documentation` | boolean | `false` | Require documentation for new code |
| `allowed_languages` | string[] | `["*"]` | Allowed programming languages |
| `max_context_tokens` | number | `50000` | Maximum context token window |
| `progressive_loading` | enum (`off`, `metadata`, `full`) | `metadata` | Progressive loading strategy |
| `drift_detection` | enum (`off`, `warn`, `error`) | `warn` | Drift detection behavior |
| `auto_generate_on_change` | boolean | `false` | Auto-generate on config change |

### Rules

Rules live in `.codi/rules/custom/` as Markdown files with YAML frontmatter:

```markdown
---
name: security
description: Security best practices
priority: high
alwaysApply: true
managed_by: user
---

# Security Rules

- Never expose secrets, API keys, or credentials in code
- Use environment variables for sensitive configuration
```

### Skills

Skills live in `.codi/skills/` as flat Markdown files with YAML frontmatter. Skills define reusable workflows and instructions that agents can invoke.

```markdown
---
name: code-review
description: Code review workflow skill
type: skill
compatibility: [claude-code, cursor]
tools: []
---

# Code Review

## When to Use

Use this skill when reviewing code changes.

## Instructions

- Check for security vulnerabilities
- Verify error handling coverage
- Ensure consistent naming conventions
```

Create skills from built-in templates with `codi add skill <name> --template <template>`:

- `mcp` — MCP server usage skill
- `code-review` — Code review workflow skill
- `documentation` — Documentation generation skill

Skills are rendered in the generated agent configuration files (e.g., `CLAUDE.md`) alongside rules and flags.

### Templates

Create rules and skills from built-in templates:

**Rule templates** (`codi add rule <name> --template <template>`):
- `security` — Security best practices
- `code-style` — Code style guidelines
- `testing` — Testing standards
- `architecture` — Architecture guidelines

**Skill templates** (`codi add skill <name> --template <template>`):
- `mcp` — MCP server usage skill
- `code-review` — Code review workflow skill
- `documentation` — Documentation generation skill

### Layered Config

Configuration resolves in 7 layers, with later layers overriding earlier ones (unless locked):

1. **org** — Organization-wide policies (`~/.codi/org.yaml`)
2. **team** — Team-specific overrides (`~/.codi/teams/{name}.yaml`)
3. **repo** — Base project configuration (`.codi/flags.yaml`)
4. **lang** — Language-specific settings (`.codi/lang/*.yaml`)
5. **framework** — Framework-specific defaults (`.codi/frameworks/*.yaml`)
6. **agent** — Agent-specific overrides (`.codi/agents/*.yaml`)
7. **user** — User-level preferences (`~/.codi/user.yaml`)

Flags can be locked at org, team, or repo level to prevent lower layers from overriding them.

To reference a team config, add the `team` field to your manifest:

```yaml
# codi.yaml
name: my-project
version: "1"
team: frontend
agents:
  - claude-code
  - cursor
```

## Verification

Codi includes a token-based verification system to confirm agents loaded your configuration.

```bash
# Show the verification token and prompt
codi verify

# Ask your agent: "Verify codi configuration"
# The agent responds with the token, rules, and flags

# Validate the agent's response
codi verify --check "token: codi-abc123, rules: security, code-style"
```

## Version Enforcement

Pin a minimum Codi version in `codi.yaml` to keep your team on the same baseline:

```yaml
codi:
  requiredVersion: ">=0.2.0"
```

Run `codi doctor` to check project health — version compatibility, generated file drift, and config validity:

```bash
# Interactive check
codi doctor

# CI/hook mode — exits non-zero on any failure
codi doctor --ci
```

When `requiredVersion` is set, `codi init` auto-includes a pre-commit hook that runs `codi doctor --ci` so version mismatches are caught before code is pushed.

## Team Sync

Share your local rules and skills with your team by syncing them to a shared config repository via pull request.

Configure the sync target in `codi.yaml`:

```yaml
sync:
  repo: "org/team-codi-config"
  branch: main
  paths: [rules, skills]
```

Then run:

```bash
# Preview what would be synced
codi sync --dry-run

# Sync and create a PR
codi sync

# Sync with a custom PR message
codi sync -m "Add security rules from project-x"
```

The sync flow: local `.codi/` changes are copied to a branch in the team repo, then a PR is created for review. Requires `gh` CLI to be installed and authenticated.

## Development

```bash
git clone <repo-url>
cd codi
pnpm install
pnpm build
pnpm test
```

### Scripts

| Script | Description |
|--------|-------------|
| `pnpm build` | Build with tsup |
| `pnpm test` | Run tests (Vitest) |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm test:coverage` | Run tests with coverage |
| `pnpm lint` | Type check with `tsc --noEmit` |
| `pnpm dev` | Build in watch mode |

### Project Structure

```
src/
  cli/            # Command handlers (init, generate, validate, status, add, verify, doctor, sync)
  adapters/       # Agent adapters (claude-code, cursor, codex, windsurf, cline)
  core/
    config/       # Config resolution, validation, state management
    flags/        # Flag catalog and schema
    generator/    # File generation engine
    hooks/        # Hook system
    migration/    # Config migration
    output/       # Logger, formatter, exit codes, errors
    scaffolder/   # Rule and skill scaffolding
    sync/         # Team sync engine
    verify/       # Token generation and verification
    version/      # Version checking
  schemas/        # Zod schemas
  templates/      # Built-in templates (hooks, rules)
  types/          # TypeScript type definitions
  utils/          # Shared utilities
```

### Tech Stack

- **TypeScript** — Strict mode, ESM
- **Commander.js** — CLI framework
- **Zod** — Schema validation
- **Vitest** — Test runner
- **tsup** — Bundler

## License

MIT
