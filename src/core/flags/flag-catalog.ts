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
