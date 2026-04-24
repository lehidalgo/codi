<p align="center">
  <img src="assets/logo.svg" alt="codi-cli" width="560">
</p>

<p align="center">
  <strong>One config. Every AI agent. Zero drift.</strong>
</p>

<p align="center">
  Define your rules, skills, and workflows once in <code>.codi/</code> — Codi generates the correct configuration for Claude Code, Cursor, Codex, Windsurf, Cline, and GitHub Copilot automatically.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/codi-cli"><img src="https://img.shields.io/npm/v/codi-cli" alt="npm version"></a>
  <a href="https://github.com/lehidalgo/codi/actions"><img src="https://img.shields.io/github/actions/workflow/status/lehidalgo/codi/ci.yml?label=CI" alt="CI"></a>
  <a href="https://lehidalgo.github.io/codi/docs/"><img src="https://img.shields.io/badge/docs-online-5865F2" alt="Documentation"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/npm/l/codi-cli" alt="license"></a>
</p>

---

## Demo

<p align="center">
  <!-- Video demo placeholder — replace with actual recording -->
  <a href="https://lehidalgo.github.io/codi/docs/">
    <img src="https://img.shields.io/badge/%E2%96%B6%20Watch%20Demo-coming%20soon-555?style=for-the-badge" alt="Watch Demo">
  </a>
</p>

> A full walkthrough video is coming soon. In the meantime, see the [Getting Started guide](https://lehidalgo.github.io/codi/docs/catalog/).

---

## The Problem

Every AI coding agent speaks a different language. Claude Code reads `CLAUDE.md`, Cursor reads `.cursorrules`, Codex reads `AGENTS.md`. When your team uses multiple agents — or different team members use different editors — you end up maintaining duplicate configurations that inevitably drift apart. A security rule added to `CLAUDE.md` never makes it to `.cursorrules`. A new coding convention is enforced in one agent but ignored by the others.

**Codi solves this.** Write your configuration once in `.codi/`, and Codi generates the correct file for every agent, every time. One source of truth. Zero drift.

---

## Who Is Codi For?

- **Teams using multiple AI agents** — ensure consistent rules across Claude Code, Cursor, Codex, Windsurf, Cline, and GitHub Copilot
- **Tech leads enforcing standards** — define security policies, coding conventions, and testing requirements once and deploy them to every developer's agent
- **Individual developers** — get a structured, version-controlled configuration with 100+ built-in templates instead of writing agent configs from scratch

---

## What You Get

| | |
|:--|:--|
| **6 agents, 1 config** | Generate native config files for all supported agents from a single `.codi/` directory |
| **100+ built-in templates** | Rules, skills, and agents covering security, testing, 11 languages, and 3 frameworks |
| **6 presets** | From minimal to strict — choose your starting point and customize |
| **Pre-commit hooks** | Automated testing, secret scanning, type checking, and file size limits |
| **Drift detection** | Know instantly when generated files diverge from your source config |
| **Interactive wizard** | Guided setup, or go fully non-interactive for CI |
| **Artifact catalog** | Browse all 123 built-in artifacts at the [docs site](https://lehidalgo.github.io/codi/docs/catalog/) |

---

## Quick Start

```bash
# 1. Install (curl one-liner — handles Node setup if missing)
curl -fsSL https://lehidalgo.github.io/codi/install.sh | bash

# Or install manually if you already manage Node 24+ yourself
npm install -g codi-cli@latest

# 2. Initialize (interactive wizard)
codi init

# OR let your AI agent set you up
"run codi onboard in the terminal and follow instructions"

# 3. Generate agent configs
codi generate

# 4. Verify
codi status
```

Your `CLAUDE.md`, `.cursorrules`, `AGENTS.md`, `.github/copilot-instructions.md`, and other agent files are generated and ready to commit.

> **No global install?** Use `npx codi-cli <command>` or `npm install -D codi-cli`. Requires **Node.js >= 24**. If your Node is older, the [curl installer](https://lehidalgo.github.io/codi/install.sh) sets up nvm + Node 24 for you.

### Supported platforms

| Platform | Status |
|----------|--------|
| macOS | Supported |
| Linux | Supported |
| Windows | Not supported. WSL2 is untested but should work since Codi is POSIX-only end-to-end. |

Codi targets POSIX environments. The installer is bash-only, hooks are POSIX shell, and CI runs only on Ubuntu and macOS. Native Windows is not on the roadmap.

---

## How It Works

```mermaid
flowchart LR
    A["Built-in templates and presets"] --> B["Scaffold or install into .codi/"]
    B --> C[".codi/ directory\n(runtime source of truth)"]
    C --> D["Config Resolution\n(3 layers)"]
    D --> E["Adapters"]
    E --> F["CLAUDE.md"]
    E --> G[".cursorrules"]
    E --> H["AGENTS.md"]
    E --> I[".windsurfrules"]
    E --> J[".clinerules"]
    E --> K[".github/copilot-instructions.md"]
```

`codi init` and `codi add` scaffold templates from the built-in library into `.codi/`. Then `codi generate` reads `.codi/`, resolves configuration across 3 layers (preset defaults → repo → user), and passes the result through agent-specific adapters that produce each platform's native format. Flags marked `locked: true` cannot be overridden by later layers.

---

## Core Concepts

| Concept | What It Is | Learn More |
|:--------|:-----------|:-----------|
| **Artifacts** | Rules, skills, agents, brands — the building blocks of your config | [Artifacts Guide](docs/project/artifacts.md) |
| **Presets** | Bundles of flags + artifacts for quick setup (6 built-in) | [Presets Guide](docs/project/presets.md) |
| **Flags** | 16 behavioral switches controlling security, testing, permissions, and generation | [Configuration](docs/project/configuration.md) |
| **Adapters** | Translators that convert your config to each agent's native format | [Architecture](docs/project/architecture.md) |

---

## Supported Agents

<!-- GENERATED:START:supported_agents -->
| Agent | Config File | Rules | Skills | Agents | MCP |
|:------|:-----------|:-----:|:------:|:------:|:---:|
| **Claude Code** | `CLAUDE.md` | `.claude/rules` | `.claude/skills` | `.claude/agents` | `.mcp.json` |
| **Cursor** | `.cursorrules` | `.cursor/rules` | `.cursor/skills` | — | `.cursor/mcp.json` |
| **Codex** | `AGENTS.md` | `.` | `.agents/skills` | `.codex/agents` | `.codex/config.toml` |
| **Windsurf** | `.windsurfrules` | `.` | `.windsurf/skills` | — | — |
| **Cline** | `.clinerules` | `.cline` | `.cline/skills` | — | — |
| **GitHub Copilot** | `.github/copilot-instructions.md` | `.github/instructions` | `.github/skills` | `.github/agents` | `.vscode/mcp.json` |
<!-- GENERATED:END:supported_agents -->

---

## Built-in Templates

<!-- GENERATED:START:template_counts_compact -->
| Artifact | Count |
|:---------|:-----:|
| **Rules** | 28 |
| **Skills** | 61 |
| **Agents** | 21 |
<!-- GENERATED:END:template_counts_compact -->

Browse the full catalog at **[lehidalgo.github.io/codi/docs/catalog/](https://lehidalgo.github.io/codi/docs/catalog/)** — filterable by type, category, and keyword, with per-artifact pages showing frontmatter and full content.

Create your own with `codi add rule|skill|agent <name>`, or start from a template with `--template`.

---

## Presets

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

Create, share, and install presets from ZIP or GitHub with `codi preset`. See the [Presets Guide](docs/project/presets.md).

---

## CLI Quick Reference

| Command | Description |
|:--------|:------------|
| `codi` | Launch interactive Command Center |
| `codi init` | Initialize `.codi/` configuration |
| `codi generate` | Generate agent config files |
| `codi add <type> <name>` | Add a rule, skill, agent, or brand |
| `codi status` | Show drift status |
| `codi doctor` | Check project health |
| `codi validate` | Validate configuration |
| `codi preset <sub>` | Manage presets (create, install, export) |
| `codi watch` | Auto-regenerate on file changes |
| `codi compliance` | Full health + drift + verification check |
| `codi onboard` | AI-guided setup — agent explores codebase and recommends artifacts |

**Global options:** `-j, --json` JSON output | `-v, --verbose` debug | `-q, --quiet` silent | `--no-color` plain

> Full reference: [CLI Reference](docs/project/cli-reference.md)

---

## FAQ

**Will Codi overwrite my existing `CLAUDE.md`?**
Yes. Back up existing files first, then move your rules into `.codi/rules/` and run `codi generate`.

**Do I commit generated files?**
Yes. Agents read these files from your repo. Commit both `.codi/` (source) and generated files (output).

**What happens if I edit a generated file manually?**
`codi status` reports it as "drifted". Running `codi generate` overwrites the edit. Modify rules in `.codi/rules/` instead.

**Can different team members use different settings?**
Yes. Personal preferences go in `~/.codi/user.yaml` (never committed). Team-wide policies are enforced via presets with `locked: true` flags.

**How do I add Codi to CI?**
Install as a dev dependency and add `npx codi doctor --ci` to your pipeline. It exits non-zero on issues.

> More questions? See [Troubleshooting](docs/project/troubleshooting.md).

---

## Documentation

Full documentation is available at **[lehidalgo.github.io/codi/docs/](https://lehidalgo.github.io/codi/docs/)**.

| Guide | Description |
|:------|:------------|
| [Getting Started](docs/project/getting-started.md) | Hands-on tutorial for new users |
| [Feature Inventory](docs/project/features.md) | Complete list of everything Codi does |
| [CLI Reference](docs/project/cli-reference.md) | All commands, Command Center, init wizard |
| [Architecture](docs/project/architecture.md) | Config resolution, adapters, generation pipeline |
| [Configuration](docs/project/configuration.md) | Manifest, flags, layers, MCP |
| [Artifacts](docs/project/artifacts.md) | Rules, skills, agents, brands |
| [Presets](docs/project/presets.md) | Built-in and custom presets |
| [Workflows](docs/project/workflows.md) | Daily usage, CI/CD, team patterns |
| [Migration](docs/project/migration.md) | Adopt Codi in existing projects |
| [Troubleshooting](docs/project/troubleshooting.md) | Common issues and fixes |
| [User Journeys](https://lehidalgo.github.io/codi/docs/guides/user-journeys/) | Step-by-step guides for every Codi scenario |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, code conventions, and how to add features.

## License

[MIT](./LICENSE)
