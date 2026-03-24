import { z } from 'zod';
import type { FlagSpec, ResolvedFlags } from '../../types/flags.js';

export const FLAG_CATALOG: Record<string, FlagSpec> = {
  auto_commit: {
    type: 'boolean',
    default: false,
    hook: null,
    description: 'Automatic commits after changes',
  },
  test_before_commit: {
    type: 'boolean',
    default: true,
    hook: 'tests',
    description: 'Run tests before commit',
  },
  security_scan: {
    type: 'boolean',
    default: true,
    hook: 'secret-detection',
    description: 'Mandatory security scanning',
  },
  type_checking: {
    type: 'enum',
    default: 'strict',
    values: ['strict', 'basic', 'off'],
    hook: 'typecheck',
    description: 'Type checking level',
  },
  max_file_lines: {
    type: 'number',
    default: 700,
    min: 1,
    hook: 'file-size-check',
    description: 'Max lines per file',
  },
  require_tests: {
    type: 'boolean',
    default: false,
    hook: null,
    description: 'Require tests for new code',
  },
  allow_shell_commands: {
    type: 'boolean',
    default: true,
    hook: null,
    description: 'Allow shell command execution',
  },
  allow_file_deletion: {
    type: 'boolean',
    default: true,
    hook: null,
    description: 'Allow file deletion',
  },
  lint_on_save: {
    type: 'boolean',
    default: true,
    hook: null,
    description: 'Lint files on save',
  },
  allow_force_push: {
    type: 'boolean',
    default: false,
    hook: null,
    description: 'Allow force push to remote',
  },
  require_pr_review: {
    type: 'boolean',
    default: true,
    hook: null,
    description: 'Require PR review before merge',
  },
  mcp_allowed_servers: {
    type: 'string[]',
    default: [],
    hook: null,
    description: 'Allowed MCP server names',
  },
  require_documentation: {
    type: 'boolean',
    default: false,
    hook: null,
    description: 'Require documentation for new code',
  },
  allowed_languages: {
    type: 'string[]',
    default: ['*'],
    hook: null,
    description: 'Allowed programming languages',
  },
  max_context_tokens: {
    type: 'number',
    default: 50000,
    min: 1000,
    hook: null,
    description: 'Maximum context token window',
  },
  progressive_loading: {
    type: 'enum',
    default: 'metadata',
    values: ['off', 'metadata', 'full'],
    hook: null,
    description: 'Progressive loading strategy',
  },
  // Controls drift detection severity in doctor/status/compliance
  drift_detection: {
    type: 'enum',
    default: 'warn',
    values: ['off', 'warn', 'error'],
    hook: null,
    description: 'Drift detection behavior',
  },
  // Enables auto-regeneration via codi watch command
  auto_generate_on_change: {
    type: 'boolean',
    default: false,
    hook: null,
    description: 'Auto-generate on config change',
  },
};

export function buildFlagSchema(
  catalog: Record<string, FlagSpec>,
): z.ZodType {
  const shape: Record<string, z.ZodType> = {};

  for (const [name, spec] of Object.entries(catalog)) {
    switch (spec.type) {
      case 'boolean':
        shape[name] = z.boolean().optional();
        break;
      case 'number':
        shape[name] = z.number().int().positive().optional();
        break;
      case 'enum':
        if (spec.values && spec.values.length > 0) {
          const [first, ...rest] = spec.values;
          shape[name] = z.enum([first!, ...rest]).optional();
        }
        break;
      case 'string[]':
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
      mode: 'enabled',
      source: 'default',
      locked: false,
    };
  }

  return defaults;
}
