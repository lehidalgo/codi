# Phase: decompose

Goal: split the plan into vertical tracer-bullet slices that can be implemented one at a time, each independently demoable.

Read `references/tracer-bullets.md` first. It defines the technique.

## What you produce

A numbered list of slices. Each slice is a `decision_recorded` event in the manifest, containing:

- Title (short, descriptive)
- Type (HITL — needs human interaction; AFK — fully autonomous)
- Files touched (subset of `scope.files_in_plan`)
- Acceptance criteria
- Blocked-by (other slices, if any)

## How to slice

For each major behavior in the plan:

1. Identify the thinnest path through every layer that delivers that behavior end-to-end.
2. That path is a slice. Each slice cuts through schema, API, UI, and tests if the codebase has those layers.
3. Prefer many thin slices over few thick ones. A slice should be implementable in a single short session.
4. Do not slice horizontally (all schema first, then all API, then all UI). That produces incoherent intermediate states.

## HITL versus AFK

Mark each slice as one of:

- **AFK**: the slice is fully specified. Tests are clear. Implementation is mechanical. An AFK agent could complete it without further input.
- **HITL**: the slice involves a decision that requires human interaction during execution — UX detail, naming choice, architecture micro-decision.

Prefer AFK. HITL slices block on human availability.

## When to transition to execute

You are ready when:

- [ ] Every behavior from the plan is covered by at least one slice
- [ ] Slices are ordered with explicit blocked-by relationships
- [ ] Each slice has a testable acceptance criterion
- [ ] HITL versus AFK label applied to each
- [ ] No slice is wider than the plan permits

Then propose:

```bash
devloop transition --to execute
```

## Common mistakes

- Horizontal slicing. Tests-first-everywhere is the canonical anti-pattern.
- Dependency tangles. Two slices that both block each other indicate the cut is wrong.
- Slices that bypass layers ("just write the API for now"). That defers integration risk.
- Too many slices. Sub-1-hour slices are friction. Aim for slices implementable in a focused session.
