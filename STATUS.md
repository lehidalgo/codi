# Project Status

## Date
2026-03-24

## Summary

Codi v0.2.0 is **published on npm** as `codi-cli`. Phase 1 (MVP), Phase 2 (Governance), and **Phase 3 (Ecosystem)** are complete. All planned features implemented: commands support, MCP distribution to all agents, skill marketplace, CI integration, traceability, backup/revert, watch mode, drift enforcement. Only `progressive_loading` remains deferred.

## Current State

- **Branch**: `main`
- **Latest commit**: `45d2606` — feat: unified codi-operations skill replaces rule-management
- **npm**: `codi-cli@0.2.0` published (v0.3.0 ready to release)
- **GitHub**: public at `lehidalgo/codi`
- **CI**: GitHub Actions passing (lint, build, test)
- **Tests**: 381 tests across 47 test files, all passing
- **Audit**: 9/10 — clean, production-ready
- **E2E**: All 8 test suites passed (including Claude Code agent integration)

## Recent Commits

| Commit | Message |
|--------|---------|
| `c5d612b` | feat: add E2E testing skill and comprehensive testing guide |
| `a4ff3e1` | feat: remove codi sync, add one-way pull from central repo |
| `f1d6b63` | feat: adoption verification — stronger token, compliance command, audit log |
| `55ea659` | docs: restructure README — move detailed content to separate guides |
| `b555e68` | docs: fix all documentation gaps from audit |
| `d8d344d` | fix: address all audit findings — 13 fixes across codebase |
| `ef326d6` | refactor: unify rules, skills, and agents — full parity |
| `80c45a9` | docs: update STATUS, README, CHANGELOG with agent support and current stats |
| `6da7796` | refactor: extract templates to individual TypeScript modules |
| `1c2f4d0` | feat: add agent (subagent) support for Claude Code and Codex |

## What's Complete

### Phase 1: MVP
- 14 CLI commands: init, generate, validate, status, add, verify, doctor, update, clean, compliance, watch, ci, revert, marketplace
- 5 agent adapters: Claude Code, Cursor, Codex, Windsurf, Cline
- 7-level config inheritance (org → team → repo → lang → framework → agent → user)
- 18 behavioral flags with 3 presets (minimal, balanced, strict)
- Zod validation, hash-based state tracking, drift detection
- Token-based verification (12-char content hash, deterministic)
- Version enforcement with `requiredVersion` and pre-commit hooks
- Migration from existing CLAUDE.md and AGENTS.md

### Phase 2: Governance
- Org config (`~/.codi/org.yaml`) with locked flag enforcement
- Team config (`~/.codi/teams/{name}.yaml`) for team overrides
- Framework layer (`.codi/frameworks/*.yaml`)
- `managed_by: codi` vs `managed_by: user` artifact ownership
- `codi update --rules --skills --agents` refreshes managed artifacts
- `codi update --from <repo>` one-way pull from central repository
- 23 structured error codes

### Artifact Parity (Rules, Skills, Agents)
- All three follow identical lifecycle: create → store → generate → update → clean
- `codi add {rule,skill,agent} --all` for batch creation
- `codi update --{rules,skills,agents}` for managed artifact refresh
- Zod schema validation for all three types
- `managed_by` field on all three types
- 9 rule templates, 5 skill templates, 3 agent templates

### Agent Output (per platform)
- Claude Code: `.claude/rules/*.md` + `.claude/skills/*/SKILL.md` + `.claude/agents/*.md`
- Cursor: `.cursor/rules/*.mdc` + `.cursor/skills/*/SKILL.md`
- Codex: `AGENTS.md` (inline) + `.agents/skills/*/SKILL.md` + `.codex/agents/*.toml`
- Windsurf: `.windsurfrules` (inline) + `.windsurf/skills/*/SKILL.md`
- Cline: `.clinerules` (inline) + `.cline/skills/*/SKILL.md`

### Adoption Verification
- `codi compliance` — composite health check (doctor + drift + config summary)
- Verification section in all generated files with 12-char content-based token
- Configuration manifest in CLAUDE.md (rule/skill/agent counts + timestamp)
- Audit log (`.codi/audit.jsonl`) records generate and update events
- `codi doctor --ci` for pre-commit and CI pipeline integration

### Documentation
- README.md (339 lines) — concise with links to 8 detailed guides
- docs/architecture.md — system design, hook system, error handling
- docs/configuration.md — flags, presets, directory structure
- docs/governance.md — 7-level inheritance, org policies
- docs/writing-rules.md — artifact authoring guide (rules, skills, agents)
- docs/verification.md — token system
- docs/migration.md — adoption guide
- docs/ci-integration.md — GitHub Actions examples
- docs/adoption-verification.md — verification audit report
- docs/testing-guide.md — E2E testing procedure (8 suites)

### Release Infrastructure
- MIT LICENSE, GitHub Actions CI + publish with provenance
- `prepublishOnly` script, `.nvmrc` for Node 20
- Terminal-style SVG logo

## Project Stats

| Metric | Value |
|--------|-------|
| Source files | 115 in `src/` |
| Test files | 47 in `tests/` |
| Source LOC | ~8,417 |
| Tests | 381 passing |
| Error codes | 23 |
| Flags | 18 |
| Config layers | 7 |
| Adapters | 5 |
| Rule templates | 9 |
| Skill templates | 5 |
| Agent templates | 3 |
| CLI commands | 14 |
| Documentation guides | 9 |

## Resolved in This Session

| Item | Resolution |
|------|-----------|
| `codi sync` violated governance | Removed. Replaced with `codi update --from` (one-way pull) |
| Skills/agents not unified with rules | Full parity refactor — identical lifecycle for all three |
| Weak verification token (6 chars, name-only) | Strengthened to 12 chars, hashes content, includes skills/agents |
| No compliance command | Added `codi compliance` |
| No audit log | Added `.codi/audit.jsonl` |
| No testing guide | Created docs/testing-guide.md + e2e-testing skill |
| drift_detection flag not enforced | Implemented — off/warn/error controls doctor/status/compliance |
| auto_generate_on_change not implemented | Added `codi watch` command with file watcher + debounce |
| TODO comments in flag catalog | All removed — only progressive_loading deferred |
| verify --check parser too rigid | Fixed — accepts Rules (N):, Rules loaded:, Rules:, - Rules: formats |
| E7.6 Traceability | Done — source attribution headers on all generated files |
| E7.3 CI integration | Done — `codi ci` composite command |
| E7.7 Backup & revert | Done — `codi revert --list/--last/--backup`, auto-backup on generate |
| E7.1 MCP centralization | Done — `.codi/mcp.yaml` → `.claude/mcp.json` |
| E7.2 Skill marketplace | Done — `codi marketplace search/install` |
| Skill templates missing `managed_by` | Added to all artifact types |
| Agent schema missing validation | Created AgentFrontmatterSchema with regex |
| README too long (1003 lines) | Restructured to 339 lines with 8 doc links |
| Commands support missing | Done — `codi add command`, `.claude/commands/` generation, 2 templates |
| MCP only for Claude Code | Done — distributed to Codex (`.toml`), Cursor (`.json`), Windsurf (`.json`) |
| No architecture documentation | Created docs/architecture.md |
| 13 audit findings (bugs, gaps) | All fixed |

## Artifact Inventory

Codi defines 8 artifact/system types. Here is the implementation status of each:

| # | Artifact | Location | Scanner | Templates | `codi add` | Generation | `codi update` | Status |
|---|----------|----------|---------|-----------|------------|------------|---------------|--------|
| 1 | **Rules** | `.codi/rules/custom/` | Yes | 9 | Yes | 5 agents | `--rules` | **Full** |
| 2 | **Skills** | `.codi/skills/` | Yes | 5 | Yes | 5 agents | `--skills` | **Full** |
| 3 | **Agents** | `.codi/agents/` | Yes | 3 | Yes | 2 agents (Claude/Codex) | `--agents` | **Full** |
| 4 | **Commands** | `.codi/commands/` | Yes | 2 | Yes | 1 agent (Claude) | No | **Mostly done** |
| 5 | **Context** | `.codi/context/` | No | No | No | No | No | **Not implemented** (type only) |
| 6 | **MCP** | `.codi/mcp.yaml` | Yes | No | No | 4 agents | No | **Partial** (no templates, no add) |
| 7 | **Hooks** | Auto-generated | No | 3 | No | Partial | No | **Infrastructure only** |
| 8 | **Flags** | `.codi/flags.yaml` | Yes | 3 presets | N/A | Yes | `--preset` | **Full** |

### About Context Files

**What it is:** Context files provide project knowledge that AI agents load at session start — architecture, domain rules, conventions, and anything a new team member would need to understand before making changes.

**Origin:** The concept comes from the **Agentic Collaboration Standard (ACS) v1.0**, an open specification for portable AI agent configuration. ACS defines a `context` layer at `.agents/context/` with:
- `project.md` (required) — stack, architecture, folder structure, conventions, restricted areas
- `domain.md` (optional) — business entities, rules, glossary

**Context vs Rules:**

| | Context | Rules |
|---|---------|-------|
| Purpose | What the agent needs to **know** | How the agent should **behave** |
| Content | Architecture, domain, conventions | Code style, testing, security |
| Example | "Our API uses Express with JWT auth" | "Always validate inputs at system boundaries" |
| Loading | At session start (Tier 1) | Persistent instructions |

**Which agents support it:**
- **Claude Code** — via CLAUDE.md and `.claude/` directory (project knowledge)
- **Cursor** — via `.cursorrules` and context features
- **ACS-compatible tools** — via `.agents/context/` (emerging standard)

**Current status in codi:** `NormalizedContext` type is defined in `src/types/config.ts` but the parser returns `context: []` (hardcoded). No scanner, no templates, no generation. Decision pending on whether to implement or remove.

## What's Next

### Immediate
- Publish v0.3.0 to npm with all Phase 3 features
- Decide on context files: implement, defer, or remove dead type

### Deferred
- `progressive_loading` flag — deferred to future version (requires adapter-specific implementation)
- Context files — pending decision (see "About Context Files" above)

### Phase 3: Ecosystem — COMPLETE

| Epic | Description | Status |
|------|-------------|--------|
| E7.1 | MCP centralization — `.codi/mcp.yaml` → `.claude/mcp.json` | **Done** |
| E7.2 | Skill marketplace — `codi marketplace search/install` | **Done** |
| E7.3 | CI integration — `codi ci` composite command | **Done** |
| E7.4 | Watch — `codi watch` file watcher | **Done** |
| E7.5 | Progressive loading | **Deferred** |
| E7.6 | Traceability — source attribution headers | **Done** |
| E7.7 | Backup & revert — `codi revert` command | **Done** |

### Phase 4: Scale

- Plugin system for custom adapters
- Approval workflows (draft → review → publish)
- VS Code extension
- Context compression engine
- Remote includes (Git URLs as config sources)

## Repository

- GitHub: https://github.com/lehidalgo/codi
- npm: https://www.npmjs.com/package/codi-cli
