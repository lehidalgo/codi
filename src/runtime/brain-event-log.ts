/**
 * Brain-DB-backed event log (Item 1+2 of v3 closure plan).
 *
 * Implements the same surface as the legacy `EventLog` (file-based JSON
 * archives in `.devloop/active/`), but persists to `~/.codi/brain.db` via
 * the `workflow_runs` + `workflow_events` tables.
 *
 * Both classes coexist behind dependency-injection in `cli-handlers.ts`:
 *   - default = legacy EventLog (legacy tests untouched)
 *   - CODI_USE_BRAIN_BACKEND=1 (or explicit DI) = BrainEventLog
 *
 * Lock semantics: legacy uses a `.lock` file with `wx` flag. We replicate
 * the same single-process exclusion via a row in `workflow_runs.metadata`
 * keyed `lock_held_pid`. A lock is "held" when the row exists for a PID
 * that is alive; clearing it on `releaseLock` removes the key.
 */

import type Database from "better-sqlite3";
import { openBrain, applyMigrations, type BrainHandle } from "./brain/index.js";
import type { ManifestEvent } from "./types.js";

export class BrainWorkflowAlreadyActiveError extends Error {
  constructor(public readonly activeId: string) {
    super(`Another workflow is already active: ${activeId}`);
    this.name = "BrainWorkflowAlreadyActiveError";
  }
}

export class BrainNoActiveWorkflowError extends Error {
  constructor() {
    super("No active workflow. Run `codi run <type> '<task>'` first.");
    this.name = "BrainNoActiveWorkflowError";
  }
}

export class BrainLockHeldError extends Error {
  constructor() {
    super("Lock is held by another codi process.");
    this.name = "BrainLockHeldError";
  }
}

interface MetadataShape {
  active_id?: string;
  lock_held_pid?: number;
  lock_acquired_at?: number;
  [key: string]: unknown;
}

/** Minimal projection of a workflow_runs row used by the active-id state. */
interface SingletonRow {
  workflow_id: string;
  metadata: string | null;
}

const SINGLETON_KEY = "__codi_session__";

function readMetadata(raw: Database.Database): MetadataShape {
  const row = raw
    .prepare(`SELECT workflow_id, metadata FROM workflow_runs WHERE workflow_id = ?`)
    .get(SINGLETON_KEY) as SingletonRow | undefined;
  if (!row || !row.metadata) return {};
  try {
    return JSON.parse(row.metadata) as MetadataShape;
  } catch {
    return {};
  }
}

function writeMetadata(raw: Database.Database, meta: MetadataShape): void {
  const json = JSON.stringify(meta);
  const exists = raw
    .prepare(`SELECT 1 FROM workflow_runs WHERE workflow_id = ?`)
    .get(SINGLETON_KEY);
  if (exists) {
    raw
      .prepare(`UPDATE workflow_runs SET metadata = ? WHERE workflow_id = ?`)
      .run(json, SINGLETON_KEY);
  } else {
    raw
      .prepare(
        `INSERT INTO workflow_runs(workflow_id, project_id, type, current_phase, status, started_at, metadata)
         VALUES (?, ?, 'session', 'session', 'active', ?, ?)`,
      )
      .run(SINGLETON_KEY, "_", Date.now(), json);
  }
}

export class BrainEventLog {
  private constructor(
    private readonly handle: BrainHandle,
    private readonly ownsHandle: boolean,
  ) {}

  /**
   * Open or create a fresh BrainEventLog backed by ~/.codi/brain.db (or
   * the path the caller supplied). Caller is responsible for `dispose()`.
   */
  static open(opts: { dbPath?: string } = {}): BrainEventLog {
    const handle = openBrain({ dbPath: opts.dbPath });
    applyMigrations(handle.raw);
    return new BrainEventLog(handle, true);
  }

  /**
   * Wrap an existing BrainHandle without taking ownership — caller must
   * close the handle. Used by the brain-ui server which already owns it.
   */
  static wrap(handle: BrainHandle): BrainEventLog {
    applyMigrations(handle.raw);
    return new BrainEventLog(handle, false);
  }

  dispose(): void {
    if (this.ownsHandle) this.handle.close();
  }

  // ─── Active workflow ID ──────────────────────────────────────────────

  getActiveWorkflowId(): string | null {
    const meta = readMetadata(this.handle.raw);
    const id = typeof meta.active_id === "string" ? meta.active_id : null;
    return id && id.length > 0 ? id : null;
  }

  setActiveWorkflowId(workflowId: string): void {
    const meta = readMetadata(this.handle.raw);
    meta.active_id = workflowId;
    writeMetadata(this.handle.raw, meta);
  }

  clearActiveWorkflowId(): void {
    const meta = readMetadata(this.handle.raw);
    delete meta.active_id;
    writeMetadata(this.handle.raw, meta);
  }

  // ─── Lock management ─────────────────────────────────────────────────

  acquireLock(): void {
    const meta = readMetadata(this.handle.raw);
    if (typeof meta.lock_held_pid === "number") {
      // Stale lock → reclaim if PID is dead. Mirrors what `flock` would do
      // automatically when the holder process exits.
      if (this.isPidAlive(meta.lock_held_pid)) {
        throw new BrainLockHeldError();
      }
    }
    meta.lock_held_pid = process.pid;
    meta.lock_acquired_at = Date.now();
    writeMetadata(this.handle.raw, meta);
  }

  releaseLock(): void {
    const meta = readMetadata(this.handle.raw);
    delete meta.lock_held_pid;
    delete meta.lock_acquired_at;
    writeMetadata(this.handle.raw, meta);
  }

  private isPidAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  // ─── Initialize a new workflow ───────────────────────────────────────

  initWorkflow(workflowId: string, initEvent: ManifestEvent): void {
    const existingId = this.getActiveWorkflowId();
    if (existingId !== null && existingId !== workflowId) {
      throw new BrainWorkflowAlreadyActiveError(existingId);
    }
    if (initEvent.event_type !== "init") {
      throw new Error(`First event must be 'init', got '${initEvent.event_type}'`);
    }

    const txn = this.handle.raw.transaction(() => {
      // Create or update the workflow_runs row for this workflow.
      const existing = this.handle.raw
        .prepare(`SELECT workflow_id FROM workflow_runs WHERE workflow_id = ?`)
        .get(workflowId);
      if (!existing) {
        const payload = initEvent.payload as { workflow_type?: string; task?: string } | undefined;
        this.handle.raw
          .prepare(
            `INSERT INTO workflow_runs(workflow_id, project_id, type, current_phase, status, started_at, metadata)
             VALUES (?, ?, ?, 'init', 'active', ?, ?)`,
          )
          .run(
            workflowId,
            "_",
            payload?.workflow_type ?? "feature",
            Date.now(),
            JSON.stringify({ task: payload?.task }),
          );
      }
      // Reject double-init: if this workflow_id already has any event, fail.
      const eventCount = this.handle.raw
        .prepare(`SELECT COUNT(*) as c FROM workflow_events WHERE workflow_id = ?`)
        .get(workflowId) as { c: number };
      if (eventCount.c > 0) {
        throw new Error(`Workflow ${workflowId} already has events.`);
      }
      this.handle.raw
        .prepare(
          `INSERT INTO workflow_events(workflow_id, event_type, ts, payload) VALUES (?, ?, ?, ?)`,
        )
        .run(workflowId, "init", Date.now(), JSON.stringify(initEvent));
      this.setActiveWorkflowId(workflowId);
    });
    txn();
  }

  // ─── Append events ──────────────────────────────────────────────────

  append(
    workflowId: string,
    event: ManifestEvent,
  ): { path: string; sequence: number; commitable: boolean } {
    const exists = this.handle.raw
      .prepare(`SELECT 1 FROM workflow_runs WHERE workflow_id = ?`)
      .get(workflowId);
    if (!exists) {
      throw new Error(`No workflow_runs row for ${workflowId}. Run initWorkflow first.`);
    }

    // F3 — keep workflow_runs.current_phase + status in sync with the event
    // stream. Closes the audit gap where these columns stayed at 'init'/
    // 'active' forever, leaving downstream readers (iron-laws-enforcer
    // readGateState, brain-ui /workflows) on stale data.
    const phaseUpdate = this.derivePhaseUpdate(event);

    const txn = this.handle.raw.transaction(() => {
      const result = this.handle.raw
        .prepare(
          `INSERT INTO workflow_events(workflow_id, event_type, ts, payload) VALUES (?, ?, ?, ?)`,
        )
        .run(workflowId, event.event_type, Date.now(), JSON.stringify(event));
      const sequence = Number(result.lastInsertRowid);
      if (phaseUpdate) {
        this.handle.raw
          .prepare(
            `UPDATE workflow_runs
               SET current_phase = COALESCE(?, current_phase),
                   status        = COALESCE(?, status),
                   ended_at      = COALESCE(?, ended_at)
             WHERE workflow_id = ?`,
          )
          .run(
            phaseUpdate.currentPhase ?? null,
            phaseUpdate.status ?? null,
            phaseUpdate.endedAt ?? null,
            workflowId,
          );
      }
      return sequence;
    });
    const sequence = txn();
    const path = `brain://workflow_events/${workflowId}/${sequence}`;
    return { path, sequence, commitable: event.commitable };
  }

  /**
   * Decide what (if anything) to update on workflow_runs based on the event
   * being appended. Returns null when the event type does not affect the
   * persisted lifecycle columns.
   */
  private derivePhaseUpdate(event: ManifestEvent): {
    currentPhase?: string;
    status?: string;
    endedAt?: number;
  } | null {
    switch (event.event_type) {
      case "phase_started": {
        const p = event.payload as { phase?: string } | undefined;
        return p?.phase ? { currentPhase: p.phase, status: "active" } : null;
      }
      case "phase_completed": {
        // Completion of a phase keeps current_phase pointing at it until the
        // next phase_started arrives — readers see 'execute' until the next
        // 'phase_started: verify'. Don't move it here.
        return null;
      }
      case "workflow_completed":
        return { status: "completed", endedAt: Date.now() };
      case "workflow_abandoned":
        return { status: "abandoned", endedAt: Date.now() };
      case "workflow_paused_for_child":
        return { status: "paused" };
      case "workflow_resumed_after_child":
        return { status: "active" };
      default:
        return null;
    }
  }

  // ─── Read events ────────────────────────────────────────────────────

  loadEvents(workflowId: string): ManifestEvent[] {
    const rows = this.handle.raw
      .prepare(`SELECT payload FROM workflow_events WHERE workflow_id = ? ORDER BY event_id ASC`)
      .all(workflowId) as { payload: string }[];
    return rows.map((r) => JSON.parse(r.payload) as ManifestEvent);
  }

  /**
   * In the legacy EventLog, "archived" = committed events (ones that
   * survived the staging-area). Brain backend has no staging — everything
   * is persisted committable or not — so this returns the same set as
   * `loadEvents`. The distinction is preserved on a per-event basis via
   * the embedded `commitable` flag in the JSON payload.
   */
  loadArchivedEvents(workflowId: string): ManifestEvent[] {
    return this.loadEvents(workflowId).filter((e) => e.commitable);
  }

  /** Backend-agnostic check: is there a workflow_runs row for this id? */
  hasWorkflow(workflowId: string): boolean {
    const row = this.handle.raw
      .prepare(`SELECT 1 as ok FROM workflow_runs WHERE workflow_id = ?`)
      .get(workflowId) as { ok?: number } | undefined;
    return row?.ok === 1;
  }
}
