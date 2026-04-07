import { describe, it, expect } from "vitest";

describe("deck skill template", () => {
  it("exports a non-empty template string", async () => {
    const mod = await import("#src/templates/skills/deck/index.js");
    expect(typeof mod.template).toBe("string");
    expect(mod.template.length).toBeGreaterThan(200);
  });

  it("has required frontmatter fields", async () => {
    const { template } = await import("#src/templates/skills/deck/index.js");
    expect(template).toContain("name: {{name}}");
    expect(template).toContain("description:");
    expect(template).toMatch(/version: \d+/);
    expect(template).toContain("managed_by: codi");
  });

  it("describes the three-phase workflow", async () => {
    const { template } = await import("#src/templates/skills/deck/index.js");
    expect(template).toContain("Phase 1");
    expect(template).toContain("Phase 2");
    expect(template).toContain("Phase 3");
  });

  it("exports staticDir as a non-empty string", async () => {
    const mod = await import("#src/templates/skills/deck/index.js");
    expect(typeof mod.staticDir).toBe("string");
    expect(mod.staticDir.length).toBeGreaterThan(0);
  });
});
