import type { ProjectError } from "../core/output/types.js";

/**
 * A discriminated union representing either a successful value (`ok: true`) or a
 * list of errors (`ok: false`).
 *
 * Use `ok()` and `err()` to construct results. Use `isOk()` and `isErr()` as
 * type guards to narrow the union safely.
 *
 * @example
 * ```ts
 * import { ok, err, isOk } from 'codi-cli';
 *
 * const result: Result<string> = someOperation();
 * if (isOk(result)) {
 *   console.log(result.data); // typed as string
 * } else {
 *   result.errors.forEach(e => console.error(e.message));
 * }
 * ```
 */
export type Result<T, E = ProjectError[]> = { ok: true; data: T } | { ok: false; errors: E };

/**
 * Wraps a value in a successful `Result`.
 *
 * @param data - The success value to wrap
 * @returns A `Result` with `ok: true` and the given data
 *
 * @example
 * ```ts
 * return ok({ name: 'my-rule', content: '...' });
 * ```
 */
export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

/**
 * Wraps one or more errors in a failed `Result`.
 *
 * @param errors - The error payload to wrap
 * @returns A `Result` with `ok: false` and the given errors
 *
 * @example
 * ```ts
 * return err([createError('E_CONFIG_NOT_FOUND', { path })]);
 * ```
 */
export function err<E = ProjectError[]>(errors: E): Result<never, E> {
  return { ok: false, errors };
}

/**
 * Type guard that narrows a `Result` to its success variant.
 *
 * @param result - The result to check
 * @returns `true` if the result is successful; narrows type to `{ ok: true; data: T }`
 */
export function isOk<T, E>(result: Result<T, E>): result is { ok: true; data: T } {
  return result.ok === true;
}

/**
 * Type guard that narrows a `Result` to its failure variant.
 *
 * @param result - The result to check
 * @returns `true` if the result failed; narrows type to `{ ok: false; errors: E }`
 */
export function isErr<T, E>(result: Result<T, E>): result is { ok: false; errors: E } {
  return result.ok === false;
}
