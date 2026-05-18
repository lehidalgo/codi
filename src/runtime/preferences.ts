/**
 * Per-project preferences for codi.
 *
 * Source of truth: `.codi/preferences.yaml` (preferred).
 * Backward compatible: legacy `.codi/preferences.json` is still read when
 * the YAML file is missing. `codi prefs migrate` converts JSON → YAML.
 *
 * Schema is closed-vocab + open extension. Missing keys take documented
 * defaults — readers never throw on malformed input.
 *
 * 16E — Phase: consolidated prefs system. Workflow chains, hooks, and the
 * gate runner read from this single source instead of probing scattered
 * `.codi/preferences.json`, `.codi/project.json`, and ad-hoc env vars.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { PROJECT_DIR } from "#src/constants.js";

export type OutputMode = "caveman" | "normal";
export type IssueTracker = "linear" | "jira" | "github" | "none";

export interface HookPreferenceOverride {
  enabled?: boolean;
  extraSkipExtensions?: string[];
  extraSkipPaths?: string[];
}

export interface DefaultProfiles {
  feature?: string;
  "bug-fix"?: string;
  refactor?: string;
  migration?: string;
  project?: string;
}

export interface CodiPreferences {
  /** Output verbosity. Defaults to caveman. */
  output_mode?: OutputMode;
  /** Test command used by verify-evidence + tdd chains. */
  test_command?: string;
  /** Validate command captured into validation_run events. */
  validate_command?: string;
  /** Docs directory (used by plan-writing and init-knowledge-base). */
  docs_dir?: string;
  /** Auto-invoke code-review at verify phase when true. */
  auto_review?: boolean;
  /** Issue tracker integration target. */
  issue_tracker?: IssueTracker;
  /** Default `--profile` per workflow type. */
  default_profiles?: DefaultProfiles;
  /**
   * Per-hook preference overrides keyed by hook name (e.g. "security-reminder").
   * Empty/missing means use registry defaults and project state selection.
   */
  hooks?: Record<string, HookPreferenceOverride>;
  /**
   * ADR-013 Paso 8: capability-discovery prompt injection on UserPromptSubmit.
   * Default `true` for codi-default preset. Set to `false` in preferences.yaml
   * to silence the per-turn capability reminder.
   */
  capability_discovery?: boolean;
  /**
   * ADR-013 Paso 8: agent-memory writes synced into project CLAUDE.md.
   * Default `true` for codi-default preset. Set to `false` to disable the
   * CLAUDE.md memory append on PostToolUse Write/Edit.
   */
  claudemd_memory_sync?: boolean;
  /**
   * ADR-013 Paso 9: warn the agent via UserPromptSubmit when the project
   * still has Husky / Lefthook / pre-commit-framework configured. Default
   * `true` for codi-default. Set to `false` to silence the migration
   * prompt (e.g. when you intentionally want to keep your other runner).
   */
  hook_conflict_detection?: boolean;
}

export const PREFERENCES_YAML_RELATIVE_PATH = `${PROJECT_DIR}/preferences.yaml`;
export const PREFERENCES_JSON_RELATIVE_PATH = `${PROJECT_DIR}/preferences.json`;

export const DEFAULT_PREFERENCES: Required<CodiPreferences> = {
  output_mode: "caveman",
  test_command: "",
  validate_command: "",
  docs_dir: "docs/",
  auto_review: false,
  issue_tracker: "github",
  default_profiles: {},
  hooks: {},
  capability_discovery: true,
  claudemd_memory_sync: true,
  hook_conflict_detection: true,
};

export function preferencesYamlPath(cwd: string): string {
  return join(cwd, PREFERENCES_YAML_RELATIVE_PATH);
}

export function preferencesJsonPath(cwd: string): string {
  return join(cwd, PREFERENCES_JSON_RELATIVE_PATH);
}

/**
 * Back-compat alias — older callers used `preferencesPath`. New code should
 * call `preferencesYamlPath` or `preferencesJsonPath` explicitly.
 */
export function preferencesPath(cwd: string): string {
  return preferencesJsonPath(cwd);
}

interface ParsedPrefs {
  readonly source: "yaml" | "json" | "default";
  readonly raw: Partial<CodiPreferences>;
}

function loadRaw(cwd: string): ParsedPrefs {
  const yamlPath = preferencesYamlPath(cwd);
  if (existsSync(yamlPath)) {
    try {
      const raw = parseYaml(readFileSync(yamlPath, "utf8")) as Partial<CodiPreferences> | null;
      return { source: "yaml", raw: raw ?? {} };
    } catch {
      return { source: "yaml", raw: {} };
    }
  }
  const jsonPath = preferencesJsonPath(cwd);
  if (existsSync(jsonPath)) {
    try {
      const raw = JSON.parse(readFileSync(jsonPath, "utf8")) as Partial<CodiPreferences>;
      return { source: "json", raw };
    } catch {
      return { source: "json", raw: {} };
    }
  }
  return { source: "default", raw: {} };
}

/**
 * Read preferences with defaults applied for any missing keys. Never throws —
 * a missing or malformed file returns the defaults.
 */
export function readPreferences(cwd: string): Required<CodiPreferences> {
  const { raw } = loadRaw(cwd);
  return mergeWithDefaults(raw);
}

export function readPreferencesWithSource(cwd: string): {
  readonly prefs: Required<CodiPreferences>;
  readonly source: ParsedPrefs["source"];
} {
  const parsed = loadRaw(cwd);
  return { prefs: mergeWithDefaults(parsed.raw), source: parsed.source };
}

function mergeWithDefaults(raw: Partial<CodiPreferences>): Required<CodiPreferences> {
  return {
    output_mode: isOutputMode(raw.output_mode) ? raw.output_mode : DEFAULT_PREFERENCES.output_mode,
    test_command:
      typeof raw.test_command === "string" ? raw.test_command : DEFAULT_PREFERENCES.test_command,
    validate_command:
      typeof raw.validate_command === "string"
        ? raw.validate_command
        : DEFAULT_PREFERENCES.validate_command,
    docs_dir: typeof raw.docs_dir === "string" ? raw.docs_dir : DEFAULT_PREFERENCES.docs_dir,
    auto_review:
      typeof raw.auto_review === "boolean" ? raw.auto_review : DEFAULT_PREFERENCES.auto_review,
    issue_tracker: isIssueTracker(raw.issue_tracker)
      ? raw.issue_tracker
      : DEFAULT_PREFERENCES.issue_tracker,
    default_profiles: isDefaultProfiles(raw.default_profiles)
      ? raw.default_profiles
      : DEFAULT_PREFERENCES.default_profiles,
    hooks: raw.hooks ?? {},
    capability_discovery:
      typeof raw.capability_discovery === "boolean"
        ? raw.capability_discovery
        : DEFAULT_PREFERENCES.capability_discovery,
    claudemd_memory_sync:
      typeof raw.claudemd_memory_sync === "boolean"
        ? raw.claudemd_memory_sync
        : DEFAULT_PREFERENCES.claudemd_memory_sync,
    hook_conflict_detection:
      typeof raw.hook_conflict_detection === "boolean"
        ? raw.hook_conflict_detection
        : DEFAULT_PREFERENCES.hook_conflict_detection,
  };
}

/**
 * Write preferences in YAML format. Merges with existing on-disk values so
 * partial writes don't blank other keys.
 */
export function writePreferences(cwd: string, prefs: Partial<CodiPreferences>): void {
  const yamlPath = preferencesYamlPath(cwd);
  mkdirSync(dirname(yamlPath), { recursive: true });
  const existing = readPreferences(cwd);
  const merged: CodiPreferences = { ...existing, ...prefs };
  writeFileSync(yamlPath, stringifyYaml(merged), "utf8");
}

/**
 * Migrate legacy `.codi/preferences.json` to `.codi/preferences.yaml`.
 * Returns the path written, or null if no migration was needed (either the
 * YAML already exists or no JSON was found).
 */
export function migratePreferencesToYaml(cwd: string): string | null {
  const yamlPath = preferencesYamlPath(cwd);
  if (existsSync(yamlPath)) return null;
  const jsonPath = preferencesJsonPath(cwd);
  if (!existsSync(jsonPath)) return null;
  let raw: Partial<CodiPreferences> = {};
  try {
    raw = JSON.parse(readFileSync(jsonPath, "utf8")) as Partial<CodiPreferences>;
  } catch {
    raw = {};
  }
  mkdirSync(dirname(yamlPath), { recursive: true });
  writeFileSync(yamlPath, stringifyYaml(mergeWithDefaults(raw)), "utf8");
  return yamlPath;
}

function isOutputMode(v: unknown): v is OutputMode {
  return v === "caveman" || v === "normal";
}

function isIssueTracker(v: unknown): v is IssueTracker {
  return v === "linear" || v === "jira" || v === "github" || v === "none";
}

function isDefaultProfiles(v: unknown): v is DefaultProfiles {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  for (const [key, value] of Object.entries(r)) {
    if (!["feature", "bug-fix", "refactor", "migration", "project"].includes(key)) return false;
    if (typeof value !== "string") return false;
  }
  return true;
}
