export type RefactorProfile = "deadcode" | "standard" | "deep";
export type RefactorKind = "deadcode" | "extract" | "deepen" | "decouple";
export type RefactorScope = "single" | "multi";
export type RefactorExecuteMode = "inline" | "subagent";

export interface RefactorAdaptation {
  profile?: RefactorProfile;
  kind?: RefactorKind;
  scope?: RefactorScope;
  executeMode?: RefactorExecuteMode;
  grill?: boolean;
  interactive?: boolean;
}

export const REFACTOR_PHASE_ORDER = [
  "intent",
  "baseline",
  "plan",
  "execute",
  "verify",
  "done",
] as const;
