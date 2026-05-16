/**
 * Types for gate definitions and results. Mirrored against the schema in
 * schemas/gate-result.schema.json for runtime validation.
 */

export type CheckType = "deterministic" | "agent";

export interface GateCheck {
  id: string;
  type: CheckType;
  rule?: string;
  skill?: string;
  max_retries?: number;
  implementation_milestone?: string;
}

export interface GateDefinition {
  checks: GateCheck[];
}

export interface GateResult {
  verdict: "pass" | "fail";
  check_id: string;
  summary?: string;
  evidence?: Record<string, unknown>;
  suggested_action?: string;
  tokens_consumed?: number;
}

export interface CheckOutcome {
  check: GateCheck;
  result: GateResult;
  retries_used: number;
}

export interface GateRunResult {
  gate_name: string;
  passed: boolean;
  outcomes: CheckOutcome[];
  failed_checks: CheckOutcome[];
  retries_remaining: number;
  next_step: string;
}

export const SUBAGENT_TIMEOUT_MS = 5 * 60 * 1000;
