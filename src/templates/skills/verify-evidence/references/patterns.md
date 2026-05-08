# Verification patterns by claim type

Concrete commands and what counts as evidence per claim type.

## Tests

```
✅ [Run test command] [See: 34/34 pass] "All tests pass"
❌ "Should pass now" / "Looks correct"
```

For workflow phase verify: `pnpm run validate` (or stack equivalent). Append `validation_run` event with exit code.

## Regression tests (TDD red-green)

A regression test is only valid if you have observed it both fail (without fix) and pass (with fix):

```
✅ Write → Run (pass) → Revert fix → Run (MUST FAIL) → Restore → Run (pass)
❌ "I've written a regression test" (without red-green verification)
```

If reverting the fix makes the test still pass, the test does not actually test the bug. Reject as evidence.

## Build

```
✅ [Run build] [See: exit 0] "Build passes"
❌ "Linter passed" (linter does not check compilation)
```

For TS: `tsc --noEmit` or `pnpm run type-check`. For Rust: `cargo build`. For Go: `go build ./...`.

## Bug fixed

The original failing scenario must reproduce no longer:

```
✅ Run the original repro → confirm it now passes
✅ Run the regression test → confirm it now passes
❌ Code was changed → "should be fixed now"
```

## Requirements met

Re-read the plan → create a checklist → verify each criterion → report gaps or completion:

```
✅ Re-read plan → checklist of N criteria → verify each → report N/N met or list gaps
❌ "Tests pass, phase complete" (tests covering implementation ≠ tests covering requirements)
```

## Agent delegation

A delegated subagent's "DONE" status is one signal, not evidence:

```
✅ Subagent reports DONE → check VCS diff → verify changes match the task → report actual state
❌ Subagent reports DONE → assume it is done
```

## CI failure mirroring

When a CI failure must be reproduced locally:

```
✅ Run the CI command locally with the same env → observe the same failure → fix → confirm both local and CI pass
❌ "It's a flaky test, just retry CI"
```

If local cannot reproduce, that itself is a finding (env-specific failure). Do not retry CI without explanation.

## Failed verification path

If the gate fails:

1. Report the actual state with the actual output.
2. Do NOT claim partial success.
3. Decide: fix the issue, or escalate to user that the claim is invalid.
4. After fix, re-run the full 5-step gate.
