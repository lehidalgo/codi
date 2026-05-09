/**
 * Phase-graph lookups against `workflow_definitions` (F4).
 *
 * Reads the JSON definition blob seeded by F2 and returns the legal next
 * phases for a given (workflow_type, current_phase). Throws when the
 * workflow type is unknown so misconfigured callers fail loud.
 *
 * Pure function over a brain handle — no I/O beyond the DB SELECT.
 */

import type Database from "better-sqlite3";

interface PhaseSpec {
  readonly gates: readonly string[];
  readonly next: readonly string[];
}

interface DefinitionShape {
  readonly id: string;
  readonly phases: Record<string, PhaseSpec>;
}

export class UnknownWorkflowTypeError extends Error {
  constructor(public readonly workflowType: string) {
    super(`Unknown workflow type: ${workflowType}`);
    this.name = "UnknownWorkflowTypeError";
  }
}

export class IllegalPhaseTransitionError extends Error {
  constructor(
    public readonly workflowType: string,
    public readonly fromPhase: string,
    public readonly toPhase: string,
    public readonly allowed: readonly string[],
  ) {
    super(
      `Illegal transition for ${workflowType}: ${fromPhase} → ${toPhase}. ` +
        `Allowed next phases: ${allowed.length > 0 ? allowed.join(", ") : "(terminal)"}`,
    );
    this.name = "IllegalPhaseTransitionError";
  }
}

export function loadDefinition(raw: Database.Database, workflowType: string): DefinitionShape {
  const row = raw
    .prepare(`SELECT definition FROM workflow_definitions WHERE id = ?`)
    .get(workflowType) as { definition: string } | undefined;
  if (!row) throw new UnknownWorkflowTypeError(workflowType);
  return JSON.parse(row.definition) as DefinitionShape;
}

export function nextPhases(
  raw: Database.Database,
  workflowType: string,
  fromPhase: string,
): readonly string[] {
  const def = loadDefinition(raw, workflowType);
  const spec = def.phases[fromPhase];
  if (!spec) {
    throw new IllegalPhaseTransitionError(workflowType, fromPhase, "?", []);
  }
  return spec.next;
}

export function gatesForPhase(
  raw: Database.Database,
  workflowType: string,
  phase: string,
): readonly string[] {
  const def = loadDefinition(raw, workflowType);
  const spec = def.phases[phase];
  return spec ? spec.gates : [];
}

/**
 * Throw if `from → to` is not legal for the given workflow type. Used by
 * `proposeTransition` to fail early on illegal transitions.
 */
export function assertLegalTransition(
  raw: Database.Database,
  workflowType: string,
  fromPhase: string,
  toPhase: string,
): void {
  const allowed = nextPhases(raw, workflowType, fromPhase);
  if (!allowed.includes(toPhase)) {
    throw new IllegalPhaseTransitionError(workflowType, fromPhase, toPhase, allowed);
  }
}
