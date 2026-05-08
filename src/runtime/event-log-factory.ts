/**
 * Backend selector for the workflow event log.
 *
 * Closes the audit gap from `docs/20260509_012237_[AUDIT]_codi-v3-zero-end-to-end.md` §6:
 * `cli-handlers/*.ts` were hardcoding `EventLog.fromCwd(cwd)`, so a real
 * `codi run feature 'task'` always wrote to `.devloop/active/` instead of
 * the brain. Every site now goes through `selectEventLog(cwd)`, which
 * returns either backend behind a shared `EventLogLike` surface.
 *
 * Selection rule:
 *   - `CODI_USE_BRAIN_BACKEND === "1"` → BrainEventLog (writes to
 *     ~/.codi/brain.db, visible to the brain-ui server live).
 *   - anything else → legacy EventLog (file-based, default for v3.0.0).
 *
 * The default is intentionally legacy to keep the existing 30+ DevLoop
 * tests passing untouched. v3.1+ may flip the default once the brain
 * backend has burned in.
 */

import { EventLog } from "./event-log.js";
import { BrainEventLog } from "./brain-event-log.js";
import type { ManifestEvent } from "./types.js";

export type EventLogBackend = "legacy" | "brain";

export interface AppendResult {
  readonly path: string;
  readonly sequence: number;
  readonly commitable: boolean;
}

/**
 * The shared surface every cli-handler depends on. Both `EventLog` and
 * `BrainEventLog` satisfy this interface — that is the contract callers
 * are coupled to, not either concrete class.
 */
export interface EventLogLike {
  getActiveWorkflowId(): string | null;
  setActiveWorkflowId(workflowId: string): void;
  clearActiveWorkflowId(): void;
  acquireLock(): void;
  releaseLock(): void;
  initWorkflow(workflowId: string, initEvent: ManifestEvent): void;
  append(workflowId: string, event: ManifestEvent): AppendResult;
  loadEvents(workflowId: string): ManifestEvent[];
  loadArchivedEvents(workflowId: string): ManifestEvent[];
  /** Reports whether a workflow id is already known to the backend. Brain
   *  backend reads the workflow_runs table; legacy reads the archive dir. */
  hasWorkflow(workflowId: string): boolean;
  /** Optional cleanup. Legacy is stateless; brain backend closes the SQLite handle. */
  dispose?(): void;
}

/** Type guard — narrows to the legacy file-based backend, exposing the
 *  filesystem-specific `paths` accessor that some recovery and stats paths
 *  still depend on. Brain backend has no equivalent to those scans. */
export function isLegacyEventLog(log: EventLogLike): log is EventLog {
  return log instanceof EventLog;
}

export interface SelectOptions {
  /** Override env-var selection (tests). */
  readonly backend?: EventLogBackend;
  /** Brain DB path override (tests). */
  readonly brainDbPath?: string;
}

export function resolveBackend(opts: SelectOptions = {}): EventLogBackend {
  if (opts.backend) return opts.backend;
  return process.env["CODI_USE_BRAIN_BACKEND"] === "1" ? "brain" : "legacy";
}

/**
 * Open the event log for a given working directory.
 *
 * Caller is responsible for `dispose()` when present (no-op for legacy,
 * closes the SQLite handle for brain). Most CLI handlers are short-lived
 * processes where the OS reclaims the handle on exit; long-running paths
 * (brain-ui server) explicitly call dispose() in their teardown hooks.
 */
export function selectEventLog(cwd: string, opts: SelectOptions = {}): EventLogLike {
  if (resolveBackend(opts) === "brain") {
    return BrainEventLog.open({ dbPath: opts.brainDbPath });
  }
  return EventLog.fromCwd(cwd);
}
