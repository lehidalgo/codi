/**
 * Workflow adapter contract — shared by every concrete workflow type.
 *
 * Each workflow lives in its own directory under `src/runtime/workflows/`
 * and exports a single `WorkflowAdapter<A>` instance. The runtime never
 * branches on `workflow_type` directly; it dispatches through the adapter
 * registry, which keeps `cli-handlers/workflow.ts` thin and makes adding
 * a new workflow type a pure additive change.
 *
 * The type parameter `A` is the workflow's own adaptation shape (e.g.
 * `BugFixAdaptation`, `FeatureAdaptation`). All adapter methods are pure;
 * I/O and brain interaction stay in `cli-handlers/workflow.ts`.
 */

import type { WorkflowType } from "../types.js";

/**
 * CLI run flags surface — the union of every workflow's flag namespace.
 * Adapters cherry-pick the fields they care about from this loose shape;
 * this avoids forcing every adapter to declare its own flag interface
 * while still preserving type-checked field names.
 */
export interface WorkflowRunFlags {
  // Common across workflows
  profile?: string;
  scope?: string;
  executeMode?: string;
  grill?: boolean;
  interactive?: boolean;
  // bug-fix
  severity?: string;
  reproducerExists?: boolean;
  rootCauseKnown?: boolean;
  // feature
  complexity?: string;
  designExists?: boolean;
  tddStrict?: boolean;
  // refactor
  kind?: string;
  // migration
  riskLevel?: string;
  rollbackTested?: boolean;
  // project
  mode?: string;
  noSheet?: boolean;
}

export interface InteractiveResult<A> {
  readonly cancelled: boolean;
  readonly adaptation: A | null;
}

export interface WorkflowAdapter<A> {
  /** Workflow type id — must match the yaml `id` and a `WorkflowType` value. */
  readonly id: WorkflowType;
  /** Phase ordering used by the generic phase walker. */
  readonly phaseOrder: readonly string[];
  /** Profiles registered for this workflow (informational; CLI validates against this). */
  readonly profiles: readonly string[];

  /** Resolve a partial adaptation against profile defaults. */
  resolve(input: Partial<A>): A;

  /** Convert an adaptation into a JSON-safe snake_case payload for the init event. */
  serialize(adaptation: A): Record<string, unknown>;

  /** Phases that should be skipped given the adaptation. Order-preserving. */
  computeSkipPhases(adaptation: A): readonly string[];

  /**
   * Validate CLI flags into a partial adaptation, then resolve via {@link resolve}.
   * Returns:
   *   - `A` when the dev supplied any adaptive flag,
   *   - `Error` when a flag value is invalid (caller surfaces the message),
   *   - `undefined` when no adaptive flags were supplied (workflow runs without adaptation metadata).
   */
  buildFromCliFlags(flags: WorkflowRunFlags): A | Error | undefined;

  /**
   * Optional clack-based intake. Only adapters that ship an interactive
   * intake module export this. The CLI dispatcher calls it when
   * `flags.interactive === true` and stdin is a TTY.
   */
  runInteractive?(): Promise<InteractiveResult<A>>;
}
