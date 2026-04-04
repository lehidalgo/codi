# Condition-Based Waiting — Replace Arbitrary Timeouts

## Overview

Flaky tests often guess at timing with arbitrary delays. This creates race conditions where tests pass on fast machines but fail under load or in CI.

**Core principle:** Wait for the actual condition you care about, not a guess about how long it takes.

## The Problem With Arbitrary Timeouts

```typescript
// Bad: guessing at timing
await new Promise(r => setTimeout(r, 5000));
const result = getResult();
expect(result).toBeDefined();
```

This is either too slow (wastes 5 seconds on a fast machine) or too fast (race condition on a slow machine or under CI load). Adding more sleep time when tests are flaky does not fix the problem - it hides it temporarily.

## The Solution: Poll Until Condition Is True

```typescript
// Good: wait for the actual condition
await waitFor(() => getResult() !== undefined, 'result to be defined');
const result = getResult();
expect(result).toBeDefined();
```

## Implementation

Generic polling function with timeout:

```typescript
async function waitFor<T>(
  condition: () => T | undefined | null | false,
  description: string,
  timeoutMs = 5000
): Promise<T> {
  const startTime = Date.now();

  while (true) {
    const result = condition();
    if (result) return result;

    if (Date.now() - startTime > timeoutMs) {
      throw new Error(
        `Timeout waiting for ${description} after ${timeoutMs}ms`
      );
    }

    await new Promise(r => setTimeout(r, 100)); // Poll every 100ms
  }
}
```

## Common Use Cases

| Scenario | Pattern |
|----------|---------|
| Wait for async event | `waitFor(() => events.find(e => e.type === 'DONE'), 'DONE event')` |
| Wait for state change | `waitFor(() => machine.state === 'ready', 'machine ready')` |
| Wait for items to accumulate | `waitFor(() => items.length >= 5 && items, '5 items')` |
| Wait for file to appear | `waitFor(() => fs.existsSync(path) && path, 'file to exist')` |
| Wait for service ready | `waitFor(() => service.isReady(), 'service ready')` |
| Complex condition | `waitFor(() => obj.ready && obj.value > 10 && obj, 'object ready')` |

## When to Use

Use when:
- Tests have arbitrary delays (`setTimeout`, `sleep`, `time.sleep()`)
- Tests are flaky (pass sometimes, fail under load)
- Tests time out when run in parallel
- Waiting for async operations, services, or files to be ready

Do not use when:
- Testing actual timing behavior (debounce intervals, throttle delays)
- The test specifically verifies that something takes a certain amount of time

## When an Arbitrary Timeout IS Correct

Sometimes a timed wait is correct - for example, when verifying behavior that depends on a real timer:

```typescript
// Tool ticks every 100ms - need 2 ticks to verify partial output
await waitFor(
  () => manager.hasStarted(),
  'tool started'
); // First: wait for condition
await new Promise(r => setTimeout(r, 200)); // Then: wait for known interval
// 200ms = 2 ticks at 100ms - documented and justified
```

Requirements for a justified arbitrary timeout:
1. First wait for the triggering condition
2. Base the duration on a known timing (not a guess)
3. Add a comment explaining why the specific duration is needed

## Common Mistakes

**Polling too fast:** `setTimeout(check, 1)` wastes CPU.
Fix: poll every 10-100ms.

**No timeout:** the loop runs forever if the condition is never met.
Fix: always include a timeout with a clear error message.

**Stale data:** caching state before the loop misses updates.
Fix: call the getter inside the loop to get fresh data on every check.

**Anti-pattern:** adding more sleep time when a test is flaky.
The test is flaky because the condition check is wrong, not because it needs more time.
