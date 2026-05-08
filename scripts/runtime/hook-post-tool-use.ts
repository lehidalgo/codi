#!/usr/bin/env tsx
/**
 * post-tool-use hook — invoked by Claude Code after a tool call succeeds.
 *
 * Reads JSON from stdin: { tool_name, tool_input, tool_response }
 * Always exits 0 (this hook never blocks; it only records).
 *
 * Captures incidental file changes (changes outside scope.files_in_plan
 * that the classifier deems incidental) by appending an
 * incidental_change_recorded event to the manifest.
 */

import { readFileSync } from "node:fs";
import { buildContext, evaluatePostToolCall, type PostToolCall } from "../lib/hook-logic.js";
import { recordIncidentalChange } from "../lib/cli-handlers.js";
import { readFileSafe } from "../lib/fs-utils.js";

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

  let call: PostToolCall;
  try {
    call = JSON.parse(raw) as PostToolCall;
  } catch {
    process.exit(0);
  }
  if (typeof call.tool_name !== "string" || !call.tool_input) process.exit(0);

  const cwd = process.cwd();
  const ctx = buildContext(cwd);
  const filePath = (call.tool_input["file_path"] ?? call.tool_input["path"]) as string | undefined;
  if (typeof filePath !== "string") process.exit(0);

  // Read current on-disk content (post-edit).
  const postContent = readFileSafe(filePath, cwd);
  const decision = evaluatePostToolCall(call, ctx, postContent);

  if (!decision.recorded || !decision.details) {
    process.exit(0);
  }

  try {
    recordIncidentalChange({
      filePath: decision.details.file_path,
      linesChanged: decision.details.lines_changed,
      classifierReason: decision.details.classifier_reason,
      author: { type: "system", id: "post-tool-use-hook" },
      cwd,
    });
  } catch {
    // Hook is non-blocking — never fail the tool call due to recording.
  }

  process.exit(0);
}

main();
