import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import {
  detectCollisions,
  installSelected,
  type InstallEntry,
} from "#src/core/external-source/installer.js";
import { discoverArtifacts } from "#src/core/external-source/discovery.js";
import { connectLocalDirectory } from "#src/core/external-source/connectors.js";
import { ARTIFACT_MANIFEST_FILENAME } from "#src/constants.js";

const FIXTURE_ROOT = path.resolve(__dirname, "../../../fixtures/external-presets/sample-a");

let tempConfigDir: string;

beforeEach(async () => {
  tempConfigDir = await fs.mkdtemp(path.join(os.tmpdir(), "codi-installer-test-"));
});

afterEach(async () => {
  await fs.rm(tempConfigDir, { recursive: true, force: true });
});

describe("external-source installer", () => {
  describe("detectCollisions", () => {
    it("marks every selected artifact as 'fresh' when target dir is empty", async () => {
      const artifacts = await discoverArtifacts(FIXTURE_ROOT);
      const map = await detectCollisions(tempConfigDir, artifacts);
      for (const status of map.values()) expect(status).toBe("fresh");
    });

    it("marks an artifact as 'exists' when same-named file already in .codi/", async () => {
      await fs.mkdir(path.join(tempConfigDir, "rules"), { recursive: true });
      await fs.writeFile(path.join(tempConfigDir, "rules", "sample-rule.md"), "existing\n");
      const artifacts = await discoverArtifacts(FIXTURE_ROOT);
      const rule = artifacts.find((a) => a.name === "sample-rule")!;
      const map = await detectCollisions(tempConfigDir, [rule]);
      expect(map.get(rule)).toBe("exists");
    });
  });

  describe("installSelected", () => {
    async function readManifest(): Promise<unknown> {
      const raw = await fs.readFile(path.join(tempConfigDir, ARTIFACT_MANIFEST_FILENAME), "utf8");
      return JSON.parse(raw);
    }

    it("copies a rule and writes a manifest entry with managed_by:user + source", async () => {
      const source = await connectLocalDirectory(FIXTURE_ROOT);
      const artifacts = await discoverArtifacts(source.rootPath);
      const rule = artifacts.find((a) => a.name === "sample-rule")!;

      const entries: InstallEntry[] = [{ artifact: rule, resolution: { kind: "overwrite" } }];
      const summary = await installSelected(tempConfigDir, entries, source);

      expect(summary.installed).toBe(1);
      expect(summary.skipped).toBe(0);

      const installed = await fs.readFile(
        path.join(tempConfigDir, "rules", "sample-rule.md"),
        "utf8",
      );
      expect(installed).toContain("name: sample-rule");

      const manifest = (await readManifest()) as {
        artifacts: Record<string, { managedBy: string; source: string; type: string }>;
      };
      expect(manifest.artifacts["sample-rule"]?.managedBy).toBe("user");
      expect(manifest.artifacts["sample-rule"]?.source).toBe(source.id);
      expect(manifest.artifacts["sample-rule"]?.type).toBe("rule");
    });

    it("skips entries with resolution.kind === 'skip'", async () => {
      const source = await connectLocalDirectory(FIXTURE_ROOT);
      const artifacts = await discoverArtifacts(source.rootPath);
      const rule = artifacts.find((a) => a.name === "sample-rule")!;

      const summary = await installSelected(
        tempConfigDir,
        [{ artifact: rule, resolution: { kind: "skip" } }],
        source,
      );

      expect(summary.installed).toBe(0);
      expect(summary.skipped).toBe(1);
      const exists = await fs
        .stat(path.join(tempConfigDir, "rules", "sample-rule.md"))
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(false);
    });

    it("renames imported file when resolution.kind === 'rename'", async () => {
      const source = await connectLocalDirectory(FIXTURE_ROOT);
      const artifacts = await discoverArtifacts(source.rootPath);
      const rule = artifacts.find((a) => a.name === "sample-rule")!;

      const summary = await installSelected(
        tempConfigDir,
        [
          {
            artifact: rule,
            resolution: { kind: "rename", newName: "sample-rule-from-fixture" },
          },
        ],
        source,
      );

      expect(summary.installed).toBe(1);
      expect(summary.renamed).toBe(1);

      const renamed = await fs
        .stat(path.join(tempConfigDir, "rules", "sample-rule-from-fixture.md"))
        .then(() => true)
        .catch(() => false);
      expect(renamed).toBe(true);

      const manifest = (await readManifest()) as {
        artifacts: Record<string, unknown>;
      };
      expect(manifest.artifacts["sample-rule-from-fixture"]).toBeDefined();
    });

    it("copies a skill directory recursively", async () => {
      const source = await connectLocalDirectory(FIXTURE_ROOT);
      const artifacts = await discoverArtifacts(source.rootPath);
      const skill = artifacts.find((a) => a.name === "sample-skill")!;

      await installSelected(
        tempConfigDir,
        [{ artifact: skill, resolution: { kind: "overwrite" } }],
        source,
      );

      const skillFile = await fs.readFile(
        path.join(tempConfigDir, "skills", "sample-skill", "SKILL.md"),
        "utf8",
      );
      expect(skillFile).toContain("name: sample-skill");
    });
  });
});
