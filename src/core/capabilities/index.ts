/**
 * Public surface of `src/core/capabilities/` (Sprint 6).
 */

export {
  TARGET_IDS,
  CAPABILITIES_MATRIX,
  TIER_1_TARGETS,
  TIER_2_TARGETS,
  supports,
  targetsSupporting,
  type TargetId,
  type Tier,
  type TargetCapabilities,
} from "./matrix.js";

export {
  buildPluginManifest,
  manifestPathForTarget,
  serializeManifest,
  type PluginManifest,
  type PluginArtifact,
  type BuildManifestInput,
} from "./plugin-manifest.js";

export {
  publishPlugin,
  type PublishInput,
  type PublishResult,
  type PublishedTarget,
  type PublishTrack,
} from "./publish.js";
