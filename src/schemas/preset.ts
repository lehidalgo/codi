import { z } from 'zod';

export const PresetManifestSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9-]*$/).max(64),
  description: z.string().optional(),
  version: z.string().optional(),
  extends: z.string().optional(),
  tags: z.array(z.string()).optional(),
  flags: z.record(z.string(), z.object({
    mode: z.enum(['enforced', 'enabled', 'disabled', 'inherited', 'delegated_to_agent_default', 'conditional']),
    value: z.unknown().optional(),
    locked: z.boolean().optional(),
  })).optional(),
});

export type PresetManifestInput = z.input<typeof PresetManifestSchema>;
