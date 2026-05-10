#!/usr/bin/env tsx
/**
 * user-prompt-submit hook — invoked by Claude Code each time the user
 * submits a prompt. Stdout is concatenated to the prompt before it
 * reaches the agent.
 *
 * Two responsibilities:
 *   1. Capture the prompt into brain.db (F6) — opens a turn that the
 *      Stop hook closes.
 *   2. Print a `<workflow-state>` block + capture reminder so the agent
 *      stays aligned with phase rules and Iron Law 9.
 *
 * Stdin payload: { session_id, prompt, cwd, transcript_path } (Claude Code).
 * The hook is non-blocking — brain failures never suppress the state block.
 */

import { readFileSync } from "node:fs";
import {
  buildContext,
  buildPromptStateBlock,
  buildCaptureReminderBlock,
} from "#src/runtime/hook-logic.js";
import { openBrain, applyMigrations } from "#src/runtime/brain/index.js";
import { BrainEventLog } from "#src/runtime/brain-event-log.js";
import { processPromptSubmit } from "#src/runtime/capture/prompt-hook.js";
import { buildIronLawsBlock, readGateState } from "#src/runtime/iron-laws-enforcer.js";
import { readPreferences } from "#src/runtime/preferences.js";

interface HookPayload {
  session_id?: string;
  prompt?: string;
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
  const cwd = process.cwd();
  const captureBlock = buildCaptureReminderBlock();
  let stateBlock = "";
  let ironLawsBlock = "";

  // Single brain handle for the whole hook invocation. Previously this
  // function opened brain.db up to 5 times per fire (capture, buildContext,
  // countPendingScopeProposals, describePendingTransition, iron-laws).
  // Wrap into a non-owning BrainEventLog so the helpers can reuse it.
  let handle: ReturnType<typeof openBrain> | null = null;
  try {
    handle = openBrain();
    applyMigrations(handle.raw);
    const log = BrainEventLog.wrap(handle);

    // (1) Try to capture the prompt. Failure here NEVER suppresses (2).
    const raw = readStdin();
    if (raw.trim().length > 0) {
      try {
        const payload = JSON.parse(raw) as HookPayload;
        if (
          typeof payload.session_id === "string" &&
          payload.session_id.length > 0 &&
          typeof payload.prompt === "string"
        ) {
          processPromptSubmit(handle, {
            sessionId: payload.session_id,
            prompt: payload.prompt,
            cwd: payload.cwd ?? cwd,
            transcriptPath: payload.transcript_path,
          });
        }
      } catch {
        // Hook is non-blocking — observability failures must not affect the
        // state-block emission below.
      }
    }

    // (2) Emit the state + iron-laws blocks (capture block is static and
    // already built above).
    const ctx = buildContext(cwd, log);
    stateBlock = buildPromptStateBlock(ctx, log);
    ironLawsBlock = buildIronLawsBlock({
      outputMode: readPreferences(cwd).output_mode,
      gateState: readGateState(handle.raw),
    });
  } catch {
    // Brain unavailable — emit only the static capture block so the agent
    // still gets Iron Law 9 reminder.
  } finally {
    if (handle !== null) handle.close();
  }

  const out = [captureBlock, stateBlock, ironLawsBlock].filter((s) => s.length > 0).join("\n\n");
  if (out.length > 0) {
    process.stdout.write(out + "\n");
  }
  process.exit(0);
}

main();
