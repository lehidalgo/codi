/**
 * Minimal logger contract (CORE-003).
 *
 * `utils/` and `adapters/` import only this interface — never the concrete
 * `Logger` class from `core/output/logger.ts`. The class implements this
 * interface; passing one across a boundary is type-checked but creates no
 * runtime dependency between layers.
 *
 * Use `NULL_LOGGER` as the default in pure modules (and in tests) when the
 * caller hasn't injected a real logger. The composition root (CLI entry,
 * generator, preset applier) is the only place that calls
 * `Logger.getInstance()` and threads the result via DI.
 */
export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  fatal(message: string, ...args: unknown[]): void;
}

/**
 * No-op logger used as the default when a caller doesn't inject one.
 * Discards every call. Useful for tests and for pure modules invoked
 * outside the CLI composition root.
 */
export const NULL_LOGGER: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {},
};
