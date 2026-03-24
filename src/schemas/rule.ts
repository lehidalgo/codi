import { z } from 'zod';
import { MAX_NAME_LENGTH, MAX_DESCRIPTION_LENGTH, NAME_PATTERN, MANAGED_BY_VALUES } from '../constants.js';

export const RuleFrontmatterSchema = z.object({
  name: z.string().regex(NAME_PATTERN).max(MAX_NAME_LENGTH),
  description: z.string().max(MAX_DESCRIPTION_LENGTH),
  type: z.literal('rule').default('rule'),
  language: z.string().optional(),
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
  scope: z.array(z.string()).optional(),
  alwaysApply: z.boolean().default(true),
  managed_by: z.enum(MANAGED_BY_VALUES).default('user'),
});

export type RuleFrontmatterInput = z.input<typeof RuleFrontmatterSchema>;
export type RuleFrontmatterOutput = z.output<typeof RuleFrontmatterSchema>;
