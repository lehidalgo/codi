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

import { buildContext, buildPromptStateBlock } from "../lib/hook-logic.js";

function main(): void {
  const ctx = buildContext(process.cwd());
  const block = buildPromptStateBlock(ctx);
  if (block.length > 0) {
    process.stdout.write(block + "\n");
  }
  process.exit(0);
}

main();
