import baseline from "./artifact-version-baseline.json" with { type: "json" };
import type { TemplateHashRegistry } from "./template-hash-registry.js";

export interface ArtifactVersionBaselineEntry {
  version: number;
  hash: string;
}

export const ARTIFACT_VERSION_BASELINE = baseline as Record<string, ArtifactVersionBaselineEntry>;

export function checkArtifactVersionBaseline(
  registry: TemplateHashRegistry,
  previous: Record<string, ArtifactVersionBaselineEntry> = ARTIFACT_VERSION_BASELINE,
): string[] {
  const errors: string[] = [];

  for (const [name, fingerprint] of Object.entries(registry.templates)) {
    const prior = previous[name];
    if (!prior) {
      continue;
    }

    if (fingerprint.artifactVersion < prior.version) {
      errors.push(
        `${fingerprint.type} "${name}": artifact version regressed from ${prior.version} to ${fingerprint.artifactVersion}`,
      );
      continue;
    }

    if (fingerprint.contentHash !== prior.hash && fingerprint.artifactVersion <= prior.version) {
      errors.push(
        `${fingerprint.type} "${name}": content changed without artifact version bump (current v${fingerprint.artifactVersion}, previous v${prior.version})\n` +
          `      runtime  hash: ${fingerprint.contentHash}\n` +
          `      baseline hash: ${prior.hash}`,
      );
    }
  }

  return errors;
}
