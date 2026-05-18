/**
 * agent-configs-scan — pre-commit check. Warns when an agent config
 * file is staged so the user is aware the change ships to every
 * teammate / future codi-init. Advisory only. ADR-013 Paso 8.
 *
 * Refines capellai's scan-agent-configs.sh.
 */

import { execFileSync } from "node:child_process";
import type { GitHookContext, GitHookVerdict } from "./types.js";
import { failOpen } from "./types.js";

const AGENT_CONFIG_PATTERNS: readonly RegExp[] = [
  /^\.claude\//,
  /^\.codi\//,
  /^\.codex\//,
  /^\.cursor\//,
  /^\.windsurf\//,
  /^\.cline\//,
  /^CLAUDE\.md$/,
  /^AGENTS\.md$/,
  /^GEMINI\.md$/,
  /^\.cursorrules$/,
];

function stagedFiles(cwd: string): string[] {
  try {
    const out = execFileSync(
      "git",
      ["diff", "--cached", "--name-only", "--diff-filter=ACMR"],
      { cwd, encoding: "utf8" },
    );
    return out.split("\n").filter((line) => line.length > 0);
  } catch {
    return [];
  }
}

export function scanAgentConfigs(ctx: GitHookContext): GitHookVerdict {
  try {
    const files = stagedFiles(ctx.cwd);
    const hits = files.filter((f) => AGENT_CONFIG_PATTERNS.some((re) => re.test(f)));
    if (hits.length === 0) return { severity: "pass", check: "agent-configs-scan", messages: [] };
    return {
      severity: "warn",
      check: "agent-configs-scan",
      messages: [
        "Staged commit modifies agent configuration files:",
        ...hits.map((s) => "  " + s),
        "These changes affect every teammate after merge. Confirm intent before commit.",
      ],
    };
  } catch (err) {
    return failOpen("agent-configs-scan", err);
  }
}
