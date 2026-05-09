import { describe, it, expect } from "vitest";
import { isGitHook, isRuntimeHook, type HookArtifact } from "#src/core/hooks/hook-artifact.js";

const gitSample: HookArtifact = {
  bucket: "git",
  name: "eslint",
  description: "JS/TS linter",
  version: "1",
  managed_by: "codi",
  required: false,
  default: true,
  category: "lint",
  language: "typescript",
  stages: ["pre-commit"],
  files: "**/*.ts",
  preCommit: { kind: "local", entry: "npx eslint", language: "system" },
  shell: { command: "npx eslint", passFiles: true, modifiesFiles: true, toolBinary: "eslint" },
  installHint: { command: "npm i -D eslint" },
};

const runtimeSample: HookArtifact = {
  bucket: "runtime",
  name: "security-reminder",
  description: "PreToolUse advisory",
  version: "1",
  managed_by: "codi",
  required: false,
  default: true,
  category: "security",
  events: ["PreToolUse"],
  evaluate: () => ({
    hookName: "security-reminder",
    matched: false,
    severity: "info",
  }),
};

describe("hook-artifact discriminator", () => {
  it("isGitHook identifies git bucket", () => {
    expect(isGitHook(gitSample)).toBe(true);
    expect(isGitHook(runtimeSample)).toBe(false);
  });

  it("isRuntimeHook identifies runtime bucket", () => {
    expect(isRuntimeHook(runtimeSample)).toBe(true);
    expect(isRuntimeHook(gitSample)).toBe(false);
  });

  it("narrows union via type guard", () => {
    const items: HookArtifact[] = [gitSample, runtimeSample];
    const gits = items.filter(isGitHook);
    expect(gits).toHaveLength(1);
    expect(gits[0]?.language).toBe("typescript");
  });
});
