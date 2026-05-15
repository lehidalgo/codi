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
import { reduce, reduceIncremental, REDUCER_VERSION } from "./reducer.js";
import type { ManifestEvent, ReducedState } from "./types.js";

/**
 * CORE-009 — snapshot every K events appended to a workflow. Set via
 * the constant so future tuning is a one-line change; CORE-009b may
 * lift it to a runtime-configurable knob (env var) if monitoring shows
 * value, but the hard-coded default keeps the migration boundary
 * narrow.
 */
const SNAPSHOT_EVERY_K = 50;

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
    // CORE-009 — snapshot every K events appended. Runs OUTSIDE the
    // append transaction so a slow snapshot doesn't block the next
    // hook's append. Failures are soft (logged via debug-only path,
    // never thrown) because the snapshot is a cache: a failed write
    // means the next read pays a cold replay, not data loss. The
    // checkpoint is read-after-commit so the snapshot reflects the
    // event we just persisted.
    if (sequence > 0 && sequence % SNAPSHOT_EVERY_K === 0) {
      try {
        const prior = this.readSnapshot(workflowId);
        const { events: delta, maxEventId } = this.loadEventsSince(
          workflowId,
          prior?.lastEventId ?? null,
        );
        if (delta.length > 0) {
          const state =
            prior === null ? reduce(delta) : reduceIncremental(prior.state, delta);
          // `events_applied` is the cumulative count in the workflow,
          // which the reducer already maintains accurately on the
          // returned state.
          this.writeSnapshot(workflowId, state, maxEventId, state.events_count);
        }
      } catch {
        // Snapshot is best-effort — append must remain durable even if
        // a malformed event in the delta blows up the reducer. The next
        // read will retry via the cold-replay path.
      }
    }
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

  /**
   * Load all events for a workflow, ordered by event_id ASC.
   *
   * Storage-layer durability (CORE-001): rows whose `payload` column is
   * not valid JSON, or whose parsed shape is not a manifest event
   * envelope, are silently filtered out. Disk-level corruption (e.g.
   * a partial write or a hand-edited row) thus produces a degraded but
   * non-crashing read. Shape-level corruption (a payload that parses
   * but doesn't match the expected fields) propagates to the reducer,
   * which throws `ReducerError` with `eventId` for actionable diagnosis.
   */
  loadEvents(workflowId: string): ManifestEvent[] {
    const rows = this.handle.raw
      .prepare(
        `SELECT event_id, payload FROM workflow_events WHERE workflow_id = ? ORDER BY event_id ASC`,
      )
      .all(workflowId) as { event_id: number; payload: string }[];
    const out: ManifestEvent[] = [];
    for (const r of rows) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(r.payload);
      } catch {
        continue;
      }
      if (
        parsed !== null &&
        typeof parsed === "object" &&
        !Array.isArray(parsed) &&
        typeof (parsed as Record<string, unknown>).event_type === "string"
      ) {
        out.push(parsed as ManifestEvent);
      }
    }
    return out;
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

  /**
   * CORE-009 — load every `workflow_events` row with rowid greater than
   * `sinceEventId`, ordered ascending. Used by the snapshot path to
   * fetch only the delta since the last persisted snapshot. Pass `0`
   * (or `null`) to load every event (semantically equivalent to
   * `loadEvents`).
   *
   * The `event_id` parameter is the integer rowid from
   * `workflow_events.event_id`, NOT the UUID inside the payload. The
   * caller obtains it either from `readSnapshot().lastEventId` or from
   * the previous call's max returned rowid.
   *
   * Returns the rowid alongside each event so the caller can persist
   * the max as the new snapshot's `last_event_id` without re-querying.
   */
  loadEventsSince(
    workflowId: string,
    sinceEventId: number | null,
  ): { events: ManifestEvent[]; maxEventId: number } {
    const cutoff = sinceEventId ?? 0;
    const rows = this.handle.raw
      .prepare(
        `SELECT event_id, payload FROM workflow_events
         WHERE workflow_id = ? AND event_id > ?
         ORDER BY event_id ASC`,
      )
      .all(workflowId, cutoff) as { event_id: number; payload: string }[];
    const events: ManifestEvent[] = [];
    let maxEventId = cutoff;
    for (const r of rows) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(r.payload);
      } catch {
        // Storage-layer corruption tolerance — mirrors loadEvents.
        continue;
      }
      if (
        parsed !== null &&
        typeof parsed === "object" &&
        !Array.isArray(parsed) &&
        typeof (parsed as Record<string, unknown>).event_type === "string"
      ) {
        events.push(parsed as ManifestEvent);
        if (r.event_id > maxEventId) maxEventId = r.event_id;
      }
    }
    return { events, maxEventId };
  }

  /**
   * CORE-009 — read a persisted snapshot if its `reducer_version`
   * matches the current `REDUCER_VERSION` constant. A mismatch signals
   * the reducer logic has changed since the snapshot was written, so
   * the cached state is stale; the caller must cold-replay. Same
   * fallback for parse failures on `reduced_state_json`.
   *
   * Returns `null` for: missing row, parse error, version mismatch.
   * Never throws — snapshots are soft-state and a corrupt row should
   * trigger a fresh cold replay rather than a workflow read failure.
   */
  readSnapshot(workflowId: string): { state: ReducedState; lastEventId: number } | null {
    const row = this.handle.raw
      .prepare(
        `SELECT last_event_id, reduced_state_json, reducer_version
           FROM workflow_snapshots
          WHERE workflow_id = ?`,
      )
      .get(workflowId) as
      | { last_event_id: number; reduced_state_json: string; reducer_version: number }
      | undefined;
    if (!row) return null;
    if (row.reducer_version !== REDUCER_VERSION) return null;
    try {
      const state = JSON.parse(row.reduced_state_json) as ReducedState;
      return { state, lastEventId: row.last_event_id };
    } catch {
      return null;
    }
  }

  /**
   * CORE-009 — UPSERT a snapshot row. Called by `append()` every K
   * events. Single row per workflow_id — historical snapshots are not
   * retained (the event log is the source of truth for time travel).
   */
  writeSnapshot(
    workflowId: string,
    state: ReducedState,
    lastEventId: number,
    eventsApplied: number,
  ): void {
    this.handle.raw
      .prepare(
        `INSERT INTO workflow_snapshots(
            workflow_id, last_event_id, reduced_state_json,
            events_applied, reducer_version, created_at
         ) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(workflow_id) DO UPDATE SET
            last_event_id = excluded.last_event_id,
            reduced_state_json = excluded.reduced_state_json,
            events_applied = excluded.events_applied,
            reducer_version = excluded.reducer_version,
            created_at = excluded.created_at`,
      )
      .run(
        workflowId,
        lastEventId,
        JSON.stringify(state),
        eventsApplied,
        REDUCER_VERSION,
        Date.now(),
      );
  }

  /**
   * CORE-009 — read the reduced state of a workflow, using the cached
   * snapshot when one exists. This is the recommended entry point for
   * callers that previously did `reduce(log.loadEvents(workflowId))`.
   *
   * Cold path (no snapshot, or snapshot stale): runs `reduce` over the
   * full event list and writes a fresh snapshot so subsequent calls
   * pay only the delta cost.
   *
   * Warm path (snapshot present and current): runs `reduceIncremental`
   * over the events appended since the snapshot's `last_event_id`.
   * When the delta is empty, returns the snapshot state directly
   * (after a deep-clone — see `reduceIncremental` for why).
   */
  getReducedState(workflowId: string): ReducedState {
    const snapshot = this.readSnapshot(workflowId);
    if (snapshot === null) {
      // Cold replay — read every event and write a fresh snapshot.
      const events = this.loadEvents(workflowId);
      const state = reduce(events);
      // Last rowid for the workflow (events.length >= 1, init is event #1).
      const lastRow = this.handle.raw
        .prepare(
          `SELECT MAX(event_id) AS max_id FROM workflow_events WHERE workflow_id = ?`,
        )
        .get(workflowId) as { max_id: number | null } | undefined;
      const lastEventId = lastRow?.max_id ?? 0;
      this.writeSnapshot(workflowId, state, lastEventId, events.length);
      return state;
    }

    const { events: delta, maxEventId } = this.loadEventsSince(
      workflowId,
      snapshot.lastEventId,
    );
    if (delta.length === 0) {
      // Deep-clone to preserve the no-mutation contract.
      return JSON.parse(JSON.stringify(snapshot.state)) as ReducedState;
    }
    const state = reduceIncremental(snapshot.state, delta);
    // Do NOT write a snapshot on every read — let `append` decide based
    // on `SNAPSHOT_EVERY_K`. Reads are read-only by contract.
    void maxEventId;
    return state;
  }

  /** Backend-agnostic check: is there a workflow_runs row for this id? */
  hasWorkflow(workflowId: string): boolean {
    const row = this.handle.raw
      .prepare(`SELECT 1 as ok FROM workflow_runs WHERE workflow_id = ?`)
      .get(workflowId) as { ok?: number } | undefined;
    return row?.ok === 1;
  }
}
