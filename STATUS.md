# Project Status

## Date
2026-03-26

## Summary

Codi v0.6.0 is **published on npm** as `codi-cli`. Phases 1-4 are complete. Full skills spec compliance, enriched adapter output, progressive loading, specialized creator skills, interactive wizards with @clack/prompts, and comprehensive documentation are all shipped.

## Current State

- **Branch**: `develop`
- **npm**: `codi-cli@0.6.0` published
- **GitHub**: public at `lehidalgo/codi`
- **CI**: GitHub Actions passing (lint, build, test)
- **Tests**: 767 tests across 71 test files, all passing
- **Docs**: spec/ (11 files), guides/ (9 files), reference/ (4 files), qa/ (1 file)

## Recent Commits

| Commit | Message |
|--------|---------|
| `7ff0723` | docs: update QA checklist with v0.6.0 full test results |
| `036b21e` | feat: v0.6.0 full skills spec + enriched adapters |
| `3b9dfb0` | chore: bump version to 0.5.1 |
| `97724ba` | feat: preset selection shows artifacts, editable to custom |
| `0f1962f` | chore: bump version to 0.5.0 |
| `93cb60b` | feat: searchable selection everywhere + CODI branding UI |
| `d2b3057` | refactor: remove old dir-based preset fallback, single behavior |
| `1af35f7` | feat: init ZIP/GitHub import, save-as-preset, preset edit |
| `cc42c35` | feat: codi contribute command for community sharing |
| `d475ba3` | feat: preset-first init wizard with searchable selection |

## What's Complete

### Phase 1: MVP
- 16 CLI commands: init, generate, validate, status, add, verify, doctor, update, clean, compliance, watch, ci, revert, marketplace, preset, docs-update
- 5 agent adapters: Claude Code, Cursor, Codex, Windsurf, Cline
- 7-level config inheritance (org → team → repo → lang → framework → agent → user)
- 18 behavioral flags with 6 presets (minimal, balanced, strict, python-web, typescript-fullstack, security-hardened)
- Zod validation, hash-based state tracking, drift detection
- Token-based verification (12-char content hash, deterministic)
- Version enforcement with `requiredVersion` and pre-commit hooks

### Phase 2: Governance
- Org config (`~/.codi/org.yaml`) with locked flag enforcement
- Team config (`~/.codi/teams/{name}.yaml`) for team overrides
- Framework layer (`.codi/frameworks/*.yaml`)
- `managed_by: codi` vs `managed_by: user` artifact ownership
- `codi update --rules --skills --agents` refreshes managed artifacts
- `codi update --from <repo>` one-way pull from central repository
- 25 structured error codes

### Phase 3: Ecosystem
- MCP centralization (`.codi/mcp.yaml` → 4 agent formats)
- Skill marketplace (`codi marketplace search/install`)
- CI integration (`codi ci` composite command)
- Watch mode (`codi watch` file watcher)
- Progressive loading (metadata-only SKILL.md for auto-discovery agents)
- Source attribution headers on all generated files
- Backup & revert (`codi revert --list/--last/--backup`)

### Phase 4: Multi-Tenant Presets
- Preset-first init wizard with searchable artifact selection
- 6 built-in presets (3 core + 3 full stack presets)
- ZIP packaging, GitHub repo support, registry search
- `codi preset create/list/install/export/validate/remove/edit/search/update`
- `codi contribute` for community sharing via PR or ZIP
- Presets as artifact references (no file duplication)

### v0.6.0: Full Skills Spec + Enriched Adapters
- Skills scaffold as directories with evals/, scripts/, references/, assets/
- 4 specialized creator skills (rule, agent, command, skill creators)
- Interactive `codi add` wizard with @clack/prompts
- Enriched adapter output: Project Overview, Permissions, Key Commands, Development Notes, Workflow
- Codex `config.toml` with developer_instructions + MCP servers
- 17 MCP servers (6 essential + 11 popular tools)
- 2 new rule templates (production-mindset, simplicity-first)
- Development hooks (husky pre-commit + commit-msg)

## Artifact Inventory

| # | Artifact | Location | Templates | Generation | Status |
|---|----------|----------|-----------|------------|--------|
| 1 | **Rules** | `.codi/rules/custom/` | 23 | 5 agents | **Full** |
| 2 | **Skills** | `.codi/skills/` | 18 | 5 agents | **Full** |
| 3 | **Agents** | `.codi/agents/` | 8 | 2 agents (Claude/Codex) | **Full** |
| 4 | **Commands** | `.codi/commands/` | 8 | 1 agent (Claude) | **Full** |
| 5 | **MCP** | `.codi/mcp.yaml` | 17 servers | 4 agents | **Full** |
| 6 | **Hooks** | Auto-generated | 3 types | `.git/hooks/` | **Infrastructure** |
| 7 | **Flags** | `.codi/flags.yaml` | 6 presets | All agents | **Full** |

## Project Stats

| Metric | Value |
|--------|-------|
| Source files | 179 in `src/` |
| Test files | 71 in `tests/` |
| Source LOC | ~17,684 |
| Tests | 767 passing |
| Error codes | 25 |
| Flags | 18 |
| Config layers | 7 |
| Adapters | 5 |
| Rule templates | 23 |
| Skill templates | 18 |
| Agent templates | 8 |
| Command templates | 8 |
| Presets | 6 |
| CLI commands | 16 |

## What's Next

### Phase 5: Scale

- Plugin system for custom adapters
- Approval workflows (draft → review → publish)
- VS Code extension
- Context compression engine
- Remote includes (Git URLs as config sources)

## Repository

- GitHub: https://github.com/lehidalgo/codi
- npm: https://www.npmjs.com/package/codi-cli
