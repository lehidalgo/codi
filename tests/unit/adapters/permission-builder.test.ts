import { describe, it, expect } from "vitest";
import {
  extractDenyRules,
  buildStrongTextRestrictions,
} from "../../../src/adapters/permission-builder.js";
import type { ResolvedFlags } from "../../../src/types/flags.js";

function makeFlags(
  overrides: Record<string, unknown> = {},
): ResolvedFlags {
  const defaults: Record<string, unknown> = {
    allow_force_push: true,
    allow_file_deletion: true,
    allow_shell_commands: true,
    auto_commit: true,
    require_pr_review: false,
    test_before_commit: false,
    security_scan: false,
  };
  const merged = { ...defaults, ...overrides };
  const flags: ResolvedFlags = {};
  for (const [k, v] of Object.entries(merged)) {
    flags[k] = { value: v, mode: "enabled", source: "test", locked: false };
  }
  return flags;
}

describe("extractDenyRules", () => {
  it("returns all false for permissive flags", () => {
    const rules = extractDenyRules(makeFlags());
    expect(rules.forcePush).toBe(false);
    expect(rules.fileDeletion).toBe(false);
    expect(rules.shellCommands).toBe(false);
    expect(rules.autoCommit).toBe(false);
    expect(rules.requirePrReview).toBe(false);
    expect(rules.testBeforeCommit).toBe(false);
    expect(rules.securityScan).toBe(false);
  });

  it("detects deny rules from strict flags", () => {
    const rules = extractDenyRules(
      makeFlags({
        allow_force_push: false,
        allow_file_deletion: false,
        require_pr_review: true,
        test_before_commit: true,
        security_scan: true,
      }),
    );
    expect(rules.forcePush).toBe(true);
    expect(rules.fileDeletion).toBe(true);
    expect(rules.requirePrReview).toBe(true);
    expect(rules.testBeforeCommit).toBe(true);
    expect(rules.securityScan).toBe(true);
    expect(rules.shellCommands).toBe(false);
    expect(rules.autoCommit).toBe(false);
  });

  it("handles empty flags", () => {
    const rules = extractDenyRules({});
    expect(rules.forcePush).toBe(false);
    expect(rules.fileDeletion).toBe(false);
  });
});

describe("buildStrongTextRestrictions", () => {
  it("returns null when no restrictions apply", () => {
    const rules = extractDenyRules(makeFlags());
    expect(buildStrongTextRestrictions(rules)).toBeNull();
  });

  it("builds restrictions for blocked operations", () => {
    const rules = extractDenyRules(
      makeFlags({ allow_force_push: false, allow_file_deletion: false }),
    );
    const text = buildStrongTextRestrictions(rules)!;
    expect(text).toContain("## RESTRICTIONS (ENFORCED)");
    expect(text).toContain("BLOCKED: git push --force");
    expect(text).toContain("BLOCKED: rm -rf");
  });

  it("builds restrictions for required operations", () => {
    const rules = extractDenyRules(
      makeFlags({
        require_pr_review: true,
        test_before_commit: true,
        security_scan: true,
      }),
    );
    const text = buildStrongTextRestrictions(rules)!;
    expect(text).toContain("REQUIRED: All changes must go through pull request");
    expect(text).toContain("REQUIRED: Run the test suite");
    expect(text).toContain("REQUIRED: Run security scans");
  });

  it("includes auto-commit approval requirement", () => {
    const rules = extractDenyRules(makeFlags({ auto_commit: false }));
    const text = buildStrongTextRestrictions(rules)!;
    expect(text).toContain("REQUIRES APPROVAL: git commit");
  });

  it("includes shell command block", () => {
    const rules = extractDenyRules(
      makeFlags({ allow_shell_commands: false }),
    );
    const text = buildStrongTextRestrictions(rules)!;
    expect(text).toContain("BLOCKED: All shell commands");
  });
});
