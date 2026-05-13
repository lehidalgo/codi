/**
 * Canonical snake_case → camelCase mapping for ALL workflow adapter fields.
 *
 * Workflow adapters serialize their adaptation as snake_case JSON (the
 * persistence format on disk and the brain DB), but the resolver functions
 * (`resolveBugFixAdaptation`, `resolveFeatureAdaptation`, etc.) operate on
 * the camelCase shape. Two CLI handlers (`transitions.ts` and
 * `workflow.ts`) previously each maintained a byte-identical copy of this
 * 16-entry mapping; any new adapter field had to be added in both places
 * or the round-trip silently dropped it.
 *
 * Adding a new field: extend this record AND the corresponding adapter's
 * `serialize` function in `runtime/workflows/<name>/`.
 */
export const ADAPTER_SNAKE_TO_CAMEL: Readonly<Record<string, string>> = Object.freeze({
  profile: "profile",
  severity: "severity",
  reproducer_exists: "reproducerExists",
  root_cause_known: "rootCauseKnown",
  scope: "scope",
  execute_mode: "executeMode",
  grill: "grill",
  interactive: "interactive",
  complexity: "complexity",
  design_exists: "designExists",
  tdd_strict: "tddStrict",
  kind: "kind",
  risk_level: "riskLevel",
  rollback_tested: "rollbackTested",
  mode: "mode",
  no_sheet: "noSheet",
});

/**
 * Convert a snake_case adapter-payload object to the camelCase shape the
 * resolver functions accept. Unknown keys pass through unchanged so future
 * additions on the persistence side don't silently drop until this map
 * catches up.
 */
export function snakeAdapterToCamel(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [snake, value] of Object.entries(raw)) {
    out[ADAPTER_SNAKE_TO_CAMEL[snake] ?? snake] = value;
  }
  return out;
}
