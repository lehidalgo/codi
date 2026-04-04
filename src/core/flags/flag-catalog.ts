import { z } from "zod";
import type { FlagSpec, ResolvedFlags } from "#src/types/flags.js";
import { PROJECT_DIR } from "#src/constants.js";

export const FLAG_CATALOG: Record<string, FlagSpec> = {
  auto_commit: {
    type: "boolean",
    default: false,
    hook: null,
    description: "Automatic commits after changes",
    hint: "Agent commits code automatically without asking for confirmation",
  },
  test_before_commit: {
    type: "boolean",
    default: true,
    hook: "tests",
    description: "Run tests before commit",
    hint: "Pre-commit hook runs your test suite — blocks commit on failure",
  },
  security_scan: {
    type: "boolean",
    default: true,
    hook: "secret-detection",
    description: "Mandatory security scanning",
    hint: "Pre-commit hook scans staged files for leaked secrets, API keys, and tokens",
  },
  type_checking: {
    type: "enum",
    default: "strict",
    values: ["strict", "basic", "off"],
    hook: "typecheck",
    description: "Type checking level",
    hint: "Controls how strictly the type checker validates your code before commit",
    valueHints: {
      strict: "Full type safety — catches most bugs at compile time",
      basic: "Standard checks — less strict, fewer false positives",
      off: "No type checking — fastest builds but no compile-time safety",
    },
  },
  require_tests: {
    type: "boolean",
    default: false,
    hook: null,
    description: "Require tests for new code",
    hint: "Agent must write tests for every new feature or bug fix",
  },
  allow_shell_commands: {
    type: "boolean",
    default: true,
    hook: null,
    description: "Allow shell command execution",
    hint: "Agent can run shell commands — disable to restrict to read-only operations",
  },
  allow_file_deletion: {
    type: "boolean",
    default: true,
    hook: null,
    description: "Allow file deletion",
    hint: "Agent can delete files — disable to prevent accidental data loss",
  },
  lint_on_save: {
    type: "boolean",
    default: true,
    hook: null,
    description: "Lint files on save",
    hint: "Agent runs linter automatically after modifying files",
  },
  allow_force_push: {
    type: "boolean",
    default: false,
    hook: null,
    description: "Allow force push to remote",
    hint: "Dangerous — force push can overwrite shared history and cause data loss",
  },
  require_pr_review: {
    type: "boolean",
    default: true,
    hook: null,
    description: "Require PR review before merge",
    hint: "Agent must create a PR instead of merging directly to main",
  },
  mcp_allowed_servers: {
    type: "string[]",
    default: [],
    hook: null,
    description: "Allowed MCP server names",
    hint: "Whitelist of MCP servers the agent can use (empty = all allowed)",
  },
  require_documentation: {
    type: "boolean",
    default: false,
    hook: null,
    description: "Require documentation for new code",
    hint: "Agent must update docs (README, CHANGELOG) when adding features",
  },
  doc_protected_branches: {
    type: "string[]",
    default: ["main", "develop", "release/*"],
    hook: null,
    description: "Branch patterns that require documentation verification before push",
    hint: "Pushes to these branches are blocked if docs/project/.doc-stamp is outdated",
  },
  allowed_languages: {
    type: "string[]",
    default: ["*"],
    hook: null,
    description: "Allowed programming languages",
    hint: "Restrict which languages the agent can write (* = all)",
  },
  progressive_loading: {
    type: "enum",
    default: "metadata",
    values: ["off", "metadata", "full"],
    hook: null,
    description: "Skill inlining strategy for single-file agents",
    hint: "Controls whether Windsurf/Cline inline skills in their main config file. Skill files always contain full content.",
    valueHints: {
      off: "Inline full skill content in .windsurfrules/.clinerules",
      metadata: "Show skill catalog table in main file; full content in separate skill files",
      full: "Same as metadata — full content always in separate files",
    },
  },
  drift_detection: {
    type: "enum",
    default: "warn",
    values: ["off", "warn", "error"],
    hook: null,
    description: "Drift detection behavior",
    hint: "Detects when generated configs diverge from source artifacts",
    valueHints: {
      off: "No drift checking — manual regeneration only",
      warn: "Show warnings when drift is detected",
      error: "Fail validation when drift is detected",
    },
  },
  auto_generate_on_change: {
    type: "boolean",
    default: false,
    hook: null,
    description: "Auto-generate on config change",
    hint: `Automatically regenerate agent configs when ${PROJECT_DIR}/ files change`,
  },
};

export function buildFlagSchema(catalog: Record<string, FlagSpec>): z.ZodType {
  const shape: Record<string, z.ZodType> = {};

  for (const [name, spec] of Object.entries(catalog)) {
    switch (spec.type) {
      case "boolean":
        shape[name] = z.boolean().optional();
        break;
      case "number":
        shape[name] = z.number().int().positive().optional();
        break;
      case "enum":
        if (spec.values && spec.values.length > 0) {
          const [first, ...rest] = spec.values;
          shape[name] = z.enum([first!, ...rest]).optional();
        }
        break;
      case "string[]":
        shape[name] = z.array(z.string()).optional();
        break;
    }
  }

  return z.object(shape).strict();
}

export function getDefaultFlags(): ResolvedFlags {
  const defaults: ResolvedFlags = {};

  for (const [name, spec] of Object.entries(FLAG_CATALOG)) {
    defaults[name] = {
      value: spec.default,
      mode: "enabled",
      source: "default",
      locked: false,
    };
  }

  return defaults;
}
