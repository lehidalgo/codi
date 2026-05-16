/**
 * Shared brain-isolation helper for runtime tests.
 *
 * The cli-handlers + hook-logic + reducer all open `BrainEventLog` against
 * `~/.codi/brain.db` by default. Tests need an isolated DB per scenario or
 * they would pollute each other. This module exposes a small `IsolatedBrain`
 * lifecycle that:
 *
 *   1. mkdtemp's a fresh tmp dir
 *   2. bootstraps `docs/CONTEXT.md` (required by runWorkflow)
 *   3. points `CODI_BRAIN_DB` at `<tmp>/brain.db`
 *
 * Cleanup restores the previous env var and rm-rfs the tmp dir.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Result } from "#src/types/result.js";
import type { ProjectError } from "#src/core/output/types.js";

export interface IsolatedBrain {
  readonly dir: string;
  readonly dbPath: string;
  dispose(): void;
}

/**
 * Unwrap a runtime-handler `Result` for happy-path tests. CORE-017 migrated
 * runtime CLI handlers to return `Result<T, ProjectError[]>`; tests that
 * only care about the success branch use this helper to keep the diff
 * small. Failure tests should NOT use this — assert on `result.ok` instead.
 */
export function unwrap<T>(r: Result<T, ProjectError[]>): T {
  if (!r.ok) {
    const codes = r.errors.map((e) => e.code).join(", ");
    const messages = r.errors.map((e) => e.message).join(" | ");
    throw new Error(`unexpected Result.err [${codes}]: ${messages}`);
  }
  return r.data;
}

/**
 * Create an isolated brain scope. Each call:
 *   - mkdtempSyncs a fresh dir under `tmpdir()` with the given prefix
 *   - writes a stub `docs/CONTEXT.md` so runWorkflow does not throw KB-missing
 *   - sets `CODI_BRAIN_DB` to `<dir>/brain.db`
 *
 * The returned `dispose()` MUST be called in afterEach (or finally) to
 * restore the env var and remove the tmp dir.
 */
export function createIsolatedBrain(prefix: string = "codi-test-"): IsolatedBrain {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  mkdirSync(join(dir, "docs"), { recursive: true });
  writeFileSync(join(dir, "docs", "CONTEXT.md"), "# Context\n", "utf-8");
  const dbPath = join(dir, "brain.db");
  const previous = process.env["CODI_BRAIN_DB"];
  process.env["CODI_BRAIN_DB"] = dbPath;

  return {
    dir,
    dbPath,
    dispose(): void {
      if (previous === undefined) delete process.env["CODI_BRAIN_DB"];
      else process.env["CODI_BRAIN_DB"] = previous;
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
