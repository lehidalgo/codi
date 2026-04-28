/** Path-derived layer the hook is operating on. */
export type HookMode = "source" | "user-managed" | "codi-managed" | "skip";

/** Result of inspecting a single staged file. */
export interface ArtifactInspection {
  path: string;
  mode: HookMode;
  artifactName: string | null;
  artifactType: "rule" | "skill" | "agent" | null;
}

/** Decision returned by bumpVersion(). */
export interface BumpDecision {
  action: "no-op" | "bumped" | "rejected";
  fromVersion: number | null;
  toVersion: number | null;
  rejectReason?: string;
  rewrittenContent?: string;
}

/** A single offender returned by verifyRange(). */
export interface VerifyOffender {
  path: string;
  headVersion: number;
  pushVersion: number;
  reason: "content-changed-without-bump" | "version-regression";
}

/** Manifest entry shape that the hook updates. */
export interface ManifestArtifactEntry {
  name: string;
  type: "rule" | "skill" | "agent" | "mcp-server";
  contentHash: string;
  installedArtifactVersion: number | "unknown";
  installedAt: string;
  managedBy: "codi" | "user";
}
