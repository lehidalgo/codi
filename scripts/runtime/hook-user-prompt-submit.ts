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
        const handle = openBrain();
        try {
          applyMigrations(handle.raw);
          processPromptSubmit(handle, {
            sessionId: payload.session_id,
            prompt: payload.prompt,
            cwd: payload.cwd ?? cwd,
            transcriptPath: payload.transcript_path,
          });
        } finally {
          handle.close();
        }
      }
    } catch {
      // Hook is non-blocking — observability failures must not affect the
      // state-block emission below.
    }
  }

  // (2) Emit the state + capture-reminder + iron-laws blocks.
  const ctx = buildContext(cwd);
  const stateBlock = buildPromptStateBlock(ctx);
  const captureBlock = buildCaptureReminderBlock();
  let ironLawsBlock = "";
  try {
    const handle = openBrain();
    try {
      applyMigrations(handle.raw);
      ironLawsBlock = buildIronLawsBlock({
        outputMode: readPreferences(cwd).output_mode,
        gateState: readGateState(handle.raw),
      });
    } finally {
      handle.close();
    }
  } catch {
    // Iron-laws block is advisory — never suppress (1) or (2)'s state output.
  }

  const out = [captureBlock, stateBlock, ironLawsBlock].filter((s) => s.length > 0).join("\n\n");
  if (out.length > 0) {
    process.stdout.write(out + "\n");
  }
  process.exit(0);
}

main();
