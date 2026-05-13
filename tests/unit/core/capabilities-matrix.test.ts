/**
 * Capabilities Matrix invariants (Sprint 6).
 */
import { describe, it, expect } from "vitest";
import {
  TARGET_IDS,
  CAPABILITIES_MATRIX,
  TIER_1_TARGETS,
  TIER_2_TARGETS,
  supports,
  targetsSupporting,
  type TargetId,
} from "#src/core/capabilities/matrix.js";
describe("Capabilities Matrix", () => {
  it("declares an entry for every TARGET_ID", () => {
    for (const id of TARGET_IDS) {
      expect(CAPABILITIES_MATRIX[id]).toBeDefined();
      expect(CAPABILITIES_MATRIX[id].target).toBe(id);
    }
  });

  it("Claude Code (Tier 1A) supports every feature", () => {
    const cc = CAPABILITIES_MATRIX["claude-code"];
    expect(cc.tier).toBe("1A");
    expect(cc.skills).toBe(true);
    expect(cc.rules).toBe(true);
    expect(cc.agents).toBe(true);
    expect(cc.hooks).toBe(true);
    expect(cc.slashCommands).toBe(true);
    expect(cc.mcp).toBe(true);
    expect(cc.uiIntegration).toBe(true);
  });

  it("Codex CLI (Tier 1B) supports everything except UI integration", () => {
    const codex = CAPABILITIES_MATRIX["codex-cli"];
    expect(codex.tier).toBe("1B");
    expect(codex.uiIntegration).toBe(false);
    expect(codex.hooks).toBe(true);
    expect(codex.skills).toBe(true);
  });

  it("Tier 2 targets are config-only (skills + rules + mcp)", () => {
    const tier2: TargetId[] = ["cursor", "windsurf", "cline", "copilot", "gemini"];
    for (const id of tier2) {
      const cap = CAPABILITIES_MATRIX[id];
      expect(cap.tier).toBe("2");
      expect(cap.skills).toBe(true);
      expect(cap.rules).toBe(true);
      expect(cap.mcp).toBe(true);
      expect(cap.agents).toBe(false);
      expect(cap.hooks).toBe(false);
      expect(cap.slashCommands).toBe(false);
      expect(cap.uiIntegration).toBe(false);
    }
  });

  it("TIER_1_TARGETS and TIER_2_TARGETS partition TARGET_IDS", () => {
    const combined = [...TIER_1_TARGETS, ...TIER_2_TARGETS].sort();
    const all = [...TARGET_IDS].sort();
    expect(combined).toEqual(all);
    expect(TIER_1_TARGETS.length).toBe(2);
    expect(TIER_2_TARGETS.length).toBe(5);
  });

  it("supports() reads the matrix correctly", () => {
    expect(supports("claude-code", "hooks")).toBe(true);
    expect(supports("cursor", "hooks")).toBe(false);
    expect(supports("cursor", "rules")).toBe(true);
  });

  it("targetsSupporting('hooks') returns only Tier 1", () => {
    const ids = targetsSupporting("hooks");
    expect([...ids].sort()).toEqual(["claude-code", "codex-cli"]);
  });

  it("targetsSupporting('rules') returns every target", () => {
    const ids = targetsSupporting("rules");
    expect([...ids].sort()).toEqual([...TARGET_IDS].sort());
  });

  it("targetsSupporting('uiIntegration') returns only Claude Code", () => {
    expect(targetsSupporting("uiIntegration")).toEqual(["claude-code"]);
  });
});
