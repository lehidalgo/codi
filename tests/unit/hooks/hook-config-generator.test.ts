import { describe, it, expect } from "vitest";
import { generateHooksConfig } from "#src/core/hooks/hook-config-generator.js";
import type { ResolvedFlags } from "#src/types/flags.js";

function makeFlags(
  overrides: Record<string, { value: unknown; mode: string }>,
): ResolvedFlags {
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

  it("generates hooks for python", () => {
    const config = generateHooksConfig(makeFlags({}), ["python"]);
    expect(config.hooks.map((h) => h.name)).toContain("ruff-check");
    expect(config.hooks.map((h) => h.name)).toContain("pyright");
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
    const config = generateHooksConfig(makeFlags({}), [
      "typescript",
      "javascript",
    ]);
    const eslintCount = config.hooks.filter((h) => h.name === "eslint").length;
    expect(eslintCount).toBe(1);
  });

  it("returns only global hooks for unknown language", () => {
    const config = generateHooksConfig(makeFlags({}), ["cobol"]);
    const langHooks = config.hooks.filter(
      (h) =>
        h.name !== "secret-scan" &&
        h.name !== "file-size-check" &&
        h.name !== "artifact-validate",
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

  it("language field is undefined on global hooks", () => {
    const config = generateHooksConfig(makeFlags({}), ["python"]);
    const secretScan = config.hooks.find((h) => h.name === "secret-scan");
    expect(secretScan?.language).toBeUndefined();
  });
});
