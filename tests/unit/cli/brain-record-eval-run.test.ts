/**
 * ISSUE-050 — `codi brain record-eval-run` CLI handler.
 *
 * Drives the handler with both happy-path JSON and the failure modes
 * (missing input, malformed JSON, missing required fields). The handler
 * opens a real tmp brain.db so the writer is fully exercised.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { recordEvalRunHandler } from "#src/cli/brain.js";
import { EXIT_CODES } from "#src/core/output/exit-codes.js";

describe("recordEvalRunHandler", () => {
  let tmpDir: string;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "codi-rer-"));
    dbPath = join(tmpDir, "brain.db");
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("inserts a row and returns the new run_id", async () => {
    const result = await recordEvalRunHandler({
      brainPath: dbPath,
      json: JSON.stringify({
        ts: 1_700_000_000_000,
        projectId: "proj-a",
        skillName: "codi-commit",
        caseId: "case-1",
        passed: true,
        triggerSource: "run-eval",
      }),
    });
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(result.data.runId).toBeGreaterThan(0);
    expect(result.data.skillName).toBe("codi-commit");
    expect(result.data.caseId).toBe("case-1");
  });

  it("rejects when neither --json nor --stdin is provided", async () => {
    const result = await recordEvalRunHandler({ brainPath: dbPath });
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(EXIT_CODES.GENERAL_ERROR);
    expect(result.errors[0]!.code).toBe("E_INPUT_REQUIRED");
  });

  it("rejects malformed JSON with E_JSON_INVALID", async () => {
    const result = await recordEvalRunHandler({
      brainPath: dbPath,
      json: "this is not json",
    });
    expect(result.success).toBe(false);
    expect(result.errors[0]!.code).toBe("E_JSON_INVALID");
  });

  it("rejects payloads missing required fields", async () => {
    const result = await recordEvalRunHandler({
      brainPath: dbPath,
      json: JSON.stringify({ ts: 1, projectId: "p", skillName: "s" }),
    });
    expect(result.success).toBe(false);
    expect(result.errors[0]!.code).toBe("E_INPUT_REQUIRED");
    expect(result.errors[0]!.context).toHaveProperty("field");
  });
});
