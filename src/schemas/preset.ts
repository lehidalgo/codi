import { z } from 'zod';
import { MAX_NAME_LENGTH, NAME_PATTERN_STRICT } from '../constants.js';

export const PresetManifestSchema = z.object({
  name: z.string().regex(NAME_PATTERN_STRICT).max(MAX_NAME_LENGTH),
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
