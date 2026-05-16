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
 * Tuple form for runtime iteration. `satisfies` enforces exhaustive coverage
 * at compile time: adding a new `CapabilityType` member without extending
 * this tuple fails the build.
 */
export const CAPABILITY_TYPES = [
  "rule",
  "skill",
  "agent",
  "mcp-server",
  "hook",
  "slash-command",
] as const satisfies readonly CapabilityType[];

/**
 * Operations-ledger entry types — what kinds of files Codi tracks for audit.
 * Adds `instruction` (CLAUDE.md / AGENTS.md) and `settings` (.claude/settings.json).
 * Used by `core/audit/operations-ledger.ts`. Fixes the legacy `mcp` literal
 * (which never matched the canonical `mcp-server`).
 */
export type LedgerEntryType = ArtifactType | "instruction" | "settings";

/** Tuple form for runtime iteration. Compile-time exhaustive. */
export const LEDGER_ENTRY_TYPES = [
  "rule",
  "skill",
  "agent",
  "mcp-server",
  "instruction",
  "settings",
] as const satisfies readonly LedgerEntryType[];

/**
 * Captured artifact-usage types — values persisted in
 * `artifacts_used.artifact_type` in the brain DB. Diverges from
 * `CapabilityType` because historical rows use `command` (not
 * `slash-command`); renaming would break existing brain DBs.
 * Used by `runtime/capture/session.ts`.
 *
 * CORE-018: the column has no CHECK constraint at the SQLite level
 * (`runtime/brain/schema.ts:artifacts_used.artifact_type` is plain TEXT);
 * the type narrative is enforced only by TypeScript. The current sole
 * producer (`runtime/capture/tool-hook.ts`) only writes `"skill"` and
 * `"agent"`, so the broader union exists for forward-compat with future
 * capture sources.
 */
export type CapturedArtifactType = "rule" | "skill" | "agent" | "command";

/** Tuple form for runtime iteration. Compile-time exhaustive. */
export const CAPTURED_ARTIFACT_TYPES = [
  "rule",
  "skill",
  "agent",
  "command",
] as const satisfies readonly CapturedArtifactType[];

// ─── Type guards ─────────────────────────────────────────────────────────────
// CORE-018 — replace inline `=== "rule" || === "skill" || …` chains with
// derivation from the canonical tuples. Adding a new member to the union
// extends the guard automatically — no parallel update required.

export function isArtifactType(value: unknown): value is ArtifactType {
  return typeof value === "string" && (ARTIFACT_TYPES as readonly string[]).includes(value);
}

export function isCapabilityType(value: unknown): value is CapabilityType {
  return typeof value === "string" && (CAPABILITY_TYPES as readonly string[]).includes(value);
}

export function isLedgerEntryType(value: unknown): value is LedgerEntryType {
  return typeof value === "string" && (LEDGER_ENTRY_TYPES as readonly string[]).includes(value);
}

export function isCapturedArtifactType(value: unknown): value is CapturedArtifactType {
  return (
    typeof value === "string" && (CAPTURED_ARTIFACT_TYPES as readonly string[]).includes(value)
  );
}

/**
 * Per-kind on-disk layout descriptor.
 *
 * `kind: "file"` artifacts live at `<dir>/<name><ext>` (single Markdown or
 * YAML file). `kind: "directory"` artifacts (skills) are bundle folders at
 * `<dir>/<name>/`; the canonical index file lives at
 * `<dir>/<name>/<indexFile>`. Consumers must not assume `.md` — mcp-servers
 * use `.yaml` with top-level `managed_by:` rather than `---` frontmatter.
 */
export interface ArtifactLayoutDef {
  readonly type: ArtifactType;
  readonly dirName: (typeof ARTIFACT_DIR_NAMES)[number];
  readonly kind: "file" | "directory";
  readonly ext: ".md" | ".yaml";
  readonly indexFile?: "SKILL.md";
  /**
   * Where the `managed_by` declaration lives. Markdown artifacts (rule /
   * skill / agent) use YAML frontmatter; YAML artifacts (mcp-server) use a
   * top-level key. Drives the right reader without a per-callsite branch.
   */
  readonly managedByLocation: "frontmatter" | "yaml-top-level";
}

/**
 * Canonical on-disk layout for every `ArtifactType`. ALL code that needs to
 * know "where does kind X live on disk and what shape is its file" must
 * read from here — the parallel-map drift across `template-hash-registry`,
 * `artifact-manifest` bootstrap, `preset-applier`, `discovery`, and
 * `backup-collectors` was traceable to inline duplications of this record.
 *
 * `satisfies` enforces exhaustive coverage at compile time: adding a new
 * `ArtifactType` member without extending this map fails the build.
 */
export const ARTIFACT_LAYOUT = {
  rule: {
    type: "rule",
    dirName: "rules",
    kind: "file",
    ext: ".md",
    managedByLocation: "frontmatter",
  },
  skill: {
    type: "skill",
    dirName: "skills",
    kind: "directory",
    ext: ".md",
    indexFile: "SKILL.md",
    managedByLocation: "frontmatter",
  },
  agent: {
    type: "agent",
    dirName: "agents",
    kind: "file",
    ext: ".md",
    managedByLocation: "frontmatter",
  },
  "mcp-server": {
    type: "mcp-server",
    dirName: "mcp-servers",
    kind: "file",
    ext: ".yaml",
    managedByLocation: "yaml-top-level",
  },
} as const satisfies Record<ArtifactType, ArtifactLayoutDef>;

/**
 * Resolve the on-disk path of an artifact relative to a root directory
 * (either the project's `.codi/` or a preset's directory). Single source
 * of truth for path layout — replaces the four near-duplicate switch
 * statements that previously lived in `preset-applier`, `artifact-manifest`,
 * `init-helpers`, and `template-hash-registry`.
 *
 * The `path` module is imported lazily so this file stays browser-safe
 * for any future docs/site consumer that wants to read `ARTIFACT_LAYOUT`
 * without pulling in `node:path`.
 */
export function artifactRelativePath(type: ArtifactType, name: string): string {
  const layout = ARTIFACT_LAYOUT[type];
  if (layout.kind === "directory") {
    return `${layout.dirName}/${name}/${layout.indexFile}`;
  }
  return `${layout.dirName}/${name}${layout.ext}`;
}
