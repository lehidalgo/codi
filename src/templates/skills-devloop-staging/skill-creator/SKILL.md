---
name: skill-creator
description: Use when creating new devloop skills, editing existing ones, or auditing skills for standard compliance. Triggers on "create a skill", "write a skill", "scaffold a skill", "audit the skills", "validate skill quality", "check standards compliance". Replaces the older write-a-skill. Body documents the canonical SKILL.md structure, the RED-GREEN-REFACTOR loop for skill content, the validator script, and the directory layout. ANY new devloop skill must be created via this skill. ANY edit to an existing devloop skill must follow the standards documented here. ANY audit of skill quality runs the validator script in `scripts/validate-skills.py`.
---

# skill-creator

Single source of truth for the devloop skill standard. Supersedes `write-a-skill`. Creates, edits, and validates skills.

## When to use

- Creating a new skill — follow RED-GREEN-REFACTOR.
- Editing an existing skill — re-read its evals first; update them BEFORE editing the body.
- Auditing the catalog — run `scripts/validate-skills.py`.

## The Iron Law

> NO SKILL WITHOUT A FAILING TEST FIRST

Applies to NEW skills AND EDITS. Write `evals/evals.json` BEFORE writing or modifying SKILL.md.

## Standard at a glance

Full standard in `references/standard.md`. Validator enforces all of it.

- Frontmatter: `name` kebab-case, `description` starts `Use when …`, third-person only, no workflow-summary inline; combined ≤1536 chars.
- Body <500 words. Required sections: When-to-use, Core principle / Process, Anti-patterns, Termination, Boundaries.
- Required files: `SKILL.md`, `contract.json`, `CHANGELOG.md`, `evals/evals.json`. Optional: `references/`, `scripts/`, `assets/`.
- Multi-mode → one skill with modes. Parallel skills forbidden.
- No origin attribution in content. No `@` path references.

## RED-GREEN-REFACTOR

| Phase    | Step                                                                                                       |
| -------- | ---------------------------------------------------------------------------------------------------------- |
| RED      | Write `evals/evals.json` with cases that fail without the skill. Pressure scenarios for discipline skills. |
| GREEN    | Write minimal SKILL.md addressing the specific failures. Re-run cases — should pass.                       |
| REFACTOR | Close loopholes without breaking compliance.                                                               |

Full discipline in `references/red-green-refactor.md`.

## Process

| Action | Steps                                                                                                                                                        |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Create | Consolidation check → write eval (RED) → scaffold dir → write SKILL.md → run validator → wire into workflows → plugin validate + tests → commit              |
| Edit   | Re-read evals → update cases (RED) → edit body → run validator → bump version + CHANGELOG entry → plugin validate                                            |
| Audit  | `python3 skills/skill-creator/scripts/validate-skills.py [--skill X] [--strict] [--json]`                                                                    |
| Map    | `python3 skills/skill-creator/scripts/generate-skill-map.py` — auto-generates `docs/[ARCHITECTURE]_skill-map.md` with Mermaid graph + cross-reference tables |

CI must run with `--strict` on every PR touching `skills/`.

## Anti-patterns

Full catalog in `references/anti-patterns.md`. Highlights:

- Description summarizes workflow / lists modes → Claude follows description shortcut, skips body.
- Description does not start with `Use when …`.
- First/second person in description.
- Body >500 words without offloading to `references/`.
- Parallel skills covering the same concern.
- Missing `evals/evals.json`.

## References

- `references/standard.md` — full standard with rationale.
- `references/eval-format.md` — `evals/evals.json` schema and examples.
- `references/red-green-refactor.md` — TDD-for-skills discipline.
- `references/multi-mode-skills.md` — modes vs parallel skills.
- `references/anti-patterns.md` — full catalog with examples.

## Termination

- Skill created or edited → validator passes → plugin validates → tests pass → ready to commit.
- Audit → violations table printed → user decides what to fix.
- No manifest events emitted directly.

## Boundaries

- Defines the standard and runs the validator. Does NOT auto-rewrite skills.
- Does NOT replace workflow skills (those orchestrate work; this authors skills).
- Standard is closed — deviations require updating `references/standard.md` and bumping skill-creator's version first.
