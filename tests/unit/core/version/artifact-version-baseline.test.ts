import { describe, expect, it } from "vitest";
import { checkArtifactVersionBaseline } from "#src/core/version/artifact-version-baseline.js";

describe("checkArtifactVersionBaseline", () => {
  it("fails when content changes without a version bump", () => {
    const registry = {
      cliVersion: "2.1.0",
      generatedAt: new Date().toISOString(),
      templates: {
        "demo-rule": {
          name: "demo-rule",
          type: "rule" as const,
          contentHash: "new-hash",
          artifactVersion: 1,
        },
      },
    };
    const baseline = {
      "demo-rule": {
        version: 1,
        hash: "old-hash",
      },
    };

    const errors = checkArtifactVersionBaseline(registry, baseline);
    expect(errors[0]).toContain("content changed without artifact version bump");
  });

  it("passes when content changes and the version increases", () => {
    const registry = {
      cliVersion: "2.1.0",
      generatedAt: new Date().toISOString(),
      templates: {
        "demo-rule": {
          name: "demo-rule",
          type: "rule" as const,
          contentHash: "new-hash",
          artifactVersion: 2,
        },
      },
    };
    const baseline = {
      "demo-rule": {
        version: 1,
        hash: "old-hash",
      },
    };

    expect(checkArtifactVersionBaseline(registry, baseline)).toEqual([]);
  });
});
