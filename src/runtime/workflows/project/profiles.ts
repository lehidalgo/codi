import type { ProjectAdaptation, ProjectProfile } from "./types.js";

export const PROJECT_PROFILES: Record<ProjectProfile, ProjectAdaptation> = {
  "no-sheet": {
    profile: "no-sheet",
    mode: "greenfield",
    noSheet: true,
    grill: false,
  },
  standard: {
    profile: "standard",
    mode: "greenfield",
    noSheet: false,
    grill: false,
  },
  absorb: {
    profile: "absorb",
    mode: "absorb",
    noSheet: false,
    grill: true,
  },
};

export const VALID_PROJECT_PROFILES: ReadonlyArray<ProjectProfile> = [
  "no-sheet",
  "standard",
  "absorb",
];
