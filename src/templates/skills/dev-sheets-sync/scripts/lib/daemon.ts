/**
 * `codi sheets daemon` — drains .codi/sheets-queue.jsonl by retrying
 * each pending upsert against the Sheet.
 *
 * v0.1 design:
 *   - Single foreground process. The user runs it in a separate terminal
 *     or a background tmux pane. Daemonization (systemd / launchd) is
 *     out of scope for v0.1.
 *   - Polling loop with a fixed interval (default 10s).
 *   - Per-record retry budget (default 5). On exhaust, the record is removed
 *     from the queue and a permanent-failure message is printed (the Sheet's
 *     own Audit tab is the persistent log; daemon stdout is best-effort).
 *   - --once mode runs a single pass and exits. Used by tests + cron-style
 *     setups that prefer external scheduling.
 */

import type { ProjectConfig } from "./types.js";
import { SheetsError } from "./types.js";
import type { SheetsClient } from "./client.js";
import { upsertRow } from "./operations.js";
import { readPending, removeById, incrementAttempt } from "./queue.js";

export interface DaemonOptions {
  cwd: string;
  client: SheetsClient;
  config: ProjectConfig;
  /** Polling interval in milliseconds. Default 10000. */
  intervalMs?: number;
  /** Per-record retry budget. Default 5. */
  maxAttempts?: number;
  /** If true, runs a single pass and returns. */
  once?: boolean;
  /** Override clock for tests. */
  now?: () => Date;
  /** Sink for human-readable status lines (default: console.log). */
  log?: (line: string) => void;
}

export interface DaemonPassResult {
  attempted: number;
  flushed: number;
  retried: number;
  permanently_failed: number;
}

/** Run a single drain pass; returns counts. Does not loop. */
export async function drainOnce(opts: DaemonOptions): Promise<DaemonPassResult> {
  const log = opts.log ?? ((l: string) => console.log(l));
  const max = opts.maxAttempts ?? 5;
  const records = readPending(opts.cwd);

  let attempted = 0;
  let flushed = 0;
  let retried = 0;
  let permanently_failed = 0;

  for (const r of records) {
    attempted += 1;
    try {
      await upsertRow(r.entity, r.row, {
        caller: r.caller,
        client: opts.client,
        config: opts.config,
        actor: r.actor,
        ...(r.audit_event !== undefined ? { auditEvent: r.audit_event } : {}),
        ...(opts.now !== undefined ? { now: opts.now } : {}),
      });
      removeById(opts.cwd, r.queue_id);
      flushed += 1;
      log(`flushed ${r.queue_id} (${r.entity}/${r.row["id"] ?? "<new>"})`);
    } catch (e) {
      if (e instanceof SheetsError && e.code === "sheet_unreachable") {
        if (r.attempts + 1 >= max) {
          removeById(opts.cwd, r.queue_id);
          permanently_failed += 1;
          log(`permanent failure: ${r.queue_id} after ${r.attempts + 1} attempts: ${e.message}`);
        } else {
          incrementAttempt(opts.cwd, r.queue_id);
          retried += 1;
          log(`retry queued: ${r.queue_id} (attempt ${r.attempts + 1}/${max})`);
        }
        continue;
      }
      // Non-transient error (zone_violation / schema_invalid / config_missing) —
      // don't retry; drop the record.
      removeById(opts.cwd, r.queue_id);
      permanently_failed += 1;
      log(`permanent failure: ${r.queue_id} non-transient error: ${(e as Error).message}`);
    }
  }

  return { attempted, flushed, retried, permanently_failed };
}

/** Poll-loop until process exits; ctrl-C to stop. */
export async function runDaemon(opts: DaemonOptions): Promise<void> {
  const interval = opts.intervalMs ?? 10000;
  const log = opts.log ?? ((l: string) => console.log(l));

  let stopping = false;
  const onSig = (): void => {
    stopping = true;
    log("daemon: stop requested; exiting after current pass");
  };
  process.once("SIGINT", onSig);
  process.once("SIGTERM", onSig);

  if (opts.once === true) {
    const r = await drainOnce(opts);
    log(
      `daemon: single pass — attempted=${r.attempted} flushed=${r.flushed} retried=${r.retried} permanently_failed=${r.permanently_failed}`,
    );
    return;
  }

  log(`daemon: starting (interval=${interval}ms)`);
  while (!stopping) {
    const r = await drainOnce(opts);
    if (r.attempted > 0) {
      log(
        `daemon: pass — attempted=${r.attempted} flushed=${r.flushed} retried=${r.retried} permanently_failed=${r.permanently_failed}`,
      );
    }
    if (stopping) break;
    await sleep(interval);
  }
  log("daemon: exited cleanly");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
