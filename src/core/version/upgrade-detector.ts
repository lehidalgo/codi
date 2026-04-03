import type { ArtifactManifest } from "./artifact-manifest.js";
import type { TemplateHashRegistry, ArtifactType } from "./template-hash-registry.js";
import type { InstalledArtifactVersion } from "./artifact-version.js";

export type ArtifactStatus =
  | "up-to-date" // installed hash matches current template hash
  | "outdated" // installed hash differs from current template hash
  | "new" // exists in current CLI but not installed
  | "removed" // installed but no longer exists in current CLI templates
  | "user-managed"; // managed_by: user — never auto-updated

export interface ArtifactUpgradeInfo {
  name: string;
  type: ArtifactType;
  status: ArtifactStatus;
  installedVersion: InstalledArtifactVersion | null;
  availableVersion: number | null;
  installedHash: string | null;
  availableHash: string;
}

/**
 * Computes the upgrade status for every artifact in the registry and manifest.
 *
 * - Templates in registry but not in manifest → "new"
 * - Templates in manifest with managedBy "user" → "user-managed"
 * - Templates in both with matching hashes → "up-to-date"
 * - Templates in both with differing hashes → "outdated"
 * - Templates in manifest but not in registry → "removed"
 */
export function computeUpgradeStatus(
  manifest: ArtifactManifest,
  registry: TemplateHashRegistry,
): ArtifactUpgradeInfo[] {
  const results: ArtifactUpgradeInfo[] = [];
  const seenInRegistry = new Set<string>();

  for (const [name, fingerprint] of Object.entries(registry.templates)) {
    seenInRegistry.add(name);
    const installed = manifest.artifacts[name];

    if (!installed) {
      results.push({
        name,
        type: fingerprint.type,
        status: "new",
        installedVersion: null,
        availableVersion: fingerprint.artifactVersion,
        installedHash: null,
        availableHash: fingerprint.contentHash,
      });
      continue;
    }

    if (installed.managedBy === "user") {
      results.push({
        name,
        type: fingerprint.type,
        status: "user-managed",
        installedVersion: installed.installedArtifactVersion,
        availableVersion: fingerprint.artifactVersion,
        installedHash: installed.contentHash,
        availableHash: fingerprint.contentHash,
      });
      continue;
    }

    const status: ArtifactStatus =
      installed.contentHash === fingerprint.contentHash ? "up-to-date" : "outdated";

    results.push({
      name,
      type: fingerprint.type,
      status,
      installedVersion: installed.installedArtifactVersion,
      availableVersion: fingerprint.artifactVersion,
      installedHash: installed.contentHash,
      availableHash: fingerprint.contentHash,
    });
  }

  // Artifacts installed locally but dropped from the current CLI
  for (const [name, entry] of Object.entries(manifest.artifacts)) {
    if (!seenInRegistry.has(name)) {
      results.push({
        name,
        type: entry.type,
        status: "removed",
        installedVersion: entry.installedArtifactVersion,
        availableVersion: null,
        installedHash: entry.contentHash,
        availableHash: "",
      });
    }
  }

  return results;
}

/**
 * Filters upgrade info to a specific artifact type and returns a lookup map
 * keyed by artifact name.
 */
export function buildUpgradeMap(
  upgradeInfo: ArtifactUpgradeInfo[],
  type: ArtifactType,
): Map<string, ArtifactUpgradeInfo> {
  const map = new Map<string, ArtifactUpgradeInfo>();
  for (const info of upgradeInfo) {
    if (info.type === type) {
      map.set(info.name, info);
    }
  }
  return map;
}

/** Returns a human-readable version transition string, e.g. "v1 → v2". */
export function formatVersionTransition(info: ArtifactUpgradeInfo): string {
  const from =
    info.installedVersion && info.installedVersion !== "unknown"
      ? `v${info.installedVersion}`
      : info.installedVersion === "unknown"
        ? "unknown"
        : "not installed";
  const to = info.availableVersion === null ? "not available" : `v${info.availableVersion}`;
  return `${from} → ${to}`;
}
