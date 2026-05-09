#!/usr/bin/env tsx
/**
 * stop hook — invoked by Claude Code when the assistant finishes a turn.
 *
 * Stdin payload: { session_id, cwd, transcript_path, hook_event_name }.
 * Always exits 0 — capture failures never block the user's session.
 *
 * Responsibility: parse `|TYPE: "..."|` markers from the agent's last
 * response (read from transcript_path), persist them into brain.db,
 * close the in-flight turn (set agent_text + duration_ms).
 */

import { readFileSync } from "node:fs";
import { openBrain, applyMigrations } from "#src/runtime/brain/index.js";
import { processStopHook } from "#src/runtime/capture/stop-hook.js";

interface HookPayload {
  session_id?: string;
  cwd?: string;
  transcript_path?: string;
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
  if (typeof payload.session_id !== "string" || payload.session_id.length === 0) process.exit(0);

  try {
    const handle = openBrain();
    try {
      applyMigrations(handle.raw);
      processStopHook(handle, {
        sessionId: payload.session_id,
        cwd: payload.cwd ?? process.cwd(),
        transcriptPath: payload.transcript_path,
      });
    } finally {
      handle.close();
    }
  } catch {
    // Hook is non-blocking — capture failures never break the session.
  }

  process.exit(0);
}

main();
