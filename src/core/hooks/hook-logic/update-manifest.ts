import type { ManifestArtifactEntry } from "./types.js";

export interface ManifestShape {
  version: string;
  artifacts: Record<string, ManifestArtifactEntry>;
}

export type ManifestUpdate =
  | (ManifestArtifactEntry & { delete?: false })
  | { name: string; delete: true };

export function updateManifestEntry(
  manifest: ManifestShape,
  update: ManifestUpdate,
): ManifestShape {
  const next: ManifestShape = {
    version: manifest.version,
    artifacts: { ...manifest.artifacts },
  };

  if ("delete" in update && update.delete) {
    delete next.artifacts[update.name];
    return next;
  }

  const entry = update as ManifestArtifactEntry;
  next.artifacts[entry.name] = {
    name: entry.name,
    type: entry.type,
    contentHash: entry.contentHash,
    installedArtifactVersion: entry.installedArtifactVersion,
    installedAt: entry.installedAt,
    managedBy: entry.managedBy,
  };
  return next;
}
