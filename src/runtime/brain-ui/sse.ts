/**
 * Sprint 4.b — SSE stream of new captures.
 *
 * Polls the brain DB once per second for new capture rows and pushes them
 * to subscribed clients. Read-only — never mutates rows.
 *
 * Hono streamSSE handles the wire format. We poll instead of using SQLite
 * notifications because better-sqlite3 has no notify; the WAL guarantees we
 * see committed rows from other writers without locking.
 */

import type { Hono, Context } from "hono";
import { streamSSE } from "hono/streaming";
import { getConnInfo } from "@hono/node-server/conninfo";
import type { BrainHandle } from "#src/runtime/brain/db.js";
export interface SseEvent {
  readonly capture_id: number;
  readonly session_id: string;
  readonly ts: number;
  readonly type: string;
  readonly content: string;
}

// ISSUE-065 — cap concurrent SSE streams per source IP. Brain-ui only
// binds to loopback so the cap is mostly a guard against runaway tabs in
// the same browser (each open dashboard tab opens its own EventSource).
// 8 streams per IP covers normal multi-tab use; further attempts get a
// 429. Counter lives in module scope — brain-ui server is single-process,
// so a Map is sufficient. _resetForTests resets it between vitest runs.
export const MAX_SSE_STREAMS_PER_IP = 8;
const sseStreamsByIp = new Map<string, number>();

// ISSUE-082 — cap each SSE connection's lifetime. Browser EventSource
// auto-reconnects after the server closes, so rotating the connection
// every N ms keeps long-lived tabs from holding a single stale stream
// indefinitely (LB / NAT timeouts, broken cookies, slow memory drift in
// the streaming buffer). 30 minutes covers normal dashboard sessions;
// the client transparently re-subscribes with the Last-Event-ID header.
export const MAX_SSE_LIFETIME_MS = 30 * 60 * 1000;

function getClientIp(c: Context): string {
  try {
    const info = getConnInfo(c);
    return info.remote.address ?? "unknown";
  } catch {
    return "unknown";
  }
}

/** Test-only — clears the per-IP counter between vitest runs. */
export function _resetSseCountersForTests(): void {
  sseStreamsByIp.clear();
}

export function registerSseRoute(app: Hono, brain: BrainHandle, intervalMs = 1000): void {
  app.get("/api/v1/live/stream", (c: Context) => {
    const ip = getClientIp(c);
    const current = sseStreamsByIp.get(ip) ?? 0;
    if (current >= MAX_SSE_STREAMS_PER_IP) {
      return c.json(
        {
          error: {
            code: "E_SSE_CAP_EXCEEDED",
            message: `Too many open SSE streams from ${ip} (max ${MAX_SSE_STREAMS_PER_IP}). Close some browser tabs and retry.`,
          },
        },
        429,
      );
    }
    sseStreamsByIp.set(ip, current + 1);

    return streamSSE(c, async (stream) => {
      let lastId =
        (
          brain.raw.prepare("SELECT MAX(capture_id) AS m FROM captures").get() as {
            m: number | null;
          }
        ).m ?? 0;

      let aborted = false;
      // ISSUE-082 — record connection birth so the loop can self-close at
      // the lifetime cap. The browser EventSource client transparently
      // reconnects with Last-Event-ID, so no data is lost.
      const openedAt = Date.now();
      const release = (): void => {
        const n = sseStreamsByIp.get(ip) ?? 0;
        if (n <= 1) sseStreamsByIp.delete(ip);
        else sseStreamsByIp.set(ip, n - 1);
      };
      stream.onAbort(() => {
        aborted = true;
        release();
      });

      try {
        while (!aborted) {
          if (Date.now() - openedAt >= MAX_SSE_LIFETIME_MS) break;
          const rows = brain.raw
            .prepare(
              `SELECT capture_id, session_id, ts, type, content
               FROM captures
               WHERE capture_id > ?
               ORDER BY capture_id ASC
               LIMIT 100`,
            )
            .all(lastId) as SseEvent[];
          for (const row of rows) {
            await stream.writeSSE({
              event: "capture",
              id: String(row.capture_id),
              data: JSON.stringify(row),
            });
            lastId = row.capture_id;
          }
          await stream.sleep(intervalMs);
        }
      } finally {
        // Defense in depth — onAbort fires on normal disconnects but a
        // thrown error inside the loop would otherwise leak the counter.
        if (!aborted) release();
      }
    });
  });
}
