import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  connectLocalDirectory,
  connectZipFile,
  connectGithubRepo,
  resolveGithubCloneTarget,
  assertPathsContained,
} from "#src/core/external-source/connectors.js";

const execFileAsync = promisify(execFile);
const FIXTURE_ROOT = path.resolve(__dirname, "../../../fixtures/external-presets/sample-a");

describe("external-source connectors", () => {
  describe("connectLocalDirectory", () => {
    it("connects to a real directory with id, rootPath, cleanup", async () => {
      const source = await connectLocalDirectory(FIXTURE_ROOT);
      expect(source.id).toBe(`local:${FIXTURE_ROOT}`);
      expect(source.rootPath).toBe(FIXTURE_ROOT);
      expect(typeof source.cleanup).toBe("function");
      // cleanup is a no-op for local dirs — must not throw
      await expect(source.cleanup()).resolves.toBeUndefined();
    });

    it("rejects a non-existent path", async () => {
      await expect(connectLocalDirectory("/this/path/does/not/exist/anywhere")).rejects.toThrow(
        /Not a readable directory/,
      );
    });

    it("rejects a file (not directory)", async () => {
      const filePath = path.join(FIXTURE_ROOT, "rules", "sample-rule.md");
      await expect(connectLocalDirectory(filePath)).rejects.toThrow(/Not a readable directory/);
    });

    it("preserves the directory after cleanup (we did not own it)", async () => {
      const source = await connectLocalDirectory(FIXTURE_ROOT);
      await source.cleanup();
      const stat = await fs.stat(FIXTURE_ROOT);
      expect(stat.isDirectory()).toBe(true);
    });
  });

  describe("resolveGithubCloneTarget", () => {
    it("expands a bare org/repo to an https clone URL with no ref", () => {
      expect(resolveGithubCloneTarget("lehidalgo/codi")).toEqual({
        url: "https://github.com/lehidalgo/codi.git",
      });
    });

    it("extracts the tag from org/repo@v1.2.0 form", () => {
      expect(resolveGithubCloneTarget("lehidalgo/codi@v2.12.0")).toEqual({
        url: "https://github.com/lehidalgo/codi.git",
        ref: "v2.12.0",
      });
    });

    it("strips the github: prefix and supports #branch notation", () => {
      expect(resolveGithubCloneTarget("github:lehidalgo/codi#feature/x")).toEqual({
        url: "https://github.com/lehidalgo/codi.git",
        ref: "feature/x",
      });
    });

    it("normalizes a full https URL into the canonical .git clone URL", () => {
      expect(resolveGithubCloneTarget("https://github.com/lehidalgo/codi")).toEqual({
        url: "https://github.com/lehidalgo/codi.git",
      });
    });

    it("strips a trailing .git from a full URL idempotently", () => {
      expect(resolveGithubCloneTarget("https://github.com/lehidalgo/codi.git")).toEqual({
        url: "https://github.com/lehidalgo/codi.git",
      });
    });

    it("extracts the branch from a /tree/<branch> URL", () => {
      expect(
        resolveGithubCloneTarget("https://github.com/lehidalgo/codi/tree/develop"),
      ).toEqual({
        url: "https://github.com/lehidalgo/codi.git",
        ref: "develop",
      });
    });

    it("rejects an empty spec", () => {
      expect(() => resolveGithubCloneTarget("")).toThrow(/Invalid GitHub spec/);
      expect(() => resolveGithubCloneTarget("   ")).toThrow(/Invalid GitHub spec/);
    });
  });

  describe("connectZipFile", () => {
    let zipPath = "";

    beforeEach(async () => {
      // Build a small ZIP from the fixture preset using the system `zip` command.
      const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codi-zip-fixture-"));
      zipPath = path.join(tmpRoot, "sample.zip");
      await execFileAsync("zip", ["-rq", zipPath, "."], { cwd: FIXTURE_ROOT });
    });

    afterEach(async () => {
      await fs.rm(path.dirname(zipPath), { recursive: true, force: true }).catch(() => {});
    });

    it("extracts a real ZIP and returns an ExternalSource pointing at the contents", async () => {
      const source = await connectZipFile(zipPath);
      try {
        expect(source.id).toBe(`zip:${path.basename(zipPath)}`);
        expect(source.rootPath).toMatch(/codi-import-zip-/);
        // Sanity check: the extracted root should contain rules/ from our fixture
        const ruleFile = path.join(source.rootPath, "rules", "sample-rule.md");
        const content = await fs.readFile(ruleFile, "utf8");
        expect(content).toContain("name: sample-rule");
      } finally {
        await source.cleanup();
      }
    });

    it("cleanup removes the extracted directory", async () => {
      const source = await connectZipFile(zipPath);
      const extractedRoot = source.rootPath;
      await source.cleanup();
      const exists = await fs
        .stat(extractedRoot)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(false);
    });

    it("rejects a non-existent file", async () => {
      await expect(
        connectZipFile("/this/path/does/not/exist/whatever.zip"),
      ).rejects.toThrow(/Not a readable file/);
    });

    it("rejects a directory passed where a file is expected", async () => {
      await expect(connectZipFile(FIXTURE_ROOT)).rejects.toThrow(/Not a readable file/);
    });
  });

  describe("assertPathsContained (ZIP-slip guard)", () => {
    let testRoot = "";

    beforeEach(async () => {
      testRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codi-slip-test-"));
    });

    afterEach(async () => {
      await fs.rm(testRoot, { recursive: true, force: true }).catch(() => {});
    });

    it("accepts a tree where every entry resolves under the root", async () => {
      await fs.writeFile(path.join(testRoot, "a.txt"), "ok");
      await fs.mkdir(path.join(testRoot, "sub"));
      await fs.writeFile(path.join(testRoot, "sub", "b.txt"), "ok");
      await expect(assertPathsContained(testRoot)).resolves.toBeUndefined();
    });

    it("rejects when a symlink escapes the root", async () => {
      const outsideTarget = await fs.mkdtemp(path.join(os.tmpdir(), "codi-outside-"));
      try {
        await fs.symlink(outsideTarget, path.join(testRoot, "evil-symlink"));
        await expect(assertPathsContained(testRoot)).rejects.toThrow(
          /Path escapes extraction root/,
        );
      } finally {
        await fs.rm(outsideTarget, { recursive: true, force: true });
      }
    });
  });

  describe("connectGithubRepo", () => {
    it("rejects an empty spec before invoking git", async () => {
      await expect(connectGithubRepo("")).rejects.toThrow(/Invalid GitHub spec/);
    });

    it("surfaces a clone failure with the resolved URL in the error", async () => {
      // Non-existent repo on github.com → git fails with 'Repository not found'.
      // The error must include the resolved URL so the user can verify what was
      // actually attempted.
      await expect(
        connectGithubRepo("https://github.com/lehidalgo/this-repo-does-not-exist-xyz"),
      ).rejects.toThrow(/Failed to clone https:\/\/github\.com\/lehidalgo\/this-repo-does-not-exist-xyz\.git/);
    });
  });
});
