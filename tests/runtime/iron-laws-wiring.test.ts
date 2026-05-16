/**
 * F7 — Iron Laws wiring tests.
 *
 * Covers:
 *   - phase_transition_proposed → workflow_runs.status = 'pending_approval'
 *   - phase_transition_approved/rejected → status reverts to 'active'
 *   - readRecentPrompts session-scoped + global fallback
 *   - readLastPromptTs returns the most recent prompt timestamp per session
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  runWorkflow,
  proposeTransition,
  approveTransition,
  rejectTransition,
} from "#src/runtime/cli-handlers.js";
import { openBrain, type BrainHandle } from "#src/runtime/brain/db.js";
import { applyMigrations } from "#src/runtime/brain/migrate.js";
import {
  readGateState,
  readRecentPrompts,
  readLastPromptTs,
} from "#src/runtime/iron-laws-enforcer.js";
import { ensureSession, recordPrompt } from "#src/runtime/capture/session.js";
import type { Author } from "#src/runtime/types.js";

const human: Author = { type: "human", id: "tester" };

let dir: string;
let savedBrain: string | undefined;

function bootstrapKb(d: string): void {
  mkdirSync(join(d, "docs"), { recursive: true });
  writeFileSync(join(d, "docs", "CONTEXT.md"), "# C\n", "utf-8");
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "codi-il-wiring-"));
  bootstrapKb(dir);
  savedBrain = process.env["CODI_BRAIN_DB"];
  process.env["CODI_BRAIN_DB"] = join(dir, "brain.db");
});

afterEach(() => {
  if (savedBrain === undefined) delete process.env["CODI_BRAIN_DB"];
  else process.env["CODI_BRAIN_DB"] = savedBrain;
  rmSync(dir, { recursive: true, force: true });
});

function withHandle<T>(cb: (h: BrainHandle) => T): T {
  const handle = openBrain();
  try {
    applyMigrations(handle.raw);
    return cb(handle);
  } finally {
    handle.close();
  }
}

describe("Iron Law 4 — workflow status flips on phase transition events", () => {
  it("phase_transition_proposed sets workflow_runs.status to pending_approval", () => {
    runWorkflow({ workflowType: "feature", task: "x", author: human, cwd: dir });
    proposeTransition({ toPhase: "plan", author: human, cwd: dir });

    withHandle((h) => {
      const state = readGateState(h.raw);
      expect(state).not.toBeNull();
      expect(state!.status).toBe("pending_approval");
      expect(state!.currentPhase).toBe("intent");
    });
  });

  it("phase_transition_approved restores status to active", () => {
    runWorkflow({ workflowType: "feature", task: "x", author: human, cwd: dir });
    proposeTransition({ toPhase: "plan", author: human, cwd: dir });
    approveTransition({ author: human, cwd: dir });

    withHandle((h) => {
      const state = readGateState(h.raw);
      expect(state).not.toBeNull();
      expect(state!.status).toBe("active");
      expect(state!.currentPhase).toBe("plan");
    });
  });

  it("phase_transition_rejected restores status to active without phase change", () => {
    runWorkflow({ workflowType: "feature", task: "x", author: human, cwd: dir });
    proposeTransition({ toPhase: "plan", author: human, cwd: dir });
    rejectTransition({ reason: "scope unclear", author: human, cwd: dir });

    withHandle((h) => {
      const state = readGateState(h.raw);
      expect(state).not.toBeNull();
      expect(state!.status).toBe("active");
      expect(state!.currentPhase).toBe("intent");
    });
  });
});

describe("readRecentPrompts", () => {
  it("returns empty array when no prompts exist", () => {
    withHandle((h) => {
      expect(readRecentPrompts(h.raw, { sessionId: "s" })).toEqual([]);
      expect(readRecentPrompts(h.raw, {})).toEqual([]);
    });
  });

  it("returns session-scoped prompts newest-first", () => {
    withHandle((h) => {
      ensureSession(h.raw, {
        sessionId: "s1",
        projectId: "p",
        agentType: "claude-code",
        workingDir: dir,
      });
      recordPrompt(h.raw, { sessionId: "s1", text: "first" });
      recordPrompt(h.raw, { sessionId: "s1", text: "second" });
      recordPrompt(h.raw, { sessionId: "s1", text: "third" });
      const recent = readRecentPrompts(h.raw, { sessionId: "s1", limit: 2 });
      expect(recent).toEqual(["third", "second"]);
    });
  });

  it("falls back to global newest-first when sessionId is empty", () => {
    withHandle((h) => {
      ensureSession(h.raw, {
        sessionId: "s1",
        projectId: "p",
        agentType: "claude-code",
        workingDir: dir,
      });
      recordPrompt(h.raw, { sessionId: "s1", text: "alpha" });
      ensureSession(h.raw, {
        sessionId: "s2",
        projectId: "p",
        agentType: "claude-code",
        workingDir: dir,
      });
      recordPrompt(h.raw, { sessionId: "s2", text: "beta" });
      const recent = readRecentPrompts(h.raw, { limit: 5 });
      expect(recent).toEqual(["beta", "alpha"]);
    });
  });

  it("falls back to global when the named session has no prompts yet", () => {
    withHandle((h) => {
      ensureSession(h.raw, {
        sessionId: "s1",
        projectId: "p",
        agentType: "claude-code",
        workingDir: dir,
      });
      recordPrompt(h.raw, { sessionId: "s1", text: "from s1" });
      const recent = readRecentPrompts(h.raw, { sessionId: "s-fresh", limit: 5 });
      expect(recent).toEqual(["from s1"]);
    });
  });
});

describe("readLastPromptTs", () => {
  it("returns 0 for a session with no prompts", () => {
    withHandle((h) => {
      expect(readLastPromptTs(h.raw, "s")).toBe(0);
    });
  });

  it("returns the most recent prompt timestamp", () => {
    withHandle((h) => {
      ensureSession(h.raw, {
        sessionId: "s",
        projectId: "p",
        agentType: "claude-code",
        workingDir: dir,
      });
      const before = Date.now();
      recordPrompt(h.raw, { sessionId: "s", text: "x" });
      recordPrompt(h.raw, { sessionId: "s", text: "y" });
      const after = Date.now();
      const ts = readLastPromptTs(h.raw, "s");
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });
  });

  it("returns 0 for empty sessionId", () => {
    withHandle((h) => {
      expect(readLastPromptTs(h.raw, "")).toBe(0);
    });
  });
});
