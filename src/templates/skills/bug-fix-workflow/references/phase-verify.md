# Phase: verify

Invoke `devloop:verify-evidence` (5-step gate: Identify → Run → Read → Verify → Claim). Without it you are claiming "fixed" without proof.

## Exit criteria

- [ ] Original repro no longer reproduces (must RUN it; do not assume).
- [ ] Regression test passes (`pnpm test` or equivalent; record exit_code via `validation_run` event).
- [ ] All `[DEBUG-…]` instrumentation removed (grep the prefix; expect zero hits).
- [ ] Throwaway prototypes deleted or moved to a clearly-marked debug location.
- [ ] Hypothesis that turned out correct is stated in the commit/PR message.

## Optional: code review on the fix

When `.devloop/config.yaml` declares `auto_review: true`, invoke `devloop:code-review` mode `request` after verify-evidence. The reviewer subagent gets the diff, the bug repro description, and the regression-test path; it returns a structured verdict. Critical or Important issues block the transition to `done`. Especially valuable for fixes that touch shared code paths or change error handling.

## Phase done

The fix is committed with the regression test. Ask: what would have prevented this bug?

- If a test pattern would have caught it → propose updating the project's test conventions.
- If an architectural seam was missing → file an `architecture-review` follow-up (do not block this workflow).
- If a process gap (review, deploy) → note in the workflow summary.
