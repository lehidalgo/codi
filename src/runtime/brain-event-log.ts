/**
 * Brain-DB-backed event log — sole event-log surface in v3 zero.
 *
 * Persists workflow runs + events to `~/.codi/brain.db` via the
 * `workflow_runs` + `workflow_events` tables. The previous filesystem
 * archive layout was retired in F5 of the v3 zero closure.
 *
 * Lock semantics: single-process exclusion via a row in
 * `workflow_runs.metadata` keyed `lock_held_pid`. A lock is "held" when
 * the row exists for a PID that is alive; `releaseLock` clears the key.
 */

import type Database from "better-sqlite3";
import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { openBrain, type BrainHandle } from "#src/runtime/brain/db.js";
import { resolveTeamId } from "#src/core/audit/resolve-team.js";
import { applyMigrations } from "#src/runtime/brain/migrate.js";
import type { ManifestEvent } from "./types.js";

// ISSUE-069 — per-process cache for `git rev-parse --show-toplevel`. Each
// uncached call spawns a child process (~50-100ms); workflow hot paths can
// invoke this 5-10× per Stop hook fire. Keyed by the raw cwd input so a
// caller asking the same question gets the same answer without re-spawning.
// The cache lives in module scope (single-process brain-event-log handle)
// and is cleared between tests via _resetProjectRootCacheForTests.
const projectRootCache = new Map<string, string>();

function resolveProjectRoot(cwd: string): string {
  const cached = projectRootCache.get(cwd);
  if (cached !== undefined) return cached;
  let absolute: string;
  try {
    const out = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      timeout: 5_000,
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    absolute = out.trim();
  } catch {
    absolute = resolve(cwd);
  }
  // Resolve symlinks (e.g. macOS /tmp → /private/tmp) so two paths
  // pointing at the same directory compare equal.
  let resolved: string;
  try {
    resolved = realpathSync(absolute);
  } catch {
    resolved = absolute;
  }
  projectRootCache.set(cwd, resolved);
  return resolved;
}

/** Test-only — clears the per-cwd cache so a beforeEach can re-probe. */
export function _resetProjectRootCacheForTests(): void {
  projectRootCache.clear();
}

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

/**
 * Active-id pointer + lock state live in the `runtime_state` KV table
 * (schema v11). Pre-v11 this lived as a fake row inside `workflow_runs`
 * with `workflow_id = '__codi_session__'`, forcing every aggregation to
 * filter `type != 'session'`. The migration moved the JSON metadata into
 * `runtime_state('session', <json>)` so workflow_runs stores only real
 * workflow rows. See ISSUE-037.
 */
const RUNTIME_STATE_KEY = "session";

interface RuntimeStateRow {
  value: string;
}

function readMetadata(raw: Database.Database): MetadataShape {
  const row = raw
    .prepare(`SELECT value FROM runtime_state WHERE key = ?`)
    .get(RUNTIME_STATE_KEY) as RuntimeStateRow | undefined;
  if (!row || !row.value) return {};
  try {
    return JSON.parse(row.value) as MetadataShape;
  } catch {
    return {};
  }
}

function writeMetadata(raw: Database.Database, meta: MetadataShape): void {
  const json = JSON.stringify(meta);
  raw
    .prepare(
      `INSERT INTO runtime_state(key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .run(RUNTIME_STATE_KEY, json);
}

export class BrainEventLog {
  private constructor(
    private readonly handle: BrainHandle,
    private readonly ownsHandle: boolean,
  ) {}

  /**
   * Direct access to the underlying SQLite handle for handlers that need
   * to run their own SELECTs / aggregations (recoverWorkflow, stats).
   * Read-only convention by name — callers should never INSERT here; they
   * should go through the typed methods on this class.
   */
  get privateRaw(): BrainHandle["raw"] {
    return this.handle.raw;
  }

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

  /**
   * Returns the active workflow id only when its `init` payload `cwd`
   * matches the supplied cwd (resolved through git toplevel). Workflows
   * that predate the cwd field (no payload.cwd) fall through and return
   * the id for back-compat. Used by `codi workflow status` so a workflow
   * started in a different project does not appear in this project's
   * status output.
   */
  getActiveWorkflowIdForCwd(cwd: string): string | null {
    const id = this.getActiveWorkflowId();
    if (!id) return null;
    try {
      const events = this.loadEvents(id);
      const initEvent = events.find((e) => e.event_type === "init");
      const initCwd = (initEvent?.payload as { cwd?: string } | undefined)?.cwd;
      if (typeof initCwd !== "string" || initCwd.length === 0) {
        return id;
      }
      const currentRoot = resolveProjectRoot(cwd);
      const initRoot = resolveProjectRoot(initCwd);
      return currentRoot === initRoot ? id : null;
    } catch {
      return id;
    }
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
    if (initEvent.event_type !== "init") {
      throw new Error(`First event must be 'init', got '${initEvent.event_type}'`);
    }

    // BEGIN IMMEDIATE: takes the SQLite reserved write-lock before the first
    // read inside the transaction. Two concurrent `codi workflow run`
    // processes will see only one acquire the lock; the second hits
    // SQLITE_BUSY and the transaction wrapper translates it to a thrown
    // error. The active-workflow check moves inside the txn so the
    // read+write is one atomic step.
    const txn = this.handle.raw.transaction(() => {
      const existingId = this.getActiveWorkflowId();
      if (existingId !== null && existingId !== workflowId) {
        throw new BrainWorkflowAlreadyActiveError(existingId);
      }
      // Create or update the workflow_runs row for this workflow.
      const existing = this.handle.raw
        .prepare(`SELECT workflow_id FROM workflow_runs WHERE workflow_id = ?`)
        .get(workflowId);
      if (!existing) {
        const payload = initEvent.payload as
          | { workflow_type?: string; task?: string; cwd?: string }
          | undefined;
        // ISSUE-053: stamp team_id at workflow init so team-brain
        // aggregation can demux this row. The cwd in the init payload
        // is the path the workflow was started against; resolveTeamId
        // reads .codi/codi.yaml from there.
        const teamId = resolveTeamId(payload?.cwd ? { cwd: payload.cwd } : {});
        this.handle.raw
          .prepare(
            `INSERT INTO workflow_runs(workflow_id, project_id, type, current_phase, status, started_at, metadata, team_id)
             VALUES (?, ?, ?, 'init', 'active', ?, ?, ?)`,
          )
          .run(
            workflowId,
            "_",
            payload?.workflow_type ?? "feature",
            Date.now(),
            JSON.stringify({ task: payload?.task }),
            teamId,
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
    txn.immediate();
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
      // Iron Law 4 (F7) — phase transitions enter pending_approval until the
      // user resolves them with an explicit 'ok' / 'reject'. The hard-gate
      // banner injected by the UserPromptSubmit hook reads this status.
      case "phase_transition_proposed":
        return { status: "pending_approval" };
      case "phase_transition_approved":
      case "phase_transition_rejected":
        return { status: "active" };
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
