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
}));

vi.mock("../../../src/core/external-source/installer.js", () => ({
  detectCollisions: vi.fn(),
  installSelected: vi.fn(),
}));

import * as p from "@clack/prompts";
import { runAddFromExternal } from "#src/cli/init-wizard-modify-add.js";
import {
  connectLocalDirectory,
  connectZipFile,
  connectGithubRepo,
} from "#src/core/external-source/connectors.js";
import { discoverArtifacts } from "#src/core/external-source/discovery.js";
import {
  detectCollisions,
  installSelected,
} from "#src/core/external-source/installer.js";

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

describe("runAddFromExternal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(p.isCancel).mockReturnValue(false);
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
    it("errors and cleans up when no artifacts are discovered", async () => {
      const source = makeMockSource();
      vi.mocked(p.text).mockResolvedValueOnce("/some/path" as never);
      vi.mocked(connectLocalDirectory).mockResolvedValueOnce(source);
      vi.mocked(discoverArtifacts).mockResolvedValueOnce([]);

      await runAddFromExternal("/cfg", "local");

      expect(p.log.error).toHaveBeenCalledWith(
        expect.stringContaining("No codi artifacts found"),
      );
      expect(source.cleanup).toHaveBeenCalledTimes(1);
      expect(p.multiselect).not.toHaveBeenCalled();
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
      vi.mocked(p.text).mockResolvedValueOnce("/some/path" as never);
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

      await runAddFromExternal("/cfg", "local");

      const installCallArgs = vi.mocked(installSelected).mock.calls[0]!;
      expect(installCallArgs[0]).toBe("/cfg");
      expect(installCallArgs[1]).toHaveLength(2);
      // Default resolution for non-colliding artifacts is overwrite
      expect(installCallArgs[1]?.[0]?.resolution).toEqual({ kind: "overwrite" });
      expect(p.log.success).toHaveBeenCalledWith(expect.stringContaining("Installed 2"));
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

      expect(p.log.error).toHaveBeenCalledWith(
        expect.stringContaining("Import failed: not a dir"),
      );
    });
  });
});
