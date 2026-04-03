import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { cleanupTmpDir } from "#tests/helpers/fs.js";
import {
  ArtifactManifestManager,
  buildArtifactEntries,
  bootstrapManifestFromState,
} from "#src/core/version/artifact-manifest.js";
import { PROJECT_NAME, PROJECT_DIR, ARTIFACT_MANIFEST_FILENAME } from "#src/constants.js";
import type { ExistingSelections } from "#src/cli/init-wizard.js";

const ARTIFACT_VERSION = 1;

function makeEntry(name: string, type: "rule" | "skill", hash = "abc123") {
  return {
    name,
    type,
    contentHash: hash,
    installedArtifactVersion: ARTIFACT_VERSION,
    installedAt: new Date().toISOString(),
    managedBy: "codi" as const,
  };
}

describe("ArtifactManifestManager", () => {
  let tmpDir: string;
  let configDir: string;
  let mgr: ArtifactManifestManager;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `${PROJECT_NAME}-manifest-`));
    configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.mkdir(configDir, { recursive: true });
    mgr = new ArtifactManifestManager(configDir);
  });

  afterEach(async () => {
    await cleanupTmpDir(tmpDir);
  });

  describe("read()", () => {
    it("returns empty manifest when file does not exist", async () => {
      const result = await mgr.read();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.version).toBe("1");
        expect(result.data.artifacts).toEqual({});
      }
    });

    it("returns parsed manifest when file exists", async () => {
      const manifest = {
        version: "1" as const,
        artifacts: { "my-rule": makeEntry("my-rule", "rule") },
      };
      await fs.writeFile(
        path.join(configDir, ARTIFACT_MANIFEST_FILENAME),
        JSON.stringify(manifest),
        "utf8",
      );
      const result = await mgr.read();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.artifacts["my-rule"]).toBeDefined();
        expect(result.data.artifacts["my-rule"]?.type).toBe("rule");
      }
    });

    it("returns empty manifest when file has invalid JSON schema", async () => {
      await fs.writeFile(
        path.join(configDir, ARTIFACT_MANIFEST_FILENAME),
        JSON.stringify({ version: "99", artifacts: {} }),
        "utf8",
      );
      const result = await mgr.read();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.artifacts).toEqual({});
      }
    });
  });

  describe("write()", () => {
    it("writes manifest atomically (tmp + rename)", async () => {
      const manifest = {
        version: "1" as const,
        artifacts: { "test-rule": makeEntry("test-rule", "rule") },
      };
      const writeResult = await mgr.write(manifest);
      expect(writeResult.ok).toBe(true);

      const raw = await fs.readFile(path.join(configDir, ARTIFACT_MANIFEST_FILENAME), "utf8");
      const parsed = JSON.parse(raw) as { artifacts: Record<string, unknown> };
      expect(parsed.artifacts["test-rule"]).toBeDefined();
    });
  });

  describe("recordInstall()", () => {
    it("adds new entries to an empty manifest", async () => {
      const entries = [makeEntry("rule-a", "rule"), makeEntry("skill-b", "skill")];
      const result = await mgr.recordInstall(entries);
      expect(result.ok).toBe(true);

      const readResult = await mgr.read();
      if (readResult.ok) {
        expect(readResult.data.artifacts["rule-a"]).toBeDefined();
        expect(readResult.data.artifacts["skill-b"]).toBeDefined();
      }
    });

    it("updates existing entries", async () => {
      await mgr.recordInstall([makeEntry("rule-a", "rule", "old-hash")]);
      await mgr.recordInstall([makeEntry("rule-a", "rule", "new-hash")]);

      const readResult = await mgr.read();
      if (readResult.ok) {
        expect(readResult.data.artifacts["rule-a"]?.contentHash).toBe("new-hash");
      }
    });

    it("preserves existing entries when recording new ones", async () => {
      await mgr.recordInstall([makeEntry("rule-a", "rule")]);
      await mgr.recordInstall([makeEntry("rule-b", "rule")]);

      const readResult = await mgr.read();
      if (readResult.ok) {
        expect(readResult.data.artifacts["rule-a"]).toBeDefined();
        expect(readResult.data.artifacts["rule-b"]).toBeDefined();
      }
    });
  });

  describe("removeArtifacts()", () => {
    it("removes specified artifacts from the manifest", async () => {
      await mgr.recordInstall([makeEntry("rule-a", "rule"), makeEntry("rule-b", "rule")]);
      await mgr.removeArtifacts(["rule-a"]);

      const readResult = await mgr.read();
      if (readResult.ok) {
        expect(readResult.data.artifacts["rule-a"]).toBeUndefined();
        expect(readResult.data.artifacts["rule-b"]).toBeDefined();
      }
    });

    it("is a no-op for names that do not exist", async () => {
      await mgr.recordInstall([makeEntry("rule-a", "rule")]);
      const result = await mgr.removeArtifacts(["nonexistent"]);
      expect(result.ok).toBe(true);

      const readResult = await mgr.read();
      if (readResult.ok) {
        expect(readResult.data.artifacts["rule-a"]).toBeDefined();
      }
    });
  });

  describe("getEntry()", () => {
    it("returns the entry for a known artifact", async () => {
      await mgr.recordInstall([makeEntry("rule-a", "rule", "hash-xyz")]);
      const entry = await mgr.getEntry("rule-a");
      expect(entry).toBeDefined();
      expect(entry?.contentHash).toBe("hash-xyz");
    });

    it("returns undefined for an unknown artifact", async () => {
      const entry = await mgr.getEntry("not-there");
      expect(entry).toBeUndefined();
    });
  });

  describe("exists()", () => {
    it("returns false when manifest file does not exist", async () => {
      expect(await mgr.exists()).toBe(false);
    });

    it("returns true after writing a manifest", async () => {
      await mgr.write({ version: "1", artifacts: {} });
      expect(await mgr.exists()).toBe(true);
    });
  });
});

describe("buildArtifactEntries()", () => {
  it("maps artifact data to ArtifactEntry objects", () => {
    const data = [
      {
        name: "my-rule",
        type: "rule" as const,
        content: "rule content",
        managedBy: "codi" as const,
      },
      {
        name: "my-skill",
        type: "skill" as const,
        content: "skill content",
        managedBy: "user" as const,
      },
    ];
    const entries = buildArtifactEntries(
      data.map((entry) => ({ ...entry, artifactVersion: ARTIFACT_VERSION })),
    );
    expect(entries).toHaveLength(2);
    expect(entries[0]?.name).toBe("my-rule");
    expect(entries[0]?.type).toBe("rule");
    expect(entries[0]?.installedArtifactVersion).toBe(ARTIFACT_VERSION);
    expect(entries[0]?.managedBy).toBe("codi");
    expect(entries[0]?.contentHash).toBeTruthy();
    expect(entries[1]?.managedBy).toBe("user");
  });

  it("produces deterministic hashes for the same content", () => {
    const data = [
      {
        name: "r",
        type: "rule" as const,
        content: "same content",
        managedBy: "codi" as const,
        artifactVersion: ARTIFACT_VERSION,
      },
    ];
    const [e1] = buildArtifactEntries(data);
    const [e2] = buildArtifactEntries(data);
    expect(e1?.contentHash).toBe(e2?.contentHash);
  });

  it("produces different hashes for different content", () => {
    const d1 = [
      {
        name: "r",
        type: "rule" as const,
        content: "content A",
        managedBy: "codi" as const,
        artifactVersion: ARTIFACT_VERSION,
      },
    ];
    const d2 = [
      {
        name: "r",
        type: "rule" as const,
        content: "content B",
        managedBy: "codi" as const,
        artifactVersion: ARTIFACT_VERSION,
      },
    ];
    const [e1] = buildArtifactEntries(d1);
    const [e2] = buildArtifactEntries(d2);
    expect(e1?.contentHash).not.toBe(e2?.contentHash);
  });
});

describe("bootstrapManifestFromState()", () => {
  let tmpDir: string;
  let configDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `${PROJECT_NAME}-bootstrap-`));
    configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.mkdir(path.join(configDir, "rules"), { recursive: true });
    await fs.mkdir(path.join(configDir, "agents"), { recursive: true });
  });

  afterEach(async () => {
    await cleanupTmpDir(tmpDir);
  });

  it("creates a manifest from existing installed files", async () => {
    await fs.writeFile(
      path.join(configDir, "rules", "my-rule.md"),
      "---\nmanaged_by: codi\n---\n# Rule",
      "utf8",
    );

    const selections: ExistingSelections = {
      preset: "balanced",
      rules: ["my-rule"],
      skills: [],
      agents: [],
      commands: [],
      mcpServers: [],
    };

    const manifest = await bootstrapManifestFromState(configDir, tmpDir, selections);
    expect(manifest.version).toBe("1");
    expect(manifest.artifacts["my-rule"]).toBeDefined();
    expect(manifest.artifacts["my-rule"]?.installedArtifactVersion).toBe("unknown");
    expect(manifest.artifacts["my-rule"]?.managedBy).toBe("codi");
  });

  it("marks user-managed files with managedBy: user", async () => {
    await fs.writeFile(
      path.join(configDir, "rules", "custom-rule.md"),
      "---\nmanaged_by: user\n---\n# Custom",
      "utf8",
    );

    const selections: ExistingSelections = {
      preset: "balanced",
      rules: ["custom-rule"],
      skills: [],
      agents: [],
      commands: [],
      mcpServers: [],
    };

    const manifest = await bootstrapManifestFromState(configDir, tmpDir, selections);
    expect(manifest.artifacts["custom-rule"]?.managedBy).toBe("user");
  });

  it("silently skips missing files", async () => {
    const selections: ExistingSelections = {
      preset: "balanced",
      rules: ["missing-rule"],
      skills: [],
      agents: [],
      commands: [],
      mcpServers: [],
    };

    const manifest = await bootstrapManifestFromState(configDir, tmpDir, selections);
    expect(manifest.artifacts["missing-rule"]).toBeUndefined();
  });

  it("writes the manifest file to disk", async () => {
    const selections: ExistingSelections = {
      preset: "balanced",
      rules: [],
      skills: [],
      agents: [],
      commands: [],
      mcpServers: [],
    };

    await bootstrapManifestFromState(configDir, tmpDir, selections);
    const exists = await fs
      .access(path.join(configDir, ARTIFACT_MANIFEST_FILENAME))
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(true);
  });
});
