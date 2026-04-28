export { detectMode } from "./detect-mode.js";
export { getPreviousVersion } from "./get-previous-version.js";
export { bumpVersion } from "./bump-version.js";
export { verifyRange } from "./verify-range.js";
export { updateManifestEntry } from "./update-manifest.js";
export type {
  HookMode,
  ArtifactInspection,
  BumpDecision,
  VerifyOffender,
  ManifestArtifactEntry,
} from "./types.js";
export type { PreviousVersionResult } from "./get-previous-version.js";
export type { ManifestShape, ManifestUpdate } from "./update-manifest.js";
