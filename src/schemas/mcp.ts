import { z } from 'zod';

const McpServerSchema = z.object({
  type: z.enum(['stdio', 'http']).optional(),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
  url: z.string().optional(),
});

export const McpConfigSchema = z.object({
  servers: z.record(z.string(), McpServerSchema).default({}),
});

export type McpConfigInput = z.input<typeof McpConfigSchema>;
export type McpConfigOutput = z.output<typeof McpConfigSchema>;
