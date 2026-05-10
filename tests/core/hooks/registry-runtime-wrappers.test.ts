import { describe, it, expect } from "vitest";
import { IRON_LAWS_HOOK } from "#src/core/hooks/registry/runtime/iron-laws-enforcer.js";
import { WORKFLOW_CLASSIFIER_HOOK } from "#src/core/hooks/registry/runtime/workflow-classifier.js";
import { CAPTURE_MARKERS_HOOK } from "#src/core/hooks/registry/runtime/capture-markers.js";
import { SKILL_TRACKER_HOOK } from "#src/core/hooks/registry/runtime/skill-tracker.js";
import { SKILL_OBSERVER_HOOK } from "#src/core/hooks/registry/runtime/skill-observer.js";
import { getRuntimeHooks, getDefaultRuntimeHookNames } from "#src/core/hooks/registry/index.js";

describe("runtime hook wrappers", () => {
  it("iron-laws-enforcer is required + dual-event", () => {
    expect(IRON_LAWS_HOOK.required).toBe(true);
    expect(IRON_LAWS_HOOK.events).toEqual(["UserPromptSubmit", "PreToolUse"]);
    expect(IRON_LAWS_HOOK.category).toBe("enforcement");
  });

  it("workflow-classifier is required PreToolUse", () => {
    expect(WORKFLOW_CLASSIFIER_HOOK.required).toBe(true);
    expect(WORKFLOW_CLASSIFIER_HOOK.events).toEqual(["PreToolUse"]);
  });

  it("capture-markers is required Stop", () => {
    expect(CAPTURE_MARKERS_HOOK.required).toBe(true);
    expect(CAPTURE_MARKERS_HOOK.events).toEqual(["Stop"]);
    expect(CAPTURE_MARKERS_HOOK.category).toBe("observation");
  });

  it("skill-tracker is opt-in InstructionsLoaded", () => {
    expect(SKILL_TRACKER_HOOK.required).toBe(false);
    expect(SKILL_TRACKER_HOOK.default).toBe(true);
    expect(SKILL_TRACKER_HOOK.events).toEqual(["InstructionsLoaded"]);
  });

  it("skill-observer is opt-in Stop", () => {
    expect(SKILL_OBSERVER_HOOK.required).toBe(false);
    expect(SKILL_OBSERVER_HOOK.default).toBe(true);
    expect(SKILL_OBSERVER_HOOK.events).toEqual(["Stop"]);
  });

  it("getRuntimeHooks returns the six built-in hooks", () => {
    const names = getRuntimeHooks()
      .map((h) => h.name)
      .sort();
    expect(names).toEqual([
      "capture-markers",
      "iron-laws-enforcer",
      "security-reminder",
      "skill-observer",
      "skill-tracker",
      "workflow-classifier",
    ]);
  });

  it("getDefaultRuntimeHookNames includes all six (required + default-on)", () => {
    const names = getDefaultRuntimeHookNames();
    expect(names).toContain("iron-laws-enforcer");
    expect(names).toContain("workflow-classifier");
    expect(names).toContain("capture-markers");
    expect(names).toContain("skill-tracker");
    expect(names).toContain("skill-observer");
    expect(names).toContain("security-reminder");
  });
});
