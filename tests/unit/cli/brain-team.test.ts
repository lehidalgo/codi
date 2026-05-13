/**
 * ISSUE-055 — `codi brain export-for-team` + `codi brain team-check`.
 *
 * Drive both handlers against tmp brain.db files. Covers happy-path,
 * missing input, missing source, multiple devs with mixed valid/invalid.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  brainExportForTeamHandler,
  brainTeamCheckHandler,
  _internals,
} from "#src/cli/brain-team.js";
import { openBrain } from "#src/runtime/brain/db.js";
import { applyMigrations } from "#src/runtime/brain/migrate.js";
import { EXIT_CODES } from "#src/core/output/exit-codes.js";

function seedBrain(path: string): void {
  mkdirSync(path.replace(/\/[^/]+$/, ""), { recursive: true });
  const handle = openBrain({ dbPath: path });
  try {
    applyMigrations(handle.raw);
  } finally {
    handle.close();
  }
}

describe("brainExportForTeamHandler", () => {
  let tmpDir: string;
  let src: string;
  let outDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "codi-bet-"));
    src = join(tmpDir, "src.db");
    outDir = join(tmpDir, "team");
    seedBrain(src);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    delete process.env["CODI_ACTOR_ID"];
  });

  it("copies the brain into <to>/<actor_slug>/brain.db", async () => {
    process.env["CODI_ACTOR_ID"] = "human:alice@example.com";
    const result = await brainExportForTeamHandler({ to: outDir, brainPath: src });
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(result.data.actorId).toBe("human:alice@example.com");
    expect(result.data.destination).toMatch(/alice_example\.com\/brain\.db$/);
    expect(existsSync(result.data.destination)).toBe(true);
    expect(result.data.sizeBytes).toBeGreaterThan(0);
  });

  it("rejects when --to is missing", async () => {
    const result = await brainExportForTeamHandler({ to: "", brainPath: src });
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(EXIT_CODES.FLAG_CONFLICT);
    expect(result.errors[0]!.code).toBe("E_BRAIN_EXPORT_MISSING_TO");
  });

  it("rejects when the source brain does not exist", async () => {
    const result = await brainExportForTeamHandler({
      to: outDir,
      brainPath: join(tmpDir, "missing.db"),
    });
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(EXIT_CODES.CONFIG_NOT_FOUND);
    expect(result.errors[0]!.code).toBe("E_BRAIN_EXPORT_SOURCE_NOT_FOUND");
  });

  it("slugifies unsafe characters in the actor id", () => {
    expect(_internals.actorIdToSlug("human:alice/bob")).toBe("alice_bob");
    expect(_internals.actorIdToSlug("agent:claude code")).toBe("claude_code");
    expect(_internals.actorIdToSlug("unknown:legacy")).toBe("legacy");
    expect(_internals.actorIdToSlug(":")).toBe("unknown");
  });
});

describe("brainTeamCheckHandler", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "codi-btc-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("counts valid and invalid candidates", async () => {
    seedBrain(join(tmpDir, "alice", "brain.db"));
    seedBrain(join(tmpDir, "bob", "brain.db"));
    // Drop a non-SQLite file that has the .db extension.
    mkdirSync(join(tmpDir, "carol"), { recursive: true });
    writeFileSync(join(tmpDir, "carol", "brain.db"), "not a sqlite file");

    const result = await brainTeamCheckHandler({ dir: tmpDir });
    expect(result.success).toBe(true);
    expect(result.data.valid).toBe(2);
    expect(result.data.invalid).toBe(1);
    const aliceRow = result.data.candidates.find((c) => c.devId === "alice");
    expect(aliceRow?.valid).toBe(true);
    expect(aliceRow?.schemaVersion).toBeGreaterThan(0);
    const carolRow = result.data.candidates.find((c) => c.devId === "carol");
    expect(carolRow?.valid).toBe(false);
    expect(carolRow?.error).toBeTruthy();
  });

  it("rejects when <dir> is empty", async () => {
    const result = await brainTeamCheckHandler({ dir: "" });
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(EXIT_CODES.FLAG_CONFLICT);
    expect(result.errors[0]!.code).toBe("E_BRAIN_TEAM_CHECK_MISSING_DIR");
  });

  it("rejects when <dir> does not exist", async () => {
    const result = await brainTeamCheckHandler({ dir: join(tmpDir, "missing") });
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(EXIT_CODES.CONFIG_NOT_FOUND);
    expect(result.errors[0]!.code).toBe("E_BRAIN_TEAM_CHECK_DIR_NOT_FOUND");
  });

  it("returns an empty inventory for a dir with no .db files", async () => {
    const result = await brainTeamCheckHandler({ dir: tmpDir });
    expect(result.success).toBe(true);
    expect(result.data.valid).toBe(0);
    expect(result.data.invalid).toBe(0);
    expect(result.data.candidates).toHaveLength(0);
  });
});
