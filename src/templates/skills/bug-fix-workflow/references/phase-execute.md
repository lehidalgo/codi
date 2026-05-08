# Phase: execute

Apply the fix. Optional: invoke `devloop:worktrees` when the fix touches ≥3 files or the diagnose phase produced significant exploration commits that should not land on main. Skip for 1-commit fixes.

## Procedure

1. Write the regression test **before the fix** — but only if there is a correct seam.
2. Watch the test fail.
3. Apply the fix.
4. Watch the test pass.
5. Re-run the original phase reproduce loop against the un-minimized scenario.

## No-seam handoff

If no correct seam exists, that itself is the finding. The architecture is preventing the bug from being locked down. Action:

1. Hand off to `devloop:architecture-review` to surface the deepening candidate.
2. File the architecture-review handoff as a follow-up.
3. Apply the narrowest fix that closes the regression.

Do NOT block the bug fix on the architectural rework. Ship the narrow fix; queue the architectural change for a separate workflow.

## Debug log discipline

Tag every debug log with a unique prefix so cleanup is one grep:

```js
console.log("[DEBUG-a4f2] cart total:", total);
```

Pattern:

- Pick a unique 4-char hex token per debugging session.
- Tag every log added during diagnosis.
- At phase verify, grep the prefix. Expected: zero hits.

Untagged logs survive cleanup. Tagged logs die.
