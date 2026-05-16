import { PROJECT_NAME, SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Use when the user wants to improve architecture, find refactoring
  opportunities, consolidate tightly-coupled modules, or make a codebase more
  testable and AI-navigable. Triggers on "improve architecture", "find
  refactoring opportunities", "consolidate tightly-coupled modules", "make
  this more testable", "deepen this module", "this codebase is hard to
  navigate". Body documents the deletion test, the architecture vocabulary,
  and the chain into refactor-workflow. Standalone via
  \`/${PROJECT_NAME}:{{name}}\` for periodic codebase health passes. Skip when
  the user has a specific bug or feature in mind; this skill is for surfacing
  latent friction, not solving named problems.
category: ${SKILL_CATEGORY.CODE_QUALITY}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 2
maintainers: ["@lehidalgo"]
---

# {{name}}

Surface architectural friction. Propose **deepening opportunities** — refactors that turn shallow modules into deep ones. The aim is testability and AI-navigability.

## When to use

- Periodic codebase health pass — no specific bug or feature in mind.
- A workflow surfaced "no good seam exists" during phase plan or execute.
- Onboarding to an unfamiliar area — pair with \\\`zoom-out\\\` first to map, then this skill to deepen.

## When to skip

- A specific bug → \\\`bug-fix-workflow\\\`.
- A specific feature → \\\`feature-workflow\\\`.
- A specific refactor target already chosen → \\\`refactor-workflow\\\` directly.

## Glossary (use these terms exactly)

Avoid "component", "service", "API", "boundary". Full definitions in \\\`references/language.md\\\`.

**Module / Interface / Implementation / Depth / Seam / Adapter / Leverage / Locality.**

Three load-bearing principles:

- **Deletion test** — imagine deleting the module. Complexity vanishes = pass-through. Complexity reappears across N callers = it was earning its keep.
- **The interface is the test surface.**
- **One adapter = hypothetical seam. Two adapters = real seam.** No port without ≥2 justified adapters.

## Process (3 steps)

1. **Explore** — read \\\`docs/CONTEXT.md\\\` and any ADRs in scope, then walk the codebase via Task subagent (\\\`subagent_type=Explore\\\`) noting friction. See \\\`references/process.md\\\` for the friction checklist.
2. **Present candidates** — numbered list with files/problem/solution/benefits, using CONTEXT.md vocabulary. No interface proposals yet. Ask which candidate to explore.
3. **Grilling loop on chosen candidate** — walk the design tree. Classify dependencies (see \\\`references/deepening.md\\\`) to pick a test strategy. Update \\\`CONTEXT.md\\\` inline as decisions crystallize. Offer an ADR when the user rejects with a load-bearing reason.

## Composition with the rest of ${PROJECT_NAME}

This skill produces deepening candidates and (optionally) interface designs. It does NOT execute the refactor.

- Approved candidate → hand off to \\\`${PROJECT_NAME}:refactor-workflow\\\` (intent phase adopts the candidate, plan phase encodes the deepened interface, execute uses \\\`subagent-orchestration\\\` mode \\\`sequential\\\` for multi-step deepenings).
- Step 3 alternative-interface exploration → \\\`${PROJECT_NAME}:subagent-orchestration\\\` mode \\\`parallel\\\` per \\\`references/interface-design.md\\\`.

## Anti-patterns

- Proposing interfaces before the user picks a candidate.
- Using "component", "service", "API", or "boundary" instead of glossary terms.
- Listing every theoretical refactor an ADR forbids.
- Introducing a port for a single adapter.
- Testing past the interface — if you must reach behind, the module is the wrong shape.

## References

- \\\`references/language.md\\\` — glossary, principles, rejected framings.
- \\\`references/process.md\\\` — friction checklist for Step 1, candidate format for Step 2, grilling loop side-effects for Step 3.
- \\\`references/deepening.md\\\` — dependency categories and test strategy.
- \\\`references/interface-design.md\\\` — parallel subagent pattern for alternative interface exploration.

## Termination

- After Step 2 if the user does not pick a candidate.
- After Step 3 either: handed off to \\\`refactor-workflow\\\`, or recorded as an ADR-rejected option.
- No manifest events emitted standalone.

## Boundaries

- Surfaces friction; does not implement fixes (refactor-workflow's job).
- Skip when the user has a named bug or feature — use the corresponding workflow.
`;
