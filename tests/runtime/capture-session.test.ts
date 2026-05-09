/**
 * Unit tests for `capture/session.ts` — sessions, prompts, turns, tool_calls,
 * artifacts_used CRUD primitives.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openBrain, applyMigrations, type BrainHandle } from "#src/runtime/brain/index.js";
import {
  closeTurn,
  endSession,
  ensureSession,
  latestTurnId,
  openTurn,
  recordArtifactUsage,
  recordPrompt,
  recordToolCall,
  refreshCaptureCount,
} from "#src/runtime/capture/session.js";
import { persistMarkers } from "#src/runtime/capture/persist.js";

let tmp: string;
let handle: BrainHandle;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "codi-capture-session-"));
  handle = openBrain({ dbPath: join(tmp, "brain.db") });
  applyMigrations(handle.raw);
});

afterEach(() => {
  handle.close();
  rmSync(tmp, { recursive: true, force: true });
});

describe("ensureSession", () => {
  it("inserts a fresh row on first call and is idempotent on second call", () => {
    ensureSession(handle.raw, {
      sessionId: "s1",
      projectId: "p1",
      agentType: "claude-code",
      workingDir: tmp,
    });
    const r1 = handle.raw
      .prepare(`SELECT session_id, project_id, working_dir, started_at FROM sessions`)
      .all() as {
      session_id: string;
      project_id: string;
      working_dir: string;
      started_at: number;
    }[];
    expect(r1).toHaveLength(1);
    expect(r1[0]?.session_id).toBe("s1");
    const startedAt = r1[0]?.started_at;

    // Re-call: started_at MUST not change.
    ensureSession(handle.raw, {
      sessionId: "s1",
      projectId: "p1",
      agentType: "claude-code",
      workingDir: tmp,
    });
    const r2 = handle.raw
      .prepare(`SELECT started_at FROM sessions WHERE session_id = 's1'`)
      .get() as { started_at: number };
    expect(r2.started_at).toBe(startedAt);
  });

  it("updates transcript_path / branch / commit_sha / workflow_id on subsequent calls", () => {
    ensureSession(handle.raw, {
      sessionId: "s2",
      projectId: "p",
      agentType: "claude-code",
      workingDir: tmp,
    });
    ensureSession(handle.raw, {
      sessionId: "s2",
      projectId: "p",
      agentType: "claude-code",
      workingDir: tmp,
      transcriptPath: "/tmp/t.jsonl",
      branch: "main",
      commitSha: "abc123",
      workflowId: "feat-x-20260509",
    });
    const row = handle.raw
      .prepare(
        `SELECT transcript_path, branch, commit_sha, workflow_id FROM sessions WHERE session_id = 's2'`,
      )
      .get() as {
      transcript_path: string;
      branch: string;
      commit_sha: string;
      workflow_id: string;
    };
    expect(row.transcript_path).toBe("/tmp/t.jsonl");
    expect(row.branch).toBe("main");
    expect(row.commit_sha).toBe("abc123");
    expect(row.workflow_id).toBe("feat-x-20260509");
  });
});

describe("recordPrompt + openTurn", () => {
  beforeEach(() => {
    ensureSession(handle.raw, {
      sessionId: "s",
      projectId: "p",
      agentType: "claude-code",
      workingDir: tmp,
    });
  });

  it("auto-increments turn_no per session", () => {
    const p1 = recordPrompt(handle.raw, { sessionId: "s", text: "Hello" });
    const p2 = recordPrompt(handle.raw, { sessionId: "s", text: "World" });
    expect(p1.turnNo).toBe(1);
    expect(p2.turnNo).toBe(2);
    expect(p2.promptId).toBeGreaterThan(p1.promptId);
  });

  it("persists char_count derived from text length", () => {
    recordPrompt(handle.raw, { sessionId: "s", text: "exactly10!" });
    const row = handle.raw
      .prepare(`SELECT char_count FROM prompts WHERE session_id = 's'`)
      .get() as { char_count: number };
    expect(row.char_count).toBe(10);
  });

  it("openTurn returns a positive turn_id and links to the prompt", () => {
    const p = recordPrompt(handle.raw, { sessionId: "s", text: "x" });
    const tid = openTurn(handle.raw, { sessionId: "s", promptId: p.promptId, turnNo: p.turnNo });
    expect(tid).toBeGreaterThan(0);
    const row = handle.raw
      .prepare(`SELECT prompt_id, agent_text, duration_ms FROM turns WHERE turn_id = ?`)
      .get(tid) as { prompt_id: number; agent_text: string | null; duration_ms: number | null };
    expect(row.prompt_id).toBe(p.promptId);
    expect(row.agent_text).toBeNull();
    expect(row.duration_ms).toBeNull();
  });
});

describe("latestTurnId", () => {
  it("returns null when the session has no turns yet", () => {
    ensureSession(handle.raw, {
      sessionId: "empty",
      projectId: "p",
      agentType: "claude-code",
      workingDir: tmp,
    });
    expect(latestTurnId(handle.raw, "empty")).toBeNull();
  });

  it("returns the most recent turn_id", () => {
    ensureSession(handle.raw, {
      sessionId: "s",
      projectId: "p",
      agentType: "claude-code",
      workingDir: tmp,
    });
    const p1 = recordPrompt(handle.raw, { sessionId: "s", text: "1" });
    const t1 = openTurn(handle.raw, { sessionId: "s", promptId: p1.promptId, turnNo: p1.turnNo });
    const p2 = recordPrompt(handle.raw, { sessionId: "s", text: "2" });
    const t2 = openTurn(handle.raw, { sessionId: "s", promptId: p2.promptId, turnNo: p2.turnNo });
    expect(latestTurnId(handle.raw, "s")).toBe(t2);
    expect(t2).toBeGreaterThan(t1);
  });
});

describe("closeTurn", () => {
  it("populates agent_text and duration_ms", () => {
    ensureSession(handle.raw, {
      sessionId: "s",
      projectId: "p",
      agentType: "claude-code",
      workingDir: tmp,
    });
    const p = recordPrompt(handle.raw, { sessionId: "s", text: "x" });
    const tid = openTurn(handle.raw, { sessionId: "s", promptId: p.promptId, turnNo: p.turnNo });

    closeTurn(handle.raw, { turnId: tid, agentText: "OK done.", durationMs: 1234 });

    const row = handle.raw
      .prepare(`SELECT agent_text, duration_ms FROM turns WHERE turn_id = ?`)
      .get(tid) as { agent_text: string; duration_ms: number };
    expect(row.agent_text).toBe("OK done.");
    expect(row.duration_ms).toBe(1234);
  });

  it("bumps sessions.total_turns to the count of turn rows", () => {
    ensureSession(handle.raw, {
      sessionId: "s",
      projectId: "p",
      agentType: "claude-code",
      workingDir: tmp,
    });
    const p1 = recordPrompt(handle.raw, { sessionId: "s", text: "1" });
    const t1 = openTurn(handle.raw, { sessionId: "s", promptId: p1.promptId, turnNo: p1.turnNo });
    const p2 = recordPrompt(handle.raw, { sessionId: "s", text: "2" });
    openTurn(handle.raw, { sessionId: "s", promptId: p2.promptId, turnNo: p2.turnNo });

    closeTurn(handle.raw, { turnId: t1, agentText: "first", durationMs: 100 });
    const row = handle.raw
      .prepare(`SELECT total_turns FROM sessions WHERE session_id = 's'`)
      .get() as { total_turns: number };
    expect(row.total_turns).toBe(2);
  });
});

describe("recordToolCall", () => {
  it("stores input as JSON and tags status", () => {
    ensureSession(handle.raw, {
      sessionId: "s",
      projectId: "p",
      agentType: "claude-code",
      workingDir: tmp,
    });
    const p = recordPrompt(handle.raw, { sessionId: "s", text: "x" });
    const tid = openTurn(handle.raw, { sessionId: "s", promptId: p.promptId, turnNo: p.turnNo });
    const callId = recordToolCall(handle.raw, {
      sessionId: "s",
      turnId: tid,
      toolName: "Edit",
      input: { file_path: "/x.ts", old_string: "a", new_string: "b" },
      outputSummary: "1 line changed",
      durationMs: 42,
      status: "ok",
    });
    expect(callId).toBeGreaterThan(0);
    const row = handle.raw
      .prepare(`SELECT tool_name, input_json, status, duration_ms FROM tool_calls`)
      .get() as { tool_name: string; input_json: string; status: string; duration_ms: number };
    expect(row.tool_name).toBe("Edit");
    expect(JSON.parse(row.input_json)).toEqual({
      file_path: "/x.ts",
      old_string: "a",
      new_string: "b",
    });
    expect(row.status).toBe("ok");
    expect(row.duration_ms).toBe(42);
  });

  it("supports blocked status with error message", () => {
    ensureSession(handle.raw, {
      sessionId: "s",
      projectId: "p",
      agentType: "claude-code",
      workingDir: tmp,
    });
    const p = recordPrompt(handle.raw, { sessionId: "s", text: "x" });
    const tid = openTurn(handle.raw, { sessionId: "s", promptId: p.promptId, turnNo: p.turnNo });
    recordToolCall(handle.raw, {
      sessionId: "s",
      turnId: tid,
      toolName: "Bash",
      input: { command: "rm -rf /" },
      status: "blocked",
      error: "rm -rf at root is destructive",
    });
    const row = handle.raw.prepare(`SELECT status, error FROM tool_calls`).get() as {
      status: string;
      error: string;
    };
    expect(row.status).toBe("blocked");
    expect(row.error).toContain("destructive");
  });
});

describe("recordArtifactUsage", () => {
  it("stores artifact_type, name, event tuples", () => {
    ensureSession(handle.raw, {
      sessionId: "s",
      projectId: "p",
      agentType: "claude-code",
      workingDir: tmp,
    });
    const p = recordPrompt(handle.raw, { sessionId: "s", text: "x" });
    const tid = openTurn(handle.raw, { sessionId: "s", promptId: p.promptId, turnNo: p.turnNo });
    recordArtifactUsage(handle.raw, {
      sessionId: "s",
      turnId: tid,
      artifactType: "skill",
      artifactName: "codi-brainstorming",
      event: "invoked",
    });
    recordArtifactUsage(handle.raw, {
      sessionId: "s",
      turnId: tid,
      artifactType: "skill",
      artifactName: "codi-brainstorming",
      event: "completed",
      outcome: "design-approved",
      durationMs: 3000,
    });
    const rows = handle.raw
      .prepare(
        `SELECT artifact_type, artifact_name, event, outcome FROM artifacts_used ORDER BY usage_id`,
      )
      .all() as {
      artifact_type: string;
      artifact_name: string;
      event: string;
      outcome: string | null;
    }[];
    expect(rows).toHaveLength(2);
    expect(rows[0]?.event).toBe("invoked");
    expect(rows[1]?.event).toBe("completed");
    expect(rows[1]?.outcome).toBe("design-approved");
  });
});

describe("refreshCaptureCount", () => {
  it("derives total_capture_count from the captures table", () => {
    ensureSession(handle.raw, {
      sessionId: "s",
      projectId: "p",
      agentType: "claude-code",
      workingDir: tmp,
    });
    const p = recordPrompt(handle.raw, { sessionId: "s", text: "x" });
    const tid = openTurn(handle.raw, { sessionId: "s", promptId: p.promptId, turnNo: p.turnNo });
    persistMarkers(handle.raw, { sessionId: "s", promptId: p.promptId, turnId: tid }, [
      { type: "RULE", content: "always X", rawMarker: '|RULE: "always X"|', offset: 0 },
      { type: "INSIGHT", content: "Y is Z", rawMarker: '|INSIGHT: "Y is Z"|', offset: 20 },
    ]);
    refreshCaptureCount(handle.raw, "s");
    const row = handle.raw
      .prepare(`SELECT total_capture_count FROM sessions WHERE session_id = 's'`)
      .get() as { total_capture_count: number };
    expect(row.total_capture_count).toBe(2);
  });
});

describe("endSession", () => {
  it("sets ended_at on first call and preserves it on second", () => {
    ensureSession(handle.raw, {
      sessionId: "s",
      projectId: "p",
      agentType: "claude-code",
      workingDir: tmp,
    });
    endSession(handle.raw, "s", 1000);
    endSession(handle.raw, "s", 2000);
    const row = handle.raw
      .prepare(`SELECT ended_at FROM sessions WHERE session_id = 's'`)
      .get() as { ended_at: number };
    expect(row.ended_at).toBe(1000);
  });
});
