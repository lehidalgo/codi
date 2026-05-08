# Phase 3 — Hypothesis and testing

Scientific method. Falsifiable hypothesis. Minimal change. One variable at a time.

## 1. Form falsifiable hypothesis

State clearly: "I think X is the root cause because Y. If X is the cause, then changing Z will make the bug disappear."

- Be specific, not vague.
- Write it down.
- Quote evidence from Phase 1 / Phase 2 that supports the hypothesis.

## 2. Test minimally

- Make the SMALLEST possible change to test the hypothesis.
- One variable at a time.
- Don't fix multiple things at once — you cannot isolate what worked.

## 3. Verify before continuing

- Did the change make the bug disappear?
- YES → proceed to Phase 4 (implement the proper fix).
- NO → form a NEW hypothesis. Do NOT add more fixes on top of the failed one.

## 4. When you don't know

- Say "I don't understand X."
- Don't pretend to know.
- Ask for help.
- Research more.

The "I don't know" discipline is critical. Pretending to understand wastes hours; admitting it saves hours.

## Failed hypothesis tracking

Keep a count of failed hypotheses. When you reach 3:

- STOP.
- The architecture may be wrong, not the implementation.
- Apply the 3-strikes rule (see `phase-4-fix.md`).

## Exit criterion

You may proceed to Phase 4 only when:

- [ ] Hypothesis is falsifiable and stated explicitly.
- [ ] Minimal-change test confirms the hypothesis.
- [ ] You can state "the root cause is X, and changing Y proves it".
