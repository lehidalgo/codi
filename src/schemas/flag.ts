import { z } from "zod";

/**
 * Valid values for the `mode` field in a flag definition.
 *
 * Controls how Codi manages the flag's value in generated agent instruction files.
 */
export const FlagModeSchema = z
  .enum([
    "enforced",
    "enabled",
    "disabled",
    "inherited",
    "delegated_to_agent_default",
    "conditional",
  ])
  .describe(
    "Flag management mode: 'enforced' (fixed, not overridable), 'enabled' (on, overridable), 'disabled' (off, overridable), 'inherited' (use agent default), 'delegated_to_agent_default' (opt out of Codi management), 'conditional' (depends on conditions field)",
  );

/**
 * Conditions that gate a "conditional" mode flag.
 *
 * At least one field must be present. When multiple fields are set, all must match.
 */
export const FlagConditionsSchema = z
  .object({
    lang: z
      .array(z.string())
      .optional()
      .describe("Programming languages this condition applies to (e.g. ['typescript', 'python'])."),
    framework: z
      .array(z.string())
      .optional()
      .describe("Framework names this condition applies to (e.g. ['react', 'nextjs'])."),
    agent: z
      .array(z.string())
      .optional()
      .describe("Agent ids this condition applies to (e.g. ['claude-code', 'cursor'])."),
    file_pattern: z
      .array(z.string())
      .optional()
      .describe("File glob patterns this condition applies to (e.g. ['**/*.test.ts'])."),
  })
  .refine(
    (data) =>
      data.lang !== undefined ||
      data.framework !== undefined ||
      data.agent !== undefined ||
      data.file_pattern !== undefined,
    { message: "At least one condition field is required" },
  );

/** The valid value types for a flag. */
export const FlagValueSchema = z
  .union([z.boolean(), z.number().int().positive(), z.string(), z.array(z.string())])
  .describe("Flag value: boolean, positive integer, string, or string array.");

/**
 * Validates a single flag entry in `.codi/flags.yaml`.
 *
 * Flags control feature toggles and configuration values that are injected
 * into agent instruction files during generation.
 */
export const FlagDefinitionSchema = z
  .object({
    mode: FlagModeSchema.describe("The flag management mode."),
    value: FlagValueSchema.optional().describe(
      "The flag's value. Only used when mode is 'enforced' or 'enabled'.",
    ),
    locked: z
      .boolean()
      .default(false)
      .describe(
        "When true, this flag cannot be modified via 'codi flags set'. Only direct file edits are allowed.",
      ),
    conditions: FlagConditionsSchema.optional().describe(
      "Conditions that determine when a 'conditional' mode flag applies. Required when mode is 'conditional'.",
    ),
  })
  .refine(
    (data) => {
      if (data.mode === "conditional" && !data.conditions) {
        return false;
      }
      return true;
    },
    { message: "Conditional mode requires conditions" },
  )
  .refine(
    (data) => {
      if (data.mode === "enforced" && data.conditions) {
        return false;
      }
      return true;
    },
    { message: "Enforced mode cannot have conditions" },
  );

export type FlagModeOutput = z.output<typeof FlagModeSchema>;
export type FlagConditionsOutput = z.output<typeof FlagConditionsSchema>;
export type FlagDefinitionOutput = z.output<typeof FlagDefinitionSchema>;
