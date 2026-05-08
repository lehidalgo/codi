/**
 * Backend selection + parity (audit gap fix).
 *
 * Closes §6 of `docs/20260509_012237_[AUDIT]_codi-v3-zero-end-to-end.md`:
 * `selectEventLog(cwd)` returns the right backend per env + concrete
 * classes both implement `EventLogLike`. The same workflow init drives
 * either backend through the same surface.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  selectEventLog,
  resolveBackend,
  isLegacyEventLog,
} from "#src/runtime/event-log-factory.js";
import { EventLog } from "#src/runtime/event-log.js";
import { BrainEventLog } from "#src/runtime/brain-event-log.js";
import type { ManifestEvent } from "#src/runtime/types.js";

const ENV_KEY = "CODI_USE_BRAIN_BACKEND";
const ORIG = process.env[ENV_KEY];

beforeEach(() => {
  delete process.env[ENV_KEY];
});
afterEach(() => {
  if (ORIG === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = ORIG;
});

describe("resolveBackend", () => {
  it("defaults to legacy", () => {
    expect(resolveBackend()).toBe("legacy");
  });

  it("returns brain when CODI_USE_BRAIN_BACKEND=1", () => {
    process.env[ENV_KEY] = "1";
    expect(resolveBackend()).toBe("brain");
  });

  it("ignores any other env value", () => {
    process.env[ENV_KEY] = "true";
    expect(resolveBackend()).toBe("legacy");
    process.env[ENV_KEY] = "yes";
    expect(resolveBackend()).toBe("legacy");
  });

  it("respects explicit override", () => {
    process.env[ENV_KEY] = "1";
    expect(resolveBackend({ backend: "legacy" })).toBe("legacy");
    delete process.env[ENV_KEY];
    expect(resolveBackend({ backend: "brain" })).toBe("brain");
  });
});

describe("selectEventLog returns the right concrete class", () => {
  it("legacy by default", () => {
    const cwd = mkdtempSync(join(tmpdir(), "codi-fact-l-"));
    try {
      const log = selectEventLog(cwd);
      expect(isLegacyEventLog(log)).toBe(true);
      expect(log).toBeInstanceOf(EventLog);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("brain when env=1", () => {
    const cwd = mkdtempSync(join(tmpdir(), "codi-fact-b-"));
    const dbPath = join(cwd, "brain.db");
    try {
      process.env[ENV_KEY] = "1";
      const log = selectEventLog(cwd, { brainDbPath: dbPath });
      expect(isLegacyEventLog(log)).toBe(false);
      expect(log).toBeInstanceOf(BrainEventLog);
      log.dispose?.();
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

function initEvent(workflowId: string): ManifestEvent {
  return {
    event_id: "ev-" + workflowId,
    event_type: "init",
    schema_version: 1,
    ts: new Date().toISOString(),
    actor: { type: "human", id: "test" },
    workflow_id: workflowId,
    commitable: true,
    payload: { workflow_type: "feature", task: "parity test" },
  } as ManifestEvent;
}

describe("contract parity: same flow, different backend", () => {
  for (const backend of ["legacy", "brain"] as const) {
    it(`${backend}: init + append + load + hasWorkflow round-trip`, () => {
      const cwd = mkdtempSync(join(tmpdir(), `codi-par-${backend}-`));
      const dbPath = join(cwd, "brain.db");
      try {
        const log = selectEventLog(cwd, { backend, brainDbPath: dbPath });

        // hasWorkflow false before init
        expect(log.hasWorkflow("wf-par-1")).toBe(false);

        log.initWorkflow("wf-par-1", initEvent("wf-par-1"));
        expect(log.getActiveWorkflowId()).toBe("wf-par-1");
        expect(log.hasWorkflow("wf-par-1")).toBe(true);

        const r = log.append("wf-par-1", {
          event_id: "ev-2",
          event_type: "phase_started",
          schema_version: 1,
          ts: new Date().toISOString(),
          actor: { type: "human", id: "test" },
          workflow_id: "wf-par-1",
          commitable: true,
          payload: { phase: "intent" },
        } as ManifestEvent);

        // Both backends produce a path string + sequence + commitable.
        expect(typeof r.path).toBe("string");
        expect(r.path.length).toBeGreaterThan(0);
        expect(typeof r.sequence).toBe("number");
        expect(r.commitable).toBe(true);

        const events = log.loadEvents("wf-par-1");
        expect(events.length).toBe(2);
        expect(events.map((e) => e.event_type)).toEqual(["init", "phase_started"]);

        log.dispose?.();
      } finally {
        rmSync(cwd, { recursive: true, force: true });
      }
    });
  }
});

describe("audit gap closed: brain backend writes are visible immediately", () => {
  it("a workflow initialised via the factory shows up in workflow_runs", () => {
    const cwd = mkdtempSync(join(tmpdir(), "codi-audit-fix-"));
    const dbPath = join(cwd, "brain.db");
    try {
      process.env[ENV_KEY] = "1";
      const log = selectEventLog(cwd, { brainDbPath: dbPath });
      log.initWorkflow("wf-audit-fix-1", initEvent("wf-audit-fix-1"));
      log.dispose?.();

      // Re-open with a fresh handle and verify persistence (this is what the
      // brain-ui server does — different process, same file).
      const log2 = selectEventLog(cwd, { brainDbPath: dbPath });
      expect(log2.getActiveWorkflowId()).toBe("wf-audit-fix-1");
      expect(log2.loadEvents("wf-audit-fix-1")).toHaveLength(1);
      log2.dispose?.();
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
