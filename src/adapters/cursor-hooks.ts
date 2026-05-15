import type { NormalizedConfig } from "../types/config.js";

interface CursorHook {
  command: string;
  args?: string[];
}

export interface CursorHooks {
  beforeShellExecution?: CursorHook[];
}

/**
 * Build the `.cursor/hooks.json` payload from Codi flags.
 *
 * Cursor's hook engine evaluates `beforeShellExecution` against the
 * proposed shell command on stdin. We emit a single hook that reads
 * stdin and rejects commands matching deny patterns derived from
 * `allow_force_push` and `allow_file_deletion`. Returns `null` when
 * no deny rules apply so the caller skips writing the file entirely.
 */
export function buildCursorHooks(config: NormalizedConfig): CursorHooks | null {
  const flagValue = (key: string): unknown => config.flags[key]?.value;
  const denyPatterns: string[] = [];

  if (flagValue("allow_force_push") === false) {
    denyPatterns.push("git push --force", "git push -f");
  }
  if (flagValue("allow_file_deletion") === false) {
    denyPatterns.push("rm -rf", "rm -r");
  }

  if (denyPatterns.length === 0) return null;

  const patternsArg = denyPatterns.join("|");
  const script = `read input; cmd=$(echo "$input" | grep -o '"command":"[^"]*"' | head -1 | sed 's/"command":"//;s/"//'); if echo "$cmd" | grep -qE '${patternsArg}'; then echo '{"permission":"deny"}'; else echo '{}'; fi`;

  return {
    beforeShellExecution: [{ command: "bash", args: ["-c", script] }],
  };
}
