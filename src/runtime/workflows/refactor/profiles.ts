import type { RefactorAdaptation, RefactorProfile } from "./types.js";

export const REFACTOR_PROFILES: Record<RefactorProfile, RefactorAdaptation> = {
  deadcode: {
    profile: "deadcode",
    kind: "deadcode",
    scope: "single",
    executeMode: "inline",
    grill: false,
  },
  standard: {
    profile: "standard",
    kind: "extract",
    scope: "multi",
    executeMode: "inline",
    grill: false,
  },
  deep: {
    profile: "deep",
    kind: "deepen",
    scope: "multi",
    executeMode: "subagent",
    grill: true,
  },
};

export const VALID_REFACTOR_PROFILES: ReadonlyArray<RefactorProfile> = [
  "deadcode",
  "standard",
  "deep",
];
