export type ProjectProfile = "no-sheet" | "standard" | "absorb";
export type ProjectMode = "greenfield" | "incremental" | "absorb";

export interface ProjectAdaptation {
  profile?: ProjectProfile;
  mode?: ProjectMode;
  noSheet?: boolean;
  grill?: boolean;
  interactive?: boolean;
}

export const PROJECT_PHASE_ORDER = ["intent", "discover", "decompose", "sync", "done"] as const;
