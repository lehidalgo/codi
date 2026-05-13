/**
 * Active-workflow resolution helper for CLI handlers.
 *
 * Background:
 *   - `codi workflow status` already uses cwd-filtered lookup via
 *     `BrainEventLog.getActiveWorkflowIdForCwd(cwd)` so a workflow started
 *     in project A does not appear when the user runs `status` from
 *     project B.
 *   - Every other CLI handler (abandon, transition propose/approve/reject,
 *     scope expansion, elevation, handover, convert) historically called
 *     bare `getActiveWorkflowId()` and ignored the `cwd?` option declared
 *     in their own opts interfaces. Result: from project B, `status` said
 *     "no active workflow" while `approve` happily mutated project A's
 *     workflow.
 *
 * This helper centralizes the cwd-filtered lookup so transitions and
 * lifecycle agree with status. Hooks (`src/runtime/capture/*`) and
 * internal stale-active cleanups inside `runWorkflow` deliberately use
 * the bare API — they need the global active pointer regardless of cwd
 * (Stop hook fires from the same cwd anyway; cleanup wants to find any
 * stale row from any project). Those call sites are NOT routed through
 * this helper.
 */

import type { BrainEventLog } from "../brain-event-log.js";

/** Minimal shape every CLI handler's opts share — only `cwd` matters here. */
export interface HasCwd {
  readonly cwd?: string;
}

/**
 * Resolve the active workflow id scoped to the caller's cwd. Returns
 * `null` when no workflow is active OR when the active workflow's
 * recorded init cwd resolves to a different project root than `opts.cwd`
 * (or `process.cwd()` when `opts.cwd` is undefined).
 *
 * Equivalent to `log.getActiveWorkflowIdForCwd(opts.cwd ?? process.cwd())`,
 * extracted so the `process.cwd()` default lives in one place — easier
 * to migrate later (e.g. for ISSUE-053 multi-project routing).
 */
export function resolveActiveWorkflowId(log: BrainEventLog, opts: HasCwd): string | null {
  return log.getActiveWorkflowIdForCwd(opts.cwd ?? process.cwd());
}
