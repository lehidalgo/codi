/**
 * Unit tests for the Stop hook orchestrator (F6).
 *
 * The orchestrator is the heart of the capture pipeline:
 *   - reads the agent's last response from the transcript JSONL
 *   - parses |TYPE: "..."| markers
 *   - persists captures + closes the in-flight turn
 *
 * Tests bypass the transcript file via `agentTextOverride` for clarity;
 * a separate suite exercises `readLastAssistantMessage` against the
 * known JSONL shapes.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openBrain, applyMigrations, type BrainHandle } from "#src/runtime/brain/index.js";
import { ensureSession, openTurn, recordPrompt } from "#src/runtime/capture/session.js";
import { processStopHook, readLastAssistantMessage } from "#src/runtime/capture/stop-hook.js";

let tmp: string;
let handle: BrainHandle;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "codi-stop-hook-"));
  handle = openBrain({ dbPath: join(tmp, "brain.db") });
  applyMigrations(handle.raw);
});

afterEach(() => {
  handle.close();
  rmSync(tmp, { recursive: true, force: true });
});

describe("processStopHook", () => {
  it("inserts captures from agentTextOverride", () => {
    const result = processStopHook(handle, {
      sessionId: "s1",
      cwd: tmp,
      agentTextOverride: 'Done.\n|RULE: "always X"|\n|INSIGHT: "Y is Z"|\n',
    });
    expect(result.markerCount).toBe(2);
    expect(result.capturesInserted).toBe(2);
    expect(result.capturesSkipped).toBe(0);
    expect(result.turnId).toBeGreaterThan(0);

    const rows = handle.raw
      .prepare(`SELECT type, content FROM captures ORDER BY capture_id`)
      .all() as { type: string; content: string }[];
    expect(rows).toEqual([
      { type: "RULE", content: "always X" },
      { type: "INSIGHT", content: "Y is Z" },
    ]);
  });

  it("synthesizes a turn when UserPromptSubmit hook hasn't run", () => {
    // Brain is empty — no prior session, prompt, or turn.
    const result = processStopHook(handle, {
      sessionId: "s-fresh",
      cwd: tmp,
      agentTextOverride: '|RULE: "x"|',
    });
    expect(result.capturesInserted).toBe(1);
    const sessionRow = handle.raw
      .prepare(`SELECT total_turns, total_capture_count FROM sessions WHERE session_id = 's-fresh'`)
      .get() as { total_turns: number; total_capture_count: number };
    expect(sessionRow.total_turns).toBe(1);
    expect(sessionRow.total_capture_count).toBe(1);
  });

  it("reuses an in-flight turn opened by UserPromptSubmit", () => {
    ensureSession(handle.raw, {
      sessionId: "s",
      projectId: "p",
      agentType: "claude-code",
      workingDir: tmp,
    });
    const p = recordPrompt(handle.raw, { sessionId: "s", text: "user prompt" });
    const tid = openTurn(handle.raw, { sessionId: "s", promptId: p.promptId, turnNo: p.turnNo });

    const result = processStopHook(handle, {
      sessionId: "s",
      cwd: tmp,
      agentTextOverride: '|DECISION: "go with B"|',
    });
    expect(result.turnId).toBe(tid);

    const turnRow = handle.raw
      .prepare(`SELECT agent_text, duration_ms FROM turns WHERE turn_id = ?`)
      .get(tid) as { agent_text: string; duration_ms: number | null };
    expect(turnRow.agent_text).toContain("DECISION");
    expect(turnRow.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it("is idempotent — re-running the same Stop event does not double captures", () => {
    const args = {
      sessionId: "s",
      cwd: tmp,
      agentTextOverride: '|RULE: "always pin deps"|',
    } as const;
    const r1 = processStopHook(handle, args);
    const r2 = processStopHook(handle, args);
    expect(r1.capturesInserted).toBe(1);
    expect(r2.capturesInserted).toBe(0);
    // total_capture_count is per-session and should still be 1.
    const total = handle.raw.prepare(`SELECT total_capture_count FROM sessions`).get() as {
      total_capture_count: number;
    };
    expect(total.total_capture_count).toBe(1);
  });

  it("handles agent text with no markers gracefully", () => {
    const result = processStopHook(handle, {
      sessionId: "s",
      cwd: tmp,
      agentTextOverride: "Plain prose without any markers.",
    });
    expect(result.markerCount).toBe(0);
    expect(result.capturesInserted).toBe(0);
    expect(result.turnId).toBeGreaterThan(0);
  });

  it("promotes markers with non-canonical types to OBSERVATION", () => {
    const result = processStopHook(handle, {
      sessionId: "s",
      cwd: tmp,
      agentTextOverride: '|FAKETYPE: "x"|\n|RULE: "real"|',
    });
    expect(result.markerCount).toBe(2);
    expect(result.capturesInserted).toBe(2);
  });
});

describe("readLastAssistantMessage", () => {
  it("returns empty string when the transcript is missing", () => {
    expect(readLastAssistantMessage(join(tmp, "missing.jsonl"))).toBe("");
  });

  it("extracts text from {role:'assistant', content:'...'} records", () => {
    const path = join(tmp, "t1.jsonl");
    writeFileSync(
      path,
      [
        JSON.stringify({ role: "user", content: "hello" }),
        JSON.stringify({ role: "assistant", content: "first response" }),
        JSON.stringify({ role: "user", content: "follow-up" }),
        JSON.stringify({ role: "assistant", content: "second response" }),
      ].join("\n"),
      "utf-8",
    );
    expect(readLastAssistantMessage(path)).toBe("second response");
  });

  it("flattens content arrays of {type:'text', text:'...'}", () => {
    const path = join(tmp, "t2.jsonl");
    writeFileSync(
      path,
      JSON.stringify({
        role: "assistant",
        content: [
          { type: "text", text: "Part one." },
          { type: "tool_use", input: { x: 1 } },
          { type: "text", text: "Part two." },
        ],
      }),
      "utf-8",
    );
    expect(readLastAssistantMessage(path)).toBe("Part one.\nPart two.");
  });

  it("handles {type:'assistant', message:{content:[...]}} records", () => {
    const path = join(tmp, "t3.jsonl");
    writeFileSync(
      path,
      JSON.stringify({
        type: "assistant",
        message: {
          content: [{ type: "text", text: "Nested response." }],
        },
      }),
      "utf-8",
    );
    expect(readLastAssistantMessage(path)).toBe("Nested response.");
  });

  it("skips malformed JSON lines without throwing", () => {
    const path = join(tmp, "t4.jsonl");
    writeFileSync(
      path,
      [
        "{not-valid-json",
        JSON.stringify({ role: "assistant", content: "valid response" }),
        "another junk line",
      ].join("\n"),
      "utf-8",
    );
    expect(readLastAssistantMessage(path)).toBe("valid response");
  });
});
