import { describe, it, expect } from "vitest";
import { SkillTestManifestSchema } from "#src/schemas/skill-test.js";

describe("SkillTestManifestSchema", () => {
  it("accepts a minimal contract-only manifest", () => {
    const result = SkillTestManifestSchema.safeParse({
      skill: "content-factory",
      tiers: { contract: true },
    });
    expect(result.success).toBe(true);
  });

  it("accepts a full manifest with logic and behavior tiers", () => {
    const result = SkillTestManifestSchema.safeParse({
      skill: "content-factory",
      tiers: {
        contract: true,
        logic: { lib: "generators/lib/", tests: "tests/unit/" },
        behavior: {
          server: "scripts/server.cjs",
          startScript: "scripts/start-server.sh",
          tests: "tests/e2e/",
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a manifest with no skill name", () => {
    const result = SkillTestManifestSchema.safeParse({ tiers: { contract: true } });
    expect(result.success).toBe(false);
  });

  it("accepts behavior tier with optional port", () => {
    const result = SkillTestManifestSchema.safeParse({
      skill: "my-skill",
      tiers: {
        contract: true,
        behavior: {
          server: "server.cjs",
          startScript: "start.sh",
          tests: "tests/e2e/",
          port: 3000,
        },
      },
    });
    expect(result.success).toBe(true);
  });
});
