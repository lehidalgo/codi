import { z } from 'zod';
import { MAX_NAME_LENGTH, MAX_SKILL_DESCRIPTION_LENGTH, NAME_PATTERN, MANAGED_BY_VALUES } from '../constants.js';

export const SkillFrontmatterSchema = z.object({
  name: z.string().regex(NAME_PATTERN).max(MAX_NAME_LENGTH),
  description: z.string().max(MAX_SKILL_DESCRIPTION_LENGTH),
  type: z.literal('skill').default('skill'),
  compatibility: z.array(z.string()).optional(),
  tools: z.array(z.string()).optional(),
  model: z.string().optional(),
  managed_by: z.enum(MANAGED_BY_VALUES).default('user'),
  disableModelInvocation: z.boolean().optional(),
  argumentHint: z.string().optional(),
  allowedTools: z.array(z.string()).optional(),
  license: z.string().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

export type SkillFrontmatterInput = z.input<typeof SkillFrontmatterSchema>;
export type SkillFrontmatterOutput = z.output<typeof SkillFrontmatterSchema>;
