/**
 * Shared test scaffolding for the per-workflow adaptive-intake suites.
 * Each suite imports `useTmpBrain()` to scope a clean brain.db + cwd
 * around its `describe` block.
 */

import { afterEach, beforeEach } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { BrainEventLog } from "#src/runtime/brain-event-log.js";
import type { Author } from "#src/runtime/types.js";

export const human: Author = { type: "human", id: "tester" };

export interface TmpBrainHandle {
  readonly tmpDir: () => string;
}

/**
 * Wires up `beforeEach` / `afterEach` hooks that allocate a fresh brain.db
 * and a temp project root with a stub `docs/CONTEXT.md`. Returns a getter
 * for the active tmpDir; tests pass it to runWorkflow as `cwd`.
 */
export function useTmpBrain(): TmpBrainHandle {
  let dir = "";
  let prevBrainDb: string | undefined;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "codi-wf-test-"));
    mkdirSync(join(dir, "docs"), { recursive: true });
    writeFileSync(join(dir, "docs", "CONTEXT.md"), "# Project Context\n", "utf-8");
    prevBrainDb = process.env["CODI_BRAIN_DB"];
    process.env["CODI_BRAIN_DB"] = join(dir, "brain.db");
  });

  afterEach(() => {
    if (prevBrainDb === undefined) delete process.env["CODI_BRAIN_DB"];
    else process.env["CODI_BRAIN_DB"] = prevBrainDb;
    rmSync(dir, { recursive: true, force: true });
  });

  return { tmpDir: () => dir };
}

export function withBrain<T>(dir: string, cb: (log: BrainEventLog) => T): T {
  const log = BrainEventLog.open({ dbPath: join(dir, "brain.db") });
  try {
    return cb(log);
  } finally {
    log.dispose();
  }
}
