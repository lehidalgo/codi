/**
 * Single source of truth for the artifact taxonomy used throughout Codi.
 *
 * Codi installs four kinds of artifacts:
 *   - rule:       project-wide rules (.md)
 *   - skill:      reusable workflows (directory bundles)
 *   - agent:      specialized subagents (.md)
 *   - mcp-server: MCP server configs (.json)
 *
 * Variant types extend or restrict this base for specific domains. Each
 * variant lives here so type drift across modules is impossible by
 * construction.
 */

/** The four installable artifact kinds (singular, kebab-case). */
export type ArtifactType = "rule" | "skill" | "agent" | "mcp-server";

/** Tuple form for runtime iteration. Matches the `ArtifactType` union exactly. */
export const ARTIFACT_TYPES = [
  "rule",
  "skill",
  "agent",
  "mcp-server",
] as const satisfies readonly ArtifactType[];

/** Plural directory names used on disk under `.codi/<dir>/`. */
export const ARTIFACT_DIR_NAMES = ["rules", "skills", "agents", "mcp-servers"] as const;

/**
 * Capability types for plugin-manifest publishing — superset of `ArtifactType`
 * that also covers non-installable capabilities (hooks, slash commands).
 * Used by `core/capabilities/plugin-manifest.ts`.
 */
export type CapabilityType = ArtifactType | "hook" | "slash-command";

/**
 * Operations-ledger entry types — what kinds of files Codi tracks for audit.
 * Adds `instruction` (CLAUDE.md / AGENTS.md) and `settings` (.claude/settings.json).
 * Used by `core/audit/operations-ledger.ts`. Fixes the legacy `mcp` literal
 * (which never matched the canonical `mcp-server`).
 */
export type LedgerEntryType = ArtifactType | "instruction" | "settings";

/**
 * Captured artifact-usage types — values persisted in
 * `artifacts_used.artifact_type` in the brain DB. Diverges from
 * `CapabilityType` because historical rows use `command` (not
 * `slash-command`); renaming would break existing brain DBs.
 * Used by `runtime/capture/session.ts`.
 */
export type CapturedArtifactType = "rule" | "skill" | "agent" | "command";
