import { describe, it, expect } from "vitest";
import { detectMode } from "#src/core/hooks/hook-logic/detect-mode.js";

describe("detectMode", () => {
  it("classifies source skill template paths", () => {
    const r = detectMode("src/templates/skills/codi-debugging/template.ts", "");
    expect(r.mode).toBe("source");
    expect(r.artifactName).toBe("codi-debugging");
    expect(r.artifactType).toBe("skill");
  });

  it("classifies source agent template paths", () => {
    const r = detectMode("src/templates/agents/codi-reviewer/template.ts", "");
    expect(r.mode).toBe("source");
    expect(r.artifactType).toBe("agent");
  });

  it("classifies source rule template paths", () => {
    const r = detectMode("src/templates/rules/codi-security.ts", "");
    expect(r.mode).toBe("source");
    expect(r.artifactName).toBe("codi-security");
    expect(r.artifactType).toBe("rule");
  });

  it("rejects rules/index.ts as not an artifact", () => {
    const r = detectMode("src/templates/rules/index.ts", "");
    expect(r.mode).toBe("skip");
  });

  it("classifies .codi user-managed artifact", () => {
    const content = "---\nname: my-rule\nmanaged_by: user\nversion: 1\n---\nbody";
    const r = detectMode(".codi/rules/my-rule.md", content);
    expect(r.mode).toBe("user-managed");
    expect(r.artifactName).toBe("my-rule");
  });

  it("classifies .codi codi-managed artifact", () => {
    const content = "---\nname: codi-debugging\nmanaged_by: codi\nversion: 11\n---\nbody";
    const r = detectMode(".codi/skills/codi-debugging/SKILL.md", content);
    expect(r.mode).toBe("codi-managed");
  });

  it("treats missing managed_by as user-managed (default)", () => {
    const content = "---\nname: my-rule\nversion: 1\n---\nbody";
    const r = detectMode(".codi/rules/my-rule.md", content);
    expect(r.mode).toBe("user-managed");
  });

  it("skips .codi/artifact-manifest.json itself", () => {
    const r = detectMode(".codi/artifact-manifest.json", "{}");
    expect(r.mode).toBe("skip");
  });

  it("skips unrelated paths", () => {
    const r = detectMode("README.md", "");
    expect(r.mode).toBe("skip");
  });
});
