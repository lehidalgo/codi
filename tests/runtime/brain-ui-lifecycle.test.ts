/**
 * brain-ui spawn-or-attach lifecycle (Sprint 4).
 *
 * Pidfile read/write/clear, isPidAlive, and the resolveAttachOrSpawn decision
 * matrix are all unit-testable without spinning a real server. healthz probe
 * is exercised against an in-process Hono `app.request()` shim by mocking
 * fetch.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  readPidfile,
  writePidfile,
  clearPidfile,
  isPidAlive,
  resolveAttachOrSpawn,
} from "#src/runtime/brain-ui/index.js";

let pidPath: string;
let cleanup: () => void;

beforeEach(() => {
  const dir = mkdtempSync(join(tmpdir(), "codi-pid-"));
  pidPath = join(dir, "brain-ui.pid");
  cleanup = () => rmSync(dir, { recursive: true, force: true });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("pidfile io", () => {
  it("returns null when file does not exist", () => {
    expect(readPidfile(pidPath)).toBeNull();
  });

  it("round-trips a record", () => {
    writePidfile({ pid: 1234, port: 4477, startedAt: 1 }, pidPath);
    const r = readPidfile(pidPath);
    expect(r).toEqual({ pid: 1234, port: 4477, startedAt: 1 });
  });

  it("clearPidfile removes the file", () => {
    writePidfile({ pid: 1, port: 4477, startedAt: 0 }, pidPath);
    clearPidfile(pidPath);
    expect(readPidfile(pidPath)).toBeNull();
  });

  it("returns null on malformed JSON", () => {
    writeFileSync(pidPath, "not-json{");
    expect(readPidfile(pidPath)).toBeNull();
  });

  it("returns null when required fields are missing", () => {
    writeFileSync(pidPath, JSON.stringify({ pid: 0 }));
    expect(readPidfile(pidPath)).toBeNull();
  });
});

describe("isPidAlive", () => {
  it("reports the current process as alive", () => {
    expect(isPidAlive(process.pid)).toBe(true);
  });

  it("reports an unallocated PID as dead", () => {
    // PID 999999 is virtually never assigned on a developer machine.
    expect(isPidAlive(999_999)).toBe(false);
  });
});

describe("resolveAttachOrSpawn", () => {
  it("spawns when there is no pidfile", async () => {
    const decision = await resolveAttachOrSpawn(pidPath);
    expect(decision.action).toBe("spawn");
    if (decision.action === "spawn") {
      expect(decision.reason).toBe("no_pidfile");
    }
  });

  it("spawns when the recorded PID is dead", async () => {
    writePidfile({ pid: 999_999, port: 4477, startedAt: 0 }, pidPath);
    const decision = await resolveAttachOrSpawn(pidPath);
    expect(decision.action).toBe("spawn");
    if (decision.action === "spawn") {
      expect(decision.reason).toBe("stale_pid");
    }
  });

  it("spawns when PID is alive but healthz is unreachable", async () => {
    writePidfile({ pid: process.pid, port: 4477, startedAt: 0 }, pidPath);
    // Stub fetch so probeHealthz fails fast.
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    const decision = await resolveAttachOrSpawn(pidPath);
    expect(decision.action).toBe("spawn");
    if (decision.action === "spawn") {
      expect(decision.reason).toBe("no_healthz");
    }
  });

  it("attaches when PID is alive and healthz is green", async () => {
    writePidfile({ pid: process.pid, port: 4477, startedAt: 0 }, pidPath);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, schema_version: 1, brain_path: "/x", now: Date.now() }),
      }),
    );
    const decision = await resolveAttachOrSpawn(pidPath);
    expect(decision.action).toBe("attach");
    if (decision.action === "attach") {
      expect(decision.record.pid).toBe(process.pid);
    }
  });
});
