/**
 * Plugin manifests for Tier 1 targets (Sprint 6.b).
 *
 * Codi v3 emits two flavours:
 *   - .claude-plugin/plugin.json   for Claude Code (Tier 1A)
 *   - .codex-plugin/plugin.json    for Codex CLI    (Tier 1B)
 *
 * The manifest is a Codi-shaped JSON document. It lists the
 * artifacts the host expects to find under the plugin root and records the
 * codi version that produced it so loaders can detect drift.
 *
 * CORE-018: dispatch from `CapabilityType` to `TargetCapabilities` flag is
 * an exhaustive `Record<CapabilityType, …>` map. Adding a new capability
 * member fails the build at this site (no silent fall-through to
 * `return false;`). The persisted `capabilitiesUsed` keys are kept as
 * camelCase for wire-format stability.
 */

import { CAPABILITIES_MATRIX, type TargetCapabilities, type TargetId } from "./matrix.js";
import { CAPABILITY_TYPES, type CapabilityType } from "../artifact-types.js";

export interface PluginArtifact {
  readonly name: string;
  readonly type: CapabilityType;
  /** Path relative to the plugin root. */
  readonly path: string;
}

export interface PluginManifest {
  readonly schemaVersion: 1;
  readonly target: TargetId;
  readonly tier: "1A" | "1B";
  readonly codiVersion: string;
  readonly generatedAt: number;
  readonly artifacts: readonly PluginArtifact[];
  readonly capabilitiesUsed: {
    readonly skills: boolean;
    readonly rules: boolean;
    readonly agents: boolean;
    readonly hooks: boolean;
    readonly slashCommands: boolean;
    readonly mcp: boolean;
  };
}

export interface BuildManifestInput {
  readonly target: TargetId;
  readonly codiVersion: string;
  readonly artifacts: readonly PluginArtifact[];
}

/**
 * Maps a `CapabilityType` (the on-disk artifact taxonomy) to the boolean
 * flag in `TargetCapabilities` that gates whether the target accepts it.
 * Exhaustive at compile time: a new `CapabilityType` member without an
 * entry here fails the build.
 */
const CAPABILITY_TO_FLAG = {
  rule: "rules",
  skill: "skills",
  agent: "agents",
  "mcp-server": "mcp",
  hook: "hooks",
  "slash-command": "slashCommands",
} as const satisfies Record<CapabilityType, keyof PluginManifest["capabilitiesUsed"]>;

export function buildPluginManifest(input: BuildManifestInput): PluginManifest {
  const cap = CAPABILITIES_MATRIX[input.target];
  if (cap.tier === "2") {
    throw new Error(
      `buildPluginManifest: target "${input.target}" is Tier 2 (config-only); Tier 2 targets do not get a plugin manifest`,
    );
  }
  // Filter artifacts to those the target actually supports. The dispatch
  // maps each `CapabilityType` to the matching `TargetCapabilities` flag
  // via `CAPABILITY_TO_FLAG`, so a new union member must extend the map
  // (no silent `return false;` fall-through).
  const filtered = input.artifacts.filter((a) => isCapabilityEnabled(cap, a.type));

  return {
    schemaVersion: 1,
    target: input.target,
    tier: cap.tier,
    codiVersion: input.codiVersion,
    generatedAt: Date.now(),
    artifacts: filtered,
    capabilitiesUsed: buildCapabilitiesUsed(filtered),
  };
}

/**
 * `TargetCapabilities` uses the same flag names as `capabilitiesUsed`
 * except for the `target` / `tier` admin fields; this helper bridges the
 * `CAPABILITY_TO_FLAG` lookup without losing exhaustiveness.
 */
function isCapabilityEnabled(cap: TargetCapabilities, type: CapabilityType): boolean {
  const flag = CAPABILITY_TO_FLAG[type];
  const value = (cap as unknown as Record<string, unknown>)[flag];
  return value === true;
}

function buildCapabilitiesUsed(
  artifacts: readonly PluginArtifact[],
): PluginManifest["capabilitiesUsed"] {
  // Start with all false; flip each flag the artifact list touches. Using
  // CAPABILITY_TYPES as the iteration domain keeps the loop exhaustive.
  const out: { -readonly [K in keyof PluginManifest["capabilitiesUsed"]]: boolean } = {
    skills: false,
    rules: false,
    agents: false,
    hooks: false,
    slashCommands: false,
    mcp: false,
  };
  for (const type of CAPABILITY_TYPES) {
    if (artifacts.some((a) => a.type === type)) {
      out[CAPABILITY_TO_FLAG[type]] = true;
    }
  }
  return out;
}

export function manifestPathForTarget(target: TargetId): string {
  if (target === "claude-code") return ".claude-plugin/plugin.json";
  if (target === "codex-cli") return ".codex-plugin/plugin.json";
  throw new Error(`No plugin manifest path for target "${target}"`);
}

export function serializeManifest(manifest: PluginManifest): string {
  return JSON.stringify(manifest, null, 2) + "\n";
}
