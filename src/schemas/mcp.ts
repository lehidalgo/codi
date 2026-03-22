import { z } from 'zod';

export const McpConfigSchema = z.object({
  servers: z.record(z.string(), z.object({
    command: z.string(),
    args: z.array(z.string()).optional(),
    env: z.record(z.string(), z.string()).optional(),
  })).default({}),
});

export type McpConfigInput = z.input<typeof McpConfigSchema>;
export type McpConfigOutput = z.output<typeof McpConfigSchema>;
