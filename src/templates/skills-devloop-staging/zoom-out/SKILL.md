---
name: zoom-out
description: Use when the user does not know an area of code well, when the agent has narrowed too tight on a single function or file, when starting a new feature in unfamiliar territory, or when a debugging session has lost the forest for the trees. Triggers on "zoom out", "give me the big picture", "I don't know this area", "step back". User-invoked only; does not auto-fire. Body documents the trigger phrase and the map output shape. Standalone via `/devloop:zoom-out`. Lightweight reset, not a workflow phase. Call before architecture-review if the user has not yet identified which area to survey.
user-invocable: false
---

# zoom-out

> "I do not know this area of code well. Go up a layer of abstraction. Give me a map of the relevant modules and callers, using the project's domain glossary vocabulary."

That is the trigger. When you (or the user) need to elevate perspective.

## Process

1. Read `docs/CONTEXT.md` if it exists. The domain glossary is the vocabulary for the map.
2. Read any `docs/adr/` decisions that touch the area being mapped. ADRs explain _why_ the structure is the way it is.
3. Spawn the Task tool with `subagent_type=Explore` (or `general-purpose`) for the codebase walk. Constrain the brief: "list modules in <area>, their public interfaces, who calls each, and which domain terms from CONTEXT.md they implement". Do NOT have the subagent read files exhaustively — this is a map, not a deep dive.
4. Present the map. Use CONTEXT.md vocabulary for domain concepts and the architecture glossary (module / interface / seam / adapter — see `architecture-review` references) for structural concepts. Avoid "component", "service", "API", "boundary".
5. Ask the user what they want to do next.

## Output shape

Map format:

```
Area: <name from CONTEXT.md or descriptive>

Modules in this area:
1. <module> — interface: <one line>; called by: <callers>; implements: <CONTEXT.md term>
2. ...

Adjacent modules (one hop out):
- <module> — relationship: <one line>

Open questions / blurry spots:
- <thing the map could not resolve from the codebase alone>

Relevant ADRs: <list, or "none">
```

## Composition with the rest of devloop

- After zooming out, common follow-ups:
  - User wants to deepen a shallow cluster → invoke `devloop:architecture-review`
  - User wants to start a feature in this area → invoke `devloop:feature-workflow`
  - User wants to fix a specific bug surfaced during the map → invoke `devloop:bug-fix-workflow`
  - User wants the map written into the knowledge base → propose adding terms to `docs/CONTEXT.md` (same discipline as `discover` mode `domain`)
- Open questions in the map are good ADR candidates — when the answer requires a load-bearing decision, offer to record it.

## Anti-patterns

- Reading every file in the area. The point is the map, not the territory.
- Using "component", "service", "API", or "boundary" instead of glossary terms.
- Producing the map without referencing CONTEXT.md vocabulary when the file exists.
- Auto-firing this skill — the frontmatter sets `disable-model-invocation: true`. It is a deliberate user trigger.

## Termination

- Map presented, user picked a follow-up (or none) → done.
- No manifest events. Standalone exploratory skill.

## Boundaries

- Produces a map. Does NOT propose refactors (that is `architecture-review`).
- Does NOT plan a feature (that is `discover` + `plan-writing`).
- Does NOT debug a bug (that is `diagnose` / `bug-fix-workflow`).
