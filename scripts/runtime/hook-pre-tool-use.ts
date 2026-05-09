#!/usr/bin/env tsx
/**
 * pre-tool-use hook — invoked by Claude Code before every tool call.
 *
 * Stdin payload (Claude Code):
 *   { session_id, cwd, transcript_path, tool_name, tool_input, hook_event_name }
 *
 * Exit codes:
 *   0 — allow the tool call (stderr may carry an advisory pull-reminder).
 *   2 — block the tool call. stderr is delivered to Claude as feedback.
 *
 * Decision sources (in order):
 *   1. The phase/scope rules in src/runtime/hook-logic.ts (legacy).
 *   2. Iron Law 7 (commit approval) — blocks `git commit/push/etc` unless an
 *      approval token appears in the user's recent prompts.
 *   3. Iron Law 5 (pull before patch) — for mutating edit tools, advisory
 *      reminder when the brain has not been read in >60s.
 */

import { readFileSync } from "node:fs";
import { buildContext, evaluateToolCall, type ToolCall } from "#src/runtime/hook-logic.js";
import { openBrain, applyMigrations } from "#src/runtime/brain/index.js";
import {
  decideGitCommand,
  readLastPromptTs,
  readRecentPrompts,
  shouldRecommendPull,
  buildPullReminder,
} from "#src/runtime/iron-laws-enforcer.js";

interface HookPayload {
  session_id?: string;
  cwd?: string;
  transcript_path?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
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
    // Malformed input → fail open. Hook misuse should not block work.
    process.exit(0);
  }
  if (typeof payload.tool_name !== "string" || !payload.tool_input) process.exit(0);

  const cwd = payload.cwd ?? process.cwd();
  const call: ToolCall = { tool_name: payload.tool_name, tool_input: payload.tool_input };

  // (1) Legacy phase/scope guardrail — blocks edits outside scope, etc.
  const ctx = buildContext(cwd);
  const decision = evaluateToolCall(call, ctx);
  if (!decision.allow) {
    console.error(`[codi pre-tool-use] BLOCKED: ${decision.reason}`);
    console.error(`[codi pre-tool-use] Suggested action: ${decision.suggested_action}`);
    process.exit(2);
  }

  // (2) Iron Law 7 — git mutation requires approval. Brain is the source of
  // truth for recent prompts; the hook fails open when brain is unreachable
  // so a misconfigured plugin never blocks a healthy repo.
  if (call.tool_name === "Bash") {
    const command = (call.tool_input["command"] ?? "") as string;
    if (typeof command === "string" && command.length > 0) {
      try {
        const handle = openBrain();
        try {
          applyMigrations(handle.raw);
          const recentPrompts = readRecentPrompts(handle.raw, {
            sessionId: payload.session_id,
            limit: 5,
          });
          const verdict = decideGitCommand({ bashCommand: command, recentPrompts });
          if (!verdict.allowed) {
            console.error(`[codi pre-tool-use] BLOCKED (Iron Law 7): ${verdict.reason}`);
            console.error(
              "[codi pre-tool-use] Ask the user before running this; an explicit prompt mentioning commit/push/merge/tag/release counts as approval.",
            );
            process.exit(2);
          }
        } finally {
          handle.close();
        }
      } catch {
        // Brain unreachable → fail open. Iron Law 7 is advisory in that mode.
      }
    }
  }

  // (3) Iron Law 5 — advisory pull-reminder for mutating edit tools.
  if (
    typeof payload.session_id === "string" &&
    payload.session_id.length > 0 &&
    (call.tool_name === "Edit" || call.tool_name === "Write" || call.tool_name === "NotebookEdit")
  ) {
    try {
      const handle = openBrain();
      try {
        applyMigrations(handle.raw);
        const lastTs = readLastPromptTs(handle.raw, payload.session_id);
        if (
          shouldRecommendPull({
            lastBrainReadTs: lastTs,
            nowTs: Date.now(),
            toolName: call.tool_name,
          })
        ) {
          console.error(buildPullReminder());
          // Advisory: still allow.
        }
      } finally {
        handle.close();
      }
    } catch {
      // Reminder is advisory — failure to read brain just suppresses it.
    }
  }

  process.exit(0);
}

main();
