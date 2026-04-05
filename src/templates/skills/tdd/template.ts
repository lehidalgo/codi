import { PROJECT_NAME, SUPPORTED_PLATFORMS_YAML, SKILL_CATEGORY } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Test-Driven Development discipline. Use when implementing any feature, bug fix,
  refactor, or behavior change. Enforces RED-GREEN-REFACTOR with iron-law verification.
  Also activate when the user mentions writing tests, fixing a bug, or adding functionality.
category: ${SKILL_CATEGORY.DEVELOPER_WORKFLOW}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 4
---

# {{name}}

## When to Activate

Apply TDD to:
- New features
- Bug fixes
- Refactors that change behavior
- Any production code change

**Exceptions — require explicit human approval before skipping:**
- Throwaway prototypes (must be deleted, not committed)
- Auto-generated code (scaffolding, code-gen output)
- Configuration files with no executable logic

Thinking "skip TDD just this once"? Stop. That is rationalization.

## The Iron Law

> **NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST. If code was written before the test, delete it entirely and start over.**

No exceptions:
- Do not keep it as "reference"
- Do not "adapt" it while writing tests
- Do not look at it while writing tests
- Delete means delete

Implement fresh from tests.

## RED Phase

Write one failing test that describes the next required behavior.

**Requirements:**
- One behavior per test
- Clear name: \\\`'does X when Y'\\\`
- Tests real code usage — minimal mocking

**Good:**
\\\`\\\`\\\`typescript
test('retries failed operations 3 times', async () => {
  let attempts = 0;
  const operation = () => {
    attempts++;
    if (attempts < 3) throw new Error('fail');
    return 'success';
  };

  const result = await retryOperation(operation);

  expect(result).toBe('success');
  expect(attempts).toBe(3);
});
\\\`\\\`\\\`
Clear name. Tests real behavior. One thing.

**Bad:**
\\\`\\\`\\\`typescript
test('retry works', async () => {
  const mock = jest.fn()
    .mockRejectedValueOnce(new Error())
    .mockRejectedValueOnce(new Error())
    .mockResolvedValueOnce('success');
  await retryOperation(mock);
  expect(mock).toHaveBeenCalledTimes(3);
});
\\\`\\\`\\\`
Vague name. Tests mock call count, not actual retry logic. If \\\`retryOperation\\\` calls the mock differently, this test breaks without proving the behavior is correct.

## Verify RED

**This step is MANDATORY and cannot be skipped.**

Run the test and confirm all four conditions:
1. Test fails (does not error out)
2. Failure message matches the expected assertion
3. Failure is caused by the missing feature, not a typo or import error
4. No other tests were broken

\\\`\\\`\\\`bash
npm test path/to/test.test.ts
\\\`\\\`\\\`

**If the test passes immediately:** it tests existing behavior or is written wrong — fix the test before continuing.

**If the test errors out:** resolve the error (import, syntax, type) and rerun until it fails correctly.

## GREEN Phase

Write the minimal code to make the failing test pass.

**Good:**
\\\`\\\`\\\`typescript
async function retryOperation<T>(fn: () => T | Promise<T>): Promise<T> {
  for (let i = 0; i < 3; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === 2) throw e;
    }
  }
  throw new Error('unreachable');
}
\\\`\\\`\\\`
Just enough to pass the test.

**Bad:**
\\\`\\\`\\\`typescript
async function retryOperation<T>(
  fn: () => Promise<T>,
  options?: {
    maxRetries?: number;
    backoff?: 'linear' | 'exponential';
    onRetry?: (attempt: number, error: unknown) => void;
    timeout?: number;
  }
): Promise<T> {
  // ... full implementation with all options
}
\\\`\\\`\\\`
Over-engineered. The test requires three retries — nothing more.

Do not add features, refactor other code, or "improve" beyond what the test requires.

## Verify GREEN

**This step is MANDATORY and cannot be skipped.**

Run the full test suite and confirm:
- The target test passes
- All other tests still pass
- Output is clean — no errors, no warnings

\\\`\\\`\\\`bash
npm test
\\\`\\\`\\\`

**If the target test fails:** fix the implementation, not the test.

**If other tests fail:** fix the regression before continuing.

## REFACTOR Phase

Only after the test suite is fully green:
- Remove duplication
- Improve naming
- Extract helper functions

**Keep tests green. Do not add behavior.**

## Good Tests

| Quality | Good | Bad |
|---------|------|-----|
| **Minimal** | One thing. "and" in name? Split it. | \\\`test('validates email and domain and whitespace')\\\` |
| **Clear** | Name describes behavior | \\\`test('test1')\\\` or \\\`test('test works')\\\` |
| **Shows intent** | Demonstrates desired API usage | Tests implementation details |

## Example: Bug Fix

**Bug:** Empty email accepted

**RED**
\\\`\\\`\\\`typescript
test('rejects empty email', async () => {
  const result = await submitForm({ email: '' });
  expect(result.error).toBe('Email required');
});
\\\`\\\`\\\`

**Verify RED**
\\\`\\\`\\\`bash
$ npm test
FAIL: expected 'Email required', got undefined
\\\`\\\`\\\`

**GREEN**
\\\`\\\`\\\`typescript
function submitForm(data: FormData) {
  if (!data.email?.trim()) {
    return { error: 'Email required' };
  }
  // ...
}
\\\`\\\`\\\`

**Verify GREEN**
\\\`\\\`\\\`bash
$ npm test
PASS
\\\`\\\`\\\`

**REFACTOR**
Extract validation for multiple fields if needed. Keep tests green.

## Rationalization Table

| Rationalization | Reality |
|-----------------|---------|
| "Too simple to test" | Simple code breaks. Writing the test takes 30 seconds. |
| "I'll test after" | Tests written after passing code pass immediately and prove nothing. |
| "Tests after achieve the same goals" | Tests-after answer "What does this do?" Tests-first answer "What should this do?" |
| "Already manually tested all the edge cases" | Manual testing is ad-hoc. No record, cannot re-run, easy to miss cases under pressure. |
| "Deleting X hours of work is wasteful" | Sunk cost fallacy. Keeping unverifiable code is the waste. |
| "I'll keep it as reference and write tests first" | You will adapt it. That is testing after. Delete means delete. |
| "I need to explore the design first" | Fine — explore in a throwaway branch. Then delete it and start with TDD. |
| "The test is hard to write" | Listen to that signal. Hard to test means hard to use. Simplify the design. |
| "TDD will slow me down" | TDD is faster than debugging production. The slowdown is an illusion. |
| "Manual testing is faster" | Manual does not prove edge cases. You will re-test every change manually forever. |
| "The existing codebase has no tests" | You are improving it. Add a test for the behavior you are changing. |

## Red Flags — Stop and Restart

Any of these thoughts or situations require deleting the code and restarting from a failing test:

- Code was written before the test
- Test was created after the implementation
- Test passes immediately on first run
- Cannot explain why the test failed
- Plan to "add tests later"
- Thinking "just this once"
- "I already manually tested it"
- "Tests after achieve the same purpose"
- "It is about the spirit, not the ritual"
- "Keep as reference" or "adapt existing code"
- "Already spent X hours — deleting is wasteful"
- "TDD is dogmatic; I am being pragmatic"
- "This case is different because..."

All of these mean: delete the code and start over with a failing test.

## Verification Checklist

Before marking any task complete:

- [ ] Every new function has a test
- [ ] Watched each test fail before implementing
- [ ] Each test failed for the expected reason (missing feature, not a typo)
- [ ] Wrote minimal code to make each test pass
- [ ] All tests pass
- [ ] Test output is clean — no errors, no warnings
- [ ] Tests use real code (mocks only when unavoidable)
- [ ] Edge cases and error paths are covered

Cannot check all boxes? TDD was skipped. Start over.

## When Stuck

| Problem | Solution |
|---------|---------|
| Uncertain how to test the behavior | Write the desired API call first — start from the assertion, work backwards |
| Test is too complicated to write | The design is too complex — simplify the interface before continuing |
| Everything requires mocking | Code is too coupled — apply dependency injection to break the coupling |
| Test setup is enormous (arrange phase > 20 lines) | Extract setup helpers; if still complex, simplify the design |

When adding mocks or test utilities, read \\\`@testing-anti-patterns.md\\\` to avoid common pitfalls such as testing mock behavior instead of real behavior, adding test-only methods to production classes, and mocking without understanding dependencies.

## Integration

Use **${PROJECT_NAME}-debugging** when bugs surface during TDD — write a failing test reproducing the bug first, then follow the TDD cycle. The test proves the fix and prevents regression.

Use **${PROJECT_NAME}-verification** before claiming any task complete — the verification checklist above must pass in full.
`;
