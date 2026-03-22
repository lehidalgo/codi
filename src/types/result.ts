import type { CodiError } from '../core/output/types.js';

export type Result<T, E = CodiError[]> =
  | { ok: true; data: T }
  | { ok: false; errors: E };

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function err<E = CodiError[]>(errors: E): Result<never, E> {
  return { ok: false, errors };
}

export function isOk<T, E>(result: Result<T, E>): result is { ok: true; data: T } {
  return result.ok === true;
}

export function isErr<T, E>(result: Result<T, E>): result is { ok: false; errors: E } {
  return result.ok === false;
}
