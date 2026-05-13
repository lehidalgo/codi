/**
 * ISSUE-053 — resolveTeamId helper.
 *
 * Tests precedence (override / env / .codi/codi.yaml / null), the slug
 * pattern, and the per-cwd cache.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { resolveTeamId, _resetTeamCacheForTests } from "#src/core/audit/resolve-team.js";
import { PROJECT_DIR, MANIFEST_FILENAME } from "#src/constants.js";

function seedManifest(root: string, teamId: string | null): void {
  mkdirSync(path.join(root, PROJECT_DIR), { recursive: true });
  const yaml = teamId ? `name: t\nversion: "1"\nteam_id: ${teamId}\n` : `name: t\nversion: "1"\n`;
  writeFileSync(path.join(root, PROJECT_DIR, MANIFEST_FILENAME), yaml);
}

describe("resolveTeamId", () => {
  let tmpRoot: string;
  let prevEnv: string | undefined;

  beforeEach(() => {
    tmpRoot = mkdtempSync(path.join(tmpdir(), "codi-team-"));
    prevEnv = process.env["CODI_TEAM_ID"];
    delete process.env["CODI_TEAM_ID"];
    _resetTeamCacheForTests();
  });

  afterEach(() => {
    if (prevEnv === undefined) delete process.env["CODI_TEAM_ID"];
    else process.env["CODI_TEAM_ID"] = prevEnv;
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("override wins over env / yaml", () => {
    process.env["CODI_TEAM_ID"] = "from-env";
    seedManifest(tmpRoot, "from-yaml");
    expect(resolveTeamId({ cwd: tmpRoot, override: "from-override" })).toBe("from-override");
  });

  it("env CODI_TEAM_ID wins over yaml", () => {
    process.env["CODI_TEAM_ID"] = "from-env";
    seedManifest(tmpRoot, "from-yaml");
    expect(resolveTeamId({ cwd: tmpRoot })).toBe("from-env");
  });

  it("reads team_id from .codi/codi.yaml", () => {
    seedManifest(tmpRoot, "rl3-platform");
    expect(resolveTeamId({ cwd: tmpRoot })).toBe("rl3-platform");
  });

  it("returns null when no team_id is configured anywhere", () => {
    seedManifest(tmpRoot, null);
    expect(resolveTeamId({ cwd: tmpRoot })).toBeNull();
  });

  it("returns null when .codi/codi.yaml does not exist", () => {
    expect(resolveTeamId({ cwd: tmpRoot })).toBeNull();
  });

  it("rejects slugs that violate the pattern", () => {
    seedManifest(tmpRoot, "BAD CASE WITH SPACES");
    expect(resolveTeamId({ cwd: tmpRoot })).toBeNull();
  });

  it("caches the yaml lookup per cwd", () => {
    seedManifest(tmpRoot, "cached-team");
    const first = resolveTeamId({ cwd: tmpRoot });
    // Mutate the file underneath — cached call should still return original
    seedManifest(tmpRoot, "different-team");
    expect(resolveTeamId({ cwd: tmpRoot })).toBe(first);
  });

  it("override of null forces null even when env / yaml have values", () => {
    process.env["CODI_TEAM_ID"] = "from-env";
    expect(resolveTeamId({ cwd: tmpRoot, override: null })).toBeNull();
  });
});
