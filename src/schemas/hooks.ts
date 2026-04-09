import { z } from "zod";
import { NAME_PATTERN, PROJECT_NAME } from "../constants.js";

/** Validates a single hook definition entry in a hooks configuration file. */
export const HookDefinitionSchema = z.object({
  name: z.string().regex(NAME_PATTERN),
  command: z.string(),
  condition: z.string(),
  staged_filter: z.string().optional(),
});

/**
 * Validates the generated `.codi/hooks.yaml` configuration file.
 *
 * This file is produced by `codi generate` (not hand-authored) and describes
 * how hooks are installed and managed across supported hook runners.
 */
export const HooksConfigSchema = z.object({
  version: z.literal("1").describe("Schema version. Always '1'."),
  runner: z
    .enum([PROJECT_NAME, "husky", "pre-commit", "none"])
    .describe(
      "Which hook manager owns the hook files: 'codi' (direct git hooks), 'husky', 'pre-commit', or 'none' (manual).",
    ),
  install_method: z
    .enum(["git-hooks", "husky-append", "pre-commit-append", "manual"])
    .describe(
      "How hooks are written to disk: 'git-hooks' writes directly to .git/hooks; 'husky-append'/'pre-commit-append' integrate with existing runners; 'manual' outputs instructions only.",
    ),
  hooks: z
    .record(z.string(), z.record(z.string(), z.array(HookDefinitionSchema)))
    .describe("Hook definitions organized by lifecycle event and hook name."),
  custom: z
    .record(z.string(), z.array(HookDefinitionSchema))
    .default({})
    .describe("User-defined custom hooks added outside of Codi's built-in hook set."),
});

export type HookDefinitionOutput = z.output<typeof HookDefinitionSchema>;
export type HooksConfigOutput = z.output<typeof HooksConfigSchema>;
