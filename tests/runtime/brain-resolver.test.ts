/**
 * Brain path resolution (DEFECT-008 fix).
 *
 * The chain is:
 *   1. CODI_BRAIN_DB env var (explicit override)
 *   2. Walk up from cwd → first `<dir>/.codi/` found → `<dir>/.codi/brain.db`
 *   3. ~/.codi/brain.db (global fallback)
 *
 * Without (2), an agent that runs `codi workflow ...` from a project's
 * subdir would hit the user's HOME brain instead of the project brain,
 * surfacing unrelated workflows. The cwd-walk plus `.codi/` marker keeps
 * each project isolated by default.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { homedir } from "node:os";
import { defaultBrainPath, findProjectBrainPath } from "#src/runtime/brain/db.js";

let tmp: string;
let savedEnv: string | undefined;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "codi-brain-resolver-"));
  savedEnv = process.env["CODI_BRAIN_DB"];
  delete process.env["CODI_BRAIN_DB"];
});

afterEach(() => {
  if (savedEnv === undefined) delete process.env["CODI_BRAIN_DB"];
  else process.env["CODI_BRAIN_DB"] = savedEnv;
  rmSync(tmp, { recursive: true, force: true });
});

describe("findProjectBrainPath", () => {
  it("returns null when no .codi/ exists from start to root", () => {
    expect(findProjectBrainPath(tmp)).toBe(null);
  });

  it("returns <project>/.codi/brain.db when .codi/ is in cwd", () => {
    mkdirSync(join(tmp, ".codi"));
    expect(findProjectBrainPath(tmp)).toBe(join(tmp, ".codi", "brain.db"));
  });

  it("walks up to find .codi/ in an ancestor directory", () => {
    mkdirSync(join(tmp, ".codi"));
    const deep = join(tmp, "src", "components", "auth");
    mkdirSync(deep, { recursive: true });
    expect(findProjectBrainPath(deep)).toBe(join(tmp, ".codi", "brain.db"));
  });

  it("picks the NEAREST .codi/ when nested projects exist", () => {
    mkdirSync(join(tmp, ".codi"));
    const inner = join(tmp, "subproject");
    mkdirSync(join(inner, ".codi"), { recursive: true });
    expect(findProjectBrainPath(inner)).toBe(join(inner, ".codi", "brain.db"));
  });

  it("returns the path even when brain.db doesn't exist yet (caller may create)", () => {
    mkdirSync(join(tmp, ".codi"));
    const path = findProjectBrainPath(tmp);
    expect(path).toBe(join(tmp, ".codi", "brain.db"));
    // The file does NOT need to exist — the resolver is structural.
  });
});

describe("defaultBrainPath chain", () => {
  it("CODI_BRAIN_DB env var wins over everything", () => {
    process.env["CODI_BRAIN_DB"] = "/tmp/explicit-test-brain.db";
    mkdirSync(join(tmp, ".codi"));
    expect(defaultBrainPath(tmp)).toBe("/tmp/explicit-test-brain.db");
  });

  it("Project-local .codi/ wins over home when no env override", () => {
    mkdirSync(join(tmp, ".codi"));
    expect(defaultBrainPath(tmp)).toBe(join(tmp, ".codi", "brain.db"));
  });

  it("Falls back to ~/.codi/brain.db when no .codi/ ancestor", () => {
    expect(defaultBrainPath(tmp)).toBe(join(homedir(), ".codi", "brain.db"));
  });

  it("Walks up multiple levels to find project brain", () => {
    mkdirSync(join(tmp, ".codi"));
    const deep = join(tmp, "a", "b", "c", "d");
    mkdirSync(deep, { recursive: true });
    expect(defaultBrainPath(deep)).toBe(join(tmp, ".codi", "brain.db"));
  });
});
