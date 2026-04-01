import { describe, it, expect } from "vitest";
import { TOP_LEVEL_MENU, SUB_MENUS } from "#src/cli/hub.js";

describe("Command Center hub", () => {
  describe("TOP_LEVEL_MENU", () => {
    it("has at least 4 top-level entries", () => {
      expect(TOP_LEVEL_MENU.length).toBeGreaterThanOrEqual(4);
    });

    it("every entry has required fields", () => {
      for (const entry of TOP_LEVEL_MENU) {
        expect(entry.value).toBeTruthy();
        expect(entry.label).toBeTruthy();
        expect(entry.hint).toBeTruthy();
        expect(typeof entry.requiresProject).toBe("boolean");
      }
    });

    it("has unique entry values", () => {
      const values = TOP_LEVEL_MENU.map((e) => e.value);
      expect(new Set(values).size).toBe(values.length);
    });

    it("init does not require a project", () => {
      const init = TOP_LEVEL_MENU.find((e) => e.value === "init");
      expect(init).toBeDefined();
      expect(init!.requiresProject).toBe(false);
    });

    it("create-configure requires a project", () => {
      const entry = TOP_LEVEL_MENU.find((e) => e.value === "create-configure");
      expect(entry).toBeDefined();
      expect(entry!.requiresProject).toBe(true);
    });

    it("diagnostics requires a project", () => {
      const entry = TOP_LEVEL_MENU.find((e) => e.value === "diagnostics");
      expect(entry).toBeDefined();
      expect(entry!.requiresProject).toBe(true);
    });

    it("maintenance requires a project", () => {
      const entry = TOP_LEVEL_MENU.find((e) => e.value === "maintenance");
      expect(entry).toBeDefined();
      expect(entry!.requiresProject).toBe(true);
    });
  });

  describe("SUB_MENUS", () => {
    it("has sub-menus for each non-init top-level entry", () => {
      const withSubMenus = TOP_LEVEL_MENU.filter(
        (e) => e.value !== "init" && SUB_MENUS[e.value],
      );
      expect(withSubMenus.length).toBeGreaterThanOrEqual(3);
    });

    it("create-configure includes add, generate, and preset", () => {
      const items = SUB_MENUS["create-configure"];
      expect(items).toBeDefined();
      const values = items.map((i) => i.value);
      expect(values).toContain("add");
      expect(values).toContain("generate");
      expect(values).toContain("preset");
    });

    it("diagnostics includes doctor, status, and verify", () => {
      const items = SUB_MENUS["diagnostics"];
      expect(items).toBeDefined();
      const values = items.map((i) => i.value);
      expect(values).toContain("doctor");
      expect(values).toContain("status");
      expect(values).toContain("verify");
    });

    it("maintenance includes clean, update, and revert", () => {
      const items = SUB_MENUS["maintenance"];
      expect(items).toBeDefined();
      const values = items.map((i) => i.value);
      expect(values).toContain("clean");
      expect(values).toContain("update");
      expect(values).toContain("revert");
    });

    it("every sub-menu item has required fields", () => {
      for (const [, items] of Object.entries(SUB_MENUS)) {
        for (const item of items) {
          expect(item.value).toBeTruthy();
          expect(item.label).toBeTruthy();
          expect(item.hint).toBeTruthy();
        }
      }
    });

    it("sub-menu values are unique within each group", () => {
      for (const [, items] of Object.entries(SUB_MENUS)) {
        const values = items.map((i) => i.value);
        expect(new Set(values).size).toBe(values.length);
      }
    });
  });
});
