# Codi Documentation

**Date**: 2026-03-25
**Document**: docs/README.md

Index of all documentation for the Codi unified AI agent configuration platform.

## Quick Links

| Document | Description |
|----------|-------------|
| [Architecture](architecture.md) | System overview, adapter design, error handling |
| [Configuration](configuration.md) | Directory structure, manifest, flags, presets |
| [Migration](migration.md) | Adopt codi in projects with existing agent configs |
| [Troubleshooting](troubleshooting.md) | Common issues and solutions |

## Specification

The formal specification lives in `spec/`. Chapters are numbered sequentially.

| # | Document | Description |
|---|----------|-------------|
| - | [Spec Index](spec/README.md) | Reading order and conventions |
| 1 | [Overview](spec/01-overview.md) | What Codi is, design philosophy, high-level architecture |
| 2 | [Layout](spec/02-layout.md) | `.codi/` directory structure and file conventions |
| 3 | [Manifest](spec/03-manifest.md) | `codi.yaml` fields, types, and semantics |
| 4 | [Artifacts](spec/04-artifacts.md) | Rules, skills, agents, commands: format, frontmatter, ownership |
| 5 | [Generation](spec/05-generation.md) | Generation pipeline: config resolution through adapter output |
| 6 | [Hooks](spec/06-hooks.md) | Hook system: detection, installation, templates |
| 7 | [Presets](spec/07-presets.md) | Preset system: built-in, ZIP, GitHub, registry |

See the [Spec Index](spec/README.md) for the full chapter list (chapters 8-10 cover flags, verification, and compatibility).

## Guides

| Document | Description |
|----------|-------------|
| [Artifact Lifecycle](guides/artifact-lifecycle.md) | Creation, ownership, update, and generation lifecycle |
| [Cloud & CI](guides/cloud-ci.md) | CI/CD integration patterns (GitHub Actions, GitLab, Azure, Docker) |
| [Security](guides/security.md) | Secret management, hook security, MCP trust, OWASP |
| [Writing Artifacts](guides/writing-artifacts.md) | Comprehensive guide to authoring rules, skills, agents, commands, and presets |
| [User Flows](guides/user-flows.md) | End-to-end workflows for common tasks |
| [CI Integration](guides/ci-integration.md) | Running codi in continuous integration pipelines |
| [Testing Guide](guides/testing-guide.md) | E2E testing procedure for validating a codi installation |
| [Adoption & Verification](guides/adoption-verification.md) | Verification tokens and compliance checking |

## Reference

| Document | Description |
|----------|-------------|
| [Design](reference/design.md) | Design decisions and rationale |
| [Governance](reference/governance.md) | 7-level config inheritance and flag locking |
| [Multi-Tenant Design](reference/multi-tenant-design.md) | Presets, plugins, and stacks for team sharing |
| [v0.5.0 Preset Redesign](reference/v050-preset-redesign.md) | Preset and artifact ecosystem redesign (v0.5.0) |
| [AI Agent Workspace Features](ai-agent-workspace-features-reference.md) | Cross-agent workspace features reference (all 5 agents) |
| [Codi Generation Audit](codi-generation-audit.md) | Gap analysis: codi generation vs agent capabilities |

## QA

| Document | Description |
|----------|-------------|
| [QA Validation Report](qa/qa-checklist.md) | v0.4.1-v0.5.1 test results and issue tracker |
