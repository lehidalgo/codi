import { z } from 'zod';

export const CommandFrontmatterSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9-]*$/).max(64),
  description: z.string().default(''),
  managed_by: z.enum(['codi', 'user']).default('user'),
});

export type CommandFrontmatterInput = z.input<typeof CommandFrontmatterSchema>;
export type CommandFrontmatterOutput = z.output<typeof CommandFrontmatterSchema>;
