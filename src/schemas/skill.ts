import { z } from 'zod';

export const SkillFrontmatterSchema = z.object({
  name: z.string().regex(/^[a-z0-9-]+$/).max(64),
  description: z.string().max(1024),
  type: z.literal('skill').default('skill'),
  compatibility: z.array(z.string()).optional(),
  tools: z.array(z.string()).optional(),
  model: z.string().optional(),
  managed_by: z.enum(['codi', 'user']).default('user'),
});

export type SkillFrontmatterInput = z.input<typeof SkillFrontmatterSchema>;
export type SkillFrontmatterOutput = z.output<typeof SkillFrontmatterSchema>;
