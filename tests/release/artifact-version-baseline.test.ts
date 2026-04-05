import { describe, expect, it } from "vitest";
import {
  ARTIFACT_VERSION_BASELINE,
  checkArtifactVersionBaseline,
} from "#src/core/version/artifact-version-baseline.js";
import { buildTemplateHashRegistry } from "#src/core/version/template-hash-registry.js";

describe("artifact version baseline — release readiness", () => {
  it("returns no errors for the current checked-in baseline", () => {
    const errors = checkArtifactVersionBaseline(buildTemplateHashRegistry());
    expect(errors).toEqual([]);
  });

  it("ships a non-empty baseline", () => {
    expect(Object.keys(ARTIFACT_VERSION_BASELINE).length).toBeGreaterThan(0);
  });
});
