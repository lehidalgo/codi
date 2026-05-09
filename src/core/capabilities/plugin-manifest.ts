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
 */

import { CAPABILITIES_MATRIX, type TargetId } from "./matrix.js";

export interface PluginArtifact {
  readonly name: string;
  readonly type: "rule" | "skill" | "agent" | "hook" | "slash-command" | "mcp-server";
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

export function buildPluginManifest(input: BuildManifestInput): PluginManifest {
  const cap = CAPABILITIES_MATRIX[input.target];
  if (cap.tier === "2") {
    throw new Error(
      `buildPluginManifest: target "${input.target}" is Tier 2 (config-only); Tier 2 targets do not get a plugin manifest`,
    );
  }
  // Filter artifacts to those the target actually supports.
  const filtered = input.artifacts.filter((a) => {
    if (a.type === "skill") return cap.skills;
    if (a.type === "rule") return cap.rules;
    if (a.type === "agent") return cap.agents;
    if (a.type === "hook") return cap.hooks;
    if (a.type === "slash-command") return cap.slashCommands;
    if (a.type === "mcp-server") return cap.mcp;
    return false;
  });

  return {
    schemaVersion: 1,
    target: input.target,
    tier: cap.tier,
    codiVersion: input.codiVersion,
    generatedAt: Date.now(),
    artifacts: filtered,
    capabilitiesUsed: {
      skills: filtered.some((a) => a.type === "skill"),
      rules: filtered.some((a) => a.type === "rule"),
      agents: filtered.some((a) => a.type === "agent"),
      hooks: filtered.some((a) => a.type === "hook"),
      slashCommands: filtered.some((a) => a.type === "slash-command"),
      mcp: filtered.some((a) => a.type === "mcp-server"),
    },
  };
}

export function manifestPathForTarget(target: TargetId): string {
  if (target === "claude-code") return ".claude-plugin/plugin.json";
  if (target === "codex-cli") return ".codex-plugin/plugin.json";
  throw new Error(`No plugin manifest path for target "${target}"`);
}

export function serializeManifest(manifest: PluginManifest): string {
  return JSON.stringify(manifest, null, 2) + "\n";
}
