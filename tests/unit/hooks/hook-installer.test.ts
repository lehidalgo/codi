import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { cleanupTmpDir } from "#tests/helpers/fs.js";
import {
  installHooks,
  buildRunnerScript,
  buildSecretScanScript,
  buildFileSizeScript,
  stripGeneratedSection,
  globToGrepPattern,
  buildHuskyCommands,
} from "#src/core/hooks/hook-installer.js";
import type { HookEntry } from "#src/core/hooks/hook-registry.js";
import type { InstallOptions } from "#src/core/hooks/hook-installer.js";
import { PROJECT_NAME, PROJECT_NAME_DISPLAY } from "#src/constants.js";
import { legacyHook } from "./_legacy-shape.js";

let tmpDir: string;

const testHooks: HookEntry[] = [
  legacyHook({ name: "eslint", command: "npx eslint --fix", stagedFilter: "**/*.{ts,tsx,js,jsx}" }),
  legacyHook({
    name: "prettier",
    command: "npx prettier --write",
    stagedFilter: "**/*.{ts,tsx,js,jsx}",
  }),
];

const baseOptions = (overrides: Partial<InstallOptions> = {}): InstallOptions => ({
  projectRoot: tmpDir,
  runner: "none",
  hooks: testHooks,
  flags: {},
  ...overrides,
});

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `${PROJECT_NAME}-hooks-install-`));
});

afterEach(async () => {
  await cleanupTmpDir(tmpDir);
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

  it("writes codi-conflict-marker-check.mjs when conflictMarkerCheck is true", async () => {
    const result = await installHooks(baseOptions({ runner: "none", conflictMarkerCheck: true }));
    expect(result.ok).toBe(true);
    const scriptPath = path.join(
      tmpDir,
      ".git",
      "hooks",
      `${PROJECT_NAME}-conflict-marker-check.mjs`,
    );
    const stat = await fs.stat(scriptPath);
    expect(stat.isFile()).toBe(true);
    const content = await fs.readFile(scriptPath, "utf-8");
    expect(content).toContain("MARKER_RE");
    expect(content).toContain("Git merge-conflict markers detected");
  });

  it("returns Result with file paths and missingDeps for standalone installation", async () => {
    const result = await installHooks(baseOptions());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.files).toContain(path.join(".git", "hooks", "pre-commit"));
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

  it(`appends ${PROJECT_NAME_DISPLAY} hooks block to existing husky pre-commit file`, async () => {
    await fs.mkdir(path.join(tmpDir, ".husky"), { recursive: true });
    const existingContent = '#!/bin/sh\necho "existing"\n';
    await fs.writeFile(path.join(tmpDir, ".husky", "pre-commit"), existingContent, "utf-8");

    const result = await installHooks(baseOptions({ runner: "husky" }));

    expect(result.ok).toBe(true);
    const content = await fs.readFile(path.join(tmpDir, ".husky", "pre-commit"), "utf-8");
    expect(content).toContain("existing");
    expect(content).toContain(`# ${PROJECT_NAME_DISPLAY} hooks`);
    expect(content).toContain("npx eslint --fix");
    expect(content).toContain("npx prettier --write");
    // Staged files collected once, then filtered per hook with grep
    expect(content).toContain("STAGED=$(git diff --cached --name-only --diff-filter=ACMR)");
    expect(content).toContain("grep -E");
    if (result.ok) {
      expect(result.data.files).toContain(path.join(".husky", "pre-commit"));
    }
  });

  it("runs global hooks without grep filtering for empty stagedFilter", async () => {
    await fs.mkdir(path.join(tmpDir, ".husky"), { recursive: true });
    const noFilterHooks: HookEntry[] = [
      legacyHook({
        name: "version-check",
        command: `node .git/hooks/${PROJECT_NAME}-version-check.mjs`,
      }),
    ];

    await installHooks(baseOptions({ runner: "husky", hooks: noFilterHooks }));

    const content = await fs.readFile(path.join(tmpDir, ".husky", "pre-commit"), "utf-8");
    expect(content).toContain(`node .git/hooks/${PROJECT_NAME}-version-check.mjs`);
    // Global hooks run unconditionally — no grep filter applied
    expect(content).not.toContain("grep");
  });

  it("replaces existing generated section instead of appending duplicates", async () => {
    await fs.mkdir(path.join(tmpDir, ".husky"), { recursive: true });
    const existingContent = `npm run lint\n\n# ${PROJECT_NAME_DISPLAY} hooks\nold-command --check\n\nnpm run other\n`;
    await fs.writeFile(path.join(tmpDir, ".husky", "pre-commit"), existingContent, "utf-8");

    const result = await installHooks(baseOptions({ runner: "husky" }));

    expect(result.ok).toBe(true);
    const content = await fs.readFile(path.join(tmpDir, ".husky", "pre-commit"), "utf-8");

    // Should have exactly one generated section
    const hookHeaderRegex = new RegExp(`# ${PROJECT_NAME_DISPLAY} hooks`, "g");
    const sectionCount = (content.match(hookHeaderRegex) ?? []).length;
    expect(sectionCount).toBe(1);

    // Should contain new hooks, not old
    expect(content).toContain("npx eslint --fix");
    expect(content).toContain("npx prettier --write");
    expect(content).not.toContain("old-command --check");

    // Should preserve non-generated content
    expect(content).toContain("npm run lint");
    expect(content).toContain("npm run other");
  });

  it("handles multiple consecutive installs without duplication", async () => {
    await fs.mkdir(path.join(tmpDir, ".husky"), { recursive: true });
    await fs.writeFile(path.join(tmpDir, ".husky", "pre-commit"), "npm run lint\n", "utf-8");

    // Install 3 times
    await installHooks(baseOptions({ runner: "husky" }));
    await installHooks(baseOptions({ runner: "husky" }));
    await installHooks(baseOptions({ runner: "husky" }));

    const content = await fs.readFile(path.join(tmpDir, ".husky", "pre-commit"), "utf-8");
    const hookHeaderRegex2 = new RegExp(`# ${PROJECT_NAME_DISPLAY} hooks`, "g");
    const sectionCount2 = (content.match(hookHeaderRegex2) ?? []).length;
    expect(sectionCount2).toBe(1);
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
      const secretRelPath = path.join(".git", "hooks", `${PROJECT_NAME}-secret-scan.mjs`);
      expect(result.data.files).toContain(secretRelPath);

      const secretPath = path.join(tmpDir, secretRelPath);
      const content = await fs.readFile(secretPath, "utf-8");
      expect(content).toContain(`${PROJECT_NAME_DISPLAY} secret scanner`);
      expect(content).toContain("PATTERNS");

      const stat = await fs.stat(secretPath);
      expect(stat.mode & 0o111).toBeGreaterThan(0);
    }
  });

  it("creates file size check script when fileSizeCheck option is enabled", async () => {
    const result = await installHooks(baseOptions({ fileSizeCheck: true }));

    expect(result.ok).toBe(true);
    if (result.ok) {
      const sizeRelPath = path.join(".git", "hooks", `${PROJECT_NAME}-file-size-check.mjs`);
      expect(result.data.files).toContain(sizeRelPath);

      const sizePath = path.join(tmpDir, sizeRelPath);
      const content = await fs.readFile(sizePath, "utf-8");
      expect(content).toContain(`${PROJECT_NAME_DISPLAY} file size checker`);
      expect(content).toContain("maxLines");
      expect(content).not.toContain("{{MAX_LINES}}");
    }
  });

  it("creates version check script when versionCheck option is enabled", async () => {
    const result = await installHooks(baseOptions({ versionCheck: true }));

    expect(result.ok).toBe(true);
    if (result.ok) {
      const versionRelPath = path.join(".git", "hooks", `${PROJECT_NAME}-version-check.mjs`);
      expect(result.data.files).toContain(versionRelPath);

      const versionPath = path.join(tmpDir, versionRelPath);
      const content = await fs.readFile(versionPath, "utf-8");
      expect(content).toContain(`${PROJECT_NAME_DISPLAY} version and freshness checker`);
    }
  });

  it("installs commit-msg hook in .git/hooks for standalone runner", async () => {
    const result = await installHooks(baseOptions({ commitMsgValidation: true }));

    expect(result.ok).toBe(true);
    if (result.ok) {
      const commitMsgRelPath = path.join(".git", "hooks", "commit-msg");
      expect(result.data.files).toContain(commitMsgRelPath);

      const commitMsgPath = path.join(tmpDir, commitMsgRelPath);
      const content = await fs.readFile(commitMsgPath, "utf-8");
      expect(content).toContain(`${PROJECT_NAME_DISPLAY} commit message validator`);

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
      expect(content).toContain(`# ${PROJECT_NAME_DISPLAY} hooks`);
      expect(content).toContain(`${PROJECT_NAME_DISPLAY} commit message validator`);
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
      expect(result.data.files).toContain(path.join(".git", "hooks", "commit-msg"));
      expect(result.data.files).toContain(path.join(".git", "hooks", "pre-commit"));
      expect(result.data.files).toContain(
        path.join(".git", "hooks", `${PROJECT_NAME}-secret-scan.mjs`),
      );
      expect(result.data.files).toContain(
        path.join(".git", "hooks", `${PROJECT_NAME}-file-size-check.mjs`),
      );
      expect(result.data.files).toContain(
        path.join(".git", "hooks", `${PROJECT_NAME}-version-check.mjs`),
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
    expect(script).toContain("potential secret(s) found");
  });
});

describe("buildFileSizeScript", () => {
  it("replaces MAX_LINES placeholder with the provided value", () => {
    const script = buildFileSizeScript(700);

    expect(script).toContain("const maxLines = 700");
    expect(script).not.toContain("{{MAX_LINES}}");
    expect(script).toContain(`${PROJECT_NAME_DISPLAY} file size checker`);
  });

  it("substitutes {{VENDORED_DIRS_PATTERNS}} with regex literals matching every vendored dir", () => {
    const script = buildFileSizeScript(800);
    expect(script).not.toContain("{{VENDORED_DIRS_PATTERNS}}");
    expect(script).toContain("/^node_modules\\//");
    expect(script).toContain("/^\\.codi\\//");
    expect(script).toContain("/^\\.agents\\//");
    expect(script).toContain("/^\\.claude\\//");
    expect(script).toContain("/^\\.codex\\//");
    expect(script).toContain("/^\\.cursor\\//");
    expect(script).toContain("/^\\.windsurf\\//");
    expect(script).toContain("/^\\.cline\\//");
  });

  it("produces a script whose EXCLUDED array parses as valid JavaScript", () => {
    const script = buildFileSizeScript(800);
    const match = script.match(/const EXCLUDED = (\[[\s\S]*?\]);/);
    expect(match).not.toBeNull();
    const arrayLiteral = match![1]!;
    const arr = new Function(`return ${arrayLiteral}`)() as RegExp[];
    expect(arr.every((r) => r instanceof RegExp)).toBe(true);
    const allMatch = (p: string) => arr.some((r) => r.test(p));
    expect(allMatch(".cursor/skills/foo/template.ts")).toBe(true);
    expect(allMatch(".cline/skills/foo/SKILL.md")).toBe(true);
    expect(allMatch("node_modules/foo/index.js")).toBe(true);
  });
});

describe("stripGeneratedSection", () => {
  it("removes generated section from content", () => {
    const input = `npm run lint\n\n# ${PROJECT_NAME_DISPLAY} hooks\nsome-command\n\nnpm run other\n`;
    const result = stripGeneratedSection(input);
    expect(result).toContain("npm run lint");
    expect(result).toContain("npm run other");
    expect(result).not.toContain(`${PROJECT_NAME_DISPLAY} hooks`);
    expect(result).not.toContain("some-command");
  });

  it("returns content unchanged when no generated section exists", () => {
    const input = "npm run lint\nnpm run test\n";
    const result = stripGeneratedSection(input);
    expect(result).toContain("npm run lint");
    expect(result).toContain("npm run test");
  });

  it("handles content with only generated section", () => {
    const input = `# ${PROJECT_NAME_DISPLAY} hooks\nsome-command\n`;
    const result = stripGeneratedSection(input);
    expect(result).not.toContain(`${PROJECT_NAME_DISPLAY} hooks`);
    expect(result).not.toContain("some-command");
  });
});

describe("globToGrepPattern", () => {
  it("converts single extension glob", () => {
    expect(globToGrepPattern("**/*.py")).toBe("\\.(py)$");
  });

  it("converts multi-extension glob with braces", () => {
    expect(globToGrepPattern("**/*.{ts,tsx,js,jsx}")).toBe("\\.(ts|tsx|js|jsx)$");
  });

  it("converts cpp extension glob", () => {
    expect(globToGrepPattern("**/*.{cpp,hpp,cc,h}")).toBe("\\.(cpp|hpp|cc|h)$");
  });

  it("returns empty string for unrecognized glob", () => {
    expect(globToGrepPattern("")).toBe("");
    expect(globToGrepPattern("src/*.ts")).toBe("");
  });
});

describe("buildHuskyCommands", () => {
  it("generates STAGED variable and per-hook grep filters with xargs", () => {
    const hooks: HookEntry[] = [
      legacyHook({
        name: "eslint",
        command: "npx eslint --fix",
        stagedFilter: "**/*.{ts,tsx,js,jsx}",
      }),
    ];
    const result = buildHuskyCommands(hooks);
    expect(result).toContain("STAGED=$(git diff --cached --name-only --diff-filter=ACMR)");
    expect(result).toContain("grep -E '\\.(ts|tsx|js|jsx)$'");
    // Files passed safely via xargs to prevent command injection
    expect(result).toContain("printf '%s\\n' $ESLINT | xargs npx eslint --fix");
  });

  it("does not pass files when passFiles is false", () => {
    const hooks: HookEntry[] = [
      legacyHook({
        name: "tsc",
        command: "npx tsc --noEmit",
        stagedFilter: "**/*.{ts,tsx}",
        passFiles: false,
      }),
    ];
    const result = buildHuskyCommands(hooks);
    expect(result).toContain('[ -n "$TSC" ] && npx tsc --noEmit');
    expect(result).not.toContain("npx tsc --noEmit $TSC");
  });

  it("runs global hooks without filtering", () => {
    const hooks: HookEntry[] = [legacyHook({ name: "test", command: "npm test" })];
    const result = buildHuskyCommands(hooks);
    expect(result).toContain("npm test");
    expect(result).not.toContain("grep");
  });

  it("generates correct output for mixed hooks", () => {
    const hooks: HookEntry[] = [
      legacyHook({
        name: "eslint",
        command: "npx eslint --fix",
        stagedFilter: "**/*.{ts,tsx,js,jsx}",
      }),
      legacyHook({
        name: "tsc",
        command: "npx tsc --noEmit",
        stagedFilter: "**/*.{ts,tsx}",
        passFiles: false,
      }),
      legacyHook({ name: "test", command: "npm test" }),
    ];
    const result = buildHuskyCommands(hooks);

    // eslint gets files passed safely via xargs
    expect(result).toContain("printf '%s\\n' $ESLINT | xargs npx eslint --fix");
    // tsc runs without files
    expect(result).toContain('[ -n "$TSC" ] && npx tsc --noEmit');
    expect(result).not.toContain("npx tsc --noEmit $TSC");
    // global hook runs unconditionally
    expect(result).toContain("npm test");
  });

  it("re-stages files after hooks with modifiesFiles", () => {
    const hooks: HookEntry[] = [
      legacyHook({
        name: "eslint",
        command: "npx eslint --fix",
        stagedFilter: "**/*.{ts,tsx,js,jsx}",
        modifiesFiles: true,
      }),
      legacyHook({
        name: "prettier",
        command: "npx prettier --write",
        stagedFilter: "**/*.{ts,tsx,js,jsx}",
        modifiesFiles: true,
      }),
      legacyHook({
        name: "tsc",
        command: "npx tsc --noEmit",
        stagedFilter: "**/*.{ts,tsx}",
        passFiles: false,
      }),
    ];
    const result = buildHuskyCommands(hooks);

    // Formatters should trigger a git add to re-stage (via xargs for safety)
    expect(result).toContain("[ -n \"$ESLINT\" ] && printf '%s\\n' $ESLINT | xargs git add");
    expect(result).toContain("[ -n \"$PRETTIER\" ] && printf '%s\\n' $PRETTIER | xargs git add");
    // Non-modifying hooks should NOT trigger git add
    expect(result).not.toContain("git add $TSC");
  });

  it("does not add git add when no hooks modify files", () => {
    const hooks: HookEntry[] = [
      legacyHook({
        name: "tsc",
        command: "npx tsc --noEmit",
        stagedFilter: "**/*.{ts,tsx}",
        passFiles: false,
      }),
    ];
    const result = buildHuskyCommands(hooks);
    expect(result).not.toContain("git add");
  });

  it("deduplicates re-stage variables", () => {
    const hooks: HookEntry[] = [
      legacyHook({
        name: "eslint",
        command: "npx eslint --fix",
        stagedFilter: "**/*.{ts,tsx,js,jsx}",
        modifiesFiles: true,
      }),
    ];
    const result = buildHuskyCommands(hooks);
    const addLines = result.split("\n").filter((l) => l.includes("git add"));
    expect(addLines).toHaveLength(1);
  });

  it("generates command -v guard with exit 1 for a required hook", () => {
    const hooks: HookEntry[] = [
      legacyHook({
        name: "tsc",
        command: "npx tsc --noEmit",
        stagedFilter: "**/*.{ts,tsx}",
        passFiles: false,
        category: "type-check",
        required: true,
        installHint: { command: "npm install -D typescript" },
      }),
    ];
    const result = buildHuskyCommands(hooks);
    expect(result).toContain("command -v");
    expect(result).toContain("tsc");
    expect(result).toContain("BLOCKING");
    expect(result).toContain("exit 1");
  });

  it("does not generate exit 1 for a non-required hook", () => {
    const hooks: HookEntry[] = [
      legacyHook({
        name: "prettier",
        command: "npx prettier --write",
        stagedFilter: "**/*.{ts,tsx}",
        modifiesFiles: true,
        category: "format",
        required: false,
        installHint: { command: "npm install -D prettier" },
      }),
    ];
    const result = buildHuskyCommands(hooks);
    expect(result).not.toContain("exit 1");
  });
});
