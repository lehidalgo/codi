import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  installHooks,
  buildRunnerScript,
  buildSecretScanScript,
  buildFileSizeScript,
  stripCodiSection,
  globToGrepPattern,
  buildHuskyCommands,
} from "../../../src/core/hooks/hook-installer.js";
import type { HookEntry } from "../../../src/core/hooks/hook-registry.js";
import type { InstallOptions } from "../../../src/core/hooks/hook-installer.js";

let tmpDir: string;

const testHooks: HookEntry[] = [
  {
    name: "eslint",
    command: "npx eslint --fix",
    stagedFilter: "**/*.{ts,tsx,js,jsx}",
  },
  {
    name: "prettier",
    command: "npx prettier --write",
    stagedFilter: "**/*.{ts,tsx,js,jsx}",
  },
];

const baseOptions = (
  overrides: Partial<InstallOptions> = {},
): InstallOptions => ({
  projectRoot: tmpDir,
  runner: "none",
  hooks: testHooks,
  flags: {},
  ...overrides,
});

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "codi-hooks-install-"));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("installHooks", () => {
  it("returns ok with empty files and missingDeps when hooks list is empty", async () => {
    const result = await installHooks(baseOptions({ hooks: [] }));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.files).toEqual([]);
      expect(result.data.missingDeps).toEqual([]);
    }
  });

  it("returns Result with file paths and missingDeps for standalone installation", async () => {
    const result = await installHooks(baseOptions());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.files).toContain(
        path.join(".git", "hooks", "pre-commit"),
      );
      expect(result.data.files.length).toBeGreaterThanOrEqual(1);
      // missingDeps is populated (eslint/prettier likely not installed in test env)
      expect(Array.isArray(result.data.missingDeps)).toBe(true);
    }
  });

  it("writes standalone pre-commit hook with correct content and permissions", async () => {
    const result = await installHooks(baseOptions());

    expect(result.ok).toBe(true);
    const hookPath = path.join(tmpDir, ".git", "hooks", "pre-commit");
    const content = await fs.readFile(hookPath, "utf-8");
    expect(content).toContain("#!/bin/sh");
    expect(content).toContain("npx eslint --fix");
    expect(content).toContain("npx prettier --write");

    const stat = await fs.stat(hookPath);
    expect(stat.mode & 0o111).toBeGreaterThan(0);
  });

  it("appends Codi hooks block to existing husky pre-commit file", async () => {
    await fs.mkdir(path.join(tmpDir, ".husky"), { recursive: true });
    const existingContent = '#!/bin/sh\necho "existing"\n';
    await fs.writeFile(
      path.join(tmpDir, ".husky", "pre-commit"),
      existingContent,
      "utf-8",
    );

    const result = await installHooks(baseOptions({ runner: "husky" }));

    expect(result.ok).toBe(true);
    const content = await fs.readFile(
      path.join(tmpDir, ".husky", "pre-commit"),
      "utf-8",
    );
    expect(content).toContain("existing");
    expect(content).toContain("# Codi hooks");
    expect(content).toContain("npx eslint --fix");
    expect(content).toContain("npx prettier --write");
    // Staged files collected once, then filtered per hook with grep
    expect(content).toContain(
      'STAGED=$(git diff --cached --name-only --diff-filter=ACMR)',
    );
    expect(content).toContain("grep -E");
    if (result.ok) {
      expect(result.data.files).toContain(path.join(".husky", "pre-commit"));
    }
  });

  it("runs global hooks without grep filtering for empty stagedFilter", async () => {
    await fs.mkdir(path.join(tmpDir, ".husky"), { recursive: true });
    const noFilterHooks: HookEntry[] = [
      {
        name: "version-check",
        command: "node .git/hooks/codi-version-check.mjs",
        stagedFilter: "",
      },
    ];

    await installHooks(baseOptions({ runner: "husky", hooks: noFilterHooks }));

    const content = await fs.readFile(
      path.join(tmpDir, ".husky", "pre-commit"),
      "utf-8",
    );
    expect(content).toContain("node .git/hooks/codi-version-check.mjs");
    // Global hooks run unconditionally — no grep filter applied
    expect(content).not.toContain("grep");
  });

  it("replaces existing codi section instead of appending duplicates", async () => {
    await fs.mkdir(path.join(tmpDir, ".husky"), { recursive: true });
    const existingContent =
      "npm run lint\n\n# Codi hooks\nold-command --check\n\nnpm run other\n";
    await fs.writeFile(
      path.join(tmpDir, ".husky", "pre-commit"),
      existingContent,
      "utf-8",
    );

    const result = await installHooks(baseOptions({ runner: "husky" }));

    expect(result.ok).toBe(true);
    const content = await fs.readFile(
      path.join(tmpDir, ".husky", "pre-commit"),
      "utf-8",
    );

    // Should have exactly one codi section
    const codiCount = (content.match(/# Codi hooks/g) ?? []).length;
    expect(codiCount).toBe(1);

    // Should contain new hooks, not old
    expect(content).toContain("npx eslint --fix");
    expect(content).toContain("npx prettier --write");
    expect(content).not.toContain("old-command --check");

    // Should preserve non-codi content
    expect(content).toContain("npm run lint");
    expect(content).toContain("npm run other");
  });

  it("handles multiple consecutive installs without duplication", async () => {
    await fs.mkdir(path.join(tmpDir, ".husky"), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, ".husky", "pre-commit"),
      "npm run lint\n",
      "utf-8",
    );

    // Install 3 times
    await installHooks(baseOptions({ runner: "husky" }));
    await installHooks(baseOptions({ runner: "husky" }));
    await installHooks(baseOptions({ runner: "husky" }));

    const content = await fs.readFile(
      path.join(tmpDir, ".husky", "pre-commit"),
      "utf-8",
    );
    const codiCount = (content.match(/# Codi hooks/g) ?? []).length;
    expect(codiCount).toBe(1);
  });

  it("creates .git/hooks directory when it does not exist (standalone)", async () => {
    const hooksDir = path.join(tmpDir, ".git", "hooks");
    await expect(fs.access(hooksDir)).rejects.toThrow();

    const result = await installHooks(baseOptions());

    expect(result.ok).toBe(true);
    const stat = await fs.stat(hooksDir);
    expect(stat.isDirectory()).toBe(true);
  });

  it("creates secret scan script when secretScan option is enabled", async () => {
    const result = await installHooks(baseOptions({ secretScan: true }));

    expect(result.ok).toBe(true);
    if (result.ok) {
      const secretRelPath = path.join(".git", "hooks", "codi-secret-scan.mjs");
      expect(result.data.files).toContain(secretRelPath);

      const secretPath = path.join(tmpDir, secretRelPath);
      const content = await fs.readFile(secretPath, "utf-8");
      expect(content).toContain("Codi secret scanner");
      expect(content).toContain("PATTERNS");

      const stat = await fs.stat(secretPath);
      expect(stat.mode & 0o111).toBeGreaterThan(0);
    }
  });

  it("creates file size check script when fileSizeCheck option is enabled", async () => {
    const result = await installHooks(baseOptions({ fileSizeCheck: true }));

    expect(result.ok).toBe(true);
    if (result.ok) {
      const sizeRelPath = path.join(
        ".git",
        "hooks",
        "codi-file-size-check.mjs",
      );
      expect(result.data.files).toContain(sizeRelPath);

      const sizePath = path.join(tmpDir, sizeRelPath);
      const content = await fs.readFile(sizePath, "utf-8");
      expect(content).toContain("Codi file size checker");
      expect(content).toContain("maxLines");
      expect(content).not.toContain("{{MAX_LINES}}");
    }
  });

  it("creates version check script when versionCheck option is enabled", async () => {
    const result = await installHooks(baseOptions({ versionCheck: true }));

    expect(result.ok).toBe(true);
    if (result.ok) {
      const versionRelPath = path.join(
        ".git",
        "hooks",
        "codi-version-check.mjs",
      );
      expect(result.data.files).toContain(versionRelPath);

      const versionPath = path.join(tmpDir, versionRelPath);
      const content = await fs.readFile(versionPath, "utf-8");
      expect(content).toContain("Codi version and freshness checker");
    }
  });

  it("installs commit-msg hook in .git/hooks for standalone runner", async () => {
    const result = await installHooks(
      baseOptions({ commitMsgValidation: true }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      const commitMsgRelPath = path.join(".git", "hooks", "commit-msg");
      expect(result.data.files).toContain(commitMsgRelPath);

      const commitMsgPath = path.join(tmpDir, commitMsgRelPath);
      const content = await fs.readFile(commitMsgPath, "utf-8");
      expect(content).toContain("Codi commit message validator");

      const stat = await fs.stat(commitMsgPath);
      expect(stat.mode & 0o111).toBeGreaterThan(0);
    }
  });

  it("installs commit-msg hook in .husky/ for husky runner", async () => {
    await fs.mkdir(path.join(tmpDir, ".husky"), { recursive: true });

    const result = await installHooks(
      baseOptions({
        runner: "husky",
        commitMsgValidation: true,
      }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      const commitMsgRelPath = path.join(".husky", "commit-msg");
      expect(result.data.files).toContain(commitMsgRelPath);

      const commitMsgPath = path.join(tmpDir, commitMsgRelPath);
      const content = await fs.readFile(commitMsgPath, "utf-8");
      expect(content).toContain("# Codi hooks");
      expect(content).toContain("Codi commit message validator");
    }
  });

  it("returns all file paths when multiple auxiliary scripts are enabled", async () => {
    const result = await installHooks(
      baseOptions({
        commitMsgValidation: true,
        secretScan: true,
        fileSizeCheck: true,
        versionCheck: true,
      }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.files).toContain(
        path.join(".git", "hooks", "commit-msg"),
      );
      expect(result.data.files).toContain(
        path.join(".git", "hooks", "pre-commit"),
      );
      expect(result.data.files).toContain(
        path.join(".git", "hooks", "codi-secret-scan.mjs"),
      );
      expect(result.data.files).toContain(
        path.join(".git", "hooks", "codi-file-size-check.mjs"),
      );
      expect(result.data.files).toContain(
        path.join(".git", "hooks", "codi-version-check.mjs"),
      );
      expect(result.data.files).toHaveLength(5);
    }
  });

  it("returns error for unsupported runner type", async () => {
    const result = await installHooks(
      baseOptions({
        runner: "unknown-runner" as InstallOptions["runner"],
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]!.code).toBe("E_HOOK_FAILED");
    }
  });
});

describe("buildRunnerScript", () => {
  it("embeds hooks JSON into the runner template", () => {
    const script = buildRunnerScript(testHooks);

    expect(script).toContain("#!/bin/sh");
    expect(script).toContain('"name": "eslint"');
    expect(script).toContain('"command": "npx eslint --fix"');
    expect(script).toContain('"name": "prettier"');
    expect(script).not.toContain("{{HOOKS_JSON}}");
  });
});

describe("buildSecretScanScript", () => {
  it("returns secret scan template with pattern matching logic", () => {
    const script = buildSecretScanScript();

    expect(script).toContain("#!/usr/bin/env node");
    expect(script).toContain("PATTERNS");
    expect(script).toContain("Potential secret found");
  });
});

describe("buildFileSizeScript", () => {
  it("replaces MAX_LINES placeholder with the provided value", () => {
    const script = buildFileSizeScript(700);

    expect(script).toContain("const maxLines = 700");
    expect(script).not.toContain("{{MAX_LINES}}");
    expect(script).toContain("Codi file size checker");
  });
});

describe("stripCodiSection", () => {
  it("removes codi section from content", () => {
    const input =
      "npm run lint\n\n# Codi hooks\nsome-command\n\nnpm run other\n";
    const result = stripCodiSection(input);
    expect(result).toContain("npm run lint");
    expect(result).toContain("npm run other");
    expect(result).not.toContain("Codi hooks");
    expect(result).not.toContain("some-command");
  });

  it("returns content unchanged when no codi section exists", () => {
    const input = "npm run lint\nnpm run test\n";
    const result = stripCodiSection(input);
    expect(result).toContain("npm run lint");
    expect(result).toContain("npm run test");
  });

  it("handles content with only codi section", () => {
    const input = "# Codi hooks\nsome-command\n";
    const result = stripCodiSection(input);
    expect(result).not.toContain("Codi hooks");
    expect(result).not.toContain("some-command");
  });
});

describe("globToGrepPattern", () => {
  it("converts single extension glob", () => {
    expect(globToGrepPattern("**/*.py")).toBe("\\.(py)$");
  });

  it("converts multi-extension glob with braces", () => {
    expect(globToGrepPattern("**/*.{ts,tsx,js,jsx}")).toBe(
      "\\.(ts|tsx|js|jsx)$",
    );
  });

  it("converts cpp extension glob", () => {
    expect(globToGrepPattern("**/*.{cpp,hpp,cc,h}")).toBe(
      "\\.(cpp|hpp|cc|h)$",
    );
  });

  it("returns empty string for unrecognized glob", () => {
    expect(globToGrepPattern("")).toBe("");
    expect(globToGrepPattern("src/*.ts")).toBe("");
  });
});

describe("buildHuskyCommands", () => {
  it("generates STAGED variable and per-hook grep filters", () => {
    const hooks: HookEntry[] = [
      {
        name: "eslint",
        command: "npx eslint --fix",
        stagedFilter: "**/*.{ts,tsx,js,jsx}",
      },
    ];
    const result = buildHuskyCommands(hooks);
    expect(result).toContain(
      'STAGED=$(git diff --cached --name-only --diff-filter=ACMR)',
    );
    expect(result).toContain("grep -E '\\.(ts|tsx|js|jsx)$'");
    expect(result).toContain("npx eslint --fix $ESLINT");
  });

  it("does not pass files when passFiles is false", () => {
    const hooks: HookEntry[] = [
      {
        name: "tsc",
        command: "npx tsc --noEmit",
        stagedFilter: "**/*.{ts,tsx}",
        passFiles: false,
      },
    ];
    const result = buildHuskyCommands(hooks);
    expect(result).toContain('[ -n "$TSC" ] && npx tsc --noEmit');
    expect(result).not.toContain("npx tsc --noEmit $TSC");
  });

  it("runs global hooks without filtering", () => {
    const hooks: HookEntry[] = [
      { name: "test", command: "npm test", stagedFilter: "" },
    ];
    const result = buildHuskyCommands(hooks);
    expect(result).toContain("npm test");
    expect(result).not.toContain("grep");
  });

  it("generates correct output for mixed hooks", () => {
    const hooks: HookEntry[] = [
      {
        name: "eslint",
        command: "npx eslint --fix",
        stagedFilter: "**/*.{ts,tsx,js,jsx}",
      },
      {
        name: "tsc",
        command: "npx tsc --noEmit",
        stagedFilter: "**/*.{ts,tsx}",
        passFiles: false,
      },
      { name: "test", command: "npm test", stagedFilter: "" },
    ];
    const result = buildHuskyCommands(hooks);

    // eslint gets files passed
    expect(result).toContain("npx eslint --fix $ESLINT");
    // tsc runs without files
    expect(result).toContain('[ -n "$TSC" ] && npx tsc --noEmit');
    expect(result).not.toContain("npx tsc --noEmit $TSC");
    // global hook runs unconditionally
    expect(result).toContain("npm test");
  });
});
