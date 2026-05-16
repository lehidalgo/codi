import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { detectHookSetup } from "#src/core/hooks/hook-detector.js";
import { PROJECT_NAME } from "#src/constants.js";
import { cleanupTmpDir } from "#tests/helpers/fs.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `${PROJECT_NAME}-hooks-detect-`));
});

afterEach(async () => {
  await cleanupTmpDir(tmpDir);
});

describe("detectHookSetup", () => {
  it("returns none when no hook runner found", async () => {
    const result = await detectHookSetup(tmpDir);
    expect(result.runner).toBe("none");
    expect(result.version).toBeUndefined();
    expect(result.configPath).toBeUndefined();
  });

  it("detects husky when .husky/ directory exists", async () => {
    await fs.mkdir(path.join(tmpDir, ".husky"), { recursive: true });
    const result = await detectHookSetup(tmpDir);
    expect(result.runner).toBe("husky");
    expect(result.configPath).toBe(path.join(tmpDir, ".husky"));
  });

  it("detects pre-commit when .pre-commit-config.yaml exists", async () => {
    await fs.writeFile(path.join(tmpDir, ".pre-commit-config.yaml"), "repos: []\n", "utf-8");
    const result = await detectHookSetup(tmpDir);
    expect(result.runner).toBe("pre-commit");
    expect(result.configPath).toBe(path.join(tmpDir, ".pre-commit-config.yaml"));
  });

  it("detects lefthook when .lefthook.yml exists", async () => {
    await fs.writeFile(
      path.join(tmpDir, ".lefthook.yml"),
      "pre-commit:\n  commands: {}\n",
      "utf-8",
    );
    const result = await detectHookSetup(tmpDir);
    expect(result.runner).toBe("lefthook");
    expect(result.configPath).toBe(path.join(tmpDir, ".lefthook.yml"));
  });

  it("detects lefthook with alternate lefthook.yml path", async () => {
    await fs.writeFile(path.join(tmpDir, "lefthook.yml"), "pre-commit:\n  commands: {}\n", "utf-8");
    const result = await detectHookSetup(tmpDir);
    expect(result.runner).toBe("lefthook");
    expect(result.configPath).toBe(path.join(tmpDir, "lefthook.yml"));
  });

  it("prefers husky over pre-commit when both exist", async () => {
    await fs.mkdir(path.join(tmpDir, ".husky"), { recursive: true });
    await fs.writeFile(path.join(tmpDir, ".pre-commit-config.yaml"), "repos: []\n", "utf-8");
    const result = await detectHookSetup(tmpDir);
    expect(result.runner).toBe("husky");
  });

  // ─── CORE-037 — mixed-runner precedence ────────────────────────────────────
  //
  // The detector walks DETECTION_RULES in order (husky → pre-commit →
  // lefthook → none) and returns the first match. These tests pin the
  // precedence chain for every pairwise + triple-overlap combination
  // so a future re-order is caught.
  describe("mixed-runner precedence (CORE-037)", () => {
    it("prefers husky over lefthook when both exist", async () => {
      await fs.mkdir(path.join(tmpDir, ".husky"), { recursive: true });
      await fs.writeFile(
        path.join(tmpDir, ".lefthook.yml"),
        "pre-commit:\n  commands: {}\n",
        "utf-8",
      );
      const result = await detectHookSetup(tmpDir);
      expect(result.runner).toBe("husky");
      expect(result.configPath).toBe(path.join(tmpDir, ".husky"));
    });

    it("prefers pre-commit over lefthook when both exist (no husky)", async () => {
      await fs.writeFile(path.join(tmpDir, ".pre-commit-config.yaml"), "repos: []\n", "utf-8");
      await fs.writeFile(
        path.join(tmpDir, ".lefthook.yml"),
        "pre-commit:\n  commands: {}\n",
        "utf-8",
      );
      const result = await detectHookSetup(tmpDir);
      expect(result.runner).toBe("pre-commit");
      expect(result.configPath).toBe(path.join(tmpDir, ".pre-commit-config.yaml"));
    });

    it("returns husky when ALL THREE runners are configured simultaneously", async () => {
      // The triple-overlap is rare in practice but documents the
      // contract: husky wins, the others are ignored without crash.
      await fs.mkdir(path.join(tmpDir, ".husky"), { recursive: true });
      await fs.writeFile(path.join(tmpDir, ".pre-commit-config.yaml"), "repos: []\n", "utf-8");
      await fs.writeFile(
        path.join(tmpDir, ".lefthook.yml"),
        "pre-commit:\n  commands: {}\n",
        "utf-8",
      );
      const result = await detectHookSetup(tmpDir);
      expect(result.runner).toBe("husky");
      expect(result.configPath).toBe(path.join(tmpDir, ".husky"));
    });

    it("husky version is read even when other runners coexist", async () => {
      // Verify the husky-specific version probe still succeeds in the
      // mixed-runner scenario.
      await fs.mkdir(path.join(tmpDir, ".husky"), { recursive: true });
      await fs.writeFile(path.join(tmpDir, ".pre-commit-config.yaml"), "repos: []\n", "utf-8");
      const huskyPkgPath = path.join(tmpDir, "node_modules", "husky");
      await fs.mkdir(huskyPkgPath, { recursive: true });
      await fs.writeFile(
        path.join(huskyPkgPath, "package.json"),
        JSON.stringify({ name: "husky", version: "9.1.7" }),
        "utf-8",
      );
      const result = await detectHookSetup(tmpDir);
      expect(result.runner).toBe("husky");
      expect(result.version).toBe("9.1.7");
    });

    it("`.lefthook.yml` wins over `lefthook.yml` when both exist", async () => {
      // The detector checks `.lefthook.yml` first; the alternate
      // (non-dotfile) form is the fallback. Pin the precedence so
      // dual-file installs are deterministic.
      await fs.writeFile(
        path.join(tmpDir, ".lefthook.yml"),
        "pre-commit:\n  commands: {}\n",
        "utf-8",
      );
      await fs.writeFile(
        path.join(tmpDir, "lefthook.yml"),
        "pre-commit:\n  commands: {}\n",
        "utf-8",
      );
      const result = await detectHookSetup(tmpDir);
      expect(result.runner).toBe("lefthook");
      expect(result.configPath).toBe(path.join(tmpDir, ".lefthook.yml"));
    });

    it("falls back to `none` when only an unrelated file is present", async () => {
      // Regression: a stray `package.json` (no husky), no
      // .pre-commit-config.yaml, no lefthook files → none.
      await fs.writeFile(path.join(tmpDir, "package.json"), "{}", "utf-8");
      const result = await detectHookSetup(tmpDir);
      expect(result.runner).toBe("none");
    });
  });
});
