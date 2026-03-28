import type { ResolvedFlags } from "../types/flags.js";

export interface PermissionDenyRules {
  forcePush: boolean;
  fileDeletion: boolean;
  shellCommands: boolean;
  autoCommit: boolean;
  requirePrReview: boolean;
  testBeforeCommit: boolean;
  securityScan: boolean;
}

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

export function buildStrongTextRestrictions(
  rules: PermissionDenyRules,
): string | null {
  const lines: string[] = [];

  if (rules.forcePush) {
    lines.push(
      "BLOCKED: git push --force (or -f) — force push is disabled by project policy",
    );
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
    lines.push(
      "REQUIRED: All changes must go through pull request review before merging",
    );
  }
  if (rules.testBeforeCommit) {
    lines.push("REQUIRED: Run the test suite before every commit");
  }
  if (rules.securityScan) {
    lines.push(
      "REQUIRED: Run security scans (npm audit / pip audit) before merging",
    );
  }

  if (lines.length === 0) return null;
  return "## RESTRICTIONS (ENFORCED)\n\n" + lines.join("\n");
}
