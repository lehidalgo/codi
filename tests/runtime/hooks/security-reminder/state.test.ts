import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  dedupeKey,
  loadShownWarnings,
  persistShownWarning,
  stateFilePath,
  cleanupOldStateFiles,
} from "#src/runtime/hooks/security-reminder/state.js";

describe("dedupe state", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "codi-sec-state-"));
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("dedupeKey resolves to absolute canonical path", () => {
    const k1 = dedupeKey("sid", "/abs/foo.ts", "rule");
    const k2 = dedupeKey("sid", "/abs/foo.ts", "rule");
    expect(k1).toBe(k2);
    expect(k1.includes("foo.ts")).toBe(true);
  });

  it("dedupeKey normalises relative paths", () => {
    const k1 = dedupeKey("sid", "src/foo.ts", "rule");
    const k2 = dedupeKey("sid", "./src/foo.ts", "rule");
    expect(k1).toBe(k2);
  });

  it("loadShownWarnings returns empty set for missing file", () => {
    const set = loadShownWarnings("missing-sid", dir);
    expect(set.size).toBe(0);
  });

  it("persist + load round-trips", () => {
    const key = dedupeKey("sid1", "/abs/foo.ts", "rule");
    persistShownWarning("sid1", key, dir);
    const set = loadShownWarnings("sid1", dir);
    expect(set.has(key)).toBe(true);
  });

  it("persist accumulates multiple keys per session", () => {
    persistShownWarning("multi", "k1", dir);
    persistShownWarning("multi", "k2", dir);
    const set = loadShownWarnings("multi", dir);
    expect(set.has("k1")).toBe(true);
    expect(set.has("k2")).toBe(true);
  });

  it("cleanupOldStateFiles removes files older than the threshold", () => {
    const path = stateFilePath("old-sid", dir);
    persistShownWarning("old-sid", "k", dir);
    const ms = (Date.now() - 31 * 24 * 60 * 60 * 1000) / 1000;
    utimesSync(path, ms, ms);
    cleanupOldStateFiles(dir, 30);
    expect(loadShownWarnings("old-sid", dir).size).toBe(0);
  });

  it("cleanupOldStateFiles keeps recent files", () => {
    persistShownWarning("fresh-sid", "k", dir);
    cleanupOldStateFiles(dir, 30);
    expect(loadShownWarnings("fresh-sid", dir).size).toBe(1);
  });
});
