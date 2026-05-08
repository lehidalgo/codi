#!/usr/bin/env tsx
/**
 * user-prompt-submit hook — invoked by Claude Code each time the user
 * submits a prompt. Stdout is concatenated to the prompt before it
 * reaches the agent.
 *
 * Output: a <workflow-state> block when there is an active workflow,
 * empty string otherwise. The block reminds the agent of the current
 * phase, scope, pending proposals, and the rules in force.
 */

import {
  buildContext,
  buildPromptStateBlock,
  buildCaptureReminderBlock,
} from "../../src/runtime/hook-logic.js";

function main(): void {
  const ctx = buildContext(process.cwd());
  const stateBlock = buildPromptStateBlock(ctx);
  const captureBlock = buildCaptureReminderBlock();
  // Capture reminder fires every turn (Iron Law 9 reinforcement).
  // State block fires only when an active workflow exists.
  const out = [captureBlock, stateBlock].filter((s) => s.length > 0).join("\n\n");
  if (out.length > 0) {
    process.stdout.write(out + "\n");
  }
  process.exit(0);
}

main();
