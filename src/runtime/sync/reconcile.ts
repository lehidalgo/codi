/**
 * `devloop sheets reconcile` — rebuild the Sheet's execution columns from
 * the manifest event log.
 *
 * Procedure:
 *   1. Walk every archived workflow under .workflow/archives/<id>/.
 *   2. For each, derive a per-Story execution-column projection from its
 *      manifest events (init, design_doc_authored, sheet_row_upserted,
 *      workflow_completed, workflow_abandoned, etc.).
 *   3. For each Story id with derived state, upsertRow with caller=execution-only
 *      (planning columns are not touched).
 *   4. Emit a single sheet_reconciled event with the row count.
 *
 * Reconcile is idempotent — running it twice with no manifest change produces
 * no Sheet writes (the upsert diff check yields was_no_op=true).
 */

import { readdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { ProjectConfig, CellValue, SheetRow } from "./types.js";
import type { SheetsClient } from "./client.js";
import { upsertRow } from "./operations.js";

interface ManifestEvent {
  event_type: string;
  payload: Record<string, unknown>;
}

interface DerivedStoryState {
  /** Columns to upsert. Always execution-only. */
  row: Record<string, CellValue>;
}

export interface ReconcileOptions {
  cwd: string;
  client: SheetsClient;
  config: ProjectConfig;
  actor: string;
  /** Override clock for tests. */
  now?: () => Date;
}

export interface ReconcileResult {
  rows_reconciled: number;
  duration_ms: number;
  rows_no_op: number;
}

export async function reconcile(opts: ReconcileOptions): Promise<ReconcileResult> {
  const start = (opts.now ?? (() => new Date()))().getTime();

  const archivesDir = join(opts.cwd, ".workflow", "archives");
  const stateByStory = new Map<string, DerivedStoryState>();

  if (existsSync(archivesDir)) {
    for (const workflowId of readdirSync(archivesDir)) {
      const workflowDir = join(archivesDir, workflowId);
      const events = readWorkflowEvents(workflowDir);
      mergeWorkflowState(events, stateByStory);
    }
  }

  let rowsReconciled = 0;
  let rowsNoOp = 0;

  for (const [storyId, derived] of stateByStory) {
    const row: SheetRow = { ...derived.row, id: storyId };
    const result = await upsertRow("UserStory", row, {
      caller: "execution-only",
      client: opts.client,
      config: opts.config,
      actor: opts.actor,
      now: opts.now,
    });
    if (result.was_no_op) rowsNoOp += 1;
    else rowsReconciled += 1;
  }

  const duration_ms = (opts.now ?? (() => new Date()))().getTime() - start;

  return { rows_reconciled: rowsReconciled, duration_ms, rows_no_op: rowsNoOp };
}

function readWorkflowEvents(workflowDir: string): ReadonlyArray<ManifestEvent> {
  // Each event is a separate JSON file: NNN_event_type.json
  if (!existsSync(workflowDir)) return [];
  const out: ManifestEvent[] = [];
  const files = readdirSync(workflowDir)
    .filter((f) => f.endsWith(".json") && f !== "reduced-state.json")
    .sort();
  for (const f of files) {
    try {
      const raw = readFileSync(join(workflowDir, f), "utf8");
      const parsed = JSON.parse(raw) as ManifestEvent;
      if (typeof parsed.event_type === "string") out.push(parsed);
    } catch {
      // Skip malformed
    }
  }
  return out;
}

function mergeWorkflowState(
  events: ReadonlyArray<ManifestEvent>,
  acc: Map<string, DerivedStoryState>,
): void {
  // Find the from_story_id from init.
  let fromStoryId: string | null = null;
  let workflowType: string | null = null;
  let startedAt: string | null = null;
  const branch: string | null = null;
  let designDocPath: string | null = null;
  const mergedSha: string | null = null;
  const mergedAt: string | null = null;
  const prUrl: string | null = null;
  const prState: string | null = null;
  let status: string | null = null;
  let completedAt: string | null = null;

  for (const ev of events) {
    if (ev.event_type === "init") {
      const fsi = ev.payload["from_story_id"];
      if (typeof fsi === "string") fromStoryId = fsi;
      const wt = ev.payload["workflow_type"];
      if (typeof wt === "string") workflowType = wt;
    } else if (ev.event_type === "phase_started") {
      // first phase_started timestamp ≈ workflow start (best-effort)
      const phase = ev.payload["phase"];
      if (phase === "intent" && startedAt === null) {
        startedAt = (ev as unknown as { timestamp?: string }).timestamp ?? null;
      }
    } else if (ev.event_type === "design_doc_authored") {
      const ddp = ev.payload["design_doc_path"];
      if (typeof ddp === "string") designDocPath = ddp;
      const sid = ev.payload["story_id"];
      if (typeof sid === "string" && fromStoryId === null) fromStoryId = sid;
    } else if (ev.event_type === "workflow_completed") {
      status = "delivered";
      completedAt = (ev as unknown as { timestamp?: string }).timestamp ?? null;
    } else if (ev.event_type === "workflow_abandoned") {
      status = "abandoned";
      completedAt = (ev as unknown as { timestamp?: string }).timestamp ?? null;
    }
  }

  if (fromStoryId === null) return; // workflow not linked to a Story; nothing to reconcile

  const row: Record<string, CellValue> = {};
  if (workflowType !== null) row["workflow_type"] = workflowType;
  if (branch !== null) row["branch"] = branch;
  if (startedAt !== null) row["started_at"] = startedAt;
  if (designDocPath !== null) row["design_doc_path"] = designDocPath;
  if (mergedSha !== null) row["merged_sha"] = mergedSha;
  if (mergedAt !== null) row["merged_at"] = mergedAt;
  if (prUrl !== null) row["pr_url"] = prUrl;
  if (prState !== null) row["pr_state"] = prState;
  if (status !== null) row["status"] = status;
  if (completedAt !== null) row["completed_at"] = completedAt;

  if (Object.keys(row).length === 0) return;

  // Last write wins per Story id (later workflows overwrite earlier).
  const existing = acc.get(fromStoryId);
  if (existing) {
    acc.set(fromStoryId, { row: { ...existing.row, ...row } });
  } else {
    acc.set(fromStoryId, { row });
  }
}
