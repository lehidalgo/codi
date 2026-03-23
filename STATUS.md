# Project Status

## Date
2026-03-23

## Summary

Codi v0.2.0 is **published on npm** as `codi-cli`. Phase 1 (MVP) and Phase 2 (Governance) are complete. CI/CD is operational. The project is public on GitHub with full documentation. Agent (subagent) support and reference-based generation are now implemented.

## Current State

- **Branch**: `main`
- **Latest commit**: `d8d344d` — fix: address all audit findings
- **npm**: `codi-cli@0.2.0` published with provenance
- **GitHub**: public at `lehidalgo/codi`
- **CI**: GitHub Actions passing (lint, test, build)
- **Tests**: 385 tests across 52 test files, all passing

## Commit History

| Commit | Message |
|--------|---------|
| `6da7796` | refactor: extract templates to individual TypeScript modules |
| `1c2f4d0` | feat: add agent (subagent) support for Claude Code and Codex |
| `17bcf65` | fix: codex adapter follows official structure |
| `ba21030` | feat: skills follow official best practices per agent |
| `983b239` | feat: wire skills to all 5 agents with proper SKILL.md format |
| `c998696` | feat: add rule authoring guide and rule-management skill |
| `31bd2eb` | feat: rule lifecycle — managed_by distinction, update --rules, add --all |
| `9615b3c` | fix: follow official best practices per agent |
| `9592536` | feat: reference-based generation and production-grade rule templates |
| `1a11331` | docs: comprehensive README rewrite with full feature documentation |
| `34652ed` | fix: re-enable npm provenance (repo is now public) |
| `acf4163` | fix: remove --provenance from npm publish (private repo) |
| `8916c65` | fix: rename package from @codi/cli to codi-cli |
| `4ac0034` | fix: run build before test in CI workflow |
| `60d10b8` | chore: add package-lock.json for CI cache support |
| `dd10e7a` | chore: add release infrastructure for npm publish |
| `bfead2a` | feat: add Phase 2 governance — 18 flags and 7-level config inheritance |
| `a2b331f` | docs: add STATUS.md session summary for continuity |
| `44df09e` | feat: initial codi CLI implementation |

## What's Complete

### Phase 1: MVP
- 10 CLI commands: init, generate, validate, status, add, verify, doctor, sync, update, clean
- 5 agent adapters: Claude Code, Cursor, Codex, Windsurf, Cline
- Config engine with 4-level inheritance (repo, lang, agent, user)
- 8 behavioral flags with typed defaults
- Zod validation, hash-based state tracking, drift detection
- Token-based verification system
- Team sync via PR with `gh` CLI
- Version enforcement with `requiredVersion`
- Pre-commit hook auto-installation
- Migration from existing CLAUDE.md and AGENTS.md
- 9 rule templates, 4 skill templates, 3 agent templates

### Phase 2: Governance
- 7-level config inheritance: org → team → repo → lang → framework → agent → user
- 10 new flags (18 total) including string[] type (`mcp_allowed_servers`, `allowed_languages`)
- Org config (`~/.codi/org.yaml`) and team config (`~/.codi/teams/{name}.yaml`)
- Framework layer (`.codi/frameworks/*.yaml`)
- Locking at org, team, and repo levels
- `codi doctor` validates org/team configs
- 23 structured error codes

### Agent (Subagent) Support
- `codi add agent <name>` with 3 built-in templates (`code-reviewer`, `test-generator`, `security-analyzer`)
- `codi add agent --all` to add all agent templates at once
- Agent scanner reads `.codi/agents/*.md` during config resolution
- Claude Code: generates `.claude/agents/*.md` (Markdown + YAML frontmatter)
- Codex: generates `.codex/agents/*.toml` (TOML format)

### Reference-Based Generation
- CLAUDE.md and .cursorrules now reference rules instead of inlining them
- Rules live in `.claude/rules/` and `.cursor/rules/` with full content
- Central config files are lightweight indexes (flags + rule list + verification)

### Production-Grade Templates
- 9 rule templates: security, code-style, testing, architecture, git-workflow, error-handling, performance, documentation, api-design
- 4 skill templates: mcp, code-review, documentation, rule-management
- 3 agent templates: code-reviewer, test-generator, security-analyzer
- All 16 templates extracted to individual TypeScript modules in `src/templates/`
- 28 generated files per project (rules + skills + agents across all agents)

### Release Infrastructure
- MIT LICENSE file
- GitHub Actions CI (lint → build → test on push/PR)
- GitHub Actions publish (npm publish with provenance on release)
- `prepublishOnly` script (lint + test + build)
- Package metadata: repository, homepage, bugs, exports
- `.nvmrc` for Node 20
- Package renamed from `@codi/cli` to `codi-cli` (no npm org needed)
- Repo made public for provenance support

### Documentation
- Comprehensive README with mermaid diagrams
- Terminal-style SVG logo
- Full CHANGELOG following Keep a Changelog format
- Rule authoring guide (`docs/writing-rules.md`)

## Project Stats

| Metric | Value |
|--------|-------|
| Source files | 102 in `src/` |
| Test files | 52 in `tests/` |
| Source LOC | ~6,953 |
| Tests | 385 passing |
| Error codes | 23 |
| Flags | 18 |
| Config layers | 7 |
| Adapters | 5 |
| Rule templates | 9 |
| Skill templates | 4 |
| Agent templates | 3 |
| Generated files | 28 per project |

## What's Next: Phase 3 — Ecosystem

| Epic | Description | Est. Days |
|------|-------------|-----------|
| E7.1 | MCP centralization — unified `.codi/mcp.yaml` distributed to all agents | 5 |
| E7.2 | Skill marketplace — Git-based skill sharing and discovery | 5 |
| E7.3 | GitHub Actions integration — CI validation workflow (`< 30s`) | 4 |
| E7.4 | `codi watch` — file watcher for auto-regeneration (`< 500ms`) | 3 |
| E7.5 | Progressive loading — metadata in generated files for on-demand loading | 4 |
| E7.6 | Traceability — source attribution comments in generated files | 2 |
| E7.7 | Backup & revert — atomic backup/restore of generated files | 3 |

**Total estimated: 26 days / 6 weeks**

## Future: Phase 4 — Scale

- Plugin system for custom adapters
- Approval workflows (draft → review → publish)
- VS Code extension
- Context compression engine
- Remote includes (Git URLs as config sources)

## Repository

https://github.com/lehidalgo/codi
https://www.npmjs.com/package/codi-cli
