import type {
  FeatureAdaptation,
  FeatureComplexity,
  FeatureExecuteMode,
  FeatureProfile,
  FeatureScope,
} from "./types.js";
import { VALID_FEATURE_PROFILES } from "./profiles.js";
import { resolveFeatureAdaptation } from "./resolver.js";
import type { WorkflowRunFlags } from "../types.js";

const VALID_COMPLEXITIES: ReadonlyArray<FeatureComplexity> = ["trivial", "standard", "large"];
const VALID_SCOPES: ReadonlyArray<FeatureScope> = ["single", "multi"];
const VALID_EXECUTE_MODES: ReadonlyArray<FeatureExecuteMode> = ["inline", "subagent"];

export function buildFeatureAdaptation(
  opts: WorkflowRunFlags,
): FeatureAdaptation | Error | undefined {
  const supplied =
    opts.profile !== undefined ||
    opts.complexity !== undefined ||
    opts.designExists !== undefined ||
    opts.scope !== undefined ||
    opts.executeMode !== undefined ||
    opts.tddStrict !== undefined ||
    opts.grill !== undefined ||
    opts.interactive !== undefined;
  if (!supplied) return undefined;

  const partial: FeatureAdaptation = {};
  if (opts.profile !== undefined) {
    if (!(VALID_FEATURE_PROFILES as readonly string[]).includes(opts.profile)) {
      return new Error(
        `unknown --profile '${opts.profile}' for feature workflow. Valid: ${VALID_FEATURE_PROFILES.join(", ")}`,
      );
    }
    partial.profile = opts.profile as FeatureProfile;
  }
  if (opts.complexity !== undefined) {
    if (!(VALID_COMPLEXITIES as readonly string[]).includes(opts.complexity)) {
      return new Error(
        `unknown --complexity '${opts.complexity}'. Valid: ${VALID_COMPLEXITIES.join(", ")}`,
      );
    }
    partial.complexity = opts.complexity as FeatureComplexity;
  }
  if (opts.scope !== undefined) {
    if (!(VALID_SCOPES as readonly string[]).includes(opts.scope)) {
      return new Error(`unknown --scope '${opts.scope}'. Valid: ${VALID_SCOPES.join(", ")}`);
    }
    partial.scope = opts.scope as FeatureScope;
  }
  if (opts.executeMode !== undefined) {
    if (!(VALID_EXECUTE_MODES as readonly string[]).includes(opts.executeMode)) {
      return new Error(
        `unknown --execute-mode '${opts.executeMode}'. Valid: ${VALID_EXECUTE_MODES.join(", ")}`,
      );
    }
    partial.executeMode = opts.executeMode as FeatureExecuteMode;
  }
  if (opts.designExists !== undefined) partial.designExists = opts.designExists;
  if (opts.tddStrict !== undefined) partial.tddStrict = opts.tddStrict;
  if (opts.grill !== undefined) partial.grill = opts.grill;
  if (opts.interactive !== undefined) partial.interactive = opts.interactive;

  return resolveFeatureAdaptation(partial);
}
