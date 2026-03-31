import { describe, it, expect } from "vitest";
import { getAvailableActions, HUB_ACTIONS } from "#src/cli/hub.js";

describe("Command Center hub", () => {
  describe("HUB_ACTIONS", () => {
    it("covers all CLI commands", () => {
      // 18 CLI commands minus the root command itself = every command has a hub action
      expect(HUB_ACTIONS.length).toBeGreaterThanOrEqual(17);
    });

    it("every action has required fields", () => {
      for (const action of HUB_ACTIONS) {
        expect(action.value).toBeTruthy();
        expect(action.label).toBeTruthy();
        expect(action.hint).toBeTruthy();
        expect(typeof action.requiresProject).toBe("boolean");
        expect(["setup", "build", "monitor"]).toContain(action.group);
      }
    });

    it("has unique action values", () => {
      const values = HUB_ACTIONS.map((a) => a.value);
      expect(new Set(values).size).toBe(values.length);
    });

    it("init does not require a project", () => {
      const init = HUB_ACTIONS.find((a) => a.value === "init");
      expect(init).toBeDefined();
      expect(init!.requiresProject).toBe(false);
    });

    it("generate requires a project", () => {
      const gen = HUB_ACTIONS.find((a) => a.value === "generate");
      expect(gen).toBeDefined();
      expect(gen!.requiresProject).toBe(true);
    });
  });

  describe("getAvailableActions", () => {
    it("returns all actions when project exists", () => {
      const actions = getAvailableActions(true);
      expect(actions).toEqual(HUB_ACTIONS);
    });

    it("filters project-dependent actions when no project exists", () => {
      const actions = getAvailableActions(false);
      expect(actions.length).toBeLessThan(HUB_ACTIONS.length);
      expect(actions.every((a) => !a.requiresProject)).toBe(true);
    });

    it("always includes init when no project exists", () => {
      const actions = getAvailableActions(false);
      expect(actions.find((a) => a.value === "init")).toBeDefined();
    });

    it("does not include generate when no project exists", () => {
      const actions = getAvailableActions(false);
      expect(actions.find((a) => a.value === "generate")).toBeUndefined();
    });

    it("does not include status when no project exists", () => {
      const actions = getAvailableActions(false);
      expect(actions.find((a) => a.value === "status")).toBeUndefined();
    });
  });

  describe("action groups", () => {
    it("has setup actions", () => {
      const setup = HUB_ACTIONS.filter((a) => a.group === "setup");
      expect(setup.length).toBeGreaterThanOrEqual(3);
    });

    it("has build actions", () => {
      const build = HUB_ACTIONS.filter((a) => a.group === "build");
      expect(build.length).toBeGreaterThanOrEqual(2);
    });

    it("has monitor actions", () => {
      const monitor = HUB_ACTIONS.filter((a) => a.group === "monitor");
      expect(monitor.length).toBeGreaterThanOrEqual(3);
    });

    it("all groups are covered", () => {
      const groups = new Set(HUB_ACTIONS.map((a) => a.group));
      expect(groups).toContain("setup");
      expect(groups).toContain("build");
      expect(groups).toContain("monitor");
      expect(groups.size).toBe(3);
    });
  });

  describe("specific action mapping", () => {
    const actionsByValue = new Map(HUB_ACTIONS.map((a) => [a.value, a]));

    it("add requires a project", () => {
      expect(actionsByValue.get("add")?.requiresProject).toBe(true);
    });

    it("preset requires a project", () => {
      expect(actionsByValue.get("preset")?.requiresProject).toBe(true);
    });

    it("doctor requires a project", () => {
      expect(actionsByValue.get("doctor")?.requiresProject).toBe(true);
    });

    it("status requires a project", () => {
      expect(actionsByValue.get("status")?.requiresProject).toBe(true);
    });

    it("verify requires a project", () => {
      expect(actionsByValue.get("verify")?.requiresProject).toBe(true);
    });

    it("clean requires a project", () => {
      expect(actionsByValue.get("clean")?.requiresProject).toBe(true);
    });

    it("update requires a project", () => {
      expect(actionsByValue.get("update")?.requiresProject).toBe(true);
    });

    it("ci requires a project", () => {
      expect(actionsByValue.get("ci")?.requiresProject).toBe(true);
    });

    it("revert requires a project", () => {
      expect(actionsByValue.get("revert")?.requiresProject).toBe(true);
    });

    it("watch requires a project", () => {
      expect(actionsByValue.get("watch")?.requiresProject).toBe(true);
    });

    it("compliance requires a project", () => {
      expect(actionsByValue.get("compliance")?.requiresProject).toBe(true);
    });

    it("skill-export is in build group", () => {
      expect(actionsByValue.get("skill-export")?.group).toBe("build");
    });

    it("contribute is in build group", () => {
      expect(actionsByValue.get("contribute")?.group).toBe("build");
    });
  });

  describe("getAvailableActions edge cases", () => {
    it("no project returns only non-project-required actions", () => {
      const actions = getAvailableActions(false);
      const nonRequired = HUB_ACTIONS.filter((a) => !a.requiresProject);
      expect(actions).toEqual(nonRequired);
    });

    it("with project returns full list unchanged", () => {
      const actions = getAvailableActions(true);
      expect(actions.length).toBe(HUB_ACTIONS.length);
      expect(actions).toEqual(HUB_ACTIONS);
    });

    it("action labels are non-empty human-readable strings", () => {
      for (const action of HUB_ACTIONS) {
        expect(action.label.length).toBeGreaterThan(2);
        expect(action.hint.length).toBeGreaterThan(5);
      }
    });
  });
});
