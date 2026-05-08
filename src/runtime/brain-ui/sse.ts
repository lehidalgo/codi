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
import type { BrainHandle } from "../brain/index.js";

export interface SseEvent {
  readonly capture_id: number;
  readonly session_id: string;
  readonly ts: number;
  readonly type: string;
  readonly content: string;
}

export function registerSseRoute(app: Hono, brain: BrainHandle, intervalMs = 1000): void {
  app.get("/api/v1/live/stream", (c: Context) => {
    return streamSSE(c, async (stream) => {
      let lastId =
        (
          brain.raw.prepare("SELECT MAX(capture_id) AS m FROM captures").get() as {
            m: number | null;
          }
        ).m ?? 0;

      let aborted = false;
      stream.onAbort(() => {
        aborted = true;
      });

      while (!aborted) {
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
    });
  });
}
