# Mode: wide

Discovery. Used when no plan exists and the design must be created.

## Order of operations

1. **Read project context first** — `git log --oneline -20`, `docs/CONTEXT.md` if present, top-level directory listing, `package.json` or equivalent. Do not ask questions you can answer by reading.

2. **Scope decomposition check** — if the request describes multiple independent subsystems (e.g., "build a platform with chat + storage + billing + analytics"), surface immediately:

   > "This sounds like ≥3 independent subsystems. Decompose first. Recommended split: [A], [B], [C], built in this order. Run `discover` separately for the first one."
   > Do not refine details on a project that needs decomposition.

3. **Ask clarifying questions** — one at a time, focused on:
   - Purpose (what problem does this solve, for whom)
   - Constraints (technical, time, scope)
   - Success criteria (what does done look like, observable)
     Stop once you have enough to propose approaches. Resist asking exhaustive questions; ask only what changes the design.

4. **Propose 2-3 approaches with trade-offs** — when you have enough understanding:

   ```
   Three approaches:

   A. [name] — [1-line description]. Trade-off: [one]. Recommended.
   B. [name] — [1-line description]. Trade-off: [one].
   C. [name] — [1-line description]. Trade-off: [one].

   Which?
   ```

   Lead with the recommendation. The user picks or asks for D.

5. **Present the design in sections** — once an approach is selected:
   - Architecture (1-3 sentences for simple; up to 200 words for nuanced)
   - Components and their responsibilities
   - Data flow
   - Error handling and edge cases
   - Testing strategy
     After each section, ask: "Does this match what you want?" Get approval section by section.

6. **Write a design summary** — when all sections are approved:
   - Standalone use: write to `docs/YYYYMMDD_HHMMSS_[RESEARCH]_<topic>.md` per project convention.
   - Inside workflow phase intent: record approved decisions via `decision_recorded` events in the manifest. Do not write a plan markdown here — that is `plan-writing`'s job in phase plan.

7. **Spec self-review** — re-read the design with fresh eyes:
   - Placeholders ("TBD", "TODO") → fix or call out.
   - Internal contradictions → reconcile.
   - Scope check → focused enough for a single workflow, or needs decomposition?
   - Ambiguity → could a section be read two ways? Pick one.
     Fix inline. Do not ask for re-approval; apply the fix and continue.

8. **User review gate** — after self-review, ask:
   > "Design summary recorded. Anything to change before we transition to plan?"
   > Wait for approval. If changes requested, revise and re-loop. Only proceed when explicit approval.

## Deep modules check

When proposing a component, ask: is the interface much smaller than the implementation? If interface ≈ implementation, the module is shallow — likely a pass-through that adds friction without earning its keep. Recommend deepening or removing.

## Working in existing codebases

Explore current structure before proposing. Follow existing patterns. If the existing code has problems that affect the work (file too large, unclear boundaries), include targeted improvements as part of the design. Do not propose unrelated refactors.

## What you do NOT do in this mode

- Write code, write a plan markdown, or invoke any implementation skill.
- Skip steps because the project "feels small". Every project gets a design summary.
- Ask more than one question per turn.
- Recap the user's previous answer.
