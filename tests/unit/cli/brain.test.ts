/**
 * ISSUE-047 — unit coverage for the brain CLI handlers.
 *
 * `codi brain` is the most-used dev surface in the daily workflow but
 * had 0 direct unit tests in `tests/unit/cli/`. ISSUE-041 (exit-code
 * propagation in handleOutput) shipped without targeted coverage on the
 * handler results — these tests close that loop.
 *
 * `brainUiHandler` is omitted because it spawns a child process (the UI
 * server) which would race with the test runner.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { brainExportHandler, brainIngestMemoryHandler } from "#src/cli/brain.js";
import { EXIT_CODES } from "#src/core/output/exit-codes.js";

describe("brainExportHandler", () => {
  it("returns a deprecation success result (export pipeline retired)", async () => {
    const result = await brainExportHandler({});
    // `codi brain export` is intentionally a no-op deprecation stub —
    // exits 0 with empty payload so older shell scripts don't break.
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(result.data.proposalsExported).toBe(0);
    expect(result.data.path).toBe("");
  });
});

describe("brainIngestMemoryHandler", () => {
  let tmpBrain: string;

  beforeEach(() => {
    tmpBrain = mkdtempSync(path.join(tmpdir(), "codi-brain-ingest-"));
  });

  afterEach(() => {
    rmSync(tmpBrain, { recursive: true, force: true });
  });

  it("rejects an unsupported --agent value with GENERAL_ERROR", async () => {
    const result = await brainIngestMemoryHandler({
      agent: "nonexistent-agent",
      brainPath: path.join(tmpBrain, "brain.db"),
      dryRun: true,
    });
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(EXIT_CODES.GENERAL_ERROR);
    expect(result.data.scanned).toBe(0);
  });

  it("runs in dry-run mode without writing to the brain", async () => {
    const result = await brainIngestMemoryHandler({
      brainPath: path.join(tmpBrain, "brain.db"),
      dryRun: true,
    });
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(result.data.dryRun).toBe(true);
    expect(typeof result.data.scanned).toBe("number");
    expect(typeof result.data.inserted).toBe("number");
    expect(typeof result.data.duplicates).toBe("number");
  });
});
