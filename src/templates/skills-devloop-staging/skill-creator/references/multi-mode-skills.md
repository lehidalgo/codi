# Multi-mode skill design

When two skills would cover the same concern, consolidate them into one skill with modes. Parallel skills duplicate maintenance and split discoverability.

## When to use modes

| Pattern                          | Example                  | Modes                                                                                     |
| -------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------- |
| One skill, two-way symmetry      | `code-review`            | `request` (sender side) + `receive` (receiver side)                                       |
| One skill, complexity ladder     | `discover`               | `wide` (no plan) + `sharpen` (existing plan) + `domain` (sharpen + ADRs)                  |
| One skill, output shape variants | `plan-writing`           | `plan` (markdown for workflow) + `prd` (PRD synthesis) + `issues` (tracker decomposition) |
| One skill, two execution shapes  | `subagent-orchestration` | `parallel` (fan-out) + `sequential` (task-by-task)                                        |

## When NOT to use modes

- Two skills that share only the topic but not the discipline. Example: `architecture-review` (find friction) and `refactor-workflow` (execute the fix) — different lifecycles, different invariants.
- A "mode" that has its own anti-patterns and termination discipline that contradict the others. That is a separate skill.
- A "mode" that is rarely used. Consolidation costs maintenance for the common path; tiny edge cases stay separate.

## SKILL.md structure for multi-mode

```markdown
# <skill-name>

<Single-paragraph hook>

## Pick a mode

| Mode     | Shape      | Use when   |
| -------- | ---------- | ---------- |
| `mode-a` | <one line> | <one line> |
| `mode-b` | <one line> | <one line> |

## Core principle

<Shared discipline across modes — the load-bearing invariant>

## Universal rules

1. <rule>
2. <rule>
   ...

## Anti-patterns

(Shared anti-patterns)

## References

- `references/mode-a.md` — full mode A flow
- `references/mode-b.md` — full mode B flow

## Termination

(Per mode termination rules)

## Boundaries

(Mutual exclusions, sibling-skill pointers)
```

## `references/mode-<id>.md` structure

Each mode reference document contains:

1. When this mode is mandatory / optional
2. Process (steps)
3. Manifest events emitted
4. Anti-patterns specific to this mode (in addition to universal)
5. Composition with other devloop skills

## `contract.json` for multi-mode

```json
{
  "skill_name": "discover",
  "skill_type": "mode",
  "version": "0.1.0",
  "modes": [
    {
      "id": "wide",
      "purpose": "<one line>",
      "reference": "references/mode-wide.md",
      "default_when": "<one line>"
    },
    {
      "id": "sharpen",
      "purpose": "<one line>",
      "reference": "references/mode-sharpen.md",
      "default_when": "<one line>"
    }
  ],
  "events_emitted": [...],
  "human_approval_required_for": [...]
}
```

## Universal vs mode-specific rules

The shared rules go in `SKILL.md` Universal Rules. Mode-specific rules go in the mode's reference document.

Example for `code-review`:

| Rule                                           | Scope                                |
| ---------------------------------------------- | ------------------------------------ |
| Verify against codebase before acting          | Universal (both request and receive) |
| One item at a time                             | Universal                            |
| No performative agreement                      | Universal                            |
| Push back with technical reasoning when wrong  | Universal                            |
| SHA resolution + context packaging             | Mode `request` only                  |
| Forbidden phrases ("you're absolutely right!") | Mode `receive` only                  |
| GitHub in-thread reply convention              | Mode `receive` only                  |

## Discoverability check

After writing a multi-mode skill, ask: "if a user invokes this without specifying a mode, can the skill body unambiguously route them?"

If yes — Pick-a-mode table is doing its job.
If no — either the modes overlap (consolidate further) or the modes are different skills (split apart).
