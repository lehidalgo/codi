# Tracer Bullets — Vertical Slicing

A tracer bullet is a thin path through every layer of the system that delivers one observable behavior end-to-end.

## Why vertical, not horizontal

Horizontal slicing — "all the schema first, then all the API, then all the UI" — produces incoherent intermediate states. Halfway through, nothing actually works yet. Tests written before the implementation are guesses about behavior.

Vertical slicing — "one feature path, end to end, then the next" — produces a working system at every commit. Each slice is demoable on its own.

## What a slice looks like

For a "user can toggle dark mode" feature:

**Bad horizontal slicing:**

- Slice 1: schema for theme preference table
- Slice 2: API endpoint to update preference
- Slice 3: UI control that calls the endpoint
- Slice 4: localStorage handling for unauth users

**Good vertical slicing:**

- Slice 1 (AFK): theme toggle persists in localStorage, no auth — minimal end-to-end. Tests assert the toggle changes the DOM theme attribute.
- Slice 2 (AFK): authenticated user has preference saved server-side, falls back to localStorage. Tests assert API round-trip.
- Slice 3 (HITL): UI polish — animation, accessibility labels.

Each slice ships value on its own. Slice 1 alone could ship if priorities changed.

## Ordering

Order slices by dependency, not by layer. If Slice B's tests need Slice A's output to exist, mark "A blocks B". The agent implements blockers first.

Avoid mutual dependencies. If two slices block each other, the cut is wrong — re-slice.

## HITL versus AFK marker

For each slice, decide:

- **AFK**: fully specified, implementation is mechanical, can ship without human in the loop.
- **HITL**: contains a decision that needs human input during implementation.

Prefer AFK. HITL slices accumulate when humans are unavailable.

## How thin is thin enough?

A slice that takes longer than ~2 hours to implement is probably too thick. Re-slice.

A slice shorter than ~30 minutes is probably too thin. Bundle it with a related slice.

The right size is one focused session.

## Slice acceptance criterion format

Each slice declares acceptance in the form:

```
Given <state>, when <action>, then <observable outcome>.
```

If you cannot phrase the slice this way, it is not really a tracer bullet — it is a layer task. Re-slice.
