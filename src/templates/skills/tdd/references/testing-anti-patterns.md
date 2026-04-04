# Testing Anti-Patterns

Common patterns that reduce test value or introduce false confidence.

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
