/**
 * Per-session dedupe state for the security-reminder runtime hook.
 *
 * The hook only blocks once per (sessionId, canonical filePath, ruleId)
 * triple. The shown set is persisted to a JSON file under ~/.codi/security/
 * so it survives across hook invocations within the same session.
 *
 * Cleanup of stale files (>30 days old) runs lazily; callers may invoke
 * cleanupOldStateFiles at the SessionStart hook to keep the directory tidy.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export const DEFAULT_STATE_DIR = join(homedir(), ".codi", "security");

export function stateFilePath(sessionId: string, dir = DEFAULT_STATE_DIR): string {
  return join(dir, `state-${sessionId}.json`);
}

export function dedupeKey(sessionId: string, filePath: string, ruleId: string): string {
  const canonical = resolve(filePath);
  return `${sessionId}::${canonical}::${ruleId}`;
}

interface PersistedState {
  sessionId: string;
  hookName: string;
  shownWarnings?: string[];
  lastAccess?: string;
}

export function loadShownWarnings(sessionId: string, dir = DEFAULT_STATE_DIR): Set<string> {
  const path = stateFilePath(sessionId, dir);
  if (!existsSync(path)) return new Set();
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as PersistedState;
    return new Set(parsed.shownWarnings ?? []);
  } catch {
    return new Set();
  }
}

export function persistShownWarning(sessionId: string, key: string, dir = DEFAULT_STATE_DIR): void {
  mkdirSync(dir, { recursive: true });
  const path = stateFilePath(sessionId, dir);
  const existing = loadShownWarnings(sessionId, dir);
  existing.add(key);
  const payload: PersistedState = {
    sessionId,
    hookName: "security-reminder",
    shownWarnings: [...existing],
    lastAccess: new Date().toISOString(),
  };
  const tmp = `${path}.tmp.${process.pid}.${Date.now()}`;
  writeFileSync(tmp, JSON.stringify(payload), "utf8");
  renameSync(tmp, path);
}

export function cleanupOldStateFiles(dir = DEFAULT_STATE_DIR, daysOld = 30): void {
  if (!existsSync(dir)) return;
  const cutoff = Date.now() - daysOld * 24 * 60 * 60 * 1000;
  for (const name of readdirSync(dir)) {
    if (!name.startsWith("state-") || !name.endsWith(".json")) continue;
    const path = join(dir, name);
    try {
      const s = statSync(path);
      if (s.mtimeMs < cutoff) unlinkSync(path);
    } catch {
      /* ignore stat / unlink races */
    }
  }
}
