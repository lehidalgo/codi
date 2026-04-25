import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@clack/prompts", () => ({
  isCancel: vi.fn().mockReturnValue(false),
  text: vi.fn(),
  select: vi.fn(),
  multiselect: vi.fn(),
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    step: vi.fn(),
  },
}));

vi.mock("../../../src/core/external-source/connectors.js", () => ({
  connectLocalDirectory: vi.fn(),
  connectZipFile: vi.fn(),
  connectGithubRepo: vi.fn(),
}));

vi.mock("../../../src/core/external-source/discovery.js", () => ({
  discoverArtifacts: vi.fn(),
  findArtifactRoots: vi.fn(),
}));

vi.mock("../../../src/core/external-source/installer.js", () => ({
  detectCollisions: vi.fn(),
  installSelected: vi.fn(),
}));

vi.mock("../../../src/cli/shared.js", () => ({
  regenerateConfigs: vi.fn().mockResolvedValue(true),
}));

import * as p from "@clack/prompts";
import { runAddFromExternal } from "#src/cli/init-wizard-modify-add.js";
import {
  connectLocalDirectory,
  connectZipFile,
  connectGithubRepo,
} from "#src/core/external-source/connectors.js";
import { discoverArtifacts, findArtifactRoots } from "#src/core/external-source/discovery.js";
import { detectCollisions, installSelected } from "#src/core/external-source/installer.js";
import { regenerateConfigs } from "#src/cli/shared.js";

function makeMockSource(id = "local:/fake/path") {
  return {
    id,
    rootPath: "/fake/extracted",
    cleanup: vi.fn().mockResolvedValue(undefined),
  };
}

const ruleArtifact = {
  type: "rule" as const,
  name: "alpha",
  relPath: "rules/alpha.md",
  absPath: "/fake/extracted/rules/alpha.md",
};
const skillArtifact = {
  type: "skill" as const,
  name: "beta",
  relPath: "skills/beta",
  absPath: "/fake/extracted/skills/beta",
};

function singleRoot(absPath = "/fake/extracted") {
  return [{ path: absPath, relPath: ".", presentTypes: ["rules"] }];
}

describe("runAddFromExternal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(p.isCancel).mockReturnValue(false);
    // Default: source root is the only candidate (most common case).
    vi.mocked(findArtifactRoots).mockResolvedValue(singleRoot());
  });

  describe("source-kind plumbing", () => {
    it("uses connectLocalDirectory when kind = 'local'", async () => {
      vi.mocked(p.text).mockResolvedValueOnce("/some/path" as never);
      vi.mocked(connectLocalDirectory).mockResolvedValueOnce(makeMockSource());
      vi.mocked(discoverArtifacts).mockResolvedValueOnce([]);

      await runAddFromExternal("/cfg", "local");

      expect(connectLocalDirectory).toHaveBeenCalledWith("/some/path");
      expect(connectZipFile).not.toHaveBeenCalled();
      expect(connectGithubRepo).not.toHaveBeenCalled();
    });

    it("uses connectZipFile when kind = 'zip'", async () => {
      vi.mocked(p.text).mockResolvedValueOnce("/x.zip" as never);
      vi.mocked(connectZipFile).mockResolvedValueOnce(makeMockSource("zip:x.zip"));
      vi.mocked(discoverArtifacts).mockResolvedValueOnce([]);

      await runAddFromExternal("/cfg", "zip");

      expect(connectZipFile).toHaveBeenCalledWith("/x.zip");
    });

    it("uses connectGithubRepo when kind = 'github'", async () => {
      vi.mocked(p.text).mockResolvedValueOnce("org/repo" as never);
      vi.mocked(connectGithubRepo).mockResolvedValueOnce(makeMockSource("github:org/repo"));
      vi.mocked(discoverArtifacts).mockResolvedValueOnce([]);

      await runAddFromExternal("/cfg", "github");

      expect(connectGithubRepo).toHaveBeenCalledWith("org/repo");
    });

    it("returns early without connecting when the path prompt is cancelled", async () => {
      vi.mocked(p.text).mockResolvedValueOnce(Symbol("cancel") as never);
      vi.mocked(p.isCancel).mockReturnValueOnce(true);

      await runAddFromExternal("/cfg", "local");

      expect(connectLocalDirectory).not.toHaveBeenCalled();
      expect(discoverArtifacts).not.toHaveBeenCalled();
    });
  });

  describe("discovery + selection", () => {
    it("errors and cleans up when no artifact roots are found in the source tree", async () => {
      const source = makeMockSource();
      vi.mocked(p.text).mockResolvedValueOnce("/some/path" as never);
      vi.mocked(connectLocalDirectory).mockResolvedValueOnce(source);
      vi.mocked(findArtifactRoots).mockResolvedValueOnce([]);

      await runAddFromExternal("/cfg", "local");

      expect(p.log.error).toHaveBeenCalledWith(expect.stringContaining("No codi artifacts found"));
      expect(source.cleanup).toHaveBeenCalledTimes(1);
      expect(p.multiselect).not.toHaveBeenCalled();
    });

    it("auto-uses a single artifact root without prompting", async () => {
      const source = makeMockSource();
      vi.mocked(p.text).mockResolvedValueOnce("/some/path" as never);
      vi.mocked(connectLocalDirectory).mockResolvedValueOnce(source);
      vi.mocked(findArtifactRoots).mockResolvedValueOnce(singleRoot("/fake/extracted"));
      vi.mocked(discoverArtifacts).mockResolvedValueOnce([ruleArtifact]);
      vi.mocked(p.multiselect).mockResolvedValueOnce([] as never);

      await runAddFromExternal("/cfg", "local");

      // No "which preset?" select prompt was shown for the single-root case.
      expect(p.select).not.toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining("Which one") }),
      );
      // discoverArtifacts was called against the single root path.
      expect(discoverArtifacts).toHaveBeenCalledWith("/fake/extracted", expect.any(Function));
    });

    it("prompts the user to pick when multiple presets are found in the source", async () => {
      const source = makeMockSource();
      vi.mocked(p.text).mockResolvedValueOnce("/some/path" as never);
      vi.mocked(connectLocalDirectory).mockResolvedValueOnce(source);
      const rootA = {
        path: "/fake/extracted/preset-a",
        relPath: "preset-a",
        presentTypes: ["rules", "skills"],
      };
      const rootB = {
        path: "/fake/extracted/preset-b",
        relPath: "preset-b",
        presentTypes: ["agents"],
      };
      vi.mocked(findArtifactRoots).mockResolvedValueOnce([rootA, rootB]);
      vi.mocked(p.select).mockResolvedValueOnce(rootB as never);
      vi.mocked(discoverArtifacts).mockResolvedValueOnce([ruleArtifact]);
      vi.mocked(p.multiselect).mockResolvedValueOnce([] as never);

      await runAddFromExternal("/cfg", "local");

      const presetPrompt = vi.mocked(p.select).mock.calls[0]?.[0];
      expect(presetPrompt?.message).toContain("Found 2 presets");
      expect(presetPrompt?.options.map((o) => o.value)).toEqual([rootA, rootB]);
      expect(discoverArtifacts).toHaveBeenCalledWith(rootB.path, expect.any(Function));
    });

    it("returns cleanly when the preset selection is cancelled", async () => {
      const source = makeMockSource();
      vi.mocked(p.text).mockResolvedValueOnce("/some/path" as never);
      vi.mocked(connectLocalDirectory).mockResolvedValueOnce(source);
      vi.mocked(findArtifactRoots).mockResolvedValueOnce([
        { path: "/a", relPath: "preset-a", presentTypes: ["rules"] },
        { path: "/b", relPath: "preset-b", presentTypes: ["rules"] },
      ]);
      vi.mocked(p.select).mockResolvedValueOnce(Symbol("cancel") as never);
      vi.mocked(p.isCancel).mockImplementation((v) => typeof v === "symbol");

      await runAddFromExternal("/cfg", "local");

      expect(discoverArtifacts).not.toHaveBeenCalled();
      expect(source.cleanup).toHaveBeenCalled();
    });

    it("warns about skipped invalid entries reported by discovery", async () => {
      const source = makeMockSource();
      vi.mocked(p.text).mockResolvedValueOnce("/some/path" as never);
      vi.mocked(connectLocalDirectory).mockResolvedValueOnce(source);
      vi.mocked(discoverArtifacts).mockImplementationOnce(async (_root, onSkip) => {
        onSkip?.("rules/_bad.md", "missing 'name' in frontmatter");
        return [ruleArtifact];
      });
      vi.mocked(p.multiselect).mockResolvedValueOnce([] as never);

      await runAddFromExternal("/cfg", "local");

      expect(p.log.warn).toHaveBeenCalledWith(expect.stringContaining("Skipped 1 invalid"));
    });

    it("aborts cleanly (info, not error) when the user picks no artifacts", async () => {
      const source = makeMockSource();
      vi.mocked(p.text).mockResolvedValueOnce("/some/path" as never);
      vi.mocked(connectLocalDirectory).mockResolvedValueOnce(source);
      vi.mocked(discoverArtifacts).mockResolvedValueOnce([ruleArtifact]);
      vi.mocked(p.multiselect).mockResolvedValueOnce([] as never);

      await runAddFromExternal("/cfg", "local");

      expect(p.log.info).toHaveBeenCalledWith(expect.stringContaining("No artifacts selected"));
      expect(installSelected).not.toHaveBeenCalled();
      expect(source.cleanup).toHaveBeenCalled();
    });
  });

  describe("happy path + collisions", () => {
    it("installs selected artifacts when there are no collisions", async () => {
      const source = makeMockSource();
      vi.mocked(p.text).mockResolvedValueOnce("/path/to/project/.codi" as never);
      vi.mocked(connectLocalDirectory).mockResolvedValueOnce(source);
      vi.mocked(discoverArtifacts).mockResolvedValueOnce([ruleArtifact, skillArtifact]);
      vi.mocked(p.multiselect).mockResolvedValueOnce([ruleArtifact, skillArtifact] as never);
      vi.mocked(detectCollisions).mockResolvedValueOnce(
        new Map([
          [ruleArtifact, "fresh"],
          [skillArtifact, "fresh"],
        ]) as never,
      );
      vi.mocked(installSelected).mockResolvedValueOnce({
        installed: 2,
        skipped: 0,
        renamed: 0,
      });

      await runAddFromExternal("/path/to/project/.codi", "local");

      const installCallArgs = vi.mocked(installSelected).mock.calls[0]!;
      expect(installCallArgs[0]).toBe("/path/to/project/.codi");
      expect(installCallArgs[1]).toHaveLength(2);
      // Default resolution for non-colliding artifacts is overwrite
      expect(installCallArgs[1]?.[0]?.resolution).toEqual({ kind: "overwrite" });
      expect(p.log.success).toHaveBeenCalledWith(expect.stringContaining("Installed 2"));
    });

    it("auto-triggers regenerateConfigs against the project root after a successful install", async () => {
      const source = makeMockSource();
      vi.mocked(p.text).mockResolvedValueOnce("/path/to/project/.codi" as never);
      vi.mocked(connectLocalDirectory).mockResolvedValueOnce(source);
      vi.mocked(discoverArtifacts).mockResolvedValueOnce([ruleArtifact]);
      vi.mocked(p.multiselect).mockResolvedValueOnce([ruleArtifact] as never);
      vi.mocked(detectCollisions).mockResolvedValueOnce(
        new Map([[ruleArtifact, "fresh"]]) as never,
      );
      vi.mocked(installSelected).mockResolvedValueOnce({
        installed: 1,
        skipped: 0,
        renamed: 0,
      });

      await runAddFromExternal("/path/to/project/.codi", "local");

      // Project root is the parent of configDir (.codi/).
      expect(regenerateConfigs).toHaveBeenCalledWith("/path/to/project");
      expect(p.log.success).toHaveBeenCalledWith(
        expect.stringContaining("Agent configs regenerated"),
      );
    });

    it("skips auto-generate when nothing was installed", async () => {
      const source = makeMockSource();
      vi.mocked(p.text).mockResolvedValueOnce("/cfg" as never);
      vi.mocked(connectLocalDirectory).mockResolvedValueOnce(source);
      vi.mocked(discoverArtifacts).mockResolvedValueOnce([ruleArtifact]);
      vi.mocked(p.multiselect).mockResolvedValueOnce([ruleArtifact] as never);
      vi.mocked(detectCollisions).mockResolvedValueOnce(
        new Map([[ruleArtifact, "exists"]]) as never,
      );
      vi.mocked(p.select).mockResolvedValueOnce("skip" as never);
      vi.mocked(installSelected).mockResolvedValueOnce({
        installed: 0,
        skipped: 1,
        renamed: 0,
      });

      await runAddFromExternal("/cfg", "local");

      expect(regenerateConfigs).not.toHaveBeenCalled();
    });

    it("warns the user to run codi generate manually if auto-generate fails", async () => {
      const source = makeMockSource();
      vi.mocked(p.text).mockResolvedValueOnce("/cfg" as never);
      vi.mocked(connectLocalDirectory).mockResolvedValueOnce(source);
      vi.mocked(discoverArtifacts).mockResolvedValueOnce([ruleArtifact]);
      vi.mocked(p.multiselect).mockResolvedValueOnce([ruleArtifact] as never);
      vi.mocked(detectCollisions).mockResolvedValueOnce(
        new Map([[ruleArtifact, "fresh"]]) as never,
      );
      vi.mocked(installSelected).mockResolvedValueOnce({
        installed: 1,
        skipped: 0,
        renamed: 0,
      });
      vi.mocked(regenerateConfigs).mockResolvedValueOnce(false);

      await runAddFromExternal("/cfg", "local");

      expect(p.log.warn).toHaveBeenCalledWith(
        expect.stringContaining("run `codi generate` manually"),
      );
    });

    it("prompts per collision with skip / overwrite / rename options", async () => {
      const source = makeMockSource("local:/x");
      vi.mocked(p.text).mockResolvedValueOnce("/some/path" as never);
      vi.mocked(connectLocalDirectory).mockResolvedValueOnce(source);
      vi.mocked(discoverArtifacts).mockResolvedValueOnce([ruleArtifact]);
      vi.mocked(p.multiselect).mockResolvedValueOnce([ruleArtifact] as never);
      vi.mocked(detectCollisions).mockResolvedValueOnce(
        new Map([[ruleArtifact, "exists"]]) as never,
      );
      vi.mocked(p.select).mockResolvedValueOnce("skip" as never);
      vi.mocked(installSelected).mockResolvedValueOnce({
        installed: 0,
        skipped: 1,
        renamed: 0,
      });

      await runAddFromExternal("/cfg", "local");

      const collisionPrompt = vi.mocked(p.select).mock.calls[0]?.[0];
      expect(collisionPrompt?.message).toContain("alpha");
      const optionValues = collisionPrompt?.options.map((o) => o.value);
      expect(optionValues).toContain("skip");
      expect(optionValues).toContain("overwrite");
      expect(optionValues).toContain("rename");
    });

    it("treats cancellation of a collision prompt as 'keep current'", async () => {
      const source = makeMockSource();
      vi.mocked(p.text).mockResolvedValueOnce("/some/path" as never);
      vi.mocked(connectLocalDirectory).mockResolvedValueOnce(source);
      vi.mocked(discoverArtifacts).mockResolvedValueOnce([ruleArtifact]);
      vi.mocked(p.multiselect).mockResolvedValueOnce([ruleArtifact] as never);
      vi.mocked(detectCollisions).mockResolvedValueOnce(
        new Map([[ruleArtifact, "exists"]]) as never,
      );
      // The collision prompt resolves to a cancel symbol; isCancel detects it.
      vi.mocked(p.select).mockResolvedValueOnce(Symbol("cancel") as never);
      vi.mocked(p.isCancel).mockImplementation((v) => typeof v === "symbol");
      vi.mocked(installSelected).mockResolvedValueOnce({
        installed: 0,
        skipped: 1,
        renamed: 0,
      });

      await runAddFromExternal("/cfg", "local");

      const installEntries = vi.mocked(installSelected).mock.calls[0]?.[1];
      expect(installEntries?.[0]?.resolution).toEqual({ kind: "skip" });
    });
  });

  describe("error + cleanup contract", () => {
    it("logs and cleans up when discovery throws", async () => {
      const source = makeMockSource();
      vi.mocked(p.text).mockResolvedValueOnce("/some/path" as never);
      vi.mocked(connectLocalDirectory).mockResolvedValueOnce(source);
      vi.mocked(discoverArtifacts).mockRejectedValueOnce(new Error("boom"));

      await runAddFromExternal("/cfg", "local");

      expect(p.log.error).toHaveBeenCalledWith(expect.stringContaining("Import failed: boom"));
      expect(source.cleanup).toHaveBeenCalled();
    });

    it("does not call cleanup when source connection throws", async () => {
      vi.mocked(p.text).mockResolvedValueOnce("/some/path" as never);
      vi.mocked(connectLocalDirectory).mockRejectedValueOnce(new Error("not a dir"));

      await runAddFromExternal("/cfg", "local");

      expect(p.log.error).toHaveBeenCalledWith(expect.stringContaining("Import failed: not a dir"));
    });
  });
});
