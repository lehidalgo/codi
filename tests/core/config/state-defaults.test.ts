import { describe, it, expect } from "vitest";
import { fillSelectedHooksDefaults } from "#src/core/config/state.js";

describe("fillSelectedHooksDefaults", () => {
  it("fills git from languages and runtime from required+default", () => {
    const filled = fillSelectedHooksDefaults(undefined, ["typescript"]);
    expect(filled.git).toContain("eslint");
    expect(filled.git).toContain("tsc");
    expect(filled.runtime).toContain("iron-laws-enforcer");
    expect(filled.runtime).toContain("security-reminder");
  });

  it("preserves user selection if present", () => {
    const filled = fillSelectedHooksDefaults({ git: ["eslint"], runtime: ["security-reminder"] }, [
      "typescript",
    ]);
    expect(filled.git).toEqual(["eslint"]);
    expect(filled.runtime).toEqual(["security-reminder"]);
  });

  it("partial input fills only the missing bucket", () => {
    const filled = fillSelectedHooksDefaults({ git: ["custom-hook"] }, ["typescript"]);
    expect(filled.git).toEqual(["custom-hook"]);
    expect(filled.runtime).toContain("iron-laws-enforcer");
  });

  it("handles empty languages list (only globals)", () => {
    const filled = fillSelectedHooksDefaults(undefined, []);
    expect(filled.git).toContain("gitleaks");
    expect(filled.git).toContain("commitlint");
    expect(filled.git).not.toContain("tsc");
  });
});
