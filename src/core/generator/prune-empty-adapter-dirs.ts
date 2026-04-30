import fs from "node:fs/promises";
import path from "node:path";
import { ALL_ADAPTERS } from "#src/adapters/index.js";
import { isPathSafe } from "#src/utils/path-guard.js";

/**
 * Removes empty directories left behind after orphan deletion / agent unselect.
 *
 * Candidates come from:
 *  1. Parent directories of every entry in `deletedPaths`, walking up.
 *  2. Adapter root dirs (configRoot, rules, skills, agents) for every
 *     agentId in `removedAgentIds`.
 *
 * Sort deepest-first, then `fs.rmdir` each. Non-empty dirs fail harmlessly
 * (ENOTEMPTY) - user content always wins.
 *
 * Returns the relative paths that were actually removed.
 */
export async function pruneEmptyAdapterDirs(
  projectRoot: string,
  deletedPaths: readonly string[],
  removedAgentIds: readonly string[],
): Promise<string[]> {
  const candidates = new Set<string>();

  for (const rel of deletedPaths) {
    if (!isPathSafe(projectRoot, rel)) continue;
    let current = path.posix.dirname(rel.split(path.sep).join("/"));
    while (current && current !== "." && current !== "/") {
      candidates.add(current);
      const parent = path.posix.dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }

  const adaptersById = new Map(ALL_ADAPTERS.map((a) => [a.id, a]));
  for (const agentId of removedAgentIds) {
    const adapter = adaptersById.get(agentId);
    if (!adapter) continue;
    for (const p of [
      adapter.paths.rules,
      adapter.paths.skills,
      adapter.paths.agents,
      adapter.paths.configRoot,
    ]) {
      if (!p || p === "." || p === "/") continue;
      if (!isPathSafe(projectRoot, p)) continue;
      candidates.add(p);
    }
  }

  const sorted = [...candidates].sort((a, b) => b.length - a.length);

  const removed: string[] = [];
  for (const rel of sorted) {
    const abs = path.resolve(projectRoot, rel);
    try {
      await fs.rmdir(abs);
      removed.push(rel);
    } catch (cause: unknown) {
      const code = (cause as NodeJS.ErrnoException | undefined)?.code;
      if (code === "ENOTEMPTY" || code === "ENOENT") continue;
    }
  }
  return removed;
}
