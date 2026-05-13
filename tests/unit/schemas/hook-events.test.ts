/**
 * Smoke tests for the four Claude Code hook event payload schemas.
 *
 * Coverage threshold for `src/schemas/**` is 100% — this test file exists
 * so that hook-events.ts contributes its share of executed branches.
 */
import { describe, it, expect } from "vitest";
import {
  UserPromptSubmitPayloadSchema,
  PreToolUsePayloadSchema,
  PostToolUsePayloadSchema,
  StopPayloadSchema,
} from "#src/schemas/hook-events.js";

describe("UserPromptSubmitPayloadSchema", () => {
  it("accepts a minimal valid payload", () => {
    const r = UserPromptSubmitPayloadSchema.safeParse({ session_id: "s1", prompt: "hello" });
    expect(r.success).toBe(true);
  });

  it("preserves unknown keys (passthrough)", () => {
    const r = UserPromptSubmitPayloadSchema.safeParse({ session_id: "s1", new_field: "x" });
    expect(r.success).toBe(true);
    if (r.success) expect((r.data as Record<string, unknown>)["new_field"]).toBe("x");
  });

  it("accepts an empty object (all fields optional)", () => {
    expect(UserPromptSubmitPayloadSchema.safeParse({}).success).toBe(true);
  });
});

describe("PreToolUsePayloadSchema", () => {
  it("accepts tool_name + tool_input", () => {
    const r = PreToolUsePayloadSchema.safeParse({
      tool_name: "Bash",
      tool_input: { command: "ls" },
    });
    expect(r.success).toBe(true);
  });
});

describe("PostToolUsePayloadSchema", () => {
  it("extends PreToolUse with tool_response", () => {
    const r = PostToolUsePayloadSchema.safeParse({
      tool_name: "Bash",
      tool_response: { exitCode: 0 },
    });
    expect(r.success).toBe(true);
  });
});

describe("StopPayloadSchema", () => {
  it("accepts session_id + cwd", () => {
    const r = StopPayloadSchema.safeParse({ session_id: "s1", cwd: "/tmp" });
    expect(r.success).toBe(true);
  });
});
