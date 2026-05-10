export type BugFixProfile = "quick" | "standard" | "deep" | "incident";
export type BugFixSeverity = "P0" | "P1" | "P2" | "P3";
export type BugFixScope = "single" | "multi";
export type BugFixExecuteMode = "inline" | "subagent";

/**
 * Adaptive intake metadata for the bug-fix workflow. Compresses or expands
 * the phase pipeline based on the dev's answers at intent. Stored in the
 * init event payload and re-read at each phase boundary so the agent can
 * skip vacuous phases.
 */
export interface BugFixAdaptation {
  profile?: BugFixProfile;
  severity?: BugFixSeverity;
  reproducerExists?: boolean;
  rootCauseKnown?: boolean;
  scope?: BugFixScope;
  executeMode?: BugFixExecuteMode;
  grill?: boolean;
  interactive?: boolean;
}

export const BUGFIX_PHASE_ORDER = [
  "intent",
  "reproduce",
  "plan",
  "execute",
  "verify",
  "done",
] as const;
