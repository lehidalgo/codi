#!/usr/bin/env tsx
/**
 * pre-tool-use hook — invoked by Claude Code before every tool call.
 *
 * Reads JSON from stdin: { tool_name, tool_input }
 * Exit codes:
 *   0 — allow the tool call
 *   2 — block the tool call. stderr is delivered to Claude as feedback.
 */

import { readFileSync } from "node:fs";
import { buildContext, evaluateToolCall, type ToolCall } from "../lib/hook-logic.js";

function readStdin(): string {
  try {
    return readFileSync(0, "utf-8");
  } catch {
    return "";
  }
}

function main(): void {
  const raw = readStdin();
  if (raw.trim().length === 0) {
    process.exit(0);
  }

  let call: ToolCall;
  try {
    call = JSON.parse(raw) as ToolCall;
  } catch {
    // Malformed input → fail open. Hook misuse should not block work.
    process.exit(0);
  }

  if (typeof call.tool_name !== "string" || !call.tool_input) {
    process.exit(0);
  }

  const ctx = buildContext(process.cwd());
  const decision = evaluateToolCall(call, ctx);

  if (decision.allow) {
    process.exit(0);
  }

  // Blocking decision — emit structured feedback.
  console.error(`[devloop pre-tool-use] BLOCKED: ${decision.reason}`);
  console.error(`[devloop pre-tool-use] Suggested action: ${decision.suggested_action}`);
  process.exit(2);
}

main();
