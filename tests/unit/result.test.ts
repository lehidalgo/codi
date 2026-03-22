import { describe, it, expect } from 'vitest';
import { ok, err, isOk, isErr } from '../../src/types/result.js';

describe('Result helpers', () => {
  it('ok() creates a success result', () => {
    const result = ok(42);
    expect(result).toEqual({ ok: true, data: 42 });
  });

  it('err() creates a failure result', () => {
    const errors = [{ code: 'E_TEST', message: 'fail' }];
    const result = err(errors);
    expect(result).toEqual({ ok: false, errors });
  });

  it('isOk() returns true for success', () => {
    expect(isOk(ok('hello'))).toBe(true);
  });

  it('isOk() returns false for failure', () => {
    expect(isOk(err([]))).toBe(false);
  });

  it('isErr() returns true for failure', () => {
    expect(isErr(err([]))).toBe(true);
  });

  it('isErr() returns false for success', () => {
    expect(isErr(ok(null))).toBe(false);
  });

  it('ok() preserves complex data', () => {
    const data = { items: [1, 2, 3], nested: { a: true } };
    const result = ok(data);
    if (isOk(result)) {
      expect(result.data).toEqual(data);
    }
  });
});
