import { describe, it, expect } from "vitest";
import { NORMAL_MENU, ADVANCED_MENU, buildFirstEntry } from "#src/cli/hub.js";

describe("Command Center hub", () => {
  describe("NORMAL_MENU", () => {
    it("has exactly 5 entries (init/customize is built separately)", () => {
      expect(NORMAL_MENU).toHaveLength(5);
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

    it("contains generate, update, revert, export, and clean", () => {
      const values = NORMAL_MENU.map((e) => e.value);
      expect(values).toContain("generate");
      expect(values).toContain("update");
      expect(values).toContain("revert");
      expect(values).toContain("export");
      expect(values).toContain("clean");
    });

    it("does not contain init or customize (those are built per-render)", () => {
      const values = NORMAL_MENU.map((e) => e.value);
      expect(values).not.toContain("init");
      expect(values).not.toContain("customize");
    });
  });

  describe("buildFirstEntry", () => {
    it("returns the init entry when no project exists", () => {
      const entry = buildFirstEntry(false);
      expect(entry.value).toBe("init");
      expect(entry.label).toBe("Initialize project");
      expect(entry.requiresProject).toBe(false);
    });

    it("returns the customize entry when a project exists", () => {
      const entry = buildFirstEntry(true);
      expect(entry.value).toBe("customize");
      expect(entry.label).toBe("Customize codi setup");
      expect(entry.requiresProject).toBe(false);
    });

    it("always sets requiresProject to false (the entry itself is always shown)", () => {
      expect(buildFirstEntry(true).requiresProject).toBe(false);
      expect(buildFirstEntry(false).requiresProject).toBe(false);
    });
  });

  describe("ADVANCED_MENU", () => {
    it("has exactly 9 entries", () => {
      expect(ADVANCED_MENU).toHaveLength(9);
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

    it("contains add, preset, doctor, status, and backup", () => {
      const values = ADVANCED_MENU.map((e) => e.value);
      expect(values).toContain("add");
      expect(values).toContain("preset");
      expect(values).toContain("doctor");
      expect(values).toContain("status");
      expect(values).toContain("backup");
    });

    it("does not contain revert (promoted to NORMAL_MENU)", () => {
      const values = ADVANCED_MENU.map((e) => e.value);
      expect(values).not.toContain("revert");
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
