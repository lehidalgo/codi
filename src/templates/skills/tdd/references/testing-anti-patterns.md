# Testing Anti-Patterns

Common patterns that reduce test value or introduce false confidence.

## Iron Laws (read before writing any test)

- **NEVER test mock behavior** — verify the real outcome, not that a spy was called
- **NEVER add test-only methods to production classes** — the public API is the contract; if it cannot express the assertion, the design is wrong
- **NEVER mock without understanding the dependency** — if you cannot explain its side effects, you will mock the wrong thing
- **Mock the COMPLETE data structure as it exists in reality, not just the fields your immediate test uses** — partial mocks lie about the shape of the world
- **Integration tests are not optional follow-up** — they are part of the implementation, not a phase to defer

---

## 1. Testing mock behavior instead of real behavior

The test verifies that a mock was called, not that the real code works.

**Bad:**
```typescript
test('sends welcome email on registration', async () => {
  const sendEmail = jest.fn();
  await registerUser({ email: 'a@b.com' }, { sendEmail });
  expect(sendEmail).toHaveBeenCalledTimes(1);
});
```

**Good:**
```typescript
test('sends welcome email on registration', async () => {
  const sent: string[] = [];
  const sendEmail = (to: string) => { sent.push(to); };
  await registerUser({ email: 'a@b.com' }, { sendEmail });
  expect(sent).toEqual(['a@b.com']);
});
```

The good example uses a real stub that records calls. It tests what was sent, not how many times a spy was invoked.

---

## 2. Testing implementation details instead of behavior

The test breaks when the implementation changes, even if behavior is unchanged.

**Bad:**
```typescript
test('calls _buildQuery before executing', () => {
  const spy = jest.spyOn(repo, '_buildQuery');
  repo.findByEmail('a@b.com');
  expect(spy).toHaveBeenCalled();
});
```

**Good:**
```typescript
test('returns user matching the given email', async () => {
  await db.insert({ email: 'a@b.com', name: 'Alice' });
  const user = await repo.findByEmail('a@b.com');
  expect(user?.name).toBe('Alice');
});
```

Test the output, not internal method calls.

---

## 3. Adding test-only methods to production classes

Public methods exist solely for test inspection and expose internals.

**Bad:**
```typescript
class Cart {
  private items: Item[] = [];

  // Added only for tests
  getInternalItems() { return this.items; }
}
```

**Good:**
```typescript
class Cart {
  private items: Item[] = [];

  total(): number {
    return this.items.reduce((sum, i) => sum + i.price, 0);
  }
}

test('total reflects added items', () => {
  const cart = new Cart();
  cart.add({ price: 10 });
  expect(cart.total()).toBe(10);
});
```

Test through the public API. If the public API cannot express the assertion, the design needs work.

---

## 4. Sharing mutable state between tests

Tests pass in isolation but fail when run together due to shared side effects.

**Bad:**
```typescript
const store = new InMemoryStore();

test('adds item', () => {
  store.set('x', 1);
  expect(store.get('x')).toBe(1);
});

test('returns undefined for missing key', () => {
  // Fails if run after the previous test
  expect(store.get('x')).toBeUndefined();
});
```

**Good:**
```typescript
function makeStore() { return new InMemoryStore(); }

test('adds item', () => {
  const store = makeStore();
  store.set('x', 1);
  expect(store.get('x')).toBe(1);
});

test('returns undefined for missing key', () => {
  const store = makeStore();
  expect(store.get('x')).toBeUndefined();
});
```

Each test creates its own instance. Tests are independent and order-safe.

---

## 5. Test names that describe implementation instead of behavior

The name describes how the code works, not what it does for the user.

**Bad:**
```
'calls validateEmail helper'
'sets isValid flag to false'
'iterates over items array'
```

**Good:**
```
'rejects email addresses without an @ symbol'
'marks form as invalid when required fields are empty'
'applies discount to every item in the cart'
```

A test name should read as a requirement. If the implementation changes, the name should still be accurate.

---

## 6. Overly large test setup (arrange phase over 20 lines)

Long setup obscures what the test is actually verifying.

**Bad:**
```typescript
test('checkout calculates correct total', async () => {
  const db = await createTestDb();
  const user = await db.users.create({ name: 'Alice', email: 'a@b.com' });
  const product1 = await db.products.create({ name: 'Widget', price: 10 });
  const product2 = await db.products.create({ name: 'Gadget', price: 20 });
  const cart = await db.carts.create({ userId: user.id });
  await db.cartItems.create({ cartId: cart.id, productId: product1.id, qty: 2 });
  await db.cartItems.create({ cartId: cart.id, productId: product2.id, qty: 1 });
  const session = await db.sessions.create({ userId: user.id });
  // ... more setup ...
  const result = await checkout(cart.id, session.token);
  expect(result.total).toBe(40);
});
```

**Good:**
```typescript
async function makeCartWithItems(items: Array<{ price: number; qty: number }>) {
  // setup extracted to a helper
}

test('checkout total equals sum of item prices times quantities', async () => {
  const cart = await makeCartWithItems([{ price: 10, qty: 2 }, { price: 20, qty: 1 }]);
  const result = await checkout(cart.id);
  expect(result.total).toBe(40);
});
```

Extract setup into named helpers. The test body should show intent, not mechanics.

---

## 7. Multiple behaviors per test

A single test verifies multiple behaviors. When it fails, the failure message does not say which behavior broke.

**Bad:**
```typescript
test('validates user input', () => {
  expect(validate({ email: '' })).toEqual({ email: 'required' });
  expect(validate({ email: 'bad' })).toEqual({ email: 'invalid format' });
  expect(validate({ email: 'a@b.com' })).toEqual({});
  expect(validate({ email: 'a@b.com', name: '' })).toEqual({ name: 'required' });
});
```

**Good:**
```typescript
test('rejects empty email with required message', () => {
  expect(validate({ email: '' })).toEqual({ email: 'required' });
});

test('rejects malformed email with format message', () => {
  expect(validate({ email: 'bad' })).toEqual({ email: 'invalid format' });
});

test('accepts valid email with no errors', () => {
  expect(validate({ email: 'a@b.com' })).toEqual({});
});
```

One behavior per test. Failures are specific and actionable.

---

## 8. Mocking without understanding the dependency

The mock is shaped by guesswork, not by reading the real dependency's contract. The test passes because the mock matches itself, not because the production code matches the real dependency.

**Bad:**
```typescript
// Mocked the http client without checking what fields the response actually has
test('parses user from API', async () => {
  const httpClient = { get: async () => ({ data: { name: 'Alice' } }) };
  const user = await fetchUser('id-1', httpClient);
  expect(user.name).toBe('Alice');
});
// In production the real API returns { user: { name, email, profile: {...} } }
// The test passes; production crashes because user.name is undefined.
```

**Good:**
```typescript
// Mock matches the documented contract; if the contract is wrong, the mock fails the same way production would
test('parses user from API', async () => {
  const httpClient = {
    get: async () => ({
      data: { user: { name: 'Alice', email: 'a@b.com', profile: { bio: '' } } },
    }),
  };
  const user = await fetchUser('id-1', httpClient);
  expect(user.name).toBe('Alice');
});
```

If you cannot articulate what the real dependency returns, do not mock it. Read the contract first (OpenAPI spec, library docs, or run the dependency once and capture its real response).

---

## 9. Incomplete mocks

The mock returns only the fields the test happens to read. The production code reads other fields and silently breaks when those fields are missing.

**Bad:**
```typescript
// Mock omits createdAt, status, role — fields the production code reads
const fakeUser = { id: 'u1', name: 'Alice' };
const session = createSession(fakeUser);
expect(session.userId).toBe('u1');
// Production: createSession reads user.role and user.status; both are undefined.
// Bug ships because the mock never exercised those code paths.
```

**Good:**
```typescript
// Mock the complete shape — every field the production type defines
const fakeUser: User = {
  id: 'u1',
  name: 'Alice',
  email: 'a@b.com',
  role: 'member',
  status: 'active',
  createdAt: new Date('2026-01-01'),
};
const session = createSession(fakeUser);
expect(session.userId).toBe('u1');
```

Use the production type to construct mocks. If the type evolves, the mock fails to compile and you fix it. If the mock is loose (\`as any\`, partial-of-T), production drift is invisible.

---

## 10. Integration tests as afterthought

Unit tests pass; the system breaks at integration time. The team ships unit-tested code with no integration coverage and treats integration testing as a separate phase to do "later".

**Bad:**
```
- All unit tests pass (mocked dependencies)
- No tests exercise the real database, real HTTP layer, or real message broker
- Integration bugs surface in staging or production
- Team labels integration testing "Phase 2" of the project
```

**Good:**
```
- Unit tests cover branching logic with fakes/stubs
- Integration tests use Testcontainers (real Postgres, real Redis, real Kafka)
- Both run in the same CI pipeline; integration runs gate the merge
- Adding a new integration touches BOTH test suites in the same PR
```

Integration tests are not a deferred phase. They prove the assumptions your unit tests' mocks made are correct. Without them, the unit suite is a fiction with high coverage numbers.

## Red Flags (your tests are smelling)

If you catch yourself doing or seeing any of these, stop and revisit the iron laws:

- Assertions checking for \`*-mock\` test IDs in production code
- Methods that appear ONLY in test files (test-only escape hatches in production classes)
- Mock setup exceeding 50% of the test body
- Tests that fail the moment any mock is removed (the test is testing the mock, not the code)
- Cannot explain in one sentence why a particular dependency is mocked
- Mocking "just to be safe" without a specific isolation reason
- Loose-typed mocks (\`as any\`, \`as unknown as T\`) that bypass the production type
- A new test file appearing alongside production code that has no integration test counterpart
- Coverage report shows 95% but the team still ships integration bugs every release
