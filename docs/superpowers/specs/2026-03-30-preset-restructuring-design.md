# Preset System Restructuring

**Date**: 2026-03-30
**Status**: Draft
**Scope**: Reduce 9 built-in presets to 6 well-differentiated presets

## Problem

The current 9-preset system has significant redundancy:

- `strict` and `security-hardened` share 85% of their configuration
- `python-web` and `typescript-fullstack` are identical except for language-specific rules
- `data-ml` contains only domain agents with generic rules — it's an agent pack, not a preset
- `balanced` is a subset of every other non-minimal preset
- `code-review` skill and `code-reviewer` agent appear in 7 of 8 non-minimal presets
- 7 of 8 non-minimal presets share the same base flag values — only enforcement level differs

Users face a confusing choice matrix with presets that look different but are mostly the same underneath.

## Solution: 6 Presets

Collapse 9 → 6 presets with clear identity separation along two axes:

```
Enforcement:  minimal ──── balanced ──── strict
                              │
Completeness:            fullstack (broad rules + testing)
                              │
Workflow:               power-user (daily commands + graph tools)
                              │
Internal:                    dev (Codi self-development)
```

Each preset occupies a unique position. No two presets share > 50% of their artifact lists.

## Preset Definitions

### 1. codi-minimal

**Identity**: Explicit blank slate. All permissions open, no artifacts.

**Flags** (all `enabled`, most permissive values):

| Flag | Value |
|:-----|:------|
| auto_commit | false |
| test_before_commit | false |
| security_scan | false |
| type_checking | off |
| max_file_lines | 1000 |
| require_tests | false |
| allow_shell_commands | true |
| allow_file_deletion | true |
| lint_on_save | false |
| allow_force_push | true |
| require_pr_review | false |
| require_documentation | false |
| max_context_tokens | 100000 |
| progressive_loading | off |
| drift_detection | off |
| auto_generate_on_change | false |

**Artifacts**: none (empty arrays for rules, skills, agents, commands)

**Tags**: minimal, permissive, starter

**Change from current**: none

---

### 2. codi-balanced

**Identity**: Recommended default. Sensible guardrails, overridable.

**Flags** (all `enabled`, not locked):

| Flag | Value | Differs from minimal |
|:-----|:------|:---------------------|
| test_before_commit | true | yes |
| security_scan | true | yes |
| type_checking | strict | yes |
| max_file_lines | 700 | yes |
| lint_on_save | true | yes |
| allow_force_push | false | yes |
| require_pr_review | true | yes |
| max_context_tokens | 50000 | yes |
| progressive_loading | metadata | yes |
| drift_detection | warn | yes |

All other flags: same as minimal.

**Artifacts**:

| Type | Templates |
|:-----|:----------|
| Rules | code-style, error-handling, improvement |
| Skills | code-review, commit, compare-preset |
| Agents | code-reviewer |
| Commands | review, commit |

**Tags**: balanced, recommended, general

**Change from current**: none

---

### 3. codi-strict (absorbs security-hardened)

**Identity**: Maximum enforcement for regulated/enterprise environments. Locked flags that cannot be overridden.

**Flags** (locked flags marked with L):

| Flag | Value | Mode | Locked |
|:-----|:------|:-----|:------:|
| test_before_commit | true | enforced | L |
| security_scan | true | enforced | L |
| type_checking | strict | enforced | L |
| max_file_lines | 500 | enabled | |
| require_tests | true | enforced | L |
| allow_shell_commands | true | enforced | L |
| allow_file_deletion | false | enforced | L |
| lint_on_save | true | enabled | |
| allow_force_push | false | enforced | L |
| require_pr_review | true | enforced | L |
| require_documentation | true | enabled | |
| drift_detection | error | enabled | |
| auto_generate_on_change | true | enabled | |

All other flags: same as balanced.

**Artifacts**:

| Type | Templates |
|:-----|:----------|
| Rules | code-style, testing, error-handling, security, git-workflow, api-design, improvement |
| Skills | code-review, security-scan, commit, test-coverage, error-recovery, compare-preset |
| Agents | code-reviewer, security-analyzer, test-generator |
| Commands | review, commit, security-scan, test-run, test-coverage |

**Tags**: strict, enforced, security, enterprise, compliance

**Changes from current**:
- Absorbs `allow_shell_commands: enforced, locked` from security-hardened
- Absorbs `allow_file_deletion: enforced=false, locked` from security-hardened
- Adds `api-design` rule from security-hardened
- Tags now include "enterprise" and "compliance" from security-hardened

---

### 4. codi-fullstack (NEW — replaces python-web + typescript-fullstack)

**Identity**: Comprehensive starting point for web/app projects. Broad rules and testing tooling. Language-agnostic — users add language rules via `codi add`.

**Flags** (all `enabled` except where noted):

| Flag | Value | Mode | Differs from balanced |
|:-----|:------|:-----|:----------------------|
| type_checking | strict | enforced | enforced (not just enabled) |
| max_file_lines | 500 | enabled | lower limit |
| require_tests | true | enabled | yes |
| security_scan | true | enforced | enforced |

All other flags: same as balanced.

**Artifacts**:

| Type | Templates |
|:-----|:----------|
| Rules | code-style, testing, architecture, error-handling, api-design, security, performance |
| Skills | code-review, e2e-testing, refactoring, security-scan, commit |
| Agents | code-reviewer, test-generator |
| Commands | check, commit, review, test-run, security-scan |

**Tags**: fullstack, web, app, api

**Why language-agnostic**: The `codi add` command already supports adding language-specific rules:
```bash
# Python project
codi init --preset fullstack
codi add rule python --template python
codi add rule django --template django
codi add agent python-expert --template python-expert

# TypeScript project
codi init --preset fullstack
codi add rule typescript --template typescript
codi add rule react --template react
codi add rule nextjs --template nextjs
codi add agent nextjs-researcher --template nextjs-researcher
```

This is more flexible than having separate presets per language, and composes with any enforcement level.

---

### 5. codi-power-user (trimmed)

**Identity**: Daily workflow companion. Graph exploration, day tracking, session management, codebase onboarding. For developers who use Codi as a daily tool.

**Flags**: Same as balanced (no extra enforcement — this preset is about tooling, not policy).

**Artifacts**:

| Type | Templates |
|:-----|:----------|
| Rules | workflow, agent-usage, code-style, error-handling, git-workflow, improvement |
| Skills | code-review, commit, codebase-onboarding, documentation, error-recovery, compare-preset |
| Agents | codebase-explorer, code-reviewer |
| Commands | commit, review, check, codebase-explore, index-graph, update-graph, open-day, close-day, roadmap, docs-lookup, session-handoff, onboard |
| MCP | github |

**Tags**: workflow, daily, power-user, mcp

**Changes from current**:
- Rules: 13 → 6 (removed testing, architecture, documentation, production-mindset, simplicity-first, security, performance — these belong in fullstack/strict, not a workflow preset)
- Skills: 9 → 6 (removed security-scan, refactoring, test-coverage — these belong in fullstack/strict)
- Agents: 3 → 2 (removed security-analyzer — belongs in strict)
- Commands: 15 → 12 (removed security-scan, test-run, refactor — available from other presets)

---

### 6. codi-dev (unchanged)

**Identity**: Codi's own development. Internal preset with full QA tooling, creator skills, and strict TypeScript enforcement.

**Artifacts**: Unchanged (11 rules, 17 skills, 3 agents, 7 commands, 1 MCP server).

**Tags**: codi, cli, typescript, development, tooling

---

## Removed Presets

| Preset | Reason | Migration |
|:-------|:-------|:----------|
| `codi-security-hardened` | 85% identical to strict | Merged into `codi-strict` |
| `codi-python-web` | Language-specific; pattern doesn't scale | `codi-fullstack` + `codi add rule python django` |
| `codi-typescript-fullstack` | Language-specific; pattern doesn't scale | `codi-fullstack` + `codi add rule typescript react nextjs` |
| `codi-data-ml` | Agent pack, not a preset (generic flags/rules, only agents are unique) | Any preset + `codi add agent` for each data/ML agent |

## Migration Guide for Existing Users

### security-hardened → strict

No action required. `codi-strict` now includes all security-hardened flags and rules. Run `codi generate` after updating.

### python-web → fullstack + language rules

```bash
# Update preset
# In codi.yaml, change presets: [codi-python-web] → presets: [codi-fullstack]

# Add language-specific artifacts
codi add rule python --template python
codi add rule django --template django
codi add agent python-expert --template python-expert
codi generate
```

### typescript-fullstack → fullstack + language rules

```bash
# In codi.yaml, change presets: [codi-typescript-fullstack] → presets: [codi-fullstack]

codi add rule typescript --template typescript
codi add rule react --template react
codi add rule nextjs --template nextjs
codi add agent nextjs-researcher --template nextjs-researcher
codi generate
```

### data-ml → balanced + domain agents

```bash
# In codi.yaml, change presets: [codi-data-ml] → presets: [codi-balanced]

codi add rule python --template python
codi add agent python-expert --template python-expert
codi add agent ai-engineering-expert --template ai-engineering-expert
codi add agent data-engineering-expert --template data-engineering-expert
codi add agent data-science-specialist --template data-science-specialist
codi add agent data-analytics-bi-expert --template data-analytics-bi-expert
codi add agent data-intensive-architect --template data-intensive-architect
codi add agent mlops-engineer --template mlops-engineer
codi generate
```

## Implementation Steps

1. Create `src/templates/presets/fullstack.ts` — new preset with the definition above
2. Modify `src/templates/presets/strict.ts` — absorb security-hardened flags and rules
3. Modify `src/templates/presets/power-user.ts` — trim rules/skills/agents/commands
4. Remove `src/templates/presets/security-hardened.ts`
5. Remove `src/templates/presets/python-web.ts`
6. Remove `src/templates/presets/typescript-fullstack.ts`
7. Remove `src/templates/presets/data-ml.ts`
8. Update `src/templates/presets/index.ts` — remove deleted presets, add fullstack
9. Update `src/core/flags/flag-presets.ts` — update BASE_PRESET_NAMES if needed
10. Update all tests referencing removed presets
11. Update `docs/presets.md` — new preset table and descriptions
12. Update `docs/features.md` — preset count 9 → 6
13. Update `README.md` — generated preset table
14. Add migration notes to `CHANGELOG.md` — breaking change for config files referencing removed presets
15. Run `codi docs-update` to sync generated sections

## Verification

1. `npm test` — all tests pass
2. `codi validate` — configuration valid
3. `codi generate` — generates correctly for all 5 agent adapters
4. Each preset produces distinct output (no two presets generate the same CLAUDE.md)
5. Removed preset names produce a clear error message with migration guidance
6. `codi init` wizard shows all 6 presets (dev remains visible for Codi contributors)
