#!/usr/bin/env tsx
/**
 * post-tool-use hook — invoked by Claude Code after every tool call.
 *
 * Reads JSON from stdin:
 *   { session_id, cwd, transcript_path, tool_name, tool_input, tool_response }
 *
 * Always exits 0 (this hook never blocks; it only records).
 *
 * Two responsibilities:
 *   1. Record the tool_call into brain.db (F6) — observability.
 *   2. Record incidental file changes (file changes the classifier deems
 *      incidental in execute/verify phases) into the manifest event log.
 */

import { readFileSync } from "node:fs";
import { buildContext, evaluatePostToolCall, type PostToolCall } from "#src/runtime/hook-logic.js";
import { recordIncidentalChange } from "#src/runtime/cli-handlers.js";
import { readFileSafe } from "#src/runtime/fs-utils.js";
import { openBrain, applyMigrations } from "#src/runtime/brain/index.js";
import { processPostToolUse } from "#src/runtime/capture/tool-hook.js";

interface HookPayload {
  session_id?: string;
  cwd?: string;
  transcript_path?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_response?: unknown;
}

function readStdin(): string {
  try {
    return readFileSync(0, "utf-8");
  } catch {
    return "";
  }
}

function main(): void {
  const raw = readStdin();
  if (raw.trim().length === 0) process.exit(0);

  let payload: HookPayload;
  try {
    payload = JSON.parse(raw) as HookPayload;
  } catch {
    process.exit(0);
  }
  if (typeof payload.tool_name !== "string" || !payload.tool_input) process.exit(0);

  const cwd = payload.cwd ?? process.cwd();

  // (1) Record the tool call into brain — observability layer.
  if (typeof payload.session_id === "string" && payload.session_id.length > 0) {
    try {
      const handle = openBrain();
      try {
        applyMigrations(handle.raw);
        processPostToolUse(handle, {
          sessionId: payload.session_id,
          cwd,
          toolName: payload.tool_name,
          toolInput: payload.tool_input,
          toolResponse: payload.tool_response,
          transcriptPath: payload.transcript_path,
        });
      } finally {
        handle.close();
      }
    } catch {
      // Hook is non-blocking — observability failures never break tool calls.
    }
  }

  // (2) Incidental change recording — workflow scope discipline.
  const call: PostToolCall = {
    tool_name: payload.tool_name,
    tool_input: payload.tool_input,
    ...(payload.tool_response !== undefined
      ? { tool_response: payload.tool_response as PostToolCall["tool_response"] }
      : {}),
  };
  const ctx = buildContext(cwd);
  const filePath = (call.tool_input["file_path"] ?? call.tool_input["path"]) as string | undefined;
  if (typeof filePath === "string") {
    const postContent = readFileSafe(filePath, cwd);
    const decision = evaluatePostToolCall(call, ctx, postContent);
    if (decision.recorded && decision.details) {
      try {
        recordIncidentalChange({
          filePath: decision.details.file_path,
          linesChanged: decision.details.lines_changed,
          classifierReason: decision.details.classifier_reason,
          author: { type: "system", id: "post-tool-use-hook" },
          cwd,
        });
      } catch {
        // Hook is non-blocking.
      }
    }
  }

  process.exit(0);
}

main();
