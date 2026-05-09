# Phase: reproduce

Most important phase. Skip ONLY when the loop already exists (e.g., a failing CI run on the user's branch).

## Story handling on entry

- **`--from-story US-NNN`** — read the parent Story (`codi sheets read UserStory US-NNN`); the bug is a follow-on to a delivered or in-flight feature. At end of intent (before reproduce starts), upsert a NEW Story carrying `parent_story=US-NNN`, `workflow_type=bug-fix`, `status=in-progress`, and an `i_want` derived from the bug report. The original Story stays untouched.
- **No `--from-story`** — auto-create a standalone Story with `as_a="user"` (or "developer" for internal bugs), `i_want=<bug summary>`, `so_that="<expected behavior>"`, `acceptance_criteria=<symptom + green-state>`, `workflow_type=bug-fix`, `status=in-progress`. Dashboard's "Untraced work" surfaces these so they don't go invisible.

The Story's execution columns (`branch`, `commit_shas`, `pr_url`, `started_at`) are written progressively as the workflow advances.

## Use `codi:diagnose` for the systematic flow

Invoke `codi:diagnose` (4-phase systematic debugging):

1. **Investigation** — read the actual code, do not skim. Trace the failing path.
2. **Pattern recognition** — look for similar bugs, prior fixes, related tests.
3. **Hypothesis** — falsifiable, one variable at a time. After 3 failed hypotheses, stop and reconsider the architecture (3-strikes rule).
4. **Fix + verification** — only after the hypothesis is proven.

If `diagnose` is not enough on its own (complex repro), use the techniques below.

## Build a feedback loop

If the bug report covers ≥2 unrelated failures (different test files, different subsystems), invoke `codi:subagent-orchestration` mode `parallel` to fan out one investigation agent per failure domain. Reconcile after fan-in.

Otherwise build the feedback loop directly. Try in roughly this order until you have a fast deterministic signal:

1. **Failing test** at the seam closest to the bug
2. **HTTP / curl** against a running dev server with the offending input
3. **CLI invocation** with fixture, diff stdout against known-good
4. **Headless browser** (Playwright/Puppeteer) for UI bugs
5. **Replay a captured trace** (real network request, payload, log)
6. **Throwaway harness** — minimal subset that exercises the bug code path
7. **Property/fuzz loop** for "sometimes wrong output" bugs
8. **Bisection harness** for "broke between commits / states"
9. **Differential** — same input through old vs new
10. **HITL bash script** as last resort

## Iterate on the loop itself

A 30-second flaky loop is barely better than no loop. A 2-second deterministic loop is a debugging superpower.

- **Faster**: cache setup, skip unrelated init, narrow scope.
- **Sharper**: assert on the exact symptom, not "didn't crash".
- **More deterministic**: pin time, seed RNG, freeze network.

## Non-deterministic bugs

The goal is not a clean repro but a **higher reproduction rate**. Loop the trigger 100×, parallelize, add stress, narrow timing windows. A 50%-flake bug is debuggable; 1% is not.

## Exit criterion

Transition to `plan` only when:

- [ ] The loop produces the failure mode the **user** described (not a different failure that happens to be nearby)
- [ ] The failure is reproducible across multiple runs (or at high rate for non-deterministic)
- [ ] The exact symptom is captured (error message, wrong output, timing)
