import type { FeatureAdaptation, FeatureProfile } from "./types.js";

export const FEATURE_PROFILES: Record<FeatureProfile, FeatureAdaptation> = {
  prototype: {
    profile: "prototype",
    complexity: "trivial",
    designExists: true,
    scope: "single",
    executeMode: "inline",
    tddStrict: false,
    grill: false,
  },
  standard: {
    profile: "standard",
    complexity: "standard",
    designExists: false,
    scope: "multi",
    executeMode: "inline",
    tddStrict: true,
    grill: false,
  },
  deep: {
    profile: "deep",
    complexity: "large",
    designExists: false,
    scope: "multi",
    executeMode: "subagent",
    tddStrict: true,
    grill: true,
  },
};

export const VALID_FEATURE_PROFILES: ReadonlyArray<FeatureProfile> = [
  "prototype",
  "standard",
  "deep",
];
