import type { Result } from "#src/types/result.js";
import type { PresetSourceType } from "#src/constants.js";

/**
 * Descriptor identifying where a preset comes from and how to resolve it.
 */
export interface PresetSourceDescriptor {
  type: PresetSourceType;
  identifier: string;
  version?: string;
  ref?: string; // git tag or branch for github sources
  path?: string; // subfolder path within a repo or archive
}

/**
 * Interface that all preset source implementations must satisfy.
 * Each source knows how to resolve a descriptor to a local directory path.
 */
export interface PresetSource {
  readonly type: PresetSourceType;

  /**
   * Resolves a preset descriptor to a local directory path containing
   * the preset files (preset.yaml, rules/, skills/, etc.).
   */
  resolve(descriptor: PresetSourceDescriptor): Promise<Result<string>>;

  /**
   * Optional cleanup for temporary directories created during resolution.
   */
  cleanup?(): Promise<void>;
}

/**
 * Metadata about a resolved preset source, stored in the lock file.
 */
export interface ResolvedPresetMeta {
  sourceType: PresetSourceType;
  sourceIdentifier: string;
  version: string;
  commit?: string; // git commit hash for github sources
  resolvedAt: string; // ISO timestamp
}
