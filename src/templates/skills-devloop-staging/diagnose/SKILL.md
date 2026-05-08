---
name: diagnose
description: Use when encountering any bug, test failure, or unexpected behavior, before proposing fixes. Triggers on "diagnose this", "debug this", "what's wrong with", "why is X failing", error messages, test failures, regressions. Body documents the 4-phase systematic flow, the Iron Law, and the 3-strikes architectural rule.
---

# diagnose

Random fixes waste time and create new bugs. Quick patches mask underlying issues. ALWAYS find root cause before fixing. Symptom fixes are failure.

## When to use

- Test failure, bug report, unexpected behavior, performance regression, build failure, integration issue.
- ESPECIALLY under time pressure — systematic is faster than thrashing.
- ESPECIALLY after multiple failed fix attempts.
- ESPECIALLY when "just one quick fix" seems obvious.

## When to skip

- Never. Every issue has a root cause; the process is fast even for simple bugs.

## The Iron Law

> NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST

If Phase 1 has not been completed, you cannot propose fixes. Violating the letter is violating the spirit.

## The 4 phases

| Phase                       | Purpose                                                                | Detail                                |
| --------------------------- | ---------------------------------------------------------------------- | ------------------------------------- |
| 1. Root cause investigation | Read the actual code; reproduce; check recent changes; trace data flow | `references/phase-1-investigation.md` |
| 2. Pattern analysis         | Find working examples; compare; identify differences                   | `references/phase-2-pattern.md`       |
| 3. Hypothesis & testing     | Form falsifiable hypothesis; test minimally; one variable at a time    | `references/phase-3-hypothesis.md`    |
| 4. Implementation           | Failing test first; single fix; verify                                 | `references/phase-4-fix.md`           |

You MUST complete each phase before proceeding.

## The 3-strikes rule

After 3 failed hypotheses → STOP. The architecture is wrong, not the implementation. Hand off to `devloop:architecture-review`.

Pattern indicating architectural problem:

- Each fix reveals a new shared-state / coupling problem in a different place.
- Fixes require "massive refactoring" to implement.
- Each fix creates new symptoms elsewhere.

This is NOT a failed hypothesis — this is a wrong architecture. Do NOT attempt fix #4.

## Anti-patterns

- "Quick fix for now, investigate later".
- "Just try changing X and see if it works".
- "Multiple fixes at once saves time".
- "I see the problem, let me fix it" — seeing symptoms ≠ understanding cause.
- "One more fix attempt" after 2 failures — 3-strikes rule applies.
- Skipping the failing test in Phase 4.

Full rationalization counters and red-flags list in `references/rationalizations.md`.

## Termination

- Phase 4 complete: failing test exists → fix applied → test passes → no other tests broken → issue resolved.
- 3-strikes triggered: handoff to `architecture-review` recorded; do NOT continue fixing.
- "No root cause found": 95% of cases are incomplete investigation; verify Phase 1 was thorough before accepting.

## Boundaries

- Diagnoses; produces falsifiable hypothesis and root cause. Does NOT implement the fix outside this phase chain (workflow's execute phase does that with TDD).
- Does NOT replace `verify-evidence` — diagnose finds; verify-evidence proves the fix works.
- Does NOT replace `bug-fix-workflow` — that workflow chains into diagnose for the systematic flow.

## References

- `references/phase-1-investigation.md` — error reading, reproduction, recent-changes check, multi-component evidence gathering, data-flow tracing.
- `references/phase-2-pattern.md` — working examples, comparison, dependency understanding.
- `references/phase-3-hypothesis.md` — falsifiable format, minimal-change testing, "I don't know" discipline.
- `references/phase-4-fix.md` — failing-test-first, single-fix discipline, 3-strikes architectural escalation.
- `references/rationalizations.md` — counter table for common excuses.
