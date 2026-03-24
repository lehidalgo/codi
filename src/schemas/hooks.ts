import { z } from 'zod';
import { NAME_PATTERN } from '../constants.js';

export const HookDefinitionSchema = z.object({
  name: z.string().regex(NAME_PATTERN),
  command: z.string(),
  condition: z.string(),
  staged_filter: z.string().optional(),
});

export const HooksConfigSchema = z.object({
  version: z.literal('1'),
  runner: z.enum(['codi', 'husky', 'pre-commit', 'none']),
  install_method: z.enum(['git-hooks', 'husky-append', 'pre-commit-append', 'manual']),
  hooks: z.record(z.string(), z.record(z.string(), z.array(HookDefinitionSchema))),
  custom: z.record(z.string(), z.array(HookDefinitionSchema)).default({}),
});

export type HookDefinitionOutput = z.output<typeof HookDefinitionSchema>;
export type HooksConfigOutput = z.output<typeof HooksConfigSchema>;
