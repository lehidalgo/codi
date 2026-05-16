/**
 * Gate registry — single source of truth for every check Codi knows how
 * to run on a workflow gate.
 *
 * Background:
 *   - Workflow YAMLs list gates as flat string IDs (`gates: [foo, bar]`).
 *   - `gate-runner-bridge` resolves IDs into `GateCheck { id, type }` and
 *     `gate-runner` dispatches each check. Previously the registry was a
 *     400-LOC `Record<string, DeterministicChecker>` literal inside
 *     `gate-runner.ts`, pushing that file near the 800-LOC limit and
 *     forcing every consumer to import the runner module just to inspect
 *     the available checks.
 *   - The `agent` branch of `CheckType` was dead — declared in
 *     `gate-types.ts` but never resolved to a real dispatcher.
 *
 * This module decouples registration from execution:
 *   - `registerGate({id, type: 'deterministic', checker})` for inline checks.
 *   - `registerGate({id, type: 'agent', skill})` for checks that need a
 *     subagent (the principal agent dispatches the named skill and
 *     ingests the verdict via `runAgentCheck`).
 *   - `getGate(id)` returns the registered spec; `listGatesFor(workflowType)`
 *     filters by `requiredWorkflowTypes` so a workflow YAML cannot
 *     reference a gate that doesn't apply to its kind.
 *
 * Unknown gate IDs still resolve to the existing advisory-pass behaviour
 * (consumer responsibility — `gate-runner.ts` decides). Changing that
 * default belongs to a separate issue.
 */

import type { GateCheck, GateResult } from "./gate-types.js";
import type { ManifestEvent, ReducedState } from "./types.js";

export interface DeterministicCheckContext {
  cwd: string;
  state: ReducedState;
  /** Raw event log — checkers may walk it when ReducedState is insufficient. */
  events?: ReadonlyArray<ManifestEvent>;
}

export type DeterministicChecker = (ctx: DeterministicCheckContext) => GateResult;

/** Common metadata both `deterministic` and `agent` gates share. */
interface GateSpecBase {
  readonly id: string;
  /**
   * If present, only workflows whose type is in this list may reference
   * the gate. Empty / undefined = universal. Lets a workflow YAML for
   * `team-consolidation` not silently inherit gates intended for
   * `bug-fix`. Validation happens at runner level via `listGatesFor`.
   */
  readonly requiredWorkflowTypes?: readonly string[];
}

/** Gate whose verdict the runner can compute synchronously. */
export interface DeterministicGateSpec extends GateSpecBase {
  readonly type: "deterministic";
  readonly checker: DeterministicChecker;
}

/**
 * Gate whose verdict comes from a subagent. The runner emits a
 * "dispatch required" placeholder outcome; the principal agent invokes
 * the named skill and feeds the result back via `runAgentCheck`.
 *
 * No subagent dispatch is wired today — `skill` is purely declarative
 * until a workflow YAML opts in. The registry shape is forward-compatible
 * so the contract is in place when ISSUE-085 / ISSUE-035 surfaces the
 * first real consumer.
 */
export interface AgentGateSpec extends GateSpecBase {
  readonly type: "agent";
  /** Skill the principal agent dispatches to render a verdict. */
  readonly skill: string;
  /** Optional bound on retries before the gate is treated as failed. */
  readonly maxRetries?: number;
}

export type GateSpec = DeterministicGateSpec | AgentGateSpec;

const REGISTRY = new Map<string, GateSpec>();

/**
 * Register a gate spec. Re-registering the same id overwrites — tests
 * that need to swap a checker can register a mock before calling the
 * runner.
 */
export function registerGate(spec: GateSpec): void {
  REGISTRY.set(spec.id, spec);
}

/** Look up a registered spec, or `undefined` if the id is unknown. */
export function getGate(id: string): GateSpec | undefined {
  return REGISTRY.get(id);
}

/**
 * Return every gate eligible for the given workflow type. A spec with no
 * `requiredWorkflowTypes` applies to ALL workflows; otherwise the
 * workflowType must appear in the allow-list.
 */
export function listGatesFor(workflowType: string): readonly GateSpec[] {
  return [...REGISTRY.values()].filter((spec) => {
    if (!spec.requiredWorkflowTypes || spec.requiredWorkflowTypes.length === 0) return true;
    return spec.requiredWorkflowTypes.includes(workflowType);
  });
}

/**
 * Convenience for `gate-runner-bridge`: synthesise a `GateCheck` from
 * the registered spec so callers don't need to repeat the lookup. Used
 * when resolving a YAML's flat string id into the runtime structure.
 */
export function gateCheckFor(id: string): GateCheck | undefined {
  const spec = REGISTRY.get(id);
  if (!spec) return undefined;
  if (spec.type === "agent") {
    return {
      id: spec.id,
      type: "agent",
      skill: spec.skill,
      ...(spec.maxRetries !== undefined ? { max_retries: spec.maxRetries } : {}),
    };
  }
  return { id: spec.id, type: "deterministic" };
}

/** Test-only: empty the registry so a `describe()` block can register fresh. */
export function _resetGateRegistryForTests(): void {
  REGISTRY.clear();
}
