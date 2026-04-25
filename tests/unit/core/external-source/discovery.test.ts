import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { discoverArtifacts, findArtifactRoots } from "#src/core/external-source/discovery.js";

const FIXTURE_ROOT = path.resolve(__dirname, "../../../fixtures/external-presets/sample-a");

describe("external-source discovery", () => {
  it("walks the standard codi layout and finds artifacts of every type", async () => {
    const artifacts = await discoverArtifacts(FIXTURE_ROOT);

    const byType = artifacts.reduce<Record<string, string[]>>((acc, a) => {
      (acc[a.type] ??= []).push(a.name);
      return acc;
    }, {});

    expect(byType["rule"]).toEqual(["sample-rule"]);
    expect(byType["agent"]).toEqual(["sample-agent"]);
    expect(byType["skill"]).toEqual(["sample-skill"]);
    expect(byType["mcp-server"]).toEqual(["sample-server"]);
  });

  it("returns absolute paths and source-relative paths", async () => {
    const artifacts = await discoverArtifacts(FIXTURE_ROOT);
    const rule = artifacts.find((a) => a.name === "sample-rule");
    expect(rule).toBeDefined();
    expect(rule!.absPath).toBe(path.join(FIXTURE_ROOT, "rules", "sample-rule.md"));
    expect(rule!.relPath).toBe(path.join("rules", "sample-rule.md"));
  });

  it("skips entries with invalid frontmatter via onSkip callback", async () => {
    const skipped: Array<{ rel: string; reason: string }> = [];
    const artifacts = await discoverArtifacts(FIXTURE_ROOT, (rel, reason) =>
      skipped.push({ rel, reason }),
    );

    expect(artifacts.find((a) => a.name === "_invalid-no-frontmatter")).toBeUndefined();
    expect(skipped).toContainEqual({
      rel: path.join("rules", "_invalid-no-frontmatter.md"),
      reason: "missing 'name' in frontmatter",
    });
  });

  it("returns an empty array for a directory with no codi-layout subdirs", async () => {
    // Use the test fixtures parent dir which has no rules/skills/agents/mcp-servers
    const parent = path.dirname(FIXTURE_ROOT);
    const artifacts = await discoverArtifacts(parent);
    expect(artifacts).toEqual([]);
  });

  describe("findArtifactRoots (depth-aware preset discovery)", () => {
    let tempRoot = "";

    beforeEach(async () => {
      tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codi-roots-test-"));
    });

    afterEach(async () => {
      await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
    });

    async function makeArtifactDirs(parent: string, types: string[]): Promise<void> {
      for (const t of types) {
        await fs.mkdir(path.join(parent, t), { recursive: true });
      }
    }

    it("returns the root itself when artifact dirs are at the top level", async () => {
      await makeArtifactDirs(tempRoot, ["rules", "skills"]);
      const roots = await findArtifactRoots(tempRoot);
      expect(roots).toHaveLength(1);
      expect(roots[0]?.relPath).toBe(".");
      expect(roots[0]?.path).toBe(tempRoot);
      expect(roots[0]?.presentTypes.sort()).toEqual(["rules", "skills"]);
    });

    it("descends one level to find a wrapper folder containing artifact dirs", async () => {
      // Mimics codi-presets-main.zip → codi-presets-main/{rules,skills,...}
      const wrapper = path.join(tempRoot, "codi-presets-main");
      await fs.mkdir(wrapper, { recursive: true });
      await makeArtifactDirs(wrapper, ["rules", "agents"]);

      const roots = await findArtifactRoots(tempRoot);
      expect(roots).toHaveLength(1);
      expect(roots[0]?.relPath).toBe("codi-presets-main");
      expect(roots[0]?.presentTypes.sort()).toEqual(["agents", "rules"]);
    });

    it("returns multiple roots when the source contains several presets", async () => {
      const a = path.join(tempRoot, "preset-a");
      const b = path.join(tempRoot, "preset-b");
      await fs.mkdir(a, { recursive: true });
      await fs.mkdir(b, { recursive: true });
      await makeArtifactDirs(a, ["rules"]);
      await makeArtifactDirs(b, ["skills"]);

      const roots = await findArtifactRoots(tempRoot);
      const rels = roots.map((r) => r.relPath).sort();
      expect(rels).toEqual(["preset-a", "preset-b"]);
    });

    it("handles two-level nesting (repo wrapper containing presets)", async () => {
      // repo-name/preset-a/{rules,...} and repo-name/preset-b/{skills,...}
      const wrapperA = path.join(tempRoot, "repo-name", "preset-a");
      const wrapperB = path.join(tempRoot, "repo-name", "preset-b");
      await fs.mkdir(wrapperA, { recursive: true });
      await fs.mkdir(wrapperB, { recursive: true });
      await makeArtifactDirs(wrapperA, ["rules"]);
      await makeArtifactDirs(wrapperB, ["skills"]);

      const roots = await findArtifactRoots(tempRoot);
      const rels = roots.map((r) => r.relPath).sort();
      expect(rels).toEqual([
        path.join("repo-name", "preset-a"),
        path.join("repo-name", "preset-b"),
      ]);
    });

    it("does NOT count an artifact root's own children as nested presets", async () => {
      // tempRoot/preset-a/{rules,skills} — the inner rules/skills must not
      // themselves count as presets (they have no rules/skills/agents/mcp).
      const presetA = path.join(tempRoot, "preset-a");
      await makeArtifactDirs(presetA, ["rules", "skills"]);

      const roots = await findArtifactRoots(tempRoot);
      expect(roots).toHaveLength(1);
      expect(roots[0]?.relPath).toBe("preset-a");
    });

    it("skips dotfiles, node_modules, .git, dist, build", async () => {
      for (const noise of ["node_modules", ".git", ".github", "dist", "build", ".hidden"]) {
        await makeArtifactDirs(path.join(tempRoot, noise), ["rules"]);
      }
      const roots = await findArtifactRoots(tempRoot);
      expect(roots).toEqual([]);
    });

    it("returns empty array when no candidates exist within maxDepth", async () => {
      // 3 levels deep, beyond default maxDepth=2.
      const deep = path.join(tempRoot, "a", "b", "c");
      await fs.mkdir(deep, { recursive: true });
      await makeArtifactDirs(deep, ["rules"]);

      const roots = await findArtifactRoots(tempRoot);
      expect(roots).toEqual([]);
    });

    it("respects a custom maxDepth", async () => {
      const deep = path.join(tempRoot, "a", "b", "c");
      await fs.mkdir(deep, { recursive: true });
      await makeArtifactDirs(deep, ["rules"]);

      const roots = await findArtifactRoots(tempRoot, 3);
      expect(roots).toHaveLength(1);
      expect(roots[0]?.relPath).toBe(path.join("a", "b", "c"));
    });
  });
});
