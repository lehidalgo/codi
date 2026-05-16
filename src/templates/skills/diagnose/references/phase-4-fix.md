# Phase 4 — Implementation

Fix the root cause, not the symptom.

## 1. Create failing test case

- Simplest possible reproduction.
- Automated test if possible.
- One-off test script if no framework.
- MUST exist BEFORE fixing.
- Use `codi:tdd` for the test-first cycle.

## 2. Implement single fix

- Address the root cause identified in Phase 3.
- ONE change at a time.
- No "while I'm here" improvements.
- No bundled refactoring.

## 3. Verify the fix

- Test passes now?
- No other tests broken?
- Issue actually resolved against the original repro?

## 4. If the fix doesn't work

- STOP.
- Count: how many fixes have you tried?
- If <3: return to Phase 1, re-analyze with new information.
- If ≥3: STOP and apply the 3-strikes rule below.

## 5. The 3-strikes architectural escalation

If 3+ fixes have failed, the architecture is wrong, not the implementation.

Pattern indicating an architectural problem:

- Each fix reveals a new shared-state / coupling problem in a different place.
- Fixes require "massive refactoring" to implement.
- Each fix creates new symptoms elsewhere.

STOP and question fundamentals:

- Is this pattern fundamentally sound?
- Are we "sticking with it through sheer inertia"?
- Should we refactor architecture vs. continue fixing symptoms?

Action: hand off to `codi:architecture-review`. Do NOT attempt fix #4.

This is not a failed hypothesis — this is a wrong architecture. The discussion belongs at the architecture level, not the bug level.

## Exit criterion

Phase 4 is complete when:

- [ ] Failing test existed before the fix.
- [ ] Test now passes.
- [ ] No other tests broken.
- [ ] Original repro no longer reproduces.
- [ ] OR: 3-strikes triggered and `architecture-review` handoff is recorded.
