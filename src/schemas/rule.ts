import { z } from "zod";
import {
  MAX_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  NAME_PATTERN,
  MANAGED_BY_VALUES,
} from "../constants.js";

/**
 * Validates the YAML frontmatter of a `.codi/rules/<name>.md` file.
 *
 * Rules are Markdown documents with frontmatter that define coding standards,
 * conventions, and guidelines injected into agent instruction files.
 */
export const RuleFrontmatterSchema = z.object({
  name: z
    .string()
    .regex(NAME_PATTERN)
    .max(MAX_NAME_LENGTH)
    .describe("Unique rule name in kebab-case (e.g. 'codi-typescript'). Must match the filename."),
  description: z
    .string()
    .max(MAX_DESCRIPTION_LENGTH)
    .describe("One-sentence description of what this rule enforces."),
  version: z
    .number()
    .int()
    .positive()
    .default(1)
    .describe("Monotonically increasing version number. Increment when making breaking changes."),
  type: z.literal("rule").default("rule").describe("Artifact type discriminator. Always 'rule'."),
  language: z
    .string()
    .optional()
    .describe(
      "Optional language hint (e.g. 'typescript', 'python'). Adapters may use this to scope the rule to matching files only.",
    ),
  priority: z
    .enum(["high", "medium", "low"])
    .default("medium")
    .describe(
      "Injection priority: 'high' rules appear first in the generated instruction file, 'low' rules appear last.",
    ),
  scope: z
    .array(z.string())
    .optional()
    .describe(
      "File glob patterns that restrict this rule to matching files only. When set, the rule is only injected for files matching these patterns.",
    ),
  alwaysApply: z
    .boolean()
    .default(true)
    .describe(
      "When true, the rule is injected unconditionally. When false, only applied when the agent deems it relevant.",
    ),
  managed_by: z
    .enum(MANAGED_BY_VALUES)
    .default("user")
    .describe(
      "Ownership: 'codi' means preset-managed (do not edit manually); 'user' means user-managed.",
    ),
});

export type RuleFrontmatterInput = z.input<typeof RuleFrontmatterSchema>;
export type RuleFrontmatterOutput = z.output<typeof RuleFrontmatterSchema>;
