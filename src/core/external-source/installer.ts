import fs from "node:fs/promises";
import path from "node:path";
import { hashContent } from "#src/utils/hash.js";
import { ArtifactManifestManager } from "#src/core/version/artifact-manifest.js";
import type { DiscoveredArtifact } from "./discovery.js";
import type { ExternalSource } from "./connectors.js";

export type CollisionResolution =
  | { kind: "skip" }
  | { kind: "overwrite" }
  | { kind: "rename"; newName: string };

export type CollisionStatus = "exists" | "fresh";

const TYPE_TO_DIR: Record<DiscoveredArtifact["type"], string> = {
  rule: "rules",
  agent: "agents",
  skill: "skills",
  "mcp-server": "mcp-servers",
};

const TYPE_EXTENSION: Record<DiscoveredArtifact["type"], string | null> = {
  rule: ".md",
  agent: ".md",
  "mcp-server": ".yaml",
  skill: null, // directory
};

function targetPath(configDir: string, artifact: DiscoveredArtifact, name: string): string {
  const ext = TYPE_EXTENSION[artifact.type];
  const baseDir = path.join(configDir, TYPE_TO_DIR[artifact.type]);
  return ext === null ? path.join(baseDir, name) : path.join(baseDir, `${name}${ext}`);
}

/**
 * Detect which selected artifacts already exist in the project's .codi/.
 * Returns a map keyed by artifact identity for cheap lookup at the prompt layer.
 */
export async function detectCollisions(
  configDir: string,
  selected: DiscoveredArtifact[],
): Promise<Map<DiscoveredArtifact, CollisionStatus>> {
  const result = new Map<DiscoveredArtifact, CollisionStatus>();
  for (const a of selected) {
    const target = targetPath(configDir, a, a.name);
    const exists = await fs
      .stat(target)
      .then(() => true)
      .catch(() => false);
    result.set(a, exists ? "exists" : "fresh");
  }
  return result;
}

export interface InstallEntry {
  artifact: DiscoveredArtifact;
  resolution: CollisionResolution;
}

export interface InstallSummary {
  installed: number;
  skipped: number;
  renamed: number;
}

/**
 * Copy each selected artifact into .codi/ and update the artifact manifest
 * with managed_by:user + the source identifier. Skips per resolution. Skill
 * artifacts (directories) are copied recursively; everything else is a single
 * file copy.
 */
export async function installSelected(
  configDir: string,
  entries: InstallEntry[],
  source: ExternalSource,
): Promise<InstallSummary> {
  const summary: InstallSummary = { installed: 0, skipped: 0, renamed: 0 };
  const manifestManager = new ArtifactManifestManager(configDir);
  const readResult = await manifestManager.read();
  if (!readResult.ok) throw new Error("Failed to read artifact manifest");
  const manifest = readResult.data;

  for (const { artifact, resolution } of entries) {
    if (resolution.kind === "skip") {
      summary.skipped++;
      continue;
    }
    const installName = resolution.kind === "rename" ? resolution.newName : artifact.name;
    const dest = targetPath(configDir, artifact, installName);
    await fs.mkdir(path.dirname(dest), { recursive: true });

    if (artifact.type === "skill") {
      // Directory copy — wipe destination if overwriting
      if (resolution.kind === "overwrite") {
        await fs.rm(dest, { recursive: true, force: true });
      }
      await fs.cp(artifact.absPath, dest, { recursive: true });
    } else {
      await fs.copyFile(artifact.absPath, dest);
    }

    if (resolution.kind === "rename") summary.renamed++;
    summary.installed++;

    // Compute content hash from primary file (SKILL.md for skills).
    const hashSourcePath = artifact.type === "skill" ? path.join(dest, "SKILL.md") : dest;
    const content = await fs.readFile(hashSourcePath, "utf8").catch(() => "");
    manifest.artifacts[installName] = {
      name: installName,
      type: artifact.type,
      contentHash: hashContent(content),
      installedArtifactVersion: "unknown",
      installedAt: new Date().toISOString(),
      managedBy: "user",
      source: source.id,
    };
  }

  const writeResult = await manifestManager.write(manifest);
  if (!writeResult.ok) throw new Error("Failed to write artifact manifest");
  return summary;
}
