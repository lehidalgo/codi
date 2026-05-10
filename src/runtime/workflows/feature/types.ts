export type FeatureProfile = "prototype" | "standard" | "deep";
export type FeatureComplexity = "trivial" | "standard" | "large";
export type FeatureScope = "single" | "multi";
export type FeatureExecuteMode = "inline" | "subagent";

export interface FeatureAdaptation {
  profile?: FeatureProfile;
  complexity?: FeatureComplexity;
  designExists?: boolean;
  scope?: FeatureScope;
  executeMode?: FeatureExecuteMode;
  tddStrict?: boolean;
  grill?: boolean;
  interactive?: boolean;
}

export const FEATURE_PHASE_ORDER = [
  "intent",
  "plan",
  "decompose",
  "execute",
  "verify",
  "done",
] as const;
