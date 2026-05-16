# TDD applied to bug fixes

Bug found? Write a failing test that reproduces it. Follow the cycle. The test proves the fix and prevents regression.

Never fix bugs without a test.

## Example: empty email accepted

### Bug

A form accepts empty email and crashes downstream.

### RED — failing test

```typescript
test("rejects empty email", async () => {
  const result = await submitForm({ email: "" });
  expect(result.error).toBe("Email required");
});
```

### Verify RED

```bash
$ pnpm test
FAIL: expected 'Email required', got undefined
```

The test fails for the right reason — the validation is missing.

### GREEN — minimal fix

```typescript
function submitForm(data: FormData) {
  if (!data.email?.trim()) {
    return { error: "Email required" };
  }
  // ...rest of submit
}
```

### Verify GREEN

```bash
$ pnpm test
PASS
```

### REFACTOR

If multiple fields need the same trim+required check, extract a helper. Tests stay green.

## Composition with bug-fix-workflow

Inside `bug-fix-workflow` phase execute:

1. Build the feedback loop in phase reproduce (the agent has it before this point).
2. Apply TDD here: write the regression test FIRST (only if a correct seam exists).
3. Watch it fail.
4. Apply the fix.
5. Watch it pass.

If no correct seam exists for the regression test, that itself is the finding — surface as architecture-review handoff. See `bug-fix-workflow/references/phase-execute.md`.
