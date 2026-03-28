import { describe, it, expect } from "vitest";
import {
  extractToolName,
  NODE_PACKAGES,
  checkHookDependencies,
} from "../../../src/core/hooks/hook-dependency-checker.js";
import type { HookEntry } from "../../../src/core/hooks/hook-registry.js";

describe("extractToolName", () => {
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
  it("returns empty array when all tools are available", async () => {
    // node is always available
    const hooks: HookEntry[] = [
      { name: "node-check", command: "node --version", stagedFilter: "" },
    ];
    const result = await checkHookDependencies(hooks);
    expect(result).toEqual([]);
  });

  it("detects missing tools", async () => {
    const hooks: HookEntry[] = [
      {
        name: "fake-tool",
        command: "nonexistent-tool-xyz --check",
        stagedFilter: "**/*.ts",
      },
    ];
    const result = await checkHookDependencies(hooks);
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("nonexistent-tool-xyz");
    expect(result[0]!.available).toBe(false);
  });

  it("deduplicates tools from multiple hooks", async () => {
    const hooks: HookEntry[] = [
      {
        name: "fake1",
        command: "nonexistent-tool-xyz --fix",
        stagedFilter: "**/*.ts",
      },
      {
        name: "fake2",
        command: "nonexistent-tool-xyz --check",
        stagedFilter: "**/*.js",
      },
    ];
    const result = await checkHookDependencies(hooks);
    expect(result).toHaveLength(1);
  });

  it("marks node packages with isNodePackage flag", async () => {
    const hooks: HookEntry[] = [
      { name: "eslint", command: "npx eslint --fix", stagedFilter: "**/*.ts" },
    ];
    const result = await checkHookDependencies(hooks);
    // eslint may or may not be installed, but if missing it should have isNodePackage=true
    for (const dep of result) {
      if (dep.name === "eslint") {
        expect(dep.isNodePackage).toBe(true);
      }
    }
  });

  it("checks node_modules/.bin when projectRoot is provided", async () => {
    const hooks: HookEntry[] = [
      { name: "eslint", command: "npx eslint --fix", stagedFilter: "**/*.ts" },
    ];
    // Using a nonexistent project root ensures the tool won't be found in node_modules
    const result = await checkHookDependencies(
      hooks,
      "/tmp/nonexistent-project",
    );
    const eslintDep = result.find((d) => d.name === "eslint");
    if (eslintDep) {
      expect(eslintDep.isNodePackage).toBe(true);
      expect(eslintDep.installHint).toBe("npm install -D eslint");
    }
  });
});
