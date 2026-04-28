import { describe, it, expect } from "vitest";
import {
  updateManifestEntry,
  type ManifestShape,
} from "#src/core/hooks/hook-logic/update-manifest.js";

function makeManifest(): ManifestShape {
  return {
    version: "1",
    artifacts: {
      "my-rule": {
        name: "my-rule",
        type: "rule",
        contentHash: "old-hash",
        installedArtifactVersion: 1,
        installedAt: "2026-04-01T00:00:00.000Z",
        managedBy: "user",
      },
    },
  };
}

describe("updateManifestEntry", () => {
  it("updates existing entry hash + version", () => {
    const m = makeManifest();
    const result = updateManifestEntry(m, {
      name: "my-rule",
      type: "rule",
      contentHash: "new-hash",
      installedArtifactVersion: 2,
      installedAt: "2026-04-28T11:30:00.000Z",
      managedBy: "user",
    });
    expect(result.artifacts["my-rule"].contentHash).toBe("new-hash");
    expect(result.artifacts["my-rule"].installedArtifactVersion).toBe(2);
  });

  it("adds new entry when missing", () => {
    const m = makeManifest();
    const result = updateManifestEntry(m, {
      name: "new-rule",
      type: "rule",
      contentHash: "hash-x",
      installedArtifactVersion: 1,
      installedAt: "2026-04-28T11:30:00.000Z",
      managedBy: "user",
    });
    expect(result.artifacts["new-rule"]).toBeDefined();
    expect(result.artifacts["new-rule"].contentHash).toBe("hash-x");
  });

  it("removes entry when delete flag is set", () => {
    const m = makeManifest();
    const result = updateManifestEntry(m, {
      name: "my-rule",
      delete: true,
    });
    expect(result.artifacts["my-rule"]).toBeUndefined();
  });

  it("preserves other entries", () => {
    const m = makeManifest();
    m.artifacts["other"] = {
      name: "other",
      type: "skill",
      contentHash: "h",
      installedArtifactVersion: 1,
      installedAt: "2026-04-01T00:00:00.000Z",
      managedBy: "user",
    };
    const result = updateManifestEntry(m, {
      name: "my-rule",
      type: "rule",
      contentHash: "new",
      installedArtifactVersion: 2,
      installedAt: "2026-04-28T11:30:00.000Z",
      managedBy: "user",
    });
    expect(result.artifacts["other"]).toBeDefined();
  });
});
