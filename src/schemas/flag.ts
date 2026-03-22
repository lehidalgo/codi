import { z } from 'zod';

export const FlagModeSchema = z.enum([
  'enforced',
  'enabled',
  'disabled',
  'inherited',
  'delegated_to_agent_default',
  'conditional',
]);

export const FlagConditionsSchema = z.object({
  lang: z.array(z.string()).optional(),
  framework: z.array(z.string()).optional(),
  agent: z.array(z.string()).optional(),
  file_pattern: z.array(z.string()).optional(),
}).refine(
  (data) =>
    data.lang !== undefined ||
    data.framework !== undefined ||
    data.agent !== undefined ||
    data.file_pattern !== undefined,
  { message: 'At least one condition field is required' },
);

export const FlagValueSchema = z.union([
  z.boolean(),
  z.number().int().positive(),
  z.string(),
  z.array(z.string()),
]);

export const FlagDefinitionSchema = z.object({
  mode: FlagModeSchema,
  value: FlagValueSchema.optional(),
  locked: z.boolean().default(false),
  conditions: FlagConditionsSchema.optional(),
}).refine(
  (data) => {
    if (data.mode === 'conditional' && !data.conditions) {
      return false;
    }
    return true;
  },
  { message: 'Conditional mode requires conditions' },
).refine(
  (data) => {
    if (data.mode === 'enforced' && data.conditions) {
      return false;
    }
    return true;
  },
  { message: 'Enforced mode cannot have conditions' },
);

export type FlagModeOutput = z.output<typeof FlagModeSchema>;
export type FlagConditionsOutput = z.output<typeof FlagConditionsSchema>;
export type FlagDefinitionOutput = z.output<typeof FlagDefinitionSchema>;
