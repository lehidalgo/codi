/**
 * ISSUE-052 — operations-ledger writes actorId on every operation.
 *
 * The ledger is now schema v2; every appended LedgerOperation carries an
 * `actorId` field, auto-resolved from `resolveActorId()` unless the
 * caller supplied one. Existing v1 ledger files keep working: missing
 * actorId on prior rows stays undefined.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { OperationsLedgerManager } from "#src/core/audit/operations-ledger.js";

describe("OperationsLedgerManager — actorId attribution", () => {
  let configDir: string;
  let prevActorEnv: string | undefined;

  beforeEach(() => {
    configDir = mkdtempSync(path.join(tmpdir(), "codi-ledger-actor-"));
    prevActorEnv = process.env["CODI_ACTOR_ID"];
    process.env["CODI_ACTOR_ID"] = "agent:test-runner";
  });

  afterEach(() => {
    if (prevActorEnv === undefined) delete process.env["CODI_ACTOR_ID"];
    else process.env["CODI_ACTOR_ID"] = prevActorEnv;
    rmSync(configDir, { recursive: true, force: true });
  });

  it("logOperation auto-fills actorId when caller omits it", async () => {
    const ledger = new OperationsLedgerManager(configDir);
    const r = await ledger.logOperation({
      type: "add",
      timestamp: new Date().toISOString(),
      details: { artifactType: "rule", name: "x" },
    });
    expect(r.ok).toBe(true);

    const read = await ledger.read();
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.data.version).toBe("2");
    expect(read.data.operations).toHaveLength(1);
    expect(read.data.operations[0]!.actorId).toBe("agent:test-runner");
  });

  it("logOperation preserves an explicit actorId override", async () => {
    const ledger = new OperationsLedgerManager(configDir);
    await ledger.logOperation({
      type: "add",
      timestamp: new Date().toISOString(),
      details: { artifactType: "rule", name: "x" },
      actorId: "system:codi",
    });
    const read = await ledger.read();
    if (!read.ok) return;
    expect(read.data.operations[0]!.actorId).toBe("system:codi");
  });

  it("setInitialization stamps actorId on the init operation", async () => {
    const ledger = new OperationsLedgerManager(configDir);
    await ledger.setInitialization({
      timestamp: new Date().toISOString(),
      preset: "balanced",
      agents: ["claude-code"],
      stack: ["typescript"],
      codiVersion: "0.0.0-test",
    });
    const read = await ledger.read();
    if (!read.ok) return;
    expect(read.data.operations[0]!.actorId).toBe("agent:test-runner");
  });
});
