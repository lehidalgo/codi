# Pipeline 4 — Operations: Implementation Plan

**Date:** 2026-04-04  
**Spec:** docs/superpowers/specs/2026-04-04-pipeline4-operations-design.md  
**Status:** Implemented

---

## Goal

Add Pipeline 4 — Operations to codi with 4 new skill templates: `codi-evidence-gathering`, `codi-step-documenter`, `codi-audit-fix`, `codi-guided-execution`. Define two entry points for operational workflows not covered by existing pipelines.

---

## Skills Created

| Skill | File | Role |
|-------|------|------|
| `codi-evidence-gathering` | `src/templates/skills/evidence-gathering/` | Shared investigation protocol |
| `codi-step-documenter` | `src/templates/skills/step-documenter/` | Step completion doc generator |
| `codi-audit-fix` | `src/templates/skills/audit-fix/` | One-item-at-a-time audit processor |
| `codi-guided-execution` | `src/templates/skills/guided-execution/` | Collaborative execution orchestrator |

---

## Files Modified

- `src/templates/skills/index.ts` — added 4 barrel exports
- `src/core/scaffolder/skill-template-loader.ts` — added 4 TEMPLATE_MAP entries
- `docs/20260403_210847_[PLAN]_superpowers-integration.md` — added Pipeline 4 section and skills 9–12

---

## Pipeline Structure

```
Entry A: codi-guided-execution
  → [per step] codi-evidence-gathering → codi-verification → codi-step-documenter
  → Final summary: docs/executions/<workflow>/README.md

Entry B: codi-audit-fix
  → [per item] codi-evidence-gathering → codi-verification → commit
```

---

## Registration Pattern Used

All 4 skills follow the no-static-assets registration pattern:
1. `src/templates/skills/<name>/template.ts` — template string with `{{name}}` placeholder
2. `src/templates/skills/<name>/index.ts` — single re-export
3. Barrel export in `src/templates/skills/index.ts`
4. TEMPLATE_MAP entry in `src/core/scaffolder/skill-template-loader.ts`

---

## Verification Steps

1. `pnpm tsc --noEmit` — no new errors in new files (pre-existing errors unrelated to this work)
2. `pnpm test` — no regressions
3. `codi add skill codi-guided-execution` in a test project — SKILL.md scaffolds with `{{name}}` replaced
4. `codi validate` after scaffolding — frontmatter validates
