/**
 * Spawn-or-attach lifecycle for the brain-ui server (Sprint 4).
 *
 * Default port: 4477. Pidfile at `~/.codi/brain-ui.pid` records the live
 * instance. Attach is preferred over spawn so multiple agent sessions share
 * one server (and one SQLite reader).
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { PROJECT_DIR } from "#src/constants.js";

export const DEFAULT_BRAIN_UI_PORT = 4477;

export function defaultPidfilePath(): string {
  return resolve(homedir(), PROJECT_DIR, "brain-ui.pid");
}

export interface PidfileRecord {
  readonly pid: number;
  readonly port: number;
  readonly startedAt: number;
}

export function readPidfile(path = defaultPidfilePath()): PidfileRecord | null {
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw) as PidfileRecord;
    if (!parsed.pid || !parsed.port) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writePidfile(record: PidfileRecord, path = defaultPidfilePath()): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(record, null, 2));
}

export function clearPidfile(path = defaultPidfilePath()): void {
  if (existsSync(path)) unlinkSync(path);
}

/**
 * Probe whether a PID is alive. Uses signal 0 — Node's idiom for "ping" that
 * does not actually send a signal but checks that the process exists.
 */
export function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Probe the running server's healthz endpoint. Returns the parsed body on
 * success, null on any failure (network, non-2xx, parse error). Caller
 * decides whether to attach or spawn based on the result.
 */
export async function probeHealthz(
  port: number,
  timeoutMs = 1000,
): Promise<{ ok: boolean; schema_version: number; brain_path: string; now: number } | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`http://127.0.0.1:${port}/healthz`, {
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as {
      ok: boolean;
      schema_version: number;
      brain_path: string;
      now: number;
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export type AttachDecision =
  | { action: "attach"; record: PidfileRecord }
  | { action: "spawn"; reason: "no_pidfile" | "stale_pid" | "no_healthz" };

/**
 * Decide attach-vs-spawn based on the pidfile + a live healthz check.
 *
 * - No pidfile or stale PID → spawn fresh
 * - PID alive but healthz unreachable → spawn (the process is wedged)
 * - PID alive + healthz green → attach
 */
export async function resolveAttachOrSpawn(
  pidfilePath = defaultPidfilePath(),
): Promise<AttachDecision> {
  const record = readPidfile(pidfilePath);
  if (!record) return { action: "spawn", reason: "no_pidfile" };
  if (!isPidAlive(record.pid)) return { action: "spawn", reason: "stale_pid" };
  const health = await probeHealthz(record.port);
  if (!health || !health.ok) return { action: "spawn", reason: "no_healthz" };
  return { action: "attach", record };
}
