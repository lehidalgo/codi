import type {
  BugFixAdaptation,
  BugFixExecuteMode,
  BugFixProfile,
  BugFixScope,
  BugFixSeverity,
} from "./types.js";
import { VALID_BUGFIX_PROFILES } from "./profiles.js";
import { resolveBugFixAdaptation } from "./resolver.js";
import type { WorkflowRunFlags } from "../types.js";

const VALID_SEVERITIES: ReadonlyArray<BugFixSeverity> = ["P0", "P1", "P2", "P3"];
const VALID_SCOPES: ReadonlyArray<BugFixScope> = ["single", "multi"];
const VALID_EXECUTE_MODES: ReadonlyArray<BugFixExecuteMode> = ["inline", "subagent"];

/**
 * Convert CLI run flags into a `BugFixAdaptation`. Returns `undefined` if
 * the dev did not supply any bug-fix flag (workflow runs without
 * adaptation metadata).
 */
export function buildBugFixAdaptation(
  opts: WorkflowRunFlags,
): BugFixAdaptation | Error | undefined {
  const supplied =
    opts.profile !== undefined ||
    opts.severity !== undefined ||
    opts.reproducerExists !== undefined ||
    opts.rootCauseKnown !== undefined ||
    opts.scope !== undefined ||
    opts.executeMode !== undefined ||
    opts.grill !== undefined ||
    opts.interactive !== undefined;
  if (!supplied) return undefined;

  const partial: BugFixAdaptation = {};
  if (opts.profile !== undefined) {
    if (!(VALID_BUGFIX_PROFILES as readonly string[]).includes(opts.profile)) {
      return new Error(
        `unknown --profile '${opts.profile}'. Valid: ${VALID_BUGFIX_PROFILES.join(", ")}`,
      );
    }
    partial.profile = opts.profile as BugFixProfile;
  }
  if (opts.severity !== undefined) {
    if (!(VALID_SEVERITIES as readonly string[]).includes(opts.severity)) {
      return new Error(
        `unknown --severity '${opts.severity}'. Valid: ${VALID_SEVERITIES.join(", ")}`,
      );
    }
    partial.severity = opts.severity as BugFixSeverity;
  }
  if (opts.scope !== undefined) {
    if (!(VALID_SCOPES as readonly string[]).includes(opts.scope)) {
      return new Error(`unknown --scope '${opts.scope}'. Valid: ${VALID_SCOPES.join(", ")}`);
    }
    partial.scope = opts.scope as BugFixScope;
  }
  if (opts.executeMode !== undefined) {
    if (!(VALID_EXECUTE_MODES as readonly string[]).includes(opts.executeMode)) {
      return new Error(
        `unknown --execute-mode '${opts.executeMode}'. Valid: ${VALID_EXECUTE_MODES.join(", ")}`,
      );
    }
    partial.executeMode = opts.executeMode as BugFixExecuteMode;
  }
  if (opts.reproducerExists !== undefined) partial.reproducerExists = opts.reproducerExists;
  if (opts.rootCauseKnown !== undefined) partial.rootCauseKnown = opts.rootCauseKnown;
  if (opts.grill !== undefined) partial.grill = opts.grill;
  if (opts.interactive !== undefined) partial.interactive = opts.interactive;

  return resolveBugFixAdaptation(partial);
}
