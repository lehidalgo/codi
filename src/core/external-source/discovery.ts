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
