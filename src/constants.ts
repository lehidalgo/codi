// Centralized constants — single source of truth for all tunable values.
// Change a value here and it propagates to schemas, validators, scaffolders, and CLI.

// --- Project identity ---
export const PROJECT_NAME = "codi";
export const PROJECT_DIR = ".codi";
export const PROJECT_REPO = "lehidalgo/codi";
export const PROJECT_TARGET_BRANCH = "develop";

// --- Artifact size limits ---
export const MAX_NAME_LENGTH = 64;
export const MAX_DESCRIPTION_LENGTH = 512;
export const MAX_SKILL_DESCRIPTION_LENGTH = 1024;
export const MAX_ARTIFACT_CHARS = 6_000;
export const MAX_TOTAL_ARTIFACT_CHARS = 12_000;

// --- Name validation patterns ---
export const NAME_PATTERN = /^[a-z0-9-]+$/;
export const NAME_PATTERN_STRICT = /^[a-z][a-z0-9-]*$/; // must start with letter

// --- Verification token ---
export const TOKEN_HASH_LENGTH = 12;
export const TOKEN_PREFIX = PROJECT_NAME;

// --- Watch ---
export const WATCH_DEBOUNCE_MS = 500;

// --- Backup ---
export const MAX_BACKUPS = 5;

// --- Managed by ---
export const MANAGED_BY_VALUES = [PROJECT_NAME, "user"] as const;

// --- Presets ---
// Base preset names are derived from flag-presets.ts PRESETS object (source of truth).
// Extended preset names are derived from templates/presets/index.ts BUILTIN_PRESETS.
// Only the default preset identifier is a true constant.
export const DEFAULT_PRESET = "balanced";

// --- Preset source types ---
export const PRESET_SOURCE_TYPES = [
  "builtin",
  "zip",
  "github",
  "local",
] as const;
export type PresetSourceType = (typeof PRESET_SOURCE_TYPES)[number];

// --- Preset size limits ---
export const MAX_PRESET_ZIP_WARN_BYTES = 1_048_576; // 1 MB
export const MAX_PRESET_ZIP_ERROR_BYTES = 10_485_760; // 10 MB

// --- Config filenames ---
export const MANIFEST_FILENAME = "codi.yaml";
export const FLAGS_FILENAME = "flags.yaml";
export const MCP_FILENAME = "mcp.yaml";
export const STATE_FILENAME = "state.json";
export const AUDIT_FILENAME = "audit.jsonl";
export const SKILL_OUTPUT_FILENAME = "SKILL.md";

// --- Agent context token limits ---
export const CONTEXT_TOKENS_LARGE = 200_000;
export const CONTEXT_TOKENS_SMALL = 32_000;

// --- Internal filenames ---
export const PRESET_MANIFEST_FILENAME = "preset.yaml";
export const BACKUP_MANIFEST_FILENAME = "backup-manifest.json";
export const PRESET_LOCK_FILENAME = "preset-lock.json";
export const OPERATIONS_LEDGER_FILENAME = "operations.json";
export const REGISTRY_INDEX_FILENAME = "index.json";
export const BACKUPS_DIR = "backups";

// --- Artifact types ---
export const ARTIFACT_TYPES = [
  "rules",
  "skills",
  "agents",
  "commands",
] as const;

// --- Git operations ---
export const GIT_CLONE_DEPTH = "1";

// --- Flag defaults ---
export const DEFAULT_MAX_FILE_LINES = 700;
export const PRE_COMMIT_MAX_FILE_LINES = 800;

// --- Per-layer line limits (ACS recommendations) ---
export const MAX_CONTEXT_LINES = 300;
export const MAX_SKILL_LINES = 500;
export const MAX_COMMAND_LINES = 100;
export const MAX_AGENT_LINES = 200;

// --- Git commit standards ---
export const GIT_COMMIT_FIRST_LINE_LIMIT = 72;

// --- Code quality thresholds ---
export const MIN_CODE_COVERAGE_PERCENT = 80;
export const MAX_FUNCTION_LINES = 30;
export const MAX_COMPONENT_LINES = 150;
