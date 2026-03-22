import { z } from 'zod';

export const RuleFrontmatterSchema = z.object({
  name: z.string().regex(/^[a-z0-9-]+$/).max(64),
  description: z.string().max(512),
  type: z.literal('rule').default('rule'),
  language: z.string().optional(),
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
  scope: z.array(z.string()).optional(),
  alwaysApply: z.boolean().default(true),
  managed_by: z.enum(['codi', 'user']).default('user'),
});

export type RuleFrontmatterInput = z.input<typeof RuleFrontmatterSchema>;
export type RuleFrontmatterOutput = z.output<typeof RuleFrontmatterSchema>;
