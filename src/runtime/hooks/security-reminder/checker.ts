/**
 * security-reminder checker.
 *
 * Wires the pattern set, the file-extension / comment filters, and the
 * per-session dedupe state into a single entry point that returns a
 * HookVerdict for the runtime hook runner.
 */

import type { HookContext, HookVerdict } from "#src/core/hooks/hook-artifact.js";
import { SECURITY_PATTERNS, type SecurityPattern } from "./patterns.js";
import { isAllowedForPattern, isSkippedExtension, stripCommentLines } from "./filters.js";
import { dedupeKey, loadShownWarnings, persistShownWarning, DEFAULT_STATE_DIR } from "./state.js";

const HOOK_NAME = "security-reminder";

const ELIGIBLE_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);

export interface CheckerOptions {
  stateDir?: string;
}

function noMatch(): HookVerdict {
  return { hookName: HOOK_NAME, matched: false, severity: "info" };
}

function matchesPattern(
  pattern: SecurityPattern,
  filePath: string,
  scrubbedContent: string,
): boolean {
  if (pattern.kind === "path") {
    return pattern.pathPredicate ? pattern.pathPredicate(filePath) : false;
  }
  if (!isAllowedForPattern(filePath, pattern.allowedExtensions)) return false;
  return (pattern.substrings ?? []).some((s) => scrubbedContent.includes(s));
}

export function evaluateSecurityReminder(ctx: HookContext, opts: CheckerOptions = {}): HookVerdict {
  if (!ctx.toolName || !ELIGIBLE_TOOLS.has(ctx.toolName)) return noMatch();
  if (!ctx.filePath || ctx.content === undefined) return noMatch();

  const skipForSubstring = isSkippedExtension(ctx.filePath);
  const scrubbed = stripCommentLines(ctx.content);
  const stateDir = opts.stateDir ?? DEFAULT_STATE_DIR;

  for (const pattern of SECURITY_PATTERNS) {
    // Path-based patterns ignore the global skiplist (e.g. GHA workflows are
    // .yaml, which is on the skiplist for substring matches).
    if (pattern.kind === "substring" && skipForSubstring) continue;
    if (!matchesPattern(pattern, ctx.filePath, scrubbed)) continue;

    const key = dedupeKey(ctx.sessionId, ctx.filePath, pattern.ruleId);
    const shown = loadShownWarnings(ctx.sessionId, stateDir);
    if (shown.has(key)) return noMatch();
    persistShownWarning(ctx.sessionId, key, stateDir);

    return {
      hookName: HOOK_NAME,
      matched: true,
      severity: "warn",
      ruleId: pattern.ruleId,
      message: pattern.reminder,
      suggestedAction: pattern.suggestedAction,
    };
  }

  return noMatch();
}
