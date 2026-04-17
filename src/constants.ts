// Centralized constants — single source of truth for all tunable values.
// Change a value here and it propagates to schemas, validators, scaffolders, and CLI.

// --- Project identity ---
/** The internal project identifier and CLI binary name. */
export const PROJECT_NAME = "codi";
/** Title-case display name for use in prose and UI. */
export const PROJECT_NAME_DISPLAY = "Codi"; // Title case for prose
/** CLI binary name — derived from PROJECT_NAME. */
export const PROJECT_CLI = PROJECT_NAME; // CLI binary name
/** Hidden configuration directory created inside a project (`.codi`). */
export const PROJECT_DIR = `.${PROJECT_NAME}`;
/** GitHub repository slug (`owner/repo`). */
export const PROJECT_REPO = "lehidalgo/codi";
/** Public GitHub URL for the project repository. */
export const PROJECT_URL = `https://github.com/${PROJECT_REPO}`;
/** Default git branch used for upstream comparisons and contributions. */
export const PROJECT_TARGET_BRANCH = "develop";
/** One-line product tagline used in generated documentation and CLI output. */
export const PROJECT_TAGLINE = "Unified AI agent configuration";

// --- Artifact naming ---
/**
 * Prefix a base artifact name with the project name.
 *
 * @param base - The unprefixed artifact name (e.g. `"balanced"`).
 * @returns The fully-prefixed name (e.g. `"codi-balanced"`).
 * @example
 * prefixedName("balanced"); // => "codi-balanced"
 */
export function prefixedName(base: string): string {
  return `${PROJECT_NAME}-${base}`;
}

/**
 * Name for project-development artifacts (prefix + base + -dev).
 *
 * @param base - The unprefixed artifact name (e.g. `"minimal"`).
 * @returns The development-variant name (e.g. `"codi-minimal-dev"`).
 * @example
 * devArtifactName("minimal"); // => "codi-minimal-dev"
 */
export function devArtifactName(base: string): string {
  return `${PROJECT_NAME}-${base}-dev`;
}

/**
 * Resolve an artifact name: accept both short ("strict") and prefixed ("codi-strict") forms.
 *
 * @param input - The name to resolve — may be short or already prefixed.
 * @param validNames - The list of fully-qualified valid artifact names.
 * @returns The resolved name if found in `validNames`, or `undefined` if not recognised.
 * @example
 * resolveArtifactName("strict", ["codi-strict", "codi-balanced"]); // => "codi-strict"
 * resolveArtifactName("codi-strict", ["codi-strict"]);             // => "codi-strict"
 * resolveArtifactName("unknown", ["codi-strict"]);                 // => undefined
 */
export function resolveArtifactName(
  input: string,
  validNames: readonly string[],
): string | undefined {
  if (validNames.includes(input)) return input;
  const prefixed = prefixedName(input);
  if (validNames.includes(prefixed)) return prefixed;
  return undefined;
}

// --- Artifact size limits ---
/** Maximum character length allowed for an artifact name. */
export const MAX_NAME_LENGTH = 64;
/** Maximum character length allowed for a general artifact description. */
export const MAX_DESCRIPTION_LENGTH = 512;
/** Maximum character length allowed for a skill description. */
export const MAX_SKILL_DESCRIPTION_LENGTH = 1024;
/** Maximum character length of a single artifact's content when injected into context. */
export const MAX_ARTIFACT_CHARS = 6_000;
/** Maximum total character count across all artifacts injected into a single context window. */
export const MAX_TOTAL_ARTIFACT_CHARS = 12_000;

// --- Name validation patterns ---
/** Regex that artifact names must satisfy: lowercase letters, digits, and hyphens only. */
export const NAME_PATTERN = /^[a-z0-9-]+$/;
/** Strict variant of NAME_PATTERN: must also start with a lowercase letter. */
export const NAME_PATTERN_STRICT = /^[a-z][a-z0-9-]*$/; // must start with letter

// --- Verification token ---
/** Length (in hex characters) of the hash segment in a verification token. */
export const TOKEN_HASH_LENGTH = 12;
/** Namespace prefix prepended to every generated verification token. */
export const TOKEN_PREFIX = PROJECT_NAME;

// --- Watch ---
/** Debounce delay in milliseconds applied to filesystem watch events. */
export const WATCH_DEBOUNCE_MS = 500;

// --- Backup ---
/** Maximum number of configuration backups retained before the oldest is pruned. */
export const MAX_BACKUPS = 5;

// --- Managed by ---
/** Valid values for the `managed_by` field in artifact frontmatter. */
export const MANAGED_BY_VALUES = [PROJECT_NAME, "user"] as const;

// --- Presets ---
// Base preset names are derived from flag-presets.ts PRESETS object (source of truth).
// Extended preset names are derived from templates/presets/index.ts BUILTIN_PRESETS.
// Only the default preset identifier is a true constant.
/** Fully-qualified name of the preset applied when no preset is explicitly configured. */
export const DEFAULT_PRESET = prefixedName("balanced");

// --- Preset source types ---
/** All supported sources from which a preset can be installed. */
export const PRESET_SOURCE_TYPES = ["builtin", "zip", "github", "local"] as const;
/** Union type of all valid preset source identifiers. */
export type PresetSourceType = (typeof PRESET_SOURCE_TYPES)[number];

// --- Preset size limits ---
/** Preset ZIP archive size (bytes) at which the installer emits a warning. */
export const MAX_PRESET_ZIP_WARN_BYTES = 1_048_576; // 1 MB
/** Preset ZIP archive size (bytes) at which the installer aborts with an error. */
export const MAX_PRESET_ZIP_ERROR_BYTES = 10_485_760; // 10 MB

// --- Config filenames ---
/** Filename of the primary project manifest written to the `.codi` directory. */
export const MANIFEST_FILENAME = `${PROJECT_NAME}.yaml`;
/** Filename of the feature-flags configuration file. */
export const FLAGS_FILENAME = "flags.yaml";
/** Filename of the MCP server configuration file. */
export const MCP_FILENAME = "mcp.yaml";
/** Filename of the persistent CLI state file. */
export const STATE_FILENAME = "state.json";
/** Filename of the append-only audit event log. */
export const AUDIT_FILENAME = "audit.jsonl";
/** Filename of the rendered skill output written during skill execution. */
export const SKILL_OUTPUT_FILENAME = "SKILL.md";

// --- Agent context token limits ---
/** Token budget for large context-window models (e.g. Claude with 200 K context). */
export const CONTEXT_TOKENS_LARGE = 200_000;
/** Token budget for small context-window models (e.g. 32 K context). */
export const CONTEXT_TOKENS_SMALL = 32_000;

// --- Internal filenames ---
/** Filename of the per-preset manifest describing preset metadata. */
export const PRESET_MANIFEST_FILENAME = "preset.yaml";
/** Filename of the JSON file that records backup metadata for a configuration snapshot. */
export const BACKUP_MANIFEST_FILENAME = "backup-manifest.json";
/** Filename of the lockfile that pins the currently installed preset version. */
export const PRESET_LOCK_FILENAME = "preset-lock.json";
/** Filename of the ledger that records all mutating operations applied to the project. */
export const OPERATIONS_LEDGER_FILENAME = "operations.json";
/** Filename of the manifest enumerating all managed artifact files. */
export const ARTIFACT_MANIFEST_FILENAME = "artifact-manifest.json";
/** Filename of the registry index used to look up available built-in artifacts. */
export const REGISTRY_INDEX_FILENAME = "index.json";
/** Name of the directory that stores configuration backups. */
export const BACKUPS_DIR = "backups";

// --- Supported platforms ---
/** Agent platform IDs — single source of truth for compatibility fields. */
export const SUPPORTED_PLATFORMS = ["claude-code", "cursor", "codex", "windsurf", "cline", "copilot"] as const;
/** YAML-ready inline list for template interpolation. */
export const SUPPORTED_PLATFORMS_YAML = `[${SUPPORTED_PLATFORMS.join(", ")}]`;

// --- Artifact types ---
/** All recognised artifact type directory names. */
export const ARTIFACT_TYPES = ["rules", "skills", "agents"] as const;

// --- Brand category ---
/** Category label assigned to brand skills. */
export const BRAND_CATEGORY = "brand" as const;

// --- Skill categories (single source of truth) ---
/** Ordered tuple of all built-in skill category display names. */
export const SKILL_CATEGORIES = [
  "Brand Identity",
  "Code Quality",
  "Content Creation",
  "Content Refinement",
  "Creative and Design",
  "Developer Tools",
  "Developer Workflow",
  "Document Generation",
  "File Format Tools",
  "Planning",
  "Productivity",
  "Testing",
  "Workflow",
] as const;

/** Union type of all built-in skill category names. */
export type SkillCategory = (typeof SKILL_CATEGORIES)[number];

/**
 * Named constants for each skill category — use in template interpolation instead of
 * hardcoding strings. Typed with `satisfies` to guarantee every key is a valid SkillCategory.
 */
export const SKILL_CATEGORY = {
  BRAND_IDENTITY: "Brand Identity",
  CODE_QUALITY: "Code Quality",
  CONTENT_CREATION: "Content Creation",
  CONTENT_REFINEMENT: "Content Refinement",
  CREATIVE_AND_DESIGN: "Creative and Design",
  DEVELOPER_TOOLS: "Developer Tools",
  DEVELOPER_WORKFLOW: "Developer Workflow",
  DOCUMENT_GENERATION: "Document Generation",
  FILE_FORMAT_TOOLS: "File Format Tools",
  PLANNING: "Planning",
  PRODUCTIVITY: "Productivity",
  TESTING: "Testing",
  WORKFLOW: "Workflow",
} as const satisfies Record<string, SkillCategory>;

/** Platform category — derived from PROJECT_NAME_DISPLAY to stay in sync. */
export const PLATFORM_CATEGORY = `${PROJECT_NAME_DISPLAY} Platform`;

/** All valid skill categories including the dynamic platform category. */
export const ALL_SKILL_CATEGORIES = [...SKILL_CATEGORIES, PLATFORM_CATEGORY] as const;
/** Union type covering both built-in and dynamic skill categories. */
export type AnySkillCategory = (typeof ALL_SKILL_CATEGORIES)[number];

/** Returns true if the value is a known built-in skill category. */
export function isKnownSkillCategory(v: string): v is AnySkillCategory {
  return (ALL_SKILL_CATEGORIES as readonly string[]).includes(v);
}

// --- CLI commands (single source of truth for stats) ---
/** Complete list of top-level CLI command names registered by the binary. */
export const CLI_COMMANDS = [
  "init",
  "generate",
  "validate",
  "status",
  "add",
  "verify",
  "doctor",
  "update",
  "clean",
  "compliance",
  "ci",
  "watch",
  "revert",

  "preset",
  "docs-update",
  "docs",
  "docs-stamp",
  "docs-check",
  "contribute",
  "skill",
  "onboard",
] as const;

// --- Git operations ---
/** Shallow-clone depth used when cloning repositories to minimise download size. */
export const GIT_CLONE_DEPTH = "1";

// --- Flag defaults ---
/** Default maximum lines-of-code limit enforced on source files via rules. */
export const DEFAULT_MAX_FILE_LINES = 700;
/** Maximum lines-of-code limit checked by the pre-commit hook (slightly relaxed). */
export const PRE_COMMIT_MAX_FILE_LINES = 800;

// --- Per-layer line limits (ACS recommendations) ---
/** Recommended maximum line count for a context injection file. */
export const MAX_CONTEXT_LINES = 300;
/** Recommended maximum line count for a skill definition file. */
export const MAX_SKILL_LINES = 500;
/** Recommended maximum line count for an agent definition file. */
export const MAX_AGENT_LINES = 200;

// --- Git commit standards ---
/** Maximum character length for the first line of a git commit message. */
export const GIT_COMMIT_FIRST_LINE_LIMIT = 72;

// --- Documentation management ---
/** Relative path to the directory that stores agent-generated project documents. */
export const DOC_PROJECT_DIR = "docs/project";
/** Filename of the hidden stamp file used to track the last documentation generation timestamp. */
export const DOC_STAMP_FILENAME = ".doc-stamp";

// --- Skill feedback & evolution ---
/** Directory name (within `.codi`) where skill feedback files are stored. */
export const FEEDBACK_DIR = "feedback";
/** Directory name used to store versioned skill snapshots. */
export const VERSIONS_DIR = "versions";
/** Filename of the JSON file that holds skill evaluation records. */
export const EVALS_FILENAME = "evals.json";
/** Maximum number of feedback entries retained per skill before the oldest are pruned. */
export const MAX_FEEDBACK_ENTRIES = 1000;
/** Maximum age in days for a feedback entry before it is eligible for pruning. */
export const MAX_FEEDBACK_AGE_DAYS = 90;
/** Minimum number of feedback entries required before a skill evolution is triggered. */
export const MIN_FEEDBACK_FOR_EVOLVE = 3;

// --- Code quality thresholds ---
/** Minimum acceptable code coverage percentage enforced in CI. */
export const MIN_CODE_COVERAGE_PERCENT = 80;
/** Maximum line count for a single function before it is flagged for refactoring. */
export const MAX_FUNCTION_LINES = 30;
/** Maximum line count for a single UI component before it is flagged for refactoring. */
export const MAX_COMPONENT_LINES = 150;

// --- Project context injection markers ---
/** Opening HTML comment marker that delimits the injected project-context block. */
export const PROJECT_CONTEXT_START = "<!-- codi:project-context:start -->";
/** Closing HTML comment marker that delimits the injected project-context block. */
export const PROJECT_CONTEXT_END = "<!-- codi:project-context:end -->";
/**
 * Anchor marker emitted at the top of every adapter instruction file.
 * The onboarding skill/playbook replaces this anchor with a
 * `<!-- codi:project-context:start --> ... <!-- codi:project-context:end -->`
 * block. `codi generate` preserves that block across regenerations by
 * re-inserting it in place of this anchor on the next run.
 */
export const PROJECT_CONTEXT_ANCHOR = "<!-- codi:project-context:insert-here -->";
