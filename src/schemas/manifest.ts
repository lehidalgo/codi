import { z } from "zod";
import { MAX_NAME_LENGTH, MAX_DESCRIPTION_LENGTH, NAME_PATTERN } from "../constants.js";

/**
 * Validates the contents of a project's `codi.yaml` manifest file.
 *
 * The manifest is the primary project configuration document at `.codi/codi.yaml`.
 * It declares the project name, which agents to target, and which presets are installed.
 */
export const ProjectManifestSchema = z.object({
  name: z
    .string()
    .regex(NAME_PATTERN)
    .max(MAX_NAME_LENGTH)
    .describe(
      "The project name used as the base for generated artifact names. Must be lowercase kebab-case.",
    ),
  version: z.enum(["1"]).describe("Schema version. Always '1'."),
  description: z
    .string()
    .max(MAX_DESCRIPTION_LENGTH)
    .optional()
    .describe("Optional human-readable description of the project."),
  agents: z
    .array(z.string())
    .optional()
    .describe(
      "Subset of agent ids to generate configuration for. Omit to generate for all detected agents.",
    ),
  layers: z
    .object({
      rules: z
        .boolean()
        .default(true)
        .describe("Whether to generate rule files. Defaults to true."),
      skills: z
        .boolean()
        .default(true)
        .describe("Whether to generate skill files. Defaults to true."),
      agents: z
        .boolean()
        .default(true)
        .describe("Whether to generate agent files. Defaults to true."),
      context: z.boolean().default(true),
    })
    .optional()
    .describe("Controls which artifact layers Codi generates. All layers default to enabled."),
  engine: z
    .object({
      requiredVersion: z
        .string()
        .optional()
        .describe("Minimum Codi version required (semver range, e.g. '>=2.0.0')."),
    })
    .optional()
    .describe("Engine version constraints for this configuration."),
  presetRegistry: z
    .object({
      url: z.string().describe("GitHub repository URL for the custom preset registry."),
      branch: z.string().default("main").describe("Branch to read preset metadata from."),
    })
    .optional()
    .describe(
      "Custom preset registry for 'codi preset install'. When set, overrides the default upstream registry.",
    ),
  presets: z
    .array(z.string())
    .optional()
    .describe(
      "Names of presets currently installed. Populated automatically by 'codi preset install'.",
    ),
});

export type ProjectManifestInput = z.input<typeof ProjectManifestSchema>;
export type ProjectManifestOutput = z.output<typeof ProjectManifestSchema>;
