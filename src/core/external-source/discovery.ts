import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

export type ArtifactType = "rule" | "skill" | "agent" | "mcp-server";

export interface DiscoveredArtifact {
  type: ArtifactType;
  /** Display name (artifact identifier, no extension). */
  name: string;
  /** Source-relative path for display, e.g. "rules/security.md". */
  relPath: string;
  /** Absolute path for the copy operation. */
  absPath: string;
}

interface TypeLayout {
  dir: string;
  /** "file" types are .md / .yaml files; "directory" types are sub-folders. */
  kind: "file" | "directory";
  /** File extension to match for "file" kind. */
  ext?: string;
}

const LAYOUTS: Record<ArtifactType, TypeLayout> = {
  rule: { dir: "rules", kind: "file", ext: ".md" },
  agent: { dir: "agents", kind: "file", ext: ".md" },
  skill: { dir: "skills", kind: "directory" },
  "mcp-server": { dir: "mcp-servers", kind: "file", ext: ".yaml" },
};

const ARTIFACT_DIR_NAMES = Object.values(LAYOUTS).map((l) => l.dir);

export interface ArtifactRoot {
  /** Absolute path to the directory containing artifact subdirs. */
  path: string;
  /** Source-relative path for display. "." when the source root is itself the candidate. */
  relPath: string;
  /** Names of the artifact subdirs found in this candidate (e.g. ["rules","skills"]). */
  presentTypes: string[];
}

/**
 * Walks a source tree (up to maxDepth levels) and returns every directory
 * that contains at least one codi artifact subdir (rules/, skills/, agents/,
 * mcp-servers/). Use the result to let the user pick when a source contains
 * multiple presets, or to follow a wrapper folder when the source extracts
 * to e.g. `repo-name/preset-name/{rules,skills,...}`.
 *
 * Stops descending into a directory once it qualifies as an artifact root —
 * we do not want to count its inner `rules/`, `skills/` etc. as separate
 * presets. Skips dotfiles and common noise dirs (`node_modules`, `.git`).
 */
export async function findArtifactRoots(sourceRoot: string, maxDepth = 2): Promise<ArtifactRoot[]> {
  const out: ArtifactRoot[] = [];
  const SKIP_NAMES = new Set(["node_modules", ".git", ".github", "dist", "build"]);

  async function probe(dir: string): Promise<string[]> {
    const present: string[] = [];
    for (const name of ARTIFACT_DIR_NAMES) {
      const exists = await fs
        .stat(path.join(dir, name))
        .then((s) => s.isDirectory())
        .catch(() => false);
      if (exists) present.push(name);
    }
    return present;
  }

  async function walk(dir: string, depth: number): Promise<void> {
    const present = await probe(dir);
    if (present.length > 0) {
      out.push({
        path: dir,
        relPath: path.relative(sourceRoot, dir) || ".",
        presentTypes: present,
      });
      // Do not descend further from a qualifying root — its subdirs are
      // its artifacts, not nested presets.
      return;
    }
    if (depth >= maxDepth) return;
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith(".") || SKIP_NAMES.has(entry.name)) continue;
      await walk(path.join(dir, entry.name), depth + 1);
    }
  }

  await walk(sourceRoot, 0);
  return out;
}

/**
 * Walk an external source root and return every codi artifact discovered.
 * Missing type directories are silently skipped (a source may carry only
 * skills, for example). Entries that fail basic shape validation (rule/agent
 * without frontmatter `name:`, skill directory without SKILL.md) are skipped
 * and reported via the optional onSkip callback.
 */
export async function discoverArtifacts(
  rootPath: string,
  onSkip?: (relPath: string, reason: string) => void,
): Promise<DiscoveredArtifact[]> {
  const out: DiscoveredArtifact[] = [];
  for (const type of Object.keys(LAYOUTS) as ArtifactType[]) {
    const layout = LAYOUTS[type];
    const typeRoot = path.join(rootPath, layout.dir);
    const exists = await fs
      .stat(typeRoot)
      .then((s) => s.isDirectory())
      .catch(() => false);
    if (!exists) continue;

    const entries = await fs.readdir(typeRoot, { withFileTypes: true });
    for (const entry of entries) {
      const absPath = path.join(typeRoot, entry.name);
      const relPath = path.join(layout.dir, entry.name);
      if (layout.kind === "file") {
        if (!entry.isFile() || !entry.name.endsWith(layout.ext!)) continue;
        const valid = await validateFileArtifact(absPath, type);
        if (!valid.ok) {
          onSkip?.(relPath, valid.reason);
          continue;
        }
        const name = entry.name.slice(0, -layout.ext!.length);
        out.push({ type, name, relPath, absPath });
      } else {
        if (!entry.isDirectory()) continue;
        const skillFile = path.join(absPath, "SKILL.md");
        const hasSkill = await fs
          .stat(skillFile)
          .then((s) => s.isFile())
          .catch(() => false);
        if (!hasSkill) {
          onSkip?.(relPath, "missing SKILL.md");
          continue;
        }
        out.push({ type, name: entry.name, relPath, absPath });
      }
    }
  }
  return out;
}

async function validateFileArtifact(
  filePath: string,
  type: ArtifactType,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const content = await fs.readFile(filePath, "utf8").catch(() => null);
  if (content === null) return { ok: false, reason: "unreadable" };
  if (type === "mcp-server") {
    // mcp YAML — minimal sanity check, just non-empty
    if (content.trim().length === 0) return { ok: false, reason: "empty file" };
    return { ok: true };
  }
  // rule / agent — markdown with frontmatter and a name field
  try {
    const parsed = matter(content);
    if (!parsed.data || typeof parsed.data["name"] !== "string") {
      return { ok: false, reason: "missing 'name' in frontmatter" };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "invalid frontmatter" };
  }
}
