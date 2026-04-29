import { PROJECT_CLI, PROJECT_NAME_DISPLAY } from "#src/constants.js";
import { EXIT_CODES } from "./exit-codes.js";
import type { ProjectError } from "./types.js";

interface CatalogEntry {
  exitCode: number;
  severity: ProjectError["severity"];
  hintTemplate: string;
}

export const ERROR_CATALOG = {
  E_CONFIG_PARSE_FAILED: {
    exitCode: EXIT_CODES.CONFIG_INVALID,
    severity: "error" as const,
    hintTemplate: "Failed to parse config file: {file}. Check YAML/JSON syntax.",
  },
  E_CONFIG_NOT_FOUND: {
    exitCode: EXIT_CODES.CONFIG_NOT_FOUND,
    severity: "error" as const,
    hintTemplate: `Config file not found at {path}. Run \`${PROJECT_CLI} init\` to create one.`,
  },
  E_CONFIG_INVALID: {
    exitCode: EXIT_CODES.CONFIG_INVALID,
    severity: "error" as const,
    hintTemplate: "Config validation failed: {message}",
  },
  E_CONFLICT_MARKERS: {
    exitCode: EXIT_CODES.CONFIG_INVALID,
    severity: "error" as const,
    hintTemplate:
      "Git merge-conflict markers in {file} (line {line}). Resolve the conflict and re-stage.",
  },
  E_FLAG_CONFLICT: {
    exitCode: EXIT_CODES.FLAG_CONFLICT,
    severity: "error" as const,
    hintTemplate: 'Flag "{flag}" has conflicting values from {source1} and {source2}.',
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
    hintTemplate: `Drift detected in {file}. Run \`${PROJECT_CLI} generate\` to sync.`,
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
  E_VERIFY_NO_CONFIG: {
    exitCode: EXIT_CODES.CONFIG_NOT_FOUND,
    severity: "error" as const,
    hintTemplate: `No ${PROJECT_NAME_DISPLAY} config found. Run \`${PROJECT_CLI} init\` then \`${PROJECT_CLI} generate\` before verifying.`,
  },
  E_VERSION_MISMATCH: {
    exitCode: EXIT_CODES.DOCTOR_FAILED,
    severity: "error" as const,
    hintTemplate: `${PROJECT_NAME_DISPLAY} version does not satisfy required version: {message}`,
  },
  E_FILES_STALE: {
    exitCode: EXIT_CODES.DOCTOR_FAILED,
    severity: "error" as const,
    hintTemplate: `Generated files are stale: {message}. Run \`${PROJECT_CLI} generate\` to sync.`,
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
  W_UNKNOWN_CATEGORY: {
    exitCode: EXIT_CODES.SUCCESS,
    severity: "warn" as const,
    hintTemplate: "{message}",
  },
  E_PRESET_NOT_FOUND: {
    exitCode: EXIT_CODES.PRESET_ERROR,
    severity: "error" as const,
    hintTemplate: `Preset "{name}" not found. Check the name or install it with \`${PROJECT_CLI} preset install\`.`,
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
    hintTemplate: `Skill "{name}" not found at {path}. Run \`${PROJECT_CLI} add skill\` to create one.`,
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
  E_SECURITY_SCAN_BLOCKED: {
    exitCode: EXIT_CODES.PRESET_ERROR,
    severity: "error" as const,
    hintTemplate: "Security scan blocked installation: {reason}",
  },
  W_SECURITY_FINDINGS: {
    exitCode: EXIT_CODES.SUCCESS,
    severity: "warn" as const,
    hintTemplate: "{message}",
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
    hintTemplate: 'Skill "{name}" needs at least {min} feedback entries to evolve (has {count})',
  },
  E_VERSION_NOT_FOUND: {
    exitCode: EXIT_CODES.GENERAL_ERROR,
    severity: "error" as const,
    hintTemplate: 'Version {version} not found for skill "{name}"',
  },
} as const satisfies Record<string, CatalogEntry>;

export type ErrorCode = keyof typeof ERROR_CATALOG;
