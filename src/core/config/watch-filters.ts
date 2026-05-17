/**
 * Predicate that decides whether a `fs.watch` event inside `.codi/` should
 * trigger a regenerate cycle.
 *
 * Background (ISSUE-004): the original implementation in `cli/watch.ts` used
 * a blacklist (`filename === "state.json" || filename === "audit.jsonl"`).
 * After CORE-002 moved the state file to `.codi/state/state.json` (and
 * `proper-lockfile` started creating `.codi/state/state.json.lock`), the
 * literal comparison stopped matching and the watcher entered an infinite
 * regenerate loop (each regenerate touched state files which the guard no
 * longer recognised). 9 regenerations in 5 seconds with no source edits.
 *
 * This module replaces the blacklist with a whitelist of recognised
 * **source-artifact** paths. Any path the predicate doesn't explicitly
 * recognise is treated as derived/generated and ignored. This makes the
 * watcher resilient to future additions of new generated subdirectories
 * (state/, backups/, hooks/, feedback/, .session/, etc.).
 */

import {
  MANIFEST_FILENAME,
  FLAGS_FILENAME,
  MCP_FILENAME,
} from "#src/constants.js";
import { ARTIFACT_DIR_NAMES } from "#src/core/artifact-types.js";

/**
 * Top-level YAML files inside `.codi/` that count as user-editable source.
 * Editing any of these should trigger a regenerate.
 */
const SOURCE_TOP_LEVEL_FILES: readonly string[] = [
  MANIFEST_FILENAME, // codi.yaml
  FLAGS_FILENAME, // flags.yaml
  MCP_FILENAME, // mcp.yaml
];

/**
 * Subdirectories of `.codi/` that hold source artifacts. Any change inside
 * one of these (or a descendant) should trigger a regenerate.
 *
 * Sourced from `ARTIFACT_DIR_NAMES` so adding a new artifact type only
 * requires updating one place.
 */
const SOURCE_DIRS: readonly string[] = ARTIFACT_DIR_NAMES;

/**
 * Returns `true` when `relPath` (relative to `.codi/`, as delivered by
 * `fs.watch({ recursive: true })`) refers to a source artifact whose
 * modification should kick off a regenerate.
 *
 * Returns `false` for:
 *   - empty filename or paths starting with "../" (defensive)
 *   - any file under `state/`, `backups/`, `hooks/`, `.session/`, `feedback/`,
 *     or any other directory not in `SOURCE_DIRS`
 *   - `state.json` / `state.json.lock` / `audit.jsonl` / `state.json.tmp.*`
 *     regardless of how they appear (root or nested)
 *   - any file at the top level that isn't `codi.yaml`, `flags.yaml`, or
 *     `mcp.yaml`
 *
 * Normalises Windows-style backslashes so the same logic works on every OS.
 */
export function isSourceArtifactChange(relPath: string | undefined | null): boolean {
  if (!relPath) return false;
  const norm = relPath.replace(/\\/g, "/");
  if (norm.startsWith("../") || norm === "..") return false;

  const segments = norm.split("/").filter((s) => s.length > 0);
  if (segments.length === 0) return false;

  // Top-level file (no subdirectory) — only the recognised source YAMLs
  // count. This naturally rejects `audit.jsonl` and any future top-level
  // generated file.
  if (segments.length === 1) {
    return SOURCE_TOP_LEVEL_FILES.includes(segments[0]!);
  }

  // Nested path — first segment must be a recognised source-artifact dir.
  // Anything under `state/`, `backups/`, `hooks/`, etc. is rejected here.
  return SOURCE_DIRS.includes(segments[0]!);
}
