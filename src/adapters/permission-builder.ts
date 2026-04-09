import type { ResolvedFlags } from "../types/flags.js";

/**
 * Boolean summary of which operations are denied or required by the active flags.
 * Used to render the `## RESTRICTIONS (ENFORCED)` section for compatible adapters.
 */
export interface PermissionDenyRules {
  /** `true` when `allow_force_push` is explicitly set to `false`. */
  forcePush: boolean;
  /** `true` when `allow_file_deletion` is explicitly set to `false`. */
  fileDeletion: boolean;
  /** `true` when `allow_shell_commands` is explicitly set to `false`. */
  shellCommands: boolean;
  /** `true` when `auto_commit` is explicitly set to `false`. */
  autoCommit: boolean;
  /** `true` when `require_pr_review` is `true`. */
  requirePrReview: boolean;
  /** `true` when `test_before_commit` is `true`. */
  testBeforeCommit: boolean;
  /** `true` when `security_scan` is `true`. */
  securityScan: boolean;
}

/**
 * Derive a {@link PermissionDenyRules} summary from the resolved flags.
 *
 * @param flags - Fully resolved flags from the project configuration.
 * @returns Boolean deny-rule object indicating which operations are restricted.
 */
export function extractDenyRules(flags: ResolvedFlags): PermissionDenyRules {
  const val = (key: string): unknown => flags[key]?.value;
  return {
    forcePush: val("allow_force_push") === false,
    fileDeletion: val("allow_file_deletion") === false,
    shellCommands: val("allow_shell_commands") === false,
    autoCommit: val("auto_commit") === false,
    requirePrReview: val("require_pr_review") === true,
    testBeforeCommit: val("test_before_commit") === true,
    securityScan: val("security_scan") === true,
  };
}

/**
 * Render active deny rules as a `## RESTRICTIONS (ENFORCED)` Markdown block.
 *
 * Each active rule contributes one line prefixed with `BLOCKED:`, `REQUIRED:`,
 * or `REQUIRES APPROVAL:`. This section is injected at the top of the agent's
 * instruction file so restrictions are impossible to miss.
 *
 * @param rules - Deny-rule summary from {@link extractDenyRules}.
 * @returns Markdown string if any rules are active, or `null` if none apply.
 */
export function buildStrongTextRestrictions(rules: PermissionDenyRules): string | null {
  const lines: string[] = [];

  if (rules.forcePush) {
    lines.push("BLOCKED: git push --force (or -f) — force push is disabled by project policy");
  }
  if (rules.fileDeletion) {
    lines.push("BLOCKED: rm -rf, rm -r — file deletion is disabled");
  }
  if (rules.shellCommands) {
    lines.push("BLOCKED: All shell commands — shell access is disabled");
  }
  if (rules.autoCommit) {
    lines.push("REQUIRES APPROVAL: git commit — always ask before committing");
  }
  if (rules.requirePrReview) {
    lines.push("REQUIRED: All changes must go through pull request review before merging");
  }
  if (rules.testBeforeCommit) {
    lines.push("REQUIRED: Run the test suite before every commit");
  }
  if (rules.securityScan) {
    lines.push("REQUIRED: Run security scans (npm audit / pip audit) before merging");
  }

  if (lines.length === 0) return null;
  return "## RESTRICTIONS (ENFORCED)\n\n" + lines.join("\n");
}
