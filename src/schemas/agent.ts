import { z } from 'zod';

export const AgentFrontmatterSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9-]*$/).max(64),
  description: z.string().default(''),
  tools: z.array(z.string()).optional(),
  model: z.string().optional(),
  managed_by: z.enum(['codi', 'user']).default('user'),
});

export type AgentFrontmatterInput = z.input<typeof AgentFrontmatterSchema>;
export type AgentFrontmatterOutput = z.output<typeof AgentFrontmatterSchema>;
