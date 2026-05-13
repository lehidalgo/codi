/**
 * Append-mostly file-based queue for sheets-sync writes that hit
 * sheet_unreachable. The daemon drains this file; reconcile ignores it
 * (reconcile derives state from the manifest, not the queue).
 *
 * Layout:
 *   .codi/sheets-queue.jsonl  — one JSON object per line, schema below.
 *
 * Concurrency: the queue is single-writer (one daemon, one CLI at a time
 * via the existing codi active-workflow lock pattern is overkill here).
 * For v0.1 we accept best-effort consistency; concurrent writes are rare
 * (interactive CLI) and operations are idempotent (id-keyed).
 */

import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";

import type { SheetRow, EntityName, CallerScope } from "./types.js";

import { PROJECT_DIR } from "./project-constants.js";

export const QUEUE_RELATIVE_PATH = `${PROJECT_DIR}/sheets-queue.jsonl`;

export interface QueuedSync {
  /** stable id for retry coalescing — derived from entity+row_id when possible. */
  queue_id: string;
  enqueued_at: string;
  attempts: number;
  entity: EntityName;
  row: SheetRow;
  caller: CallerScope;
  actor: string;
  /** Optional pre-computed audit event so the original event_id is preserved on flush. */
  audit_event?: {
    event_id: string;
    event_type: string;
    payload?: unknown;
  };
}

export function queuePath(cwd: string): string {
  return resolve(cwd, QUEUE_RELATIVE_PATH);
}

export function enqueue(cwd: string, record: QueuedSync): void {
  const path = queuePath(cwd);
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, JSON.stringify(record) + "\n", "utf8");
}

export function readPending(cwd: string): ReadonlyArray<QueuedSync> {
  const path = queuePath(cwd);
  if (!existsSync(path)) return [];
  const raw = readFileSync(path, "utf8");
  if (raw.length === 0) return [];
  const out: QueuedSync[] = [];
  for (const line of raw.split("\n")) {
    if (line.length === 0) continue;
    try {
      const parsed = JSON.parse(line) as QueuedSync;
      out.push(parsed);
    } catch {
      // Skip malformed lines; daemon logs but does not fail the whole pass.
    }
  }
  return out;
}

/** Remove a record from the queue by id (after successful flush or permanent fail). */
export function removeById(cwd: string, queueId: string): void {
  const path = queuePath(cwd);
  if (!existsSync(path)) return;
  const records = readPending(cwd).filter((r) => r.queue_id !== queueId);
  rewrite(path, records);
}

/** Increment the attempt counter for a record. */
export function incrementAttempt(cwd: string, queueId: string): void {
  const path = queuePath(cwd);
  if (!existsSync(path)) return;
  const records = readPending(cwd).map((r) =>
    r.queue_id === queueId ? { ...r, attempts: r.attempts + 1 } : r,
  );
  rewrite(path, records);
}

function rewrite(path: string, records: ReadonlyArray<QueuedSync>): void {
  if (records.length === 0) {
    writeFileSync(path, "", "utf8");
    return;
  }
  const body = records.map((r) => JSON.stringify(r)).join("\n") + "\n";
  writeFileSync(path, body, "utf8");
}

/** Build a deterministic queue id from entity + row id (or random if id absent). */
export function buildQueueId(entity: EntityName, row: SheetRow): string {
  const id = typeof row["id"] === "string" ? (row["id"] as string) : null;
  if (id !== null) return `q_${entity}_${id}_${shortRandom()}`;
  return `q_${entity}_new_${shortRandom()}`;
}

function shortRandom(): string {
  return randomUUID().replace(/-/g, "").slice(0, 6);
}
