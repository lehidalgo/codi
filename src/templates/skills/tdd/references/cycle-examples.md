# RED-GREEN-REFACTOR cycle — examples

One excellent example beats many mediocre ones. The example below is TypeScript; the cycle is identical in any language.

## Feature: retry failed operations 3 times

### RED — write failing test

```typescript
test("retries failed operations 3 times", async () => {
  let attempts = 0;
  const operation = () => {
    attempts++;
    if (attempts < 3) throw new Error("fail");
    return "success";
  };

  const result = await retryOperation(operation);

  expect(result).toBe("success");
  expect(attempts).toBe(3);
});
```

Clear name, tests real behavior, one thing.

### Verify RED — watch it fail

```bash
pnpm test path/to/test.test.ts
```

Confirm:

- Test fails (does not error).
- Failure message is the expected one.
- Fails because the feature is missing (not a typo or import error).

If the test passes → it is testing existing behavior. Fix the test.
If the test errors → fix the error and re-run until it fails correctly.

### GREEN — minimal code

```typescript
async function retryOperation<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; i < 3; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === 2) throw e;
    }
  }
  throw new Error("unreachable");
}
```

Just enough to pass. No options object, no exponential backoff, no logging — those are not in the test.

### Verify GREEN — watch it pass

```bash
pnpm test path/to/test.test.ts
```

Confirm:

- Target test passes.
- Other tests still pass.
- Output is pristine (no errors, no warnings).

### REFACTOR — clean up

After green only:

- Remove duplication.
- Improve names.
- Extract helpers.

Keep tests green. Do NOT add behavior in refactor.

### Repeat

Next failing test for next behavior.

## YAGNI in GREEN

GREEN means SIMPLEST. The bad version:

```typescript
async function retryOperation<T>(
  fn: () => Promise<T>,
  options?: {
    maxRetries?: number;
    backoff?: "linear" | "exponential";
    onRetry?: (attempt: number) => void;
  },
): Promise<T> {
  // Over-engineered — the test asks for none of this
}
```

Test asks for "retries 3 times". Implementation does that and nothing more. Add features when the next failing test requires them.
