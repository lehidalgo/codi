import { describe, it, expect } from "vitest";
import {
  extractToolName,
  resolveToolBinary,
  NODE_PACKAGES,
  checkHookDependencies,
  filterMissing,
} from "#src/core/hooks/hook-dependency-checker.js";
import type { HookEntry } from "#src/core/hooks/hook-registry.js";
import { legacyHook } from "./_legacy-shape.js";

describe("extractToolName (argv fallback)", () => {
  it("extracts tool name from simple command", () => {
    expect(extractToolName("ruff check --fix")).toBe("ruff");
  });

  it("extracts tool name after npx prefix", () => {
    expect(extractToolName("npx eslint --fix")).toBe("eslint");
  });

  it("extracts tool name after npx with no args", () => {
    expect(extractToolName("npx prettier")).toBe("prettier");
  });

  it("handles command with no args", () => {
    expect(extractToolName("gofmt")).toBe("gofmt");
  });

  it("handles cargo subcommands", () => {
    expect(extractToolName("cargo clippy")).toBe("cargo");
  });

  it("skips npx --no flag and honors -- separator (regression: commitlint)", () => {
    expect(extractToolName("npx --no -- commitlint --edit")).toBe("commitlint");
  });

  it("skips npx -y flag", () => {
    expect(extractToolName("npx -y prettier --write")).toBe("prettier");
  });

  it("skips npx --no-install flag", () => {
    expect(extractToolName("npx --no-install eslint")).toBe("eslint");
  });

  it("consumes argument of -p / --package", () => {
    expect(extractToolName("npx -p typescript@5 tsc --noEmit")).toBe("tsc");
    expect(extractToolName("npx --package=typescript tsc --noEmit")).toBe("tsc");
  });
});

describe("resolveToolBinary (HookSpec-aware)", () => {
  it("prefers shell.toolBinary over argv parsing", () => {
    const hook = legacyHook({
      name: "commitlint",
      command: "npx --no -- commitlint --edit",
      stagedFilter: "**/*",
    });
    // legacyHook sets toolBinary = first command token. Override it explicitly.
    hook.shell = { ...hook.shell, toolBinary: "commitlint" };
    expect(resolveToolBinary(hook)).toBe("commitlint");
  });

  it("falls back to argv parsing when toolBinary is empty", () => {
    const hook = legacyHook({
      name: "x",
      command: "npx -y prettier --write",
      stagedFilter: "**/*",
    });
    hook.shell = { ...hook.shell, toolBinary: "" };
    expect(resolveToolBinary(hook)).toBe("prettier");
  });

  it("uses toolBinary even when argv parse would yield a different value", () => {
    const hook = legacyHook({
      name: "x",
      command: "npx eslint --fix",
      stagedFilter: "**/*",
    });
    hook.shell = { ...hook.shell, toolBinary: "ruff" };
    expect(resolveToolBinary(hook)).toBe("ruff");
  });
});

describe("NODE_PACKAGES", () => {
  it("includes eslint, prettier, tsc, pyright", () => {
    expect(NODE_PACKAGES.has("eslint")).toBe(true);
    expect(NODE_PACKAGES.has("prettier")).toBe(true);
    expect(NODE_PACKAGES.has("tsc")).toBe(true);
    expect(NODE_PACKAGES.has("pyright")).toBe(true);
  });

  it("does not include system tools", () => {
    expect(NODE_PACKAGES.has("ruff")).toBe(false);
    expect(NODE_PACKAGES.has("cargo")).toBe(false);
    expect(NODE_PACKAGES.has("gofmt")).toBe(false);
  });
});

describe("checkHookDependencies", () => {
  it("returns all tools including found ones", async () => {
    // node is always available
    const hooks: HookEntry[] = [legacyHook({ name: "node-check", command: "node --version" })];
    const result = await checkHookDependencies(hooks);
    expect(result).toHaveLength(1);
    expect(result[0]!.found).toBe(true);
    expect(result[0]!.severity).toBe("ok");
  });

  it("detects missing tools with found=false and severity=error for required", async () => {
    const hooks: HookEntry[] = [
      legacyHook({
        name: "fake-tool",
        command: "nonexistent-tool-xyz --check",
        stagedFilter: "**/*.ts",
        required: true,
      }),
    ];
    const result = await checkHookDependencies(hooks);
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("nonexistent-tool-xyz");
    expect(result[0]!.found).toBe(false);
    expect(result[0]!.severity).toBe("error");
  });

  it("detects missing tools with severity=warning for non-required", async () => {
    const hooks: HookEntry[] = [
      legacyHook({
        name: "fake-tool",
        command: "nonexistent-tool-xyz --check",
        stagedFilter: "**/*.ts",
        required: false,
      }),
    ];
    const result = await checkHookDependencies(hooks);
    expect(result[0]!.severity).toBe("warning");
  });

  it("deduplicates tools from multiple hooks", async () => {
    const hooks: HookEntry[] = [
      legacyHook({ name: "fake1", command: "nonexistent-tool-xyz --fix", stagedFilter: "**/*.ts" }),
      legacyHook({
        name: "fake2",
        command: "nonexistent-tool-xyz --check",
        stagedFilter: "**/*.js",
      }),
    ];
    const result = await checkHookDependencies(hooks);
    expect(result).toHaveLength(1);
  });

  it("marks node packages with isNodePackage flag", async () => {
    const hooks: HookEntry[] = [
      legacyHook({ name: "eslint", command: "npx eslint --fix", stagedFilter: "**/*.ts" }),
    ];
    const result = await checkHookDependencies(hooks);
    const eslintDep = result.find((d) => d.name === "eslint");
    expect(eslintDep).toBeDefined();
    expect(eslintDep!.isNodePackage).toBe(true);
  });

  it("checks node_modules/.bin when projectRoot is provided", async () => {
    const hooks: HookEntry[] = [
      legacyHook({ name: "eslint", command: "npx eslint --fix", stagedFilter: "**/*.ts" }),
    ];
    // Using a nonexistent project root ensures the tool won't be found in node_modules
    const result = await checkHookDependencies(hooks, "/tmp/nonexistent-project");
    const eslintDep = result.find((d) => d.name === "eslint");
    expect(eslintDep).toBeDefined();
    expect(eslintDep!.isNodePackage).toBe(true);
    expect(eslintDep!.installHint?.command).toBe("npm install -D eslint");
  });
});

describe("filterMissing", () => {
  it("returns only missing tools as DependencyCheck array", async () => {
    const hooks: HookEntry[] = [
      legacyHook({ name: "node-check", command: "node --version" }),
      legacyHook({
        name: "fake-tool",
        command: "nonexistent-tool-xyz --check",
        stagedFilter: "**/*.ts",
        required: true,
      }),
    ];
    const diagnostics = await checkHookDependencies(hooks);
    const missing = filterMissing(diagnostics);
    expect(missing).toHaveLength(1);
    expect(missing[0]!.name).toBe("nonexistent-tool-xyz");
    expect(missing[0]!.available).toBe(false);
    expect(typeof missing[0]!.installHint).toBe("string");
  });
});
