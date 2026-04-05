import { describe, it, expect } from "vitest";
import { NORMAL_MENU, ADVANCED_MENU } from "#src/cli/hub.js";

describe("Command Center hub", () => {
  describe("NORMAL_MENU", () => {
    it("has exactly 4 entries", () => {
      expect(NORMAL_MENU).toHaveLength(4);
    });

    it("every entry has required fields", () => {
      for (const entry of NORMAL_MENU) {
        expect(entry.value).toBeTruthy();
        expect(entry.label).toBeTruthy();
        expect(entry.hint).toBeTruthy();
        expect(typeof entry.requiresProject).toBe("boolean");
      }
    });

    it("has unique entry values", () => {
      const values = NORMAL_MENU.map((e) => e.value);
      expect(new Set(values).size).toBe(values.length);
    });

    it("init does not require a project", () => {
      const init = NORMAL_MENU.find((e) => e.value === "init");
      expect(init).toBeDefined();
      expect(init!.requiresProject).toBe(false);
    });

    it("contains generate, export, and clean", () => {
      const values = NORMAL_MENU.map((e) => e.value);
      expect(values).toContain("generate");
      expect(values).toContain("export");
      expect(values).toContain("clean");
    });
  });

  describe("ADVANCED_MENU", () => {
    it("has exactly 10 entries", () => {
      expect(ADVANCED_MENU).toHaveLength(10);
    });

    it("every entry has required fields", () => {
      for (const entry of ADVANCED_MENU) {
        expect(entry.value).toBeTruthy();
        expect(entry.label).toBeTruthy();
        expect(entry.hint).toBeTruthy();
        expect(typeof entry.requiresProject).toBe("boolean");
      }
    });

    it("has unique entry values", () => {
      const values = ADVANCED_MENU.map((e) => e.value);
      expect(new Set(values).size).toBe(values.length);
    });

    it("all advanced entries require a project", () => {
      for (const entry of ADVANCED_MENU) {
        expect(entry.requiresProject).toBe(true);
      }
    });

    it("contains add, preset, doctor, status, and revert", () => {
      const values = ADVANCED_MENU.map((e) => e.value);
      expect(values).toContain("add");
      expect(values).toContain("preset");
      expect(values).toContain("doctor");
      expect(values).toContain("status");
      expect(values).toContain("revert");
    });
  });

  describe("menu integrity", () => {
    it("no value collisions between normal and advanced menus", () => {
      const normalValues = new Set(NORMAL_MENU.map((e) => e.value));
      const advancedValues = ADVANCED_MENU.map((e) => e.value);
      for (const v of advancedValues) {
        expect(normalValues.has(v)).toBe(false);
      }
    });
  });
});
