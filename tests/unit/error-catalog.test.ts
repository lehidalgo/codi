import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { ERROR_CATALOG } from '../../src/core/output/error-catalog.js';
import { createError, zodToCodiErrors } from '../../src/core/output/errors.js';
import { EXIT_CODES } from '../../src/core/output/exit-codes.js';

describe('ERROR_CATALOG', () => {
  it('has unique error codes', () => {
    const codes = Object.keys(ERROR_CATALOG);
    const unique = new Set(codes);
    expect(unique.size).toBe(codes.length);
  });

  it('has 25 entries', () => {
    expect(Object.keys(ERROR_CATALOG)).toHaveLength(25);
  });

  it('all entries have required fields', () => {
    for (const [_code, entry] of Object.entries(ERROR_CATALOG)) {
      expect(entry).toHaveProperty('exitCode');
      expect(entry).toHaveProperty('severity');
      expect(entry).toHaveProperty('hintTemplate');
      expect(typeof entry.exitCode).toBe('number');
      expect(['warn', 'error', 'fatal']).toContain(entry.severity);
    }
  });

  it('all exit codes reference valid EXIT_CODES', () => {
    const validCodes = new Set(Object.values(EXIT_CODES));
    for (const entry of Object.values(ERROR_CATALOG)) {
      expect(validCodes.has(entry.exitCode as typeof EXIT_CODES[keyof typeof EXIT_CODES])).toBe(true);
    }
  });
});

describe('createError', () => {
  it('creates error with interpolated hint', () => {
    const error = createError('E_CONFIG_NOT_FOUND', { path: '/foo/bar' });
    expect(error.code).toBe('E_CONFIG_NOT_FOUND');
    expect(error.hint).toContain('/foo/bar');
    expect(error.severity).toBe('error');
  });

  it('preserves context', () => {
    const ctx = { file: 'codi.yml', extra: 42 };
    const error = createError('E_CONFIG_PARSE_FAILED', ctx);
    expect(error.context).toEqual(ctx);
  });

  it('includes cause when provided', () => {
    const cause = new Error('original');
    const error = createError('E_GENERATION_FAILED', { agent: 'claude', reason: 'timeout' }, cause);
    expect(error.cause).toBe(cause);
  });

  it('leaves unmatched placeholders as-is', () => {
    const error = createError('E_CONFIG_NOT_FOUND', {});
    expect(error.hint).toContain('{path}');
  });
});

describe('zodToCodiErrors', () => {
  it('converts Zod errors to CodiError array', () => {
    const schema = z.object({ name: z.string(), age: z.number() });
    const result = schema.safeParse({ name: 123, age: 'old' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = zodToCodiErrors(result.error, 'test.yml');
      expect(errors.length).toBeGreaterThan(0);
      for (const err of errors) {
        expect(err.code).toBe('E_SCHEMA_VALIDATION');
        expect(err.context).toHaveProperty('file', 'test.yml');
      }
    }
  });
});
