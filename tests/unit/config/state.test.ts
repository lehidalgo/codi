import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { cleanupTmpDir } from "#tests/helpers/fs.js";
import { StateManager } from "#src/core/config/state.js";
import type { StateData, GeneratedFileState } from "#src/core/config/state.js";
import { hashContent } from "#src/utils/hash.js";
import { PROJECT_NAME } from "#src/constants.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `${PROJECT_NAME}-state-`));
});

afterEach(async () => {
  await cleanupTmpDir(tmpDir);
});

describe("StateManager", () => {
  it("returns empty state when state.json does not exist", async () => {
    const mgr = new StateManager(tmpDir);
    const result = await mgr.read();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.version).toBe("1");
    expect(result.data.agents).toEqual({});
  });

  it("writes and reads state", async () => {
    const mgr = new StateManager(tmpDir);
    const state: StateData = {
      version: "1",
      lastGenerated: "2026-01-01T00:00:00.000Z",
      agents: {
        "claude-code": [
          {
            path: "/project/.claude/rules",
            sourceHash: "abc",
            generatedHash: "def",
            sources: ["rule1.md"],
            timestamp: "2026-01-01T00:00:00.000Z",
          },
        ],
      },
      hooks: [],
    };

    const writeResult = await mgr.write(state);
    expect(writeResult.ok).toBe(true);

    const readResult = await mgr.read();
    expect(readResult.ok).toBe(true);
    if (!readResult.ok) return;
    expect(readResult.data.agents["claude-code"]).toHaveLength(1);
  });

  it("updateAgent adds files for an agent", async () => {
    const mgr = new StateManager(tmpDir);
    const files: GeneratedFileState[] = [
      {
        path: "/project/.cursor/rules",
        sourceHash: "aaa",
        generatedHash: "bbb",
        sources: ["rule1.md"],
        timestamp: new Date().toISOString(),
      },
    ];

    await mgr.updateAgent("cursor", files);
    const result = await mgr.getAgentFiles("cursor");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.path).toBe("/project/.cursor/rules");
  });

  it("getAgentFiles returns empty for unknown agent", async () => {
    const mgr = new StateManager(tmpDir);
    const result = await mgr.getAgentFiles("nonexistent");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([]);
  });

  it("detectDrift detects synced files", async () => {
    const content = "file content here";
    const genHash = hashContent(content);

    const filePath = path.join(tmpDir, "generated-file.md");
    await fs.writeFile(filePath, content, "utf8");

    const mgr = new StateManager(tmpDir);
    await mgr.updateAgent("claude-code", [
      {
        path: filePath,
        sourceHash: "src",
        generatedHash: genHash,
        sources: ["source.md"],
        timestamp: new Date().toISOString(),
      },
    ]);

    const driftResult = await mgr.detectDrift("claude-code");
    expect(driftResult.ok).toBe(true);
    if (!driftResult.ok) return;
    expect(driftResult.data.files[0]!.status).toBe("synced");
  });

  it("detectDrift detects drifted files", async () => {
    const filePath = path.join(tmpDir, "drifted-file.md");
    await fs.writeFile(filePath, "modified content", "utf8");

    const mgr = new StateManager(tmpDir);
    await mgr.updateAgent("claude-code", [
      {
        path: filePath,
        sourceHash: "src",
        generatedHash: "original-hash",
        sources: ["source.md"],
        timestamp: new Date().toISOString(),
      },
    ]);

    const driftResult = await mgr.detectDrift("claude-code");
    expect(driftResult.ok).toBe(true);
    if (!driftResult.ok) return;
    expect(driftResult.data.files[0]!.status).toBe("drifted");
  });

  it("detectDrift detects missing files", async () => {
    const mgr = new StateManager(tmpDir);
    await mgr.updateAgent("claude-code", [
      {
        path: "/nonexistent/file.md",
        sourceHash: "src",
        generatedHash: "hash",
        sources: ["source.md"],
        timestamp: new Date().toISOString(),
      },
    ]);

    const driftResult = await mgr.detectDrift("claude-code");
    expect(driftResult.ok).toBe(true);
    if (!driftResult.ok) return;
    expect(driftResult.data.files[0]!.status).toBe("missing");
  });

  describe("updateHooks", () => {
    it("stores hook files in state", async () => {
      const mgr = new StateManager(tmpDir);
      const hooks: GeneratedFileState[] = [
        {
          path: `.git/hooks/${PROJECT_NAME}-secret-scan.mjs`,
          sourceHash: "src1",
          generatedHash: "gen1",
          sources: ["hooks"],
          timestamp: new Date().toISOString(),
        },
      ];

      const result = await mgr.updateHooks(hooks);
      expect(result.ok).toBe(true);

      const readResult = await mgr.read();
      expect(readResult.ok).toBe(true);
      if (!readResult.ok) return;
      expect(readResult.data.hooks).toHaveLength(1);
      expect(readResult.data.hooks[0]!.path).toBe(`.git/hooks/${PROJECT_NAME}-secret-scan.mjs`);
    });

    it("replaces previous hooks on update", async () => {
      const mgr = new StateManager(tmpDir);
      const firstHooks: GeneratedFileState[] = [
        {
          path: `.git/hooks/${PROJECT_NAME}-secret-scan.mjs`,
          sourceHash: "a",
          generatedHash: "b",
          sources: ["hooks"],
          timestamp: new Date().toISOString(),
        },
      ];
      await mgr.updateHooks(firstHooks);

      const secondHooks: GeneratedFileState[] = [
        {
          path: ".husky/pre-commit",
          sourceHash: "c",
          generatedHash: "d",
          sources: ["hooks"],
          timestamp: new Date().toISOString(),
        },
        {
          path: ".husky/commit-msg",
          sourceHash: "e",
          generatedHash: "f",
          sources: ["hooks"],
          timestamp: new Date().toISOString(),
        },
      ];
      await mgr.updateHooks(secondHooks);

      const readResult = await mgr.read();
      expect(readResult.ok).toBe(true);
      if (!readResult.ok) return;
      expect(readResult.data.hooks).toHaveLength(2);
      expect(readResult.data.hooks.map((h) => h.path)).toEqual([
        ".husky/pre-commit",
        ".husky/commit-msg",
      ]);
    });

    it("preserves agent data when updating hooks", async () => {
      const mgr = new StateManager(tmpDir);
      await mgr.updateAgent("cursor", [
        {
          path: ".cursorrules",
          sourceHash: "x",
          generatedHash: "y",
          sources: ["manifest"],
          timestamp: new Date().toISOString(),
        },
      ]);

      await mgr.updateHooks([
        {
          path: `.git/hooks/${PROJECT_NAME}-secret-scan.mjs`,
          sourceHash: "a",
          generatedHash: "b",
          sources: ["hooks"],
          timestamp: new Date().toISOString(),
        },
      ]);

      const readResult = await mgr.read();
      expect(readResult.ok).toBe(true);
      if (!readResult.ok) return;
      expect(readResult.data.agents["cursor"]).toHaveLength(1);
      expect(readResult.data.hooks).toHaveLength(1);
    });

    it("stores empty hooks array", async () => {
      const mgr = new StateManager(tmpDir);
      await mgr.updateHooks([
        {
          path: `.git/hooks/${PROJECT_NAME}-secret-scan.mjs`,
          sourceHash: "a",
          generatedHash: "b",
          sources: ["hooks"],
          timestamp: new Date().toISOString(),
        },
      ]);

      await mgr.updateHooks([]);

      const readResult = await mgr.read();
      expect(readResult.ok).toBe(true);
      if (!readResult.ok) return;
      expect(readResult.data.hooks).toEqual([]);
    });

    it("updates lastGenerated timestamp", async () => {
      const mgr = new StateManager(tmpDir);
      const before = new Date().toISOString();

      await mgr.updateHooks([
        {
          path: ".husky/pre-commit",
          sourceHash: "a",
          generatedHash: "b",
          sources: ["hooks"],
          timestamp: new Date().toISOString(),
        },
      ]);

      const readResult = await mgr.read();
      expect(readResult.ok).toBe(true);
      if (!readResult.ok) return;
      expect(readResult.data.lastGenerated).toBeDefined();
      expect(readResult.data.lastGenerated! >= before).toBe(true);
    });
  });

  describe("detectPresetArtifactDrift", () => {
    it("detects synced preset artifacts", async () => {
      const mgr = new StateManager(tmpDir);
      const content = "rule content";
      const filePath = path.join(tmpDir, "rule.md");
      await fs.writeFile(filePath, content, "utf-8");

      await mgr.updatePresetArtifacts([
        {
          path: filePath,
          hash: hashContent(content),
          preset: "balanced",
          timestamp: new Date().toISOString(),
        },
      ]);

      const result = await mgr.detectPresetArtifactDrift();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data).toHaveLength(1);
      expect(result.data[0]!.status).toBe("synced");
    });

    it("detects drifted preset artifacts", async () => {
      const mgr = new StateManager(tmpDir);
      const filePath = path.join(tmpDir, "rule.md");
      await fs.writeFile(filePath, "modified content", "utf-8");

      await mgr.updatePresetArtifacts([
        {
          path: filePath,
          hash: hashContent("original content"),
          preset: "balanced",
          timestamp: new Date().toISOString(),
        },
      ]);

      const result = await mgr.detectPresetArtifactDrift();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data).toHaveLength(1);
      expect(result.data[0]!.status).toBe("drifted");
      expect(result.data[0]!.expectedHash).toBe(hashContent("original content"));
    });

    it("detects missing preset artifacts", async () => {
      const mgr = new StateManager(tmpDir);

      await mgr.updatePresetArtifacts([
        {
          path: "/nonexistent/artifact.md",
          hash: "abc123",
          preset: "balanced",
          timestamp: new Date().toISOString(),
        },
      ]);

      const result = await mgr.detectPresetArtifactDrift();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data).toHaveLength(1);
      expect(result.data[0]!.status).toBe("missing");
    });
  });

  describe("detectHookDrift", () => {
    it("detects synced hook files", async () => {
      const mgr = new StateManager(tmpDir);
      const content = "#!/bin/sh\nnpx vitest";
      const filePath = path.join(tmpDir, ".husky", "pre-commit");
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content, "utf-8");

      await mgr.updateHooks([
        {
          path: filePath,
          sourceHash: "src",
          generatedHash: hashContent(content),
          sources: ["hooks"],
          timestamp: new Date().toISOString(),
        },
      ]);

      const result = await mgr.detectHookDrift();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data).toHaveLength(1);
      expect(result.data[0]!.status).toBe("synced");
    });

    it("detects drifted hook files", async () => {
      const mgr = new StateManager(tmpDir);
      const filePath = path.join(tmpDir, ".husky", "pre-commit");
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, "modified hook", "utf-8");

      await mgr.updateHooks([
        {
          path: filePath,
          sourceHash: "src",
          generatedHash: hashContent("original hook"),
          sources: ["hooks"],
          timestamp: new Date().toISOString(),
        },
      ]);

      const result = await mgr.detectHookDrift();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data).toHaveLength(1);
      expect(result.data[0]!.status).toBe("drifted");
    });

    it("detects missing hook files", async () => {
      const mgr = new StateManager(tmpDir);

      await mgr.updateHooks([
        {
          path: "/nonexistent/hook",
          sourceHash: "src",
          generatedHash: "abc",
          sources: ["hooks"],
          timestamp: new Date().toISOString(),
        },
      ]);

      const result = await mgr.detectHookDrift();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data).toHaveLength(1);
      expect(result.data[0]!.status).toBe("missing");
    });
  });

  describe("detectOrphans + deleteOrphans", () => {
    async function seedFile(relPath: string, content: string): Promise<string> {
      const fullPath = path.join(tmpDir, relPath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content, "utf-8");
      return fullPath;
    }

    function stateEntry(relPath: string, content: string): GeneratedFileState {
      return {
        path: relPath,
        sourceHash: "src",
        generatedHash: hashContent(content),
        sources: ["manifest.yaml"],
        timestamp: new Date().toISOString(),
      };
    }

    it("returns a clean orphan when the file exists unchanged and is no longer generated", async () => {
      const mgr = new StateManager(tmpDir, tmpDir);
      await seedFile(".claude/skills/foo/scripts/server.cjs", "keep-me");
      await mgr.updateAgentsBatch({
        "claude-code": [stateEntry(".claude/skills/foo/scripts/server.cjs", "keep-me")],
      });

      const result = await mgr.detectOrphans({ "claude-code": [] });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.clean).toHaveLength(1);
      expect(result.data.drifted).toHaveLength(0);
      expect(result.data.clean[0]!.path).toBe(".claude/skills/foo/scripts/server.cjs");
    });

    it("returns a drifted orphan when the file was user-edited after generation", async () => {
      const mgr = new StateManager(tmpDir, tmpDir);
      await seedFile(".claude/skills/foo/README.md", "user-edited");
      // State records the original hash of "original", but disk now has "user-edited"
      await mgr.updateAgentsBatch({
        "claude-code": [stateEntry(".claude/skills/foo/README.md", "original")],
      });

      const result = await mgr.detectOrphans({ "claude-code": [] });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.clean).toHaveLength(0);
      expect(result.data.drifted).toHaveLength(1);
    });

    it("treats already-missing files as clean (state gets trimmed)", async () => {
      const mgr = new StateManager(tmpDir, tmpDir);
      // Never write the file to disk
      await mgr.updateAgentsBatch({
        "claude-code": [stateEntry(".claude/skills/foo/gone.txt", "ghost")],
      });

      const result = await mgr.detectOrphans({ "claude-code": [] });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.clean).toHaveLength(1);
      expect(result.data.drifted).toHaveLength(0);
    });

    it("does not report files that are still in the next generation", async () => {
      const mgr = new StateManager(tmpDir, tmpDir);
      await seedFile(".claude/skills/foo/SKILL.md", "content");
      await mgr.updateAgentsBatch({
        "claude-code": [stateEntry(".claude/skills/foo/SKILL.md", "content")],
      });

      const result = await mgr.detectOrphans({
        "claude-code": [stateEntry(".claude/skills/foo/SKILL.md", "content")],
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.clean).toHaveLength(0);
      expect(result.data.drifted).toHaveLength(0);
    });

    it("deleteOrphans unlinks files and prunes empty parent directories", async () => {
      const mgr = new StateManager(tmpDir, tmpDir);
      const full = await seedFile(".claude/skills/foo/scripts/nested/server.cjs", "bye");
      await mgr.updateAgentsBatch({
        "claude-code": [stateEntry(".claude/skills/foo/scripts/nested/server.cjs", "bye")],
      });

      const orphans = await mgr.detectOrphans({ "claude-code": [] });
      expect(orphans.ok).toBe(true);
      if (!orphans.ok) return;

      const deleted = await mgr.deleteOrphans(orphans.data.clean);
      expect(deleted).toEqual([".claude/skills/foo/scripts/nested/server.cjs"]);

      // File is gone
      await expect(fs.access(full)).rejects.toThrow();
      // And the now-empty scripts/nested and scripts/ directories were pruned
      await expect(
        fs.access(path.join(tmpDir, ".claude/skills/foo/scripts/nested")),
      ).rejects.toThrow();
      await expect(fs.access(path.join(tmpDir, ".claude/skills/foo/scripts"))).rejects.toThrow();
      // But the skill directory itself still exists (because it was empty of generated files)
      // Actually it too is empty and should have been pruned. Verify directory-up pruning stops
      // at the project root — in this test we don't seed any other files so it may climb all the way
      // to tmpDir itself, which is fine. What we care about is that nothing below the skill survives.
    });

    it("deleteOrphans is idempotent when the file is already gone", async () => {
      const mgr = new StateManager(tmpDir, tmpDir);
      // Set up state with a ghost file
      await mgr.updateAgentsBatch({
        "claude-code": [stateEntry(".claude/skills/foo/ghost.txt", "never-written")],
      });

      const deleted = await mgr.deleteOrphans([
        stateEntry(".claude/skills/foo/ghost.txt", "never-written"),
      ]);
      expect(deleted).toEqual([".claude/skills/foo/ghost.txt"]);
    });

    it("treats binary assets (placeholder empty-input hash) as clean orphans", async () => {
      // Generators that skip hashing binary assets store EMPTY_INPUT_SHA256
      // as the placeholder. Without the binary-safe path, fs.readFile(..., utf8)
      // corrupts the bytes and hash mismatch misclassifies them as drifted,
      // which leaves them on disk after agent unselect.
      const mgr = new StateManager(tmpDir, tmpDir);
      const binPath = ".cursor/skills/x/assets/font.ttf";
      const fullPath = path.join(tmpDir, binPath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      // Write actual binary bytes (non-UTF-8)
      await fs.writeFile(fullPath, Buffer.from([0x00, 0x01, 0xff, 0xfe, 0x80]));
      const { EMPTY_INPUT_SHA256 } = await import("#src/utils/hash.js");
      await mgr.updateAgentsBatch({
        cursor: [
          {
            path: binPath,
            sourceHash: "src",
            generatedHash: EMPTY_INPUT_SHA256,
            sources: ["codi.yaml"],
            timestamp: new Date().toISOString(),
          },
        ],
      });

      const result = await mgr.detectOrphans({ cursor: [] });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.clean).toHaveLength(1);
      expect(result.data.drifted).toHaveLength(0);
      expect(result.data.clean[0]!.path).toBe(binPath);
    });
  });

  describe("removeAgents", () => {
    it("clears state entries for fully-removed agents", async () => {
      const mgr = new StateManager(tmpDir, tmpDir);
      await mgr.updateAgentsBatch({
        "claude-code": [
          {
            path: "CLAUDE.md",
            sourceHash: "x",
            generatedHash: "y",
            sources: [],
            timestamp: "t",
          },
        ],
        cursor: [
          {
            path: ".cursor/rules/a.md",
            sourceHash: "x",
            generatedHash: "y",
            sources: [],
            timestamp: "t",
          },
        ],
      });

      const result = await mgr.removeAgents(["cursor"]);
      expect(result.ok).toBe(true);

      const after = await mgr.read();
      if (!after.ok) throw new Error("read failed");
      expect(Object.keys(after.data.agents).sort()).toEqual(["claude-code"]);
    });

    it("is a no-op when no requested agents are present", async () => {
      const mgr = new StateManager(tmpDir, tmpDir);
      await mgr.updateAgentsBatch({
        "claude-code": [
          {
            path: "CLAUDE.md",
            sourceHash: "x",
            generatedHash: "y",
            sources: [],
            timestamp: "t",
          },
        ],
      });
      const result = await mgr.removeAgents(["cursor", "windsurf"]);
      expect(result.ok).toBe(true);
      const after = await mgr.read();
      if (!after.ok) throw new Error("read failed");
      expect(Object.keys(after.data.agents)).toEqual(["claude-code"]);
    });
  });
});
