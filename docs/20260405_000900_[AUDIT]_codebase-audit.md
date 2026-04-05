# Codebase Audit
**Date**: 2026-04-05 00:09
**Document**: 20260405_0009_AUDIT_codebase-audit.md
**Category**: AUDIT

## Executive Summary

Audit scope covered the current worktree, including uncommitted source, tests, and docs changes. The repo is in a mostly working state at runtime: `npm run test` passed with 147 test files and 1748 passing tests, and `npm run docs:validate` returned success. However, `npm run lint` currently fails with a hard type regression caused by a partially adopted required `version` field on normalized artifacts.

The most important issues are consistency problems rather than broad runtime breakage. The main patterns found were:

- Contract drift between schemas/types and construction paths
- Documentation drift around MCP output paths
- Cleanup and ignore gaps for generated MCP support files
- A maintainability rule violation in source file size
- Test and docs validation blind spots that allow stale references to survive

Overall assessment: **request changes** before treating the current worktree as releasable.

## Findings

### Critical

#### 1. Required artifact `version` field is only partially integrated and currently breaks typecheck

**Evidence**

- `src/types/config.ts` now requires `version` on `NormalizedRule`, `NormalizedSkill`, and `NormalizedAgent`
- `src/schemas/rule.ts`, `src/schemas/skill.ts`, and `src/schemas/agent.ts` all default `version: 1`
- Several construction paths still return normalized artifacts without `version`:
  - `src/core/config/parser.ts`
  - `src/core/preset/preset-loader.ts`
  - `src/core/preset/preset-builtin.ts`
  - `src/core/migration/agents-md.ts`
  - `src/core/migration/claude-md.ts`

**Impact**

- `npm run lint` fails
- The artifact contract is no longer single-source-of-truth
- Future behavior is brittle because schema-parsed artifacts have `version`, while manually constructed artifacts do not

**Recommendation**

Centralize normalized artifact creation or add `version` in every non-schema path. Add targeted tests for preset loading and migration importers so this class of drift is caught before typecheck-only failures.

### Warning

#### 2. Claude MCP path documentation is inconsistent with the actual adapter output, and stale generated docs are not covered by `docs:validate`

**Evidence**

- Actual adapter output: `src/adapters/claude-code.ts` generates `.mcp.json`
- README and some docs reflect `.mcp.json`
- Other docs and templates still claim `.claude/mcp.json`:
  - `docs/project/configuration.md`
  - `src/templates/skills/mcp-ops/template.ts`
  - `src/templates/skills/dev-e2e-testing/template.ts`
  - `docs/codi_docs/index.html`
- `src/cli/docs.ts` reports only code-driven section sync for `--validate`; it does not validate the generated HTML catalog contents in `docs/codi_docs/`

**Impact**

- Users can follow the wrong MCP path for Claude Code
- The generated HTML catalog can remain stale while `docs:validate` still reports success

**Recommendation**

Pick one canonical Claude MCP path and update all docs/templates to match the adapter. Either include generated HTML freshness in docs validation or stop treating `docs:validate` as a full docs-integrity check.

#### 3. Generated MCP support files are handled inconsistently by ignore and cleanup flows

**Evidence**

- `src/adapters/claude-code.ts` and `src/adapters/cursor.ts` generate `.mcp.env.example`
- Current repo status shows untracked `.mcp.json` and `.mcp.env.example`
- `.gitignore` ignores generated agent outputs broadly, but does not ignore top-level `.mcp.json` or `.mcp.env.example`
- `src/cli/clean.ts` fallback `AGENT_FILES` includes `.mcp.json` but not `.mcp.env.example`

**Impact**

- Self-hosting this repo produces noisy untracked generated files
- `clean` can leave an orphaned `.mcp.env.example` behind when state is missing or incomplete

**Recommendation**

Make top-level generated MCP artifacts consistent with the rest of generated-output policy:

- If they should be ignored in this repo, add them to `.gitignore`
- If `clean` is supposed to work without state, include `.mcp.env.example` in fallback cleanup

#### 4. `src/core/hooks/hook-templates.ts` exceeds the repo’s 700-line source-file limit

**Evidence**

- `src/core/hooks/hook-templates.ts`: 704 lines

**Impact**

- Violates the repo’s stated architecture constraint
- Makes already dense hook-generation logic harder to review and evolve

**Recommendation**

Split the file by concern, for example:

- runner template
- scan/check templates
- doc/template wiring checks
- shared helper fragments/constants

### Suggestion

#### 5. Some tests and labels understate the real risk of docs/config drift

**Evidence**

- `tests/integration/docs-generation.test.ts` only asserts `totalSkills >= 0`, which would still pass if the catalog were empty
- `tests/unit/adapters/claude-code.test.ts` includes a test name saying `.claude/mcp.json`, but the assertion checks `.mcp.json`

**Impact**

- Weakens confidence in docs generation
- Lets misleading naming survive in tests

**Recommendation**

- Strengthen docs-generation assertions to require a non-trivial skill count
- Align test descriptions with actual expected paths

## Recommendations

1. Fix the `version` integration first and re-run `npm run lint`
2. Resolve the Claude MCP path discrepancy across docs, templates, and generated HTML
3. Add `.mcp.json` and `.mcp.env.example` to ignore or cleanup flows consistently
4. Split `src/core/hooks/hook-templates.ts` under the 700-line threshold
5. Tighten docs/test assertions so stale generated documentation is harder to miss

## Risk Matrix

| Finding | Severity | Likelihood | Impact |
|---------|----------|------------|--------|
| Partial `version` integration breaks typecheck | Critical | High | High |
| MCP path documentation drift | Warning | High | Medium |
| Generated MCP file cleanup/ignore inconsistency | Warning | Medium | Medium |
| Oversized hook templates source file | Warning | High | Low |
| Weak docs/test assertions | Suggestion | High | Low |
