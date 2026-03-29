# Skill Self-Improvement Feature — Roadmap & Implementation Plan

**Date**: 2026-03-28
**Target**: Codi CLI (codi-cli)
**Constraint**: Zero external LLM APIs — host agent does all thinking

---

## Context & Rationale

OpenSpace demonstrates that self-evolving skills can dramatically improve agent performance (4.2x higher income, 46% fewer tokens). However, OpenSpace achieves this by running its own separate LLM engine — doubling API costs.

**Our approach**: Instead of paying for a second LLM, we leverage the host coding agent itself. Codi already controls what the agent reads (it generates the config). So we can simply *instruct* the agent to self-report on skill usage via a meta-skill, then aggregate that feedback to drive improvements.

**Data flow**:
```
Agent completes task using a skill
  → skill-reporter meta-skill instructs agent to write feedback
    → agent writes JSON to .codi/feedback/
      → `codi skill stats` aggregates and shows health
        → `codi skill evolve` assembles improvement prompt
          → user gives prompt to agent → agent improves SKILL.md
            → `codi generate` propagates to all agents
```

Zero LLM API calls from Codi. Zero runtime dependencies. Pure data plumbing.

---

## Phase 1: Feedback Collection + Stats (~1.5 weeks)

### P1.1 — Feedback & Evals Schemas
- **Create** `src/schemas/feedback.ts` — Zod schema for feedback entries
- **Create** `src/schemas/evals.ts` — Formalize the existing empty evals.json
- **Modify** `src/schemas/index.ts` — Export new schemas
- **Modify** `src/constants.ts` — Add `FEEDBACK_DIR`, `VERSIONS_DIR`, `EVALS_FILENAME`, `MAX_FEEDBACK_ENTRIES`, `MAX_FEEDBACK_AGE_DAYS`

**Feedback entry schema (key fields)**:

| Field | Type | Purpose |
|-------|------|---------|
| `id` | UUID | Unique per entry |
| `skillName` | string | Links to skill |
| `timestamp` | ISO datetime | When recorded |
| `agent` | enum | claude-code / codex / cursor / windsurf / cline |
| `taskSummary` | string (max 500) | What was done |
| `outcome` | enum | success / partial / failure |
| `issues` | array | {category, description, severity} structured problems |
| `suggestions` | array | Free-text improvement ideas |

**Issue categories**: trigger-miss, trigger-false, unclear-step, missing-step, wrong-output, context-overflow, other

### P1.2 — Feedback Collector
- **Create** `src/core/skill/feedback-collector.ts`
- Methods: `readAll()`, `readForSkill()`, `write()`, `prune()`
- Reads `*.json` from `.codi/feedback/`, validates with Zod, skips invalid with warnings
- Atomic writes (tmp + rename pattern, same as OperationsLedgerManager)
- `prune()` removes entries older than 90 days

### P1.3 — Evals Manager
- **Create** `src/core/skill/evals-manager.ts`
- Methods: `read()`, `write()`, `updateResult()`, `getSummary()`
- Operates on existing `.codi/skills/{name}/evals/evals.json`

### P1.4 — Skill-Reporter Meta-Skill
- **Create** `src/templates/skills/skill-reporter.ts`
- **Modify** `src/templates/skills/index.ts` — Register template

A SKILL.md that instructs the host agent to write structured feedback after using any skill. Key properties:
- `user-invocable: false` — Not a slash command, background knowledge
- Contains the exact JSON schema inline so agent knows the format
- Examples for each issue category
- Instructions to write to `.codi/feedback/{timestamp}-{skill-name}.json`
- Works on both Claude Code and Codex (no command references)

### P1.5 — Stats Aggregation
- **Create** `src/core/skill/skill-stats.ts`
- Pure functions: `aggregateStats()`, `formatStatsTable()`, `formatDetailedStats()`
- Per-skill metrics: successRate, avgDuration, topIssues, healthGrade (A-F), trend
- Grade thresholds: A>=90%, B>=75%, C>=60%, D>=40%, F<40%
- Trend: compares last 5 vs previous 5 entries

### P1.6 — CLI Commands (feedback + stats)
- **Create** `src/cli/handlers/skill-feedback.ts` — Lists raw feedback
- **Create** `src/cli/handlers/skill-stats.ts` — Health dashboard
- **Modify** `src/cli/skill.ts` — Register subcommands

```bash
codi skill feedback [--skill <name>] [--limit <n>]
codi skill stats [name]              # table or detail view
codi skill stats [name] --json       # machine-readable
```

### P1.7 — Integration
- **Modify** `src/core/audit/operations-ledger.ts` — Add `skill-feedback | skill-evolve | skill-stats` to OperationType
- **Modify** `src/adapters/skill-generator.ts` — Add `"versions"` to SKIP_DIRS
- **Modify** `src/core/output/error-catalog.ts` — Add error codes (E_FEEDBACK_NOT_FOUND, E_FEEDBACK_INVALID, etc.)

---

## Phase 2: Evolve Command (~1 week)

### P2.1 — Version Manager
- **Create** `src/core/skill/version-manager.ts`
- Methods: `saveVersion()`, `listVersions()`, `restoreVersion()`, `diffVersions()`
- Stores in `.codi/skills/{name}/versions/v{N}.SKILL.md`
- Created on-demand (not during scaffold)

### P2.2 — Skill Improver
- **Create** `src/core/skill/skill-improver.ts`
- `generateImprovementPrompt()` — Assembles structured prompt from:
  - Current SKILL.md content
  - Aggregated feedback (stats, top issues, quoted descriptions)
  - Eval pass/fail status
  - Improvement instructions (fix issues, preserve passing behaviors)
- Zero LLM calls — pure data assembly

### P2.3 — CLI: `codi skill evolve`
- **Create** `src/cli/handlers/skill-evolve.ts`
- **Modify** `src/cli/skill.ts` — Register subcommand

```bash
codi skill evolve <name>              # prints improvement prompt to stdout
codi skill evolve <name> --dry-run    # show prompt without saving version
codi skill evolve <name> --auto       # writes prompt to tmp file for piping
```

Flow: validate skill -> check feedback (min 3 entries) -> save version -> generate prompt -> print

---

## Phase 3: Version History CLI (~3 days)

### P3.1 — CLI: `codi skill versions`
- **Create** `src/cli/handlers/skill-versions.ts`
- **Modify** `src/cli/skill.ts` — Register subcommand

```bash
codi skill versions <name>              # list all versions
codi skill versions <name> --restore 2  # rollback to v2
codi skill versions <name> --diff 1 2   # unified diff between versions
```

---

## Files Summary

### New Files (12)

| File | LOC (est) | Phase |
|------|-----------|-------|
| `src/schemas/feedback.ts` | ~50 | 1 |
| `src/schemas/evals.ts` | ~50 | 1 |
| `src/core/skill/feedback-collector.ts` | ~120 | 1 |
| `src/core/skill/evals-manager.ts` | ~100 | 1 |
| `src/core/skill/skill-stats.ts` | ~150 | 1 |
| `src/templates/skills/skill-reporter.ts` | ~200 | 1 |
| `src/cli/handlers/skill-feedback.ts` | ~80 | 1 |
| `src/cli/handlers/skill-stats.ts` | ~80 | 1 |
| `src/core/skill/version-manager.ts` | ~120 | 2 |
| `src/core/skill/skill-improver.ts` | ~200 | 2 |
| `src/cli/handlers/skill-evolve.ts` | ~100 | 2 |
| `src/cli/handlers/skill-versions.ts` | ~80 | 3 |

**All files under 250 LOC. Total new code: ~1,330 LOC across 12 files.**

### Modified Files (7)

| File | Change | Phase |
|------|--------|-------|
| `src/constants.ts` | Add 6 constants | 1 |
| `src/schemas/index.ts` | Export new schemas | 1 |
| `src/cli/skill.ts` | Register 4 subcommands | 1-3 |
| `src/core/audit/operations-ledger.ts` | Extend OperationType union | 1 |
| `src/adapters/skill-generator.ts` | Add "versions" to SKIP_DIRS | 1 |
| `src/core/output/error-catalog.ts` | Add error codes | 1 |
| `src/templates/skills/index.ts` | Register skill-reporter | 1 |

---

## Test Strategy

### Unit Tests (per new module)
- `tests/unit/schemas/feedback.test.ts` — Zod parse/reject
- `tests/unit/schemas/evals.test.ts` — Zod parse/reject
- `tests/unit/core/skill/feedback-collector.test.ts` — Read/write/prune, validation, atomic writes
- `tests/unit/core/skill/evals-manager.test.ts` — CRUD, validation
- `tests/unit/core/skill/skill-stats.test.ts` — Aggregation math, grades, trends, edge cases
- `tests/unit/core/skill/skill-improver.test.ts` — Prompt generation, missing data handling
- `tests/unit/core/skill/version-manager.test.ts` — Save/list/restore/diff

### Integration Tests
- `tests/integration/skill-feedback-pipeline.test.ts` — Write feedback -> run stats -> verify
- `tests/integration/skill-evolve-pipeline.test.ts` — Scaffold -> feedback -> evolve -> verify prompt + version

---

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Agent ignores skill-reporter | High | Extremely specific imperative language + inline JSON example. Fallback: manual `codi skill feedback --add` |
| Agent writes malformed JSON | Medium | `safeParse()` skips invalid files with warning. Template includes exact schema. |
| Feedback volume explosion | Low | `prune()` at 90 days, `MAX_FEEDBACK_ENTRIES` cap (1000/skill) |
| Watch mode triggers on feedback writes | Low | Verify watch ignores `.codi/feedback/`. Add exclusion if needed. |
| Cross-agent compatibility | Medium | `agent` field in schema enables per-agent filtering. Instructions are self-contained. |

---

## Verification

1. **Phase 1 complete when**: `codi skill stats` shows a table with health grades from feedback written by Claude Code
2. **Phase 2 complete when**: `codi skill evolve <name>` prints a structured prompt that, when given to an agent, produces an improved SKILL.md
3. **Phase 3 complete when**: `codi skill versions <name> --diff 1 2` shows changes between pre/post evolution
4. **End-to-end**: Run all 770+ existing tests passing + new tests passing
