import { EXIT_CODES } from "./exit-codes.js";
import type { CodiError } from "./types.js";

interface CatalogEntry {
  exitCode: number;
  severity: CodiError["severity"];
  hintTemplate: string;
}

export const ERROR_CATALOG = {
  E_CONFIG_PARSE_FAILED: {
    exitCode: EXIT_CODES.CONFIG_INVALID,
    severity: "error" as const,
    hintTemplate:
      "Failed to parse config file: {file}. Check YAML/JSON syntax.",
  },
  E_CONFIG_NOT_FOUND: {
    exitCode: EXIT_CODES.CONFIG_NOT_FOUND,
    severity: "error" as const,
    hintTemplate:
      "Config file not found at {path}. Run `codi init` to create one.",
  },
  E_CONFIG_INVALID: {
    exitCode: EXIT_CODES.CONFIG_INVALID,
    severity: "error" as const,
    hintTemplate: "Config validation failed: {message}",
  },
  E_FLAG_CONFLICT: {
    exitCode: EXIT_CODES.FLAG_CONFLICT,
    severity: "error" as const,
    hintTemplate:
      'Flag "{flag}" has conflicting values from {source1} and {source2}.',
  },
  E_FLAG_LOCKED: {
    exitCode: EXIT_CODES.FLAG_CONFLICT,
    severity: "error" as const,
    hintTemplate:
      'Flag "{flag}" is locked by {source} and cannot be overridden.',
  },
  E_GENERATION_FAILED: {
    exitCode: EXIT_CODES.GENERATION_FAILED,
    severity: "error" as const,
    hintTemplate: 'Failed to generate config for agent "{agent}": {reason}',
  },
  E_AGENT_NOT_FOUND: {
    exitCode: EXIT_CODES.AGENT_NOT_FOUND,
    severity: "error" as const,
    hintTemplate: 'Agent "{agent}" not found. Available agents: {available}',
  },
  E_MIGRATION_FAILED: {
    exitCode: EXIT_CODES.MIGRATION_FAILED,
    severity: "error" as const,
    hintTemplate: "Migration failed for {file}: {reason}",
  },
  E_DRIFT_DETECTED: {
    exitCode: EXIT_CODES.DRIFT_DETECTED,
    severity: "warn" as const,
    hintTemplate: "Drift detected in {file}. Run `codi generate` to sync.",
  },
  E_HOOK_FAILED: {
    exitCode: EXIT_CODES.HOOK_FAILED,
    severity: "error" as const,
    hintTemplate: 'Hook "{hook}" failed: {reason}',
  },
  E_PERMISSION_DENIED: {
    exitCode: EXIT_CODES.PERMISSION_DENIED,
    severity: "fatal" as const,
    hintTemplate: "Permission denied: {path}. Check file permissions.",
  },
  E_FRONTMATTER_INVALID: {
    exitCode: EXIT_CODES.CONFIG_INVALID,
    severity: "error" as const,
    hintTemplate: "Invalid frontmatter in {file}: {message}",
  },
  E_SCHEMA_VALIDATION: {
    exitCode: EXIT_CODES.CONFIG_INVALID,
    severity: "error" as const,
    hintTemplate: "Schema validation failed in {file}: {message}",
  },
  E_FLAG_INVALID_VALUE: {
    exitCode: EXIT_CODES.FLAG_CONFLICT,
    severity: "error" as const,
    hintTemplate: 'Flag "{flag}" has invalid value: {reason}',
  },
  E_FLAG_INVALID_MODE: {
    exitCode: EXIT_CODES.FLAG_CONFLICT,
    severity: "error" as const,
    hintTemplate: 'Flag "{flag}" has invalid mode configuration: {reason}',
  },
  E_FLAG_INVALID_CONDITION: {
    exitCode: EXIT_CODES.FLAG_CONFLICT,
    severity: "error" as const,
    hintTemplate:
      'Flag "{flag}" has invalid condition key: {key}. Allowed: lang, framework, agent, file_pattern.',
  },
  E_FLAG_LOCKED_LEVEL: {
    exitCode: EXIT_CODES.FLAG_CONFLICT,
    severity: "error" as const,
    hintTemplate:
      'Flag "{flag}" uses locked:true at "{level}" level. Only org, team, and repo levels can lock flags.',
  },
  E_FLAG_UNKNOWN: {
    exitCode: EXIT_CODES.FLAG_CONFLICT,
    severity: "error" as const,
    hintTemplate:
      'Unknown flag "{flag}" in {source}. Check flag name spelling.',
  },
  E_ORG_CONFIG_INVALID: {
    exitCode: EXIT_CODES.CONFIG_INVALID,
    severity: "error" as const,
    hintTemplate: "Org config at {path} is invalid: {message}",
  },
  E_TEAM_NOT_FOUND: {
    exitCode: EXIT_CODES.CONFIG_NOT_FOUND,
    severity: "error" as const,
    hintTemplate:
      'Team config "{team}" not found at {path}. Create it or remove the team reference from manifest.',
  },
  E_VERIFY_NO_CONFIG: {
    exitCode: EXIT_CODES.CONFIG_NOT_FOUND,
    severity: "error" as const,
    hintTemplate:
      "No Codi config found. Run `codi init` then `codi generate` before verifying.",
  },
  E_VERSION_MISMATCH: {
    exitCode: EXIT_CODES.DOCTOR_FAILED,
    severity: "error" as const,
    hintTemplate: "Codi version does not satisfy required version: {message}",
  },
  E_FILES_STALE: {
    exitCode: EXIT_CODES.DOCTOR_FAILED,
    severity: "error" as const,
    hintTemplate:
      "Generated files are stale: {message}. Run `codi generate` to sync.",
  },
  W_CONTENT_SIZE: {
    exitCode: EXIT_CODES.SUCCESS,
    severity: "warn" as const,
    hintTemplate: "{message}",
  },
  W_DOCS_STALE: {
    exitCode: EXIT_CODES.SUCCESS,
    severity: "warn" as const,
    hintTemplate: "{message}",
  },
  E_PRESET_NOT_FOUND: {
    exitCode: EXIT_CODES.PRESET_ERROR,
    severity: "error" as const,
    hintTemplate:
      'Preset "{name}" not found. Check the name or install it with `codi preset install`.',
  },
  E_PRESET_INVALID: {
    exitCode: EXIT_CODES.PRESET_ERROR,
    severity: "error" as const,
    hintTemplate: 'Preset "{name}" is invalid: {reason}',
  },
  E_PRESET_ZIP_FAILED: {
    exitCode: EXIT_CODES.PRESET_ERROR,
    severity: "error" as const,
    hintTemplate: "Failed to process ZIP preset: {reason}",
  },
  E_PRESET_GITHUB_FAILED: {
    exitCode: EXIT_CODES.PRESET_ERROR,
    severity: "error" as const,
    hintTemplate: 'Failed to clone GitHub preset "{repo}": {reason}',
  },
  E_PRESET_CIRCULAR_EXTENDS: {
    exitCode: EXIT_CODES.PRESET_ERROR,
    severity: "error" as const,
    hintTemplate: "Circular extends chain detected: {chain}",
  },
  W_PRESET_SIZE: {
    exitCode: EXIT_CODES.SUCCESS,
    severity: "warn" as const,
    hintTemplate: "{message}",
  },
  E_SKILL_NOT_FOUND: {
    exitCode: EXIT_CODES.GENERAL_ERROR,
    severity: "error" as const,
    hintTemplate:
      'Skill "{name}" not found at {path}. Run `codi add skill` to create one.',
  },
  E_SKILL_EXPORT_FAILED: {
    exitCode: EXIT_CODES.GENERAL_ERROR,
    severity: "error" as const,
    hintTemplate: 'Failed to export skill "{name}": {reason}',
  },
  E_SKILL_INVALID: {
    exitCode: EXIT_CODES.CONFIG_INVALID,
    severity: "error" as const,
    hintTemplate: 'Skill "{name}" is invalid: {reason}',
  },
  E_FEEDBACK_NOT_FOUND: {
    exitCode: EXIT_CODES.GENERAL_ERROR,
    severity: "error" as const,
    hintTemplate: "Feedback not found at {path}.",
  },
  E_FEEDBACK_INVALID: {
    exitCode: EXIT_CODES.CONFIG_INVALID,
    severity: "error" as const,
    hintTemplate: "Invalid feedback data: {reason}",
  },
  E_FEEDBACK_WRITE_FAILED: {
    exitCode: EXIT_CODES.GENERAL_ERROR,
    severity: "error" as const,
    hintTemplate: "Failed to write feedback: {reason}",
  },
  E_EVOLVE_NOT_READY: {
    exitCode: EXIT_CODES.GENERAL_ERROR,
    severity: "warn" as const,
    hintTemplate:
      'Skill "{name}" needs at least {min} feedback entries to evolve (has {count})',
  },
  E_VERSION_NOT_FOUND: {
    exitCode: EXIT_CODES.GENERAL_ERROR,
    severity: "error" as const,
    hintTemplate: 'Version {version} not found for skill "{name}"',
  },
} as const satisfies Record<string, CatalogEntry>;

export type ErrorCode = keyof typeof ERROR_CATALOG;
