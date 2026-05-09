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

export interface IsolatedBrain {
  readonly dir: string;
  readonly dbPath: string;
  dispose(): void;
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
