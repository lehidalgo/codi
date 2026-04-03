import { describe, expect, it } from "vitest";
import {
  ARTIFACT_VERSION_BASELINE,
  checkArtifactVersionBaseline,
} from "#src/core/version/artifact-version-baseline.js";
import { buildTemplateHashRegistry } from "#src/core/version/template-hash-registry.js";

describe("checkArtifactVersionBaseline", () => {
  it("returns no errors for the current checked-in baseline", () => {
    const errors = checkArtifactVersionBaseline(buildTemplateHashRegistry());
    expect(errors).toEqual([]);
  });

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

  it("ships a non-empty baseline", () => {
    expect(Object.keys(ARTIFACT_VERSION_BASELINE).length).toBeGreaterThan(0);
  });
});
