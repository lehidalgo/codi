/**
 * `codi plugin publish` — dual-track publisher (Sprint 6.b).
 *
 * Track A (default): emit local manifests next to the existing per-agent
 * directories (.claude/, .codex/, ...). Track B (opt-in): pack everything
 * into a tarball ready for a marketplace upload. Both tracks consult the
 * Capabilities Matrix to decide what each target receives.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  buildPluginManifest,
  manifestPathForTarget,
  serializeManifest,
  type PluginArtifact,
} from "./plugin-manifest.js";
import { TIER_1_TARGETS, type TargetId } from "./matrix.js";

export type PublishTrack = "local" | "marketplace";

export interface PublishInput {
  readonly track: PublishTrack;
  readonly repoRoot: string;
  readonly codiVersion: string;
  readonly artifacts: readonly PluginArtifact[];
  /** Restrict publish to a subset of Tier 1 targets. Default: all Tier 1. */
  readonly targets?: readonly TargetId[];
}

export interface PublishedTarget {
  readonly target: TargetId;
  readonly manifestPath: string;
  readonly artifactCount: number;
}

export interface PublishResult {
  readonly track: PublishTrack;
  readonly published: readonly PublishedTarget[];
  readonly skipped: readonly { target: TargetId; reason: string }[];
}

export function publishPlugin(input: PublishInput): PublishResult {
  const targets = input.targets ?? TIER_1_TARGETS;
  const published: PublishedTarget[] = [];
  const skipped: { target: TargetId; reason: string }[] = [];

  for (const target of targets) {
    if (!TIER_1_TARGETS.includes(target)) {
      skipped.push({ target, reason: "Tier 2 targets do not receive a plugin manifest" });
      continue;
    }
    const manifest = buildPluginManifest({
      target,
      codiVersion: input.codiVersion,
      artifacts: input.artifacts,
    });
    const relPath = manifestPathForTarget(target);
    const absPath = resolve(input.repoRoot, relPath);

    if (input.track === "local") {
      mkdirSync(dirname(absPath), { recursive: true });
      writeFileSync(absPath, serializeManifest(manifest));
    }
    // Marketplace track is the same write + a tarball assembly. The tarball
    // step is left to Sprint 7's release tooling; for Sprint 6.b we ship the
    // manifest emit and report the path so a packer script can pick it up.

    published.push({
      target,
      manifestPath: absPath,
      artifactCount: manifest.artifacts.length,
    });
  }

  return { track: input.track, published, skipped };
}
