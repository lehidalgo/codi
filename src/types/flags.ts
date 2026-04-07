/**
 * Controls how Codi manages a flag's value for a given agent.
 *
 * - `"enforced"` — value is fixed; agents cannot override it
 * - `"enabled"` — feature is on; agents may override
 * - `"disabled"` — feature is off; agents may override
 * - `"inherited"` — Codi does not set a value; the agent uses its own default
 * - `"delegated_to_agent_default"` — explicitly opt out of Codi management for this flag
 * - `"conditional"` — value depends on the `conditions` field (agent id or file pattern)
 */
export type FlagMode =
  | "enforced"
  | "enabled"
  | "disabled"
  | "inherited"
  | "delegated_to_agent_default"
  | "conditional";

/**
 * A single flag entry as stored in `.codi/flags.yaml`.
 *
 * Flags control feature toggles and configuration values that are passed to
 * agent instruction files during generation.
 */
export interface FlagDefinition {
  /** How Codi manages this flag's value. */
  mode: FlagMode;
  /** The flag's value. Only used when mode is "enforced" or "enabled". */
  value?: unknown;
  /** When true, this flag cannot be modified by codi flags set — only direct file edits. */
  locked?: boolean;
  /** Conditions that determine when a "conditional" mode flag applies. */
  conditions?: FlagConditions;
}

/**
 * Conditions that gate a "conditional" flag.
 *
 * At least one field must be set. Multiple fields are evaluated with AND logic.
 */
export interface FlagConditions {
  /** Agent ids this condition applies to (e.g. ["claude-code", "cursor"]). */
  agent?: string[];
  /** File glob patterns this condition applies to (e.g. ["**\/*.test.ts"]). */
  file_pattern?: string[];
}

/** Runtime-accessible keys of FlagConditions — kept in sync with the interface above. */
export const FLAG_CONDITION_KEYS: ReadonlySet<string> = new Set<string>(["agent", "file_pattern"]);

/** Map of flag name to its resolved value, keyed by the flag identifier. */
export interface ResolvedFlags {
  [key: string]: ResolvedFlag;
}

/**
 * A single flag after resolution — value merged from project flags and agent defaults.
 */
export interface ResolvedFlag {
  /** The resolved value of the flag after merging project and agent defaults. */
  value: unknown;
  /** The mode in effect for this flag after resolution. */
  mode: FlagMode;
  /** Identifier of the source that provided this flag's value (e.g. project, agent default). */
  source: string;
  /** Whether this flag is locked from modification via the CLI. */
  locked: boolean;
}

/** A flag specification used by the CLI to validate and describe flags. */
export interface FlagSpec {
  /** The data type of this flag's value. */
  type: "boolean" | "number" | "enum" | "string[]";
  /** The default value for this flag when not explicitly set. */
  default: unknown;
  /** Allowed values for enum-typed flags. */
  values?: string[];
  /** Minimum numeric value for number-typed flags. */
  min?: number;
  /** Optional hook identifier invoked when this flag changes. */
  hook?: string | null;
  /** Human-readable description shown in CLI help output. */
  description: string;
  /** Short hint displayed alongside the flag in interactive prompts. */
  hint?: string;
  /** Descriptive labels for each allowed enum value, shown in interactive prompts. */
  valueHints?: Record<string, string>;
}
