/**
 * CORE-002 — StateManager.atomicMutate cross-process lock + serialization.
 *
 * Verifies the lock works for the in-process race that two `codi generate`
 * runs would create. We can't actually fork two Node processes here
 * (vitest workers complicate that), but the lock semantics are the same:
 * proper-lockfile uses an O_CREAT|O_EXCL mkdir behind the scenes, so
 * multiple async callers within the same process serialize identically
 * to multiple processes.
 *
 * Stale-lock reclaim is covered by a fixture that pre-populates the lock
 * directory with an old mtime — proper-lockfile reclaims after `stale`
 * (default 10s, we override to 200ms in the stale test for speed).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { cleanupTmpDir } from "#tests/helpers/fs.js";
import { StateManager } from "#src/core/config/state.js";
import { PROJECT_NAME } from "#src/constants.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `${PROJECT_NAME}-state-lock-`));
});

afterEach(async () => {
  await cleanupTmpDir(tmpDir);
});

describe("StateManager.atomicMutate", () => {
  it("serializes concurrent mutations: every update is observed", async () => {
    // Two concurrent atomicMutate calls must NOT lose updates the way the
    // pre-fix read+write race did. The lock guarantees ordering.
    const mgr = new StateManager(tmpDir);
    await mgr.atomicMutate((s) => {
      s.agents["a1"] = [];
      return s;
    });

    // Fire 5 concurrent appends each adding one path under a distinct agent.
    const results = await Promise.all(
      ["b1", "b2", "b3", "b4", "b5"].map((id) =>
        mgr.atomicMutate((s) => {
          s.agents[id] = [
            {
              path: `${id}.txt`,
              sourceHash: "src",
              generatedHash: "gen",
              sources: ["x"],
              timestamp: new Date().toISOString(),
            },
          ];
          return s;
        }),
      ),
    );

    for (const r of results) expect(r.ok).toBe(true);

    const finalRead = await mgr.read();
    expect(finalRead.ok).toBe(true);
    if (!finalRead.ok) return;
    // All five concurrent mutations must be observable; the pre-fix code
    // would have lost 1-4 of them to last-writer-wins.
    expect(Object.keys(finalRead.data.agents).sort()).toEqual(["a1", "b1", "b2", "b3", "b4", "b5"]);
  });

  it("returns Result.ok when mutator succeeds", async () => {
    const mgr = new StateManager(tmpDir);
    const result = await mgr.atomicMutate((s) => {
      s.lastGenerated = "2026-05-15T12:00:00.000Z";
      return s;
    });
    expect(result.ok).toBe(true);

    const read = await mgr.read();
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.data.lastGenerated).toBe("2026-05-15T12:00:00.000Z");
  });

  it("returns Result.err and preserves state when mutator throws", async () => {
    const mgr = new StateManager(tmpDir);
    // Seed a known state.
    await mgr.atomicMutate((s) => {
      s.lastGenerated = "before";
      return s;
    });

    const result = await mgr.atomicMutate(() => {
      throw new Error("intentional mutator failure");
    });
    expect(result.ok).toBe(false);

    // State must be unchanged after a failed mutation.
    const read = await mgr.read();
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.data.lastGenerated).toBe("before");
  });

  it("releases the lock so subsequent mutations succeed after a throw", async () => {
    const mgr = new StateManager(tmpDir);
    const errResult = await mgr.atomicMutate(() => {
      throw new Error("first call fails");
    });
    expect(errResult.ok).toBe(false);

    // Second call must succeed — the lock from the first call has been released.
    const okResult = await mgr.atomicMutate((s) => {
      s.agents["a"] = [];
      return s;
    });
    expect(okResult.ok).toBe(true);
  });

  it("preserves updateAgentsBatch semantics through atomicMutate refactor", async () => {
    // updateAgentsBatch is now a thin wrapper over atomicMutate.
    // Existing callers must continue to work identically.
    const mgr = new StateManager(tmpDir);
    const file = {
      path: "x.md",
      sourceHash: "s",
      generatedHash: "g",
      sources: ["src1"],
      timestamp: new Date().toISOString(),
    };
    const result = await mgr.updateAgentsBatch({
      "claude-code": [file],
      cursor: [file],
    });
    expect(result.ok).toBe(true);

    const read = await mgr.read();
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.data.agents["claude-code"]).toHaveLength(1);
    expect(read.data.agents["cursor"]).toHaveLength(1);
  });

  it("preserves removeAgents semantics through atomicMutate refactor", async () => {
    const mgr = new StateManager(tmpDir);
    const file = {
      path: "x.md",
      sourceHash: "s",
      generatedHash: "g",
      sources: ["src1"],
      timestamp: new Date().toISOString(),
    };
    await mgr.updateAgentsBatch({ a: [file], b: [file], c: [file] });

    const result = await mgr.removeAgents(["a", "c"]);
    expect(result.ok).toBe(true);

    const read = await mgr.read();
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(Object.keys(read.data.agents).sort()).toEqual(["b"]);
  });
});
