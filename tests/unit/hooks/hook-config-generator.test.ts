import { describe, it, expect } from "vitest";
import { generateHooksConfig } from "#src/core/hooks/hook-config-generator.js";
import { FLAG_CATALOG } from "#src/core/flags/flag-catalog.js";
import type { ResolvedFlags } from "#src/types/flags.js";

function makeFlags(overrides: Record<string, { value: unknown; mode: string }>): ResolvedFlags {
  const base: ResolvedFlags = {
    security_scan: {
      value: true,
      mode: "enabled",
      source: "default",
      locked: false,
    },
    type_checking: {
      value: "strict",
      mode: "enabled",
      source: "default",
      locked: false,
    },
  };
  for (const [key, val] of Object.entries(overrides)) {
    base[key] = { ...val, source: "test", locked: false };
  }
  return base;
}

describe("generateHooksConfig", () => {
  it("generates hooks for typescript", () => {
    const config = generateHooksConfig(makeFlags({}), ["typescript"]);
    expect(config.hooks.length).toBeGreaterThan(0);
    expect(config.hooks.map((h) => h.name)).toContain("eslint");
    expect(config.hooks.map((h) => h.name)).toContain("tsc");
  });

  it("generates hooks for python (default type checker = basedpyright)", () => {
    const config = generateHooksConfig(makeFlags({}), ["python"]);
    expect(config.hooks.map((h) => h.name)).toContain("ruff-check");
    // Default Python type-checker is now basedpyright (the others get filtered).
    expect(config.hooks.map((h) => h.name)).toContain("basedpyright");
    expect(config.hooks.map((h) => h.name)).not.toContain("mypy");
    expect(config.hooks.map((h) => h.name)).not.toContain("pyright");
  });

  it("python_type_checker=mypy keeps only mypy", () => {
    const flags = makeFlags({ python_type_checker: { value: "mypy", mode: "enabled" } });
    const config = generateHooksConfig(flags, ["python"]);
    const names = config.hooks.map((h) => h.name);
    expect(names).toContain("mypy");
    expect(names).not.toContain("basedpyright");
    expect(names).not.toContain("pyright");
  });

  it("python_type_checker=pyright keeps only pyright", () => {
    const flags = makeFlags({ python_type_checker: { value: "pyright", mode: "enabled" } });
    const config = generateHooksConfig(flags, ["python"]);
    const names = config.hooks.map((h) => h.name);
    expect(names).toContain("pyright");
    expect(names).not.toContain("mypy");
    expect(names).not.toContain("basedpyright");
  });

  it("python_type_checker=off drops all three checkers", () => {
    const flags = makeFlags({ python_type_checker: { value: "off", mode: "enabled" } });
    const config = generateHooksConfig(flags, ["python"]);
    const names = config.hooks.map((h) => h.name);
    expect(names).not.toContain("mypy");
    expect(names).not.toContain("basedpyright");
    expect(names).not.toContain("pyright");
  });

  it("excludes typecheck hooks when type_checking is off", () => {
    const flags = makeFlags({
      type_checking: { value: "off", mode: "enabled" },
    });
    const config = generateHooksConfig(flags, ["typescript"]);
    expect(config.hooks.map((h) => h.name)).not.toContain("tsc");
  });

  it("includes typecheck hooks when type_checking is strict", () => {
    const flags = makeFlags({
      type_checking: { value: "strict", mode: "enabled" },
    });
    const config = generateHooksConfig(flags, ["typescript"]);
    expect(config.hooks.map((h) => h.name)).toContain("tsc");
  });

  it("enables secret scan when security_scan flag is enabled", () => {
    const config = generateHooksConfig(makeFlags({}), ["typescript"]);
    expect(config.secretScan).toBe(true);
  });

  it("disables secret scan when security_scan flag is disabled", () => {
    const flags = makeFlags({
      security_scan: { value: false, mode: "disabled" },
    });
    const config = generateHooksConfig(flags, ["typescript"]);
    expect(config.secretScan).toBe(false);
  });

  it("always enables file-size-check hook", () => {
    const config = generateHooksConfig(makeFlags({}), []);
    expect(config.fileSizeCheck).toBe(true);
  });

  it("deduplicates hooks across languages", () => {
    const config = generateHooksConfig(makeFlags({}), ["typescript", "javascript"]);
    const eslintCount = config.hooks.filter((h) => h.name === "eslint").length;
    expect(eslintCount).toBe(1);
  });

  it("returns only global hooks for unknown language", () => {
    const config = generateHooksConfig(makeFlags({}), ["cobol"]);
    const langHooks = config.hooks.filter(
      (h) =>
        h.name !== "gitleaks" &&
        h.name !== "commitlint" &&
        h.name !== "secret-scan" &&
        h.name !== "file-size-check" &&
        h.name !== "artifact-validate" &&
        h.name !== "import-depth-check" &&
        h.name !== "skill-yaml-validate" &&
        h.name !== "skill-resource-check" &&
        h.name !== "skill-path-wrap-check" &&
        h.name !== "staged-junk-check" &&
        h.name !== "template-wiring-check" &&
        h.name !== "doc-naming-check" &&
        h.name !== "version-bump" &&
        h.name !== "brand-skill-validate",
    );
    expect(langHooks).toHaveLength(0);
  });

  it("combines hooks from multiple languages", () => {
    const config = generateHooksConfig(makeFlags({}), ["typescript", "python"]);
    const names = config.hooks.map((h) => h.name);
    expect(names).toContain("eslint");
    expect(names).toContain("ruff-check");
  });

  it("includes bandit for python when security_scan is enabled", () => {
    const config = generateHooksConfig(makeFlags({}), ["python"]);
    expect(config.hooks.map((h) => h.name)).toContain("bandit");
  });

  it("excludes bandit when security_scan is disabled", () => {
    const flags = makeFlags({
      security_scan: { value: false, mode: "disabled" },
    });
    const config = generateHooksConfig(flags, ["python"]);
    expect(config.hooks.map((h) => h.name)).not.toContain("bandit");
  });

  it("includes gosec for go when security_scan is enabled", () => {
    const config = generateHooksConfig(makeFlags({}), ["go"]);
    expect(config.hooks.map((h) => h.name)).toContain("gosec");
  });

  it("stamps language field on language hooks", () => {
    const config = generateHooksConfig(makeFlags({}), ["python"]);
    const ruff = config.hooks.find((h) => h.name === "ruff-check");
    expect(ruff?.language).toBe("python");
  });

  it('language field is "global" on global meta hooks', () => {
    const config = generateHooksConfig(makeFlags({}), ["python"]);
    const secretScan = config.hooks.find((h) => h.name === "secret-scan");
    expect(secretScan?.language).toBe("global");
  });

  it("enables test hooks when test_before_commit is true", () => {
    const flags = makeFlags({
      test_before_commit: { value: true, mode: "enabled" },
    });
    const config = generateHooksConfig(flags, ["typescript"]);
    expect(config.testBeforeCommit).toBe(true);
    expect(config.hooks.map((h) => h.name)).toContain("test-ts");
  });

  it("disables test hooks when test_before_commit is false", () => {
    const flags = makeFlags({
      test_before_commit: { value: false, mode: "enabled" },
    });
    const config = generateHooksConfig(flags, ["typescript"]);
    expect(config.testBeforeCommit).toBe(false);
    expect(config.hooks.map((h) => h.name)).not.toContain("test-ts");
  });

  it("disables test hooks when test_before_commit mode is disabled", () => {
    const flags = makeFlags({
      test_before_commit: { value: true, mode: "disabled" },
    });
    const config = generateHooksConfig(flags, ["python"]);
    expect(config.testBeforeCommit).toBe(false);
    expect(config.hooks.map((h) => h.name)).not.toContain("test-py");
  });

  it("enables docCheck when require_documentation is true", () => {
    const flags = makeFlags({
      require_documentation: { value: true, mode: "enabled" },
    });
    const config = generateHooksConfig(flags, []);
    expect(config.docCheck).toBe(true);
  });

  it("disables docCheck when require_documentation is false", () => {
    const flags = makeFlags({
      require_documentation: { value: false, mode: "enabled" },
    });
    const config = generateHooksConfig(flags, []);
    expect(config.docCheck).toBe(false);
  });

  it("disables docCheck when require_documentation mode is disabled", () => {
    const flags = makeFlags({
      require_documentation: { value: true, mode: "disabled" },
    });
    const config = generateHooksConfig(flags, []);
    expect(config.docCheck).toBe(false);
  });

  it("uses custom doc_protected_branches from flags", () => {
    const flags = makeFlags({
      require_documentation: { value: true, mode: "enabled" },
      doc_protected_branches: { value: ["main", "staging"], mode: "enabled" },
    });
    const config = generateHooksConfig(flags, []);
    expect(config.docProtectedBranches).toEqual(["main", "staging"]);
  });

  it("falls back to default doc_protected_branches when flag is absent", () => {
    const config = generateHooksConfig(makeFlags({}), []);
    expect(config.docProtectedBranches).toEqual(["main", "develop", "release/*"]);
  });

  it("test hooks appear after all non-test hooks", () => {
    const flags = makeFlags({ test_before_commit: { value: true, mode: "enabled" } });
    const config = generateHooksConfig(flags, ["typescript", "python"]);
    const names = config.hooks.map((h) => h.name);
    const testIndices = names
      .map((n, i) => ({ n, i }))
      .filter(({ n }) => n.startsWith("test-"))
      .map(({ i }) => i);
    const nonTestIndices = names
      .map((n, i) => ({ n, i }))
      .filter(({ n }) => !n.startsWith("test-"))
      .map(({ i }) => i);
    expect(testIndices.length).toBeGreaterThan(0);
    const lastNonTest = Math.max(...nonTestIndices);
    const firstTest = Math.min(...testIndices);
    expect(firstTest).toBeGreaterThan(lastNonTest);
  });

  it("staged-junk-check appears before test hooks and language hooks", () => {
    const flags = makeFlags({ test_before_commit: { value: true, mode: "enabled" } });
    const config = generateHooksConfig(flags, ["typescript"]);
    const names = config.hooks.map((h) => h.name);
    const junkIdx = names.indexOf("staged-junk-check");
    const eslintIdx = names.indexOf("eslint");
    const testIdx = names.indexOf("test-ts");
    expect(junkIdx).toBeLessThan(eslintIdx);
    expect(junkIdx).toBeLessThan(testIdx);
  });

  it("always enables brandSkillValidation", () => {
    const config = generateHooksConfig(makeFlags({}), []);
    expect(config.brandSkillValidation).toBe(true);
  });

  it("includes brand-skill-validate hook in Stage 2", () => {
    const config = generateHooksConfig(makeFlags({}), []);
    expect(config.hooks.map((h) => h.name)).toContain("brand-skill-validate");
  });

  it("brand-skill-validate appears before language hooks", () => {
    const config = generateHooksConfig(makeFlags({}), ["typescript"]);
    const brandIdx = config.hooks.findIndex((h) => h.name === "brand-skill-validate");
    const eslintIdx = config.hooks.findIndex((h) => h.name === "eslint");
    expect(brandIdx).toBeGreaterThanOrEqual(0);
    expect(brandIdx).toBeLessThan(eslintIdx);
  });
});

describe("FLAG_CATALOG hook field sync", () => {
  // This test guards against FLAG_CATALOG.hook drifting from the actual hook
  // wiring in hook-config-generator.ts. If a flag has hook: "something" in the
  // catalog, the generator must actually respect that flag when deciding whether
  // to activate hooks.

  it("flags with non-null hook field are respected by the generator", () => {
    // Flags that declare a hook in the catalog must be able to disable their
    // associated hooks when set to false/off/disabled.

    // test_before_commit -> test hooks
    const noTests = makeFlags({ test_before_commit: { value: false, mode: "enabled" } });
    const noTestsCfg = generateHooksConfig(noTests, ["typescript", "python"]);
    expect(noTestsCfg.testBeforeCommit).toBe(false);

    // security_scan -> secret scan + language security scanners
    const noSec = makeFlags({ security_scan: { value: false, mode: "enabled" } });
    const noSecCfg = generateHooksConfig(noSec, ["python", "go"]);
    expect(noSecCfg.secretScan).toBe(false);
    expect(noSecCfg.hooks.map((h) => h.name)).not.toContain("bandit");
    expect(noSecCfg.hooks.map((h) => h.name)).not.toContain("gosec");

    // type_checking -> tsc / pyright
    const noTypes = makeFlags({ type_checking: { value: "off", mode: "enabled" } });
    const noTypesCfg = generateHooksConfig(noTypes, ["typescript", "python"]);
    expect(noTypesCfg.hooks.map((h) => h.name)).not.toContain("tsc");
    expect(noTypesCfg.hooks.map((h) => h.name)).not.toContain("pyright");

    // require_documentation -> docCheck
    const noDoc = makeFlags({ require_documentation: { value: false, mode: "enabled" } });
    const noDocCfg = generateHooksConfig(noDoc, []);
    expect(noDocCfg.docCheck).toBe(false);
  });

  it("includes gitleaks in hook list when security_scan is enabled", () => {
    const config = generateHooksConfig(makeFlags({}), []);
    const gitleaks = config.hooks.find((h) => h.name === "gitleaks");
    expect(gitleaks).toBeDefined();
    expect(gitleaks!.category).toBe("security");
  });

  it("places gitleaks before language hooks", () => {
    const config = generateHooksConfig(makeFlags({}), ["typescript"]);
    const gitleaksIdx = config.hooks.findIndex((h) => h.name === "gitleaks");
    const eslintIdx = config.hooks.findIndex((h) => h.name === "eslint");
    expect(gitleaksIdx).toBeGreaterThanOrEqual(0);
    expect(gitleaksIdx).toBeLessThan(eslintIdx);
  });

  it("excludes gitleaks when security_scan is disabled", () => {
    const flags = makeFlags({
      security_scan: { value: false, mode: "disabled" },
    });
    const config = generateHooksConfig(flags, []);
    const gitleaks = config.hooks.find((h) => h.name === "gitleaks");
    expect(gitleaks).toBeUndefined();
  });

  it("all flags with hook != null in catalog have a matching generator effect", () => {
    const flagsWithHooks = Object.entries(FLAG_CATALOG)
      .filter(([, spec]) => spec.hook !== null)
      .map(([name]) => name);

    // Every flagged flag must be in this known set — update this list if a new
    // hook-controlling flag is added to the catalog.
    const expectedHookFlags = [
      "test_before_commit",
      "security_scan",
      "type_checking",
      "require_documentation",
      "doc_protected_branches",
    ];

    expect(flagsWithHooks.sort()).toEqual(expectedHookFlags.sort());
  });
});
