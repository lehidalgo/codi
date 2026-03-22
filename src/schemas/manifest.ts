import { z } from 'zod';

export const CodiManifestSchema = z.object({
  name: z.string().regex(/^[a-z0-9-]+$/).max(64),
  version: z.enum(['1']),
  description: z.string().max(512).optional(),
  agents: z.array(z.string()).optional(),
  layers: z.object({
    rules: z.boolean().default(true),
    skills: z.boolean().default(true),
    commands: z.boolean().default(true),
    agents: z.boolean().default(true),
    context: z.boolean().default(true),
  }).optional(),
  codi: z.object({
    requiredVersion: z.string().optional(),
  }).optional(),
  sync: z.object({
    repo: z.string(),
    branch: z.string().default('main'),
    paths: z.array(z.string()).default(['rules', 'skills']),
  }).optional(),
});

export type CodiManifestInput = z.input<typeof CodiManifestSchema>;
export type CodiManifestOutput = z.output<typeof CodiManifestSchema>;
