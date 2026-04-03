import { describe, it, expect } from "vitest";
import {
  computeUpgradeStatus,
  buildUpgradeMap,
  formatVersionTransition,
} from "#src/core/version/upgrade-detector.js";
import type { ArtifactManifest } from "#src/core/version/artifact-manifest.js";
import type { TemplateHashRegistry } from "#src/core/version/template-hash-registry.js";

const CLI_VERSION = "2.1.0";
const ARTIFACT_VERSION = 1;

function makeManifest(artifacts: ArtifactManifest["artifacts"] = {}): ArtifactManifest {
  return { version: "1", artifacts };
}

function makeRegistry(templates: TemplateHashRegistry["templates"] = {}): TemplateHashRegistry {
  return { cliVersion: CLI_VERSION, generatedAt: new Date().toISOString(), templates };
}

function makeEntry(
  name: string,
  type: "rule" | "skill",
  contentHash: string,
  installedArtifactVersion: number | "unknown" = 1,
  managedBy: "codi" | "user" = "codi",
) {
  return {
    name,
    type,
    contentHash,
    installedArtifactVersion,
    installedAt: new Date().toISOString(),
    managedBy,
  };
}

function makeFingerprint(
  name: string,
  type: "rule" | "skill",
  contentHash: string,
  artifactVersion = ARTIFACT_VERSION,
) {
  return { name, type, contentHash, artifactVersion };
}

describe("computeUpgradeStatus()", () => {
  it('marks an artifact as "up-to-date" when hashes match', () => {
    const manifest = makeManifest({ "my-rule": makeEntry("my-rule", "rule", "hash-abc") });
    const registry = makeRegistry({ "my-rule": makeFingerprint("my-rule", "rule", "hash-abc") });

    const results = computeUpgradeStatus(manifest, registry);
    const result = results.find((r) => r.name === "my-rule");
    expect(result?.status).toBe("up-to-date");
  });

  it('marks an artifact as "outdated" when hashes differ', () => {
    const manifest = makeManifest({ "my-rule": makeEntry("my-rule", "rule", "old-hash") });
    const registry = makeRegistry({ "my-rule": makeFingerprint("my-rule", "rule", "new-hash") });

    const results = computeUpgradeStatus(manifest, registry);
    const result = results.find((r) => r.name === "my-rule");
    expect(result?.status).toBe("outdated");
    expect(result?.installedHash).toBe("old-hash");
    expect(result?.availableHash).toBe("new-hash");
  });

  it('marks an artifact as "new" when in registry but not in manifest', () => {
    const manifest = makeManifest({});
    const registry = makeRegistry({
      "brand-new-rule": makeFingerprint("brand-new-rule", "rule", "hash-xyz"),
    });

    const results = computeUpgradeStatus(manifest, registry);
    const result = results.find((r) => r.name === "brand-new-rule");
    expect(result?.status).toBe("new");
    expect(result?.installedHash).toBeNull();
  });

  it('marks an artifact as "removed" when in manifest but not in registry', () => {
    const manifest = makeManifest({ "old-rule": makeEntry("old-rule", "rule", "some-hash") });
    const registry = makeRegistry({});

    const results = computeUpgradeStatus(manifest, registry);
    const result = results.find((r) => r.name === "old-rule");
    expect(result?.status).toBe("removed");
  });

  it('marks an artifact as "user-managed" regardless of hash match', () => {
    const manifest = makeManifest({
      "custom-rule": makeEntry("custom-rule", "rule", "old-hash", "2.0.0", "user"),
    });
    const registry = makeRegistry({
      "custom-rule": makeFingerprint("custom-rule", "rule", "new-hash"),
    });

    const results = computeUpgradeStatus(manifest, registry);
    const result = results.find((r) => r.name === "custom-rule");
    expect(result?.status).toBe("user-managed");
  });

  it("returns correct availableVersion from registry artifact version", () => {
    const manifest = makeManifest({ "rule-a": makeEntry("rule-a", "rule", "hash-abc") });
    const registry = makeRegistry({ "rule-a": makeFingerprint("rule-a", "rule", "hash-abc") });

    const results = computeUpgradeStatus(manifest, registry);
    const result = results.find((r) => r.name === "rule-a");
    expect(result?.availableVersion).toBe(ARTIFACT_VERSION);
  });

  it("returns installedVersion from manifest entry", () => {
    const manifest = makeManifest({ "rule-a": makeEntry("rule-a", "rule", "old-hash", 7) });
    const registry = makeRegistry({ "rule-a": makeFingerprint("rule-a", "rule", "new-hash") });

    const results = computeUpgradeStatus(manifest, registry);
    const result = results.find((r) => r.name === "rule-a");
    expect(result?.installedVersion).toBe(7);
  });

  it("handles empty manifest and registry", () => {
    const results = computeUpgradeStatus(makeManifest(), makeRegistry());
    expect(results).toHaveLength(0);
  });

  it("handles multiple artifacts with mixed statuses", () => {
    const manifest = makeManifest({
      "up-to-date-rule": makeEntry("up-to-date-rule", "rule", "hash-same"),
      "outdated-rule": makeEntry("outdated-rule", "rule", "hash-old"),
      "user-rule": makeEntry("user-rule", "rule", "hash-x", 3, "user"),
      "removed-rule": makeEntry("removed-rule", "rule", "hash-gone"),
    });
    const registry = makeRegistry({
      "up-to-date-rule": makeFingerprint("up-to-date-rule", "rule", "hash-same"),
      "outdated-rule": makeFingerprint("outdated-rule", "rule", "hash-new"),
      "user-rule": makeFingerprint("user-rule", "rule", "hash-y"),
      "new-rule": makeFingerprint("new-rule", "rule", "hash-brand-new"),
    });

    const results = computeUpgradeStatus(manifest, registry);
    const byName = Object.fromEntries(results.map((r) => [r.name, r]));

    expect(byName["up-to-date-rule"]?.status).toBe("up-to-date");
    expect(byName["outdated-rule"]?.status).toBe("outdated");
    expect(byName["user-rule"]?.status).toBe("user-managed");
    expect(byName["removed-rule"]?.status).toBe("removed");
    expect(byName["new-rule"]?.status).toBe("new");
  });
});

describe("buildUpgradeMap()", () => {
  it("filters by artifact type and returns a Map", () => {
    const info = [
      {
        name: "rule-a",
        type: "rule" as const,
        status: "outdated" as const,
        installedVersion: 1,
        availableVersion: 2,
        installedHash: "old",
        availableHash: "new",
      },
      {
        name: "skill-b",
        type: "skill" as const,
        status: "up-to-date" as const,
        installedVersion: 2,
        availableVersion: 2,
        installedHash: "same",
        availableHash: "same",
      },
    ];

    const ruleMap = buildUpgradeMap(info, "rule");
    expect(ruleMap.size).toBe(1);
    expect(ruleMap.has("rule-a")).toBe(true);
    expect(ruleMap.has("skill-b")).toBe(false);
  });

  it("returns empty map when no artifacts match type", () => {
    const info = [
      {
        name: "rule-a",
        type: "rule" as const,
        status: "new" as const,
        installedVersion: null,
        availableVersion: 1,
        installedHash: null,
        availableHash: "hash",
      },
    ];
    const skillMap = buildUpgradeMap(info, "skill");
    expect(skillMap.size).toBe(0);
  });
});

describe("formatVersionTransition()", () => {
  it('shows "unknown → vN" for unknown installedVersion', () => {
    const info = {
      name: "rule-a",
      type: "rule" as const,
      status: "outdated" as const,
      installedVersion: "unknown",
      availableVersion: 2,
      installedHash: "old",
      availableHash: "new",
    };
    const result = formatVersionTransition(info);
    expect(result).toContain("unknown");
    expect(result).toContain("v2");
  });

  it("shows version transition when both versions are known", () => {
    const info = {
      name: "rule-a",
      type: "rule" as const,
      status: "outdated" as const,
      installedVersion: 1,
      availableVersion: 2,
      installedHash: "old",
      availableHash: "new",
    };
    const result = formatVersionTransition(info);
    expect(result).toContain("v1");
    expect(result).toContain("v2");
  });

  it("returns a non-empty string", () => {
    const info = {
      name: "rule-a",
      type: "rule" as const,
      status: "up-to-date" as const,
      installedVersion: 2,
      availableVersion: 2,
      installedHash: "same",
      availableHash: "same",
    };
    expect(formatVersionTransition(info).length).toBeGreaterThan(0);
  });
});
