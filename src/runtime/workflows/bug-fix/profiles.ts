import type { BugFixAdaptation, BugFixProfile } from "./types.js";

export const BUGFIX_PROFILES: Record<BugFixProfile, BugFixAdaptation> = {
  quick: {
    profile: "quick",
    severity: "P3",
    reproducerExists: true,
    rootCauseKnown: true,
    scope: "single",
    executeMode: "inline",
    grill: false,
  },
  standard: {
    profile: "standard",
    severity: "P2",
    reproducerExists: false,
    rootCauseKnown: false,
    scope: "multi",
    executeMode: "inline",
    grill: false,
  },
  deep: {
    profile: "deep",
    severity: "P1",
    reproducerExists: false,
    rootCauseKnown: false,
    scope: "multi",
    executeMode: "subagent",
    grill: true,
  },
  incident: {
    profile: "incident",
    severity: "P0",
    reproducerExists: true,
    rootCauseKnown: true,
    scope: "multi",
    executeMode: "subagent",
    grill: false,
  },
};

export const VALID_BUGFIX_PROFILES: ReadonlyArray<BugFixProfile> = [
  "quick",
  "standard",
  "deep",
  "incident",
];
