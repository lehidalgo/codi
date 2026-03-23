# Project Status

## Date
2026-03-23

## Summary

Codi v0.1.0 is **published on npm** as `codi-cli`. Phase 1 (MVP) and Phase 2 (Governance) are complete. CI/CD is operational. The project is public on GitHub with full documentation.

## Current State

- **Branch**: `main`
- **Latest commit**: `1a11331` — comprehensive README rewrite
- **npm**: `codi-cli@0.1.0` published with provenance
- **GitHub**: public at `lehidalgo/codi`
- **CI**: GitHub Actions passing (lint, test, build)
- **Tests**: 365 tests across 49 test files, all passing

## Commit History

| Commit | Message |
|--------|---------|
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
- 8 CLI commands: init, generate, validate, status, add, verify, doctor, sync
- 5 agent adapters: Claude Code, Cursor, Codex, Windsurf, Cline
- Config engine with 4-level inheritance (repo, lang, agent, user)
- 8 behavioral flags with typed defaults
- Zod validation, hash-based state tracking, drift detection
- Token-based verification system
- Team sync via PR with `gh` CLI
- Version enforcement with `requiredVersion`
- Pre-commit hook auto-installation
- Migration from existing CLAUDE.md and AGENTS.md
- 4 rule templates, 3 skill templates, 3 hook templates

### Phase 2: Governance
- 7-level config inheritance: org → team → repo → lang → framework → agent → user
- 10 new flags (18 total) including string[] type (`mcp_allowed_servers`, `allowed_languages`)
- Org config (`~/.codi/org.yaml`) and team config (`~/.codi/teams/{name}.yaml`)
- Framework layer (`.codi/frameworks/*.yaml`)
- Locking at org, team, and repo levels
- `codi doctor` validates org/team configs
- 23 structured error codes

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
- Comprehensive README (679 lines) with mermaid diagrams
- Terminal-style SVG logo
- Full CHANGELOG following Keep a Changelog format

## Resolved Open Items

| Item | Status |
|------|--------|
| npm publish | Done — `codi-cli@0.1.0` on npm |
| CI/CD | Done — GitHub Actions for test + publish |
| LICENSE file | Done — MIT |
| Badge URLs | Done — npm, license, CI badges |
| prepublishOnly script | Done |
| Package naming | Resolved — `codi-cli` (unscoped) |

## Project Stats

| Metric | Value |
|--------|-------|
| Source files | 76 in `src/` |
| Test files | 49 in `tests/` |
| Source LOC | ~5,410 |
| Tests | 365 passing |
| Error codes | 23 |
| Flags | 18 |
| Config layers | 7 |
| Adapters | 5 |

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
