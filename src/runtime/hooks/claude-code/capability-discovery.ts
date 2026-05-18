/**
 * Capability-discovery block — UserPromptSubmit hook contribution.
 *
 * Replaces capellai's `.claude/hooks/inject-capability-prompt.sh`
 * (ADR-013 Paso 8). Reminds the agent every turn to inspect installed
 * skills and propose a path BEFORE answering substantive requests.
 * Also reads the per-checkout output-mode override so users can disable
 * caveman without modifying the preset.
 *
 * The block is emitted as part of the existing user-prompt-submit
 * dispatcher's `stdout.write(out)` composition — it does NOT create a
 * new entry in `.claude/settings.json::hooks.UserPromptSubmit` or
 * `.codex/hooks.json`. Both adapters' hardcoded entries point to the
 * single command (`codi hook user-prompt-submit`); this module is
 * invoked INSIDE that command, regardless of which agent fired it.
 *
 * **Multi-agent (ADR-013)**: block content is agent-neutral so it lands
 * correctly in both Claude Code sessions and Codex sessions. The agent
 * knows its own filesystem layout — the block points at intent, not
 * file paths.
 *
 * Gating: silent no-op unless the codi-default preset's
 * `capability_discovery: true` flag is set (read via preferences).
 * Same convention as the existing ironLawsBlock + gateAdvisoryBlock.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Build the capability-discovery prompt block. Always-safe to call;
 * returns empty string when the feature is off so callers can join
 * unconditionally.
 */
export function buildCapabilityDiscoveryBlock(opts: {
  enabled: boolean;
}): string {
  if (!opts.enabled) return "";
  return `<capability-discovery>
Your installed skills, agents, and slash commands are listed in your
session's available-capabilities surface (system reminder block or
equivalent for your agent). That surface IS your capability catalog.

Before responding to a substantive request (anything asking for action,
analysis, planning, audit, research, design, or code change):

  1. Restate the user's intent in ONE phrase.
  2. Skim your available capabilities. Identify any whose description
     matches the intent.
  3. If 1+ capabilities apply, NAME THEM in your response and propose
     how to use them. Combine into a numbered route if 2+ apply.
  4. State which files/dirs you would touch before any non-trivial write.
  5. Confirm only when scope >3 files, destructive, or ambiguous.

DO NOT:
  - reply "I can help" without naming applicable capabilities
  - start executing when 2+ apply and the user has not chosen
  - ask the user which one to use (you decide, they confirm)
  - skip a capability because "I know the pattern" — skills/agents add
    hooks, captures, or guardrails you would not reproduce manually

SKIP discovery for: greetings, yes/no confirmations, pure conceptual
questions without action, mid-plan execution of already-approved steps,
P0 incidents.

The codi-agent-capability-discovery rule is the policy source; the
codi-default preset enforces it operationally via this block.
</capability-discovery>`;
}

/**
 * Per-checkout permanent override for output mode. Mirrors capellai's
 * inject-capability-prompt.sh check: if `.claude/output-mode.local`
 * contains "normal", emit an override block that cancels the codi
 * caveman default for this session.
 *
 * The output-tone-policy rule (ported in Paso 5) documents the full
 * precedence: \`?\` escape > .local file > Iron Law 8 default.
 */
export function buildOutputModeOverrideBlock(opts: { cwd: string }): string {
  const overrideFile = join(opts.cwd, ".claude", "output-mode.local");
  if (!existsSync(overrideFile)) return "";
  let mode = "";
  try {
    mode = readFileSync(overrideFile, "utf8").trim().toLowerCase();
  } catch {
    return "";
  }
  if (mode !== "normal") return "";
  return `<output-mode-override>normal</output-mode-override>
<output-mode-override-note>
The project caveman default is OVERRIDDEN for this checkout via
.claude/output-mode.local. Respond in normal prose with full articles
and natural phrasing. Remove .claude/output-mode.local to revert.
</output-mode-override-note>`;
}
