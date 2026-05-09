# Mode: issues

Decompose a plan or PRD into independently-grabbable tracer-bullet issues on the project issue tracker.

## Pre-conditions

- A plan markdown (`docs/[PLAN]_*.md`) or PRD exists.
- An issue tracker is configured (e.g., GitHub via `gh` CLI, or another tracker declared in `.codi/config.yaml`).
- The active workflow is in phase decompose (or this is a standalone invocation post-plan).

## Tracer-bullet vertical slices

Each issue is a thin **vertical slice** — a slice that cuts through ALL integration layers end-to-end (schema + API + UI + tests for that slice), NOT a horizontal slice of one layer.

Rules:

- Each slice delivers a narrow but COMPLETE path. Demoable on its own.
- Prefer many thin slices over few thick ones.
- Horizontal slicing is a failure mode (e.g., "first all the schema, then all the API, then all the UI" — leaves the system in incoherent intermediate states).

## HITL vs AFK

Mark each slice as one of:

- **AFK** — fully specified, mechanical to implement, can ship without human in the loop. Default.
- **HITL** — requires human interaction (UX detail, naming choice, architecture micro-decision).

Prefer AFK. HITL slices block on human availability.

## Order of operations

1. **Gather context.** Read the source plan or PRD. If the user passed an issue reference (e.g., `gh issue view 42`), fetch that issue's body and comments.

2. **Explore codebase if needed.** Issue titles and descriptions must use the project's domain glossary (`docs/CONTEXT.md`) and respect ADRs (`docs/adr/`).

3. **Draft vertical slices.** For each behavior in the source plan, identify the thinnest path that delivers it end-to-end. Sequence slices by dependency.

4. **Quiz the user on the breakdown.** Present the proposed slices as a numbered list. For each, show:
   - Title (short descriptive)
   - Type (HITL or AFK)
   - Blocked by (other slices that must complete first)
   - User stories covered (if the source has them)

   Then ask:

   > "Granularity right? Dependency relationships correct? Any slices to merge or split? HITL/AFK marking correct?"

   Iterate until the user approves the breakdown.

5. **Publish.** For each approved slice, publish a new issue to the tracker. Use the issue body template below. Apply the `needs-triage` label so it enters the team's triage flow.

   Publish in dependency order (blockers first). That way the "Blocked by" field can reference real issue identifiers.

## Issue body template

```markdown
## Parent

[link to the parent plan or PRD issue, if any]

## What to build

[concise description of this vertical slice; describe end-to-end behavior, not layer-by-layer implementation]

## Acceptance criteria

- [ ] Criterion 1 (testable, observable)
- [ ] Criterion 2
- [ ] Criterion 3

## Blocked by

- #<issue-number-of-blocker>

(or "None — can start immediately" if no blockers)

## Notes

[any extra context the implementer needs that does not fit in "What to build"]
```

## Termination

- Emit one `decision_recorded` event per published issue, with the issue identifier and the slice title in the payload.
- Do NOT close or modify the parent plan/PRD.
- Surface the list of published issues to the user with a 1-line summary:
  > "<N> issues published. Order: #X → #Y → #Z. <count> AFK, <count> HITL."

## What you do NOT do in this mode

- Horizontal slicing (one layer per issue). Each issue cuts top to bottom.
- Issues with implementation code in them. The issue says WHAT to build, not HOW. The plan markdown has the HOW.
- Mass-publish without user approval of the breakdown. Step 4 is mandatory.
- Modify the parent plan/PRD. Issues are derived artifacts; the parent stays intact.
- Use issue tracker without it being configured. If no tracker is declared, this mode is not applicable; switch to mode `plan` and use the plan markdown's "Files to be modified" table as the de facto decomposition.
