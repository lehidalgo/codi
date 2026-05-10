import type { ProjectAdaptation, ProjectMode, ProjectProfile } from "./types.js";
import { VALID_PROJECT_PROFILES } from "./profiles.js";
import { resolveProjectAdaptation } from "./resolver.js";
import type { WorkflowRunFlags } from "../types.js";

const VALID_MODES: ReadonlyArray<ProjectMode> = ["greenfield", "incremental", "absorb"];

export function buildProjectAdaptation(
  opts: WorkflowRunFlags,
): ProjectAdaptation | Error | undefined {
  const supplied =
    opts.profile !== undefined ||
    opts.mode !== undefined ||
    opts.noSheet !== undefined ||
    opts.grill !== undefined ||
    opts.interactive !== undefined;
  if (!supplied) return undefined;

  const partial: ProjectAdaptation = {};
  if (opts.profile !== undefined) {
    if (!(VALID_PROJECT_PROFILES as readonly string[]).includes(opts.profile)) {
      return new Error(
        `unknown --profile '${opts.profile}' for project. Valid: ${VALID_PROJECT_PROFILES.join(", ")}`,
      );
    }
    partial.profile = opts.profile as ProjectProfile;
  }
  if (opts.mode !== undefined) {
    if (!(VALID_MODES as readonly string[]).includes(opts.mode)) {
      return new Error(`unknown --mode '${opts.mode}'. Valid: ${VALID_MODES.join(", ")}`);
    }
    partial.mode = opts.mode as ProjectMode;
  }
  if (opts.noSheet !== undefined) partial.noSheet = opts.noSheet;
  if (opts.grill !== undefined) partial.grill = opts.grill;
  if (opts.interactive !== undefined) partial.interactive = opts.interactive;

  return resolveProjectAdaptation(partial);
}
