import type {
  RefactorAdaptation,
  RefactorExecuteMode,
  RefactorKind,
  RefactorProfile,
  RefactorScope,
} from "./types.js";
import { VALID_REFACTOR_PROFILES } from "./profiles.js";
import { resolveRefactorAdaptation } from "./resolver.js";
import type { WorkflowRunFlags } from "../types.js";

const VALID_KINDS: ReadonlyArray<RefactorKind> = ["deadcode", "extract", "deepen", "decouple"];
const VALID_SCOPES: ReadonlyArray<RefactorScope> = ["single", "multi"];
const VALID_EXECUTE_MODES: ReadonlyArray<RefactorExecuteMode> = ["inline", "subagent"];

export function buildRefactorAdaptation(
  opts: WorkflowRunFlags,
): RefactorAdaptation | Error | undefined {
  const supplied =
    opts.profile !== undefined ||
    opts.kind !== undefined ||
    opts.scope !== undefined ||
    opts.executeMode !== undefined ||
    opts.grill !== undefined ||
    opts.interactive !== undefined;
  if (!supplied) return undefined;

  const partial: RefactorAdaptation = {};
  if (opts.profile !== undefined) {
    if (!(VALID_REFACTOR_PROFILES as readonly string[]).includes(opts.profile)) {
      return new Error(
        `unknown --profile '${opts.profile}' for refactor. Valid: ${VALID_REFACTOR_PROFILES.join(", ")}`,
      );
    }
    partial.profile = opts.profile as RefactorProfile;
  }
  if (opts.kind !== undefined) {
    if (!(VALID_KINDS as readonly string[]).includes(opts.kind)) {
      return new Error(`unknown --kind '${opts.kind}'. Valid: ${VALID_KINDS.join(", ")}`);
    }
    partial.kind = opts.kind as RefactorKind;
  }
  if (opts.scope !== undefined) {
    if (!(VALID_SCOPES as readonly string[]).includes(opts.scope)) {
      return new Error(`unknown --scope '${opts.scope}'. Valid: ${VALID_SCOPES.join(", ")}`);
    }
    partial.scope = opts.scope as RefactorScope;
  }
  if (opts.executeMode !== undefined) {
    if (!(VALID_EXECUTE_MODES as readonly string[]).includes(opts.executeMode)) {
      return new Error(
        `unknown --execute-mode '${opts.executeMode}'. Valid: ${VALID_EXECUTE_MODES.join(", ")}`,
      );
    }
    partial.executeMode = opts.executeMode as RefactorExecuteMode;
  }
  if (opts.grill !== undefined) partial.grill = opts.grill;
  if (opts.interactive !== undefined) partial.interactive = opts.interactive;

  return resolveRefactorAdaptation(partial);
}
