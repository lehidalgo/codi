/**
 * Unit tests for the UserPromptSubmit + PostToolUse orchestrators (F6).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openBrain, type BrainHandle } from "#src/runtime/brain/db.js";
import { applyMigrations } from "#src/runtime/brain/migrate.js";
import { processPromptSubmit } from "#src/runtime/capture/prompt-hook.js";
import { processPostToolUse } from "#src/runtime/capture/tool-hook.js";
import { processStopHook } from "#src/runtime/capture/stop-hook.js";

let tmp: string;
let handle: BrainHandle;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "codi-hook-orch-"));
  handle = openBrain({ dbPath: join(tmp, "brain.db") });
  applyMigrations(handle.raw);
});

afterEach(() => {
  handle.close();
  rmSync(tmp, { recursive: true, force: true });
});

describe("processPromptSubmit", () => {
  it("UPSERTs a session, inserts a prompt, opens a turn", () => {
    const result = processPromptSubmit(handle, {
      sessionId: "s",
      prompt: "Refactor the auth flow.",
      cwd: tmp,
    });
    expect(result.promptId).toBeGreaterThan(0);
    expect(result.turnId).toBeGreaterThan(0);
    expect(result.turnNo).toBe(1);

    const session = handle.raw
      .prepare(`SELECT working_dir, project_id FROM sessions WHERE session_id = 's'`)
      .get() as { working_dir: string; project_id: string };
    expect(session.working_dir).toBe(tmp);
    expect(session.project_id).toMatch(/-[0-9a-f]{1,8}$/);

    const prompt = handle.raw
      .prepare(`SELECT text FROM prompts WHERE prompt_id = ?`)
      .get(result.promptId) as { text: string };
    expect(prompt.text).toBe("Refactor the auth flow.");

    const turn = handle.raw
      .prepare(`SELECT prompt_id, agent_text FROM turns WHERE turn_id = ?`)
      .get(result.turnId) as { prompt_id: number; agent_text: string | null };
    expect(turn.prompt_id).toBe(result.promptId);
    expect(turn.agent_text).toBeNull();
  });

  it("turn_no auto-increments across consecutive prompts", () => {
    const r1 = processPromptSubmit(handle, { sessionId: "s", prompt: "1", cwd: tmp });
    const r2 = processPromptSubmit(handle, { sessionId: "s", prompt: "2", cwd: tmp });
    expect(r1.turnNo).toBe(1);
    expect(r2.turnNo).toBe(2);
    expect(r2.turnId).toBeGreaterThan(r1.turnId);
  });
});

describe("processPostToolUse", () => {
  it("records a tool_call against the in-flight turn", () => {
    const p = processPromptSubmit(handle, { sessionId: "s", prompt: "x", cwd: tmp });

    const result = processPostToolUse(handle, {
      sessionId: "s",
      cwd: tmp,
      toolName: "Edit",
      toolInput: { file_path: "/x.ts" },
      toolResponse: { success: true },
      durationMs: 12,
    });
    expect(result.turnId).toBe(p.turnId);
    expect(result.status).toBe("ok");
    expect(result.callId).toBeGreaterThan(0);

    const row = handle.raw
      .prepare(`SELECT tool_name, status, duration_ms FROM tool_calls WHERE call_id = ?`)
      .get(result.callId) as { tool_name: string; status: string; duration_ms: number };
    expect(row.tool_name).toBe("Edit");
    expect(row.status).toBe("ok");
    expect(row.duration_ms).toBe(12);
  });

  it("infers blocked status from blocked:true response", () => {
    processPromptSubmit(handle, { sessionId: "s", prompt: "x", cwd: tmp });
    const result = processPostToolUse(handle, {
      sessionId: "s",
      cwd: tmp,
      toolName: "Bash",
      toolInput: { command: "rm -rf /" },
      toolResponse: { blocked: true, reason: "destructive" },
    });
    expect(result.status).toBe("blocked");
    const row = handle.raw
      .prepare(`SELECT error FROM tool_calls WHERE call_id = ?`)
      .get(result.callId) as { error: string };
    expect(row.error).toContain("destructive");
  });

  it("infers error status from { success: false }", () => {
    processPromptSubmit(handle, { sessionId: "s", prompt: "x", cwd: tmp });
    const result = processPostToolUse(handle, {
      sessionId: "s",
      cwd: tmp,
      toolName: "Read",
      toolInput: { file_path: "/missing" },
      toolResponse: { success: false, error: "ENOENT" },
    });
    expect(result.status).toBe("error");
  });

  it("synthesizes a turn when no prior prompt has been recorded", () => {
    // Tool call arrives before any prompt — defensive path.
    const result = processPostToolUse(handle, {
      sessionId: "lonely",
      cwd: tmp,
      toolName: "Read",
      toolInput: { file_path: "/x" },
    });
    expect(result.turnId).toBeGreaterThan(0);
    const turnCount = handle.raw
      .prepare(`SELECT COUNT(*) as c FROM turns WHERE session_id = 'lonely'`)
      .get() as { c: number };
    expect(turnCount.c).toBe(1);
  });
});

describe("end-to-end: prompt → tool → stop", () => {
  it("Stop hook closes the same turn the prompt opened, captures included", () => {
    const p = processPromptSubmit(handle, {
      sessionId: "s",
      prompt: "Audit the auth module.",
      cwd: tmp,
    });

    processPostToolUse(handle, {
      sessionId: "s",
      cwd: tmp,
      toolName: "Read",
      toolInput: { file_path: "src/auth.ts" },
      toolResponse: { success: true },
      durationMs: 8,
    });

    const stop = processStopHook(handle, {
      sessionId: "s",
      cwd: tmp,
      agentTextOverride:
        'Reviewed.\n|INSIGHT: "auth module has 3 unused branches"|\n|RULE: "always validate JWT exp"|',
    });

    expect(stop.turnId).toBe(p.turnId);
    expect(stop.capturesInserted).toBe(2);

    const session = handle.raw
      .prepare(`SELECT total_turns, total_capture_count FROM sessions WHERE session_id = 's'`)
      .get() as { total_turns: number; total_capture_count: number };
    expect(session.total_turns).toBe(1);
    expect(session.total_capture_count).toBe(2);

    const tools = handle.raw
      .prepare(`SELECT COUNT(*) as c FROM tool_calls WHERE turn_id = ?`)
      .get(p.turnId) as { c: number };
    expect(tools.c).toBe(1);
  });
});
