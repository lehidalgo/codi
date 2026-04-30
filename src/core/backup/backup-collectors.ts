import fs from "node:fs/promises";
import path from "node:path";
import { PROJECT_DIR, BACKUP_EXCLUDE_DIRS } from "#src/constants.js";
import { ALL_ADAPTERS } from "#src/adapters/index.js";

function isExcluded(relPath: string): boolean {
  for (const dir of BACKUP_EXCLUDE_DIRS) {
    if (relPath === dir || relPath.startsWith(`${dir}/`)) return true;
  }
  return false;
}

/**
 * Walk .codi/ recursively, returning relative paths (POSIX-style) of every
 * file that should be captured under the "source" scope.
 */
export async function collectSourceFiles(projectRoot: string): Promise<string[]> {
  const out: string[] = [];
  const cfgRoot = path.join(projectRoot, PROJECT_DIR);

  async function walk(dirAbs: string): Promise<void> {
    const rel = path.relative(projectRoot, dirAbs).split(path.sep).join("/");
    if (isExcluded(rel)) return;
    let entries;
    try {
      entries = await fs.readdir(dirAbs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const childAbs = path.join(dirAbs, entry.name);
      const childRel = path.relative(projectRoot, childAbs).split(path.sep).join("/");
      if (isExcluded(childRel)) continue;
      if (entry.isDirectory()) {
        await walk(childAbs);
      } else if (entry.isFile()) {
        out.push(childRel);
      }
    }
  }

  await walk(cfgRoot);
  return out;
}

interface StateAgents {
  [agentId: string]: ReadonlyArray<{ path: string }>;
}

/**
 * Probe ALL_ADAPTERS target paths for files that exist on disk but are NOT
 * recorded in state.agents. These are user-written files codi never tracked
 * (e.g. a hand-written CLAUDE.md before first init).
 */
export async function collectPreExistingFiles(
  projectRoot: string,
  stateAgents: StateAgents,
): Promise<string[]> {
  const trackedPaths = new Set<string>();
  for (const files of Object.values(stateAgents)) {
    for (const f of files) trackedPaths.add(f.path);
  }

  const candidates = new Set<string>();

  for (const adapter of ALL_ADAPTERS) {
    const p = adapter.paths;
    const fileFields = [p.instructionFile, p.mcpConfig].filter((x): x is string => Boolean(x));
    for (const f of fileFields) candidates.add(f);

    const dirFields = [p.configRoot, p.rules, p.skills, p.agents].filter(
      (x): x is string => Boolean(x) && x !== ".",
    );
    for (const d of dirFields) {
      const dirAbs = path.resolve(projectRoot, d);
      try {
        const entries = await fs.readdir(dirAbs, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isFile()) continue;
          const rel = path.posix.join(d, entry.name);
          candidates.add(rel);
        }
      } catch {
        // dir doesn't exist - nothing to capture
      }
    }
  }

  const present: string[] = [];
  for (const candidate of candidates) {
    if (trackedPaths.has(candidate)) continue;
    const abs = path.resolve(projectRoot, candidate);
    try {
      const stat = await fs.stat(abs);
      if (stat.isFile()) present.push(candidate);
    } catch {
      // not on disk - skip
    }
  }

  return present.sort();
}
