/**
 * Resolve the `team_id` slug for an audit-trail row (ISSUE-053).
 *
 * Mirrors `resolveActorId` (ISSUE-052) so multi-dev brains aggregated
 * downstream (ADR-005, ISSUE-055) can demux rows from each contributor.
 * Returns `null` when no team is configured — single-tenant rows
 * deliberately carry no team identity.
 *
 * Resolution order:
 *   1. Caller-supplied override (a CLI flag, a session-level config).
 *   2. `CODI_TEAM_ID` env var (CI / multi-team devs).
 *   3. `.codi/codi.yaml` `team_id` field (the per-repo source of truth).
 *
 * The `.codi/codi.yaml` lookup is cached per resolved cwd so repeated
 * writes in one process do not re-read the file.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { PROJECT_DIR, MANIFEST_FILENAME } from "#src/constants.js";

export interface ResolveTeamOptions {
  readonly cwd?: string;
  /** Caller-supplied override — wins over every fallback. */
  readonly override?: string | null;
}

const TEAM_ID_PATTERN = /^[a-z0-9][a-z0-9-_]{0,63}$/;
const cache = new Map<string, string | null>();

/**
 * Best-effort team-slug resolution. Never throws. Returns `null` when
 * no team is configured at any tier — callers should treat NULL as
 * "untagged" (single-tenant / pre-team-brain rows).
 */
export function resolveTeamId(opts: ResolveTeamOptions = {}): string | null {
  if (opts.override !== undefined) {
    return validateTeamId(opts.override);
  }
  const envTeam = process.env["CODI_TEAM_ID"];
  if (typeof envTeam === "string" && envTeam.length > 0) {
    const v = validateTeamId(envTeam);
    if (v !== null) return v;
  }
  const cwd = opts.cwd ?? process.cwd();
  const cached = cache.get(cwd);
  if (cached !== undefined) return cached;
  const fromYaml = readTeamFromYaml(cwd);
  cache.set(cwd, fromYaml);
  return fromYaml;
}

function validateTeamId(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (!TEAM_ID_PATTERN.test(trimmed)) return null;
  return trimmed;
}

function readTeamFromYaml(cwd: string): string | null {
  const yamlPath = path.join(cwd, PROJECT_DIR, MANIFEST_FILENAME);
  if (!existsSync(yamlPath)) return null;
  try {
    const raw = readFileSync(yamlPath, "utf-8");
    const doc = parseYaml(raw) as { team_id?: unknown } | undefined;
    if (doc && typeof doc.team_id === "string") {
      return validateTeamId(doc.team_id);
    }
  } catch {
    // Defensive: corrupt yaml must not break the writer.
  }
  return null;
}

/** Test-only — clears the per-cwd cache so a beforeEach can re-read. */
export function _resetTeamCacheForTests(): void {
  cache.clear();
}
