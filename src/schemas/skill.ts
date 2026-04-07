import { z } from "zod";
import {
  MAX_NAME_LENGTH,
  MAX_SKILL_DESCRIPTION_LENGTH,
  NAME_PATTERN,
  MANAGED_BY_VALUES,
  ALL_SKILL_CATEGORIES,
  SUPPORTED_PLATFORMS,
} from "../constants.js";

const HookConfigSchema = z.record(z.string(), z.union([z.string(), z.array(z.string())]));

/**
 * Validates the YAML frontmatter of a `.codi/skills/<name>/SKILL.md` file.
 *
 * Skills are reusable agent workflows with structured frontmatter that controls
 * how they are invoked, which platforms they target, and how they run.
 */
export const SkillFrontmatterSchema = z.object({
  name: z
    .string()
    .regex(NAME_PATTERN)
    .max(MAX_NAME_LENGTH)
    .describe(
      "Unique skill name in kebab-case (e.g. 'codi-brainstorming'). Must match the directory name.",
    ),
  description: z
    .string()
    .max(MAX_SKILL_DESCRIPTION_LENGTH)
    .describe(
      "Human-readable description used in skill routing tables and discovery. Should describe the skill's purpose and when to activate it.",
    ),
  version: z
    .number()
    .int()
    .positive()
    .default(1)
    .describe("Monotonically increasing schema version. Increment on breaking changes."),
  type: z
    .literal("skill")
    .default("skill")
    .describe("Artifact type discriminator. Always 'skill'."),
  compatibility: z
    .array(z.enum(SUPPORTED_PLATFORMS))
    .optional()
    .describe(
      "Agent platform ids this skill targets (e.g. ['claude-code']). Omit to support all platforms.",
    ),
  tools: z
    .array(z.string())
    .optional()
    .describe("Tool names the skill is allowed to use. Passed to the agent's tool allowlist."),
  model: z
    .string()
    .optional()
    .describe(
      "Model identifier override (e.g. 'claude-opus-4-5'). Omit to use the agent's default model.",
    ),
  managed_by: z
    .enum(MANAGED_BY_VALUES)
    .default("user")
    .describe(
      "Ownership: 'codi' means preset-managed (do not edit manually); 'user' means user-managed.",
    ),
  disableModelInvocation: z
    .boolean()
    .optional()
    .describe(
      "When true, the skill runs as a pure tool execution with no LLM call. Useful for deterministic script-type skills.",
    ),
  argumentHint: z
    .string()
    .optional()
    .describe(
      "Short hint shown to users when invoking: '/skill-name <hint>'. Example: '<feature-description>'.",
    ),
  allowedTools: z
    .array(z.string())
    .optional()
    .describe("Tool names explicitly allowed at the agent level. More restrictive than 'tools'."),
  category: z
    .enum([...ALL_SKILL_CATEGORIES] as [string, ...string[]])
    .optional()
    .describe(
      "Skill category for routing and discovery (e.g. 'engineering', 'content', 'quality').",
    ),
  license: z
    .string()
    .optional()
    .describe("SPDX license identifier for contributed skills (e.g. 'MIT')."),
  metadata: z
    .record(z.string(), z.string())
    .optional()
    .describe("Arbitrary key-value metadata attached to this skill for tooling and discovery."),
  // Official Claude Code frontmatter fields
  effort: z
    .enum(["low", "medium", "high", "max"])
    .optional()
    .describe(
      "Model effort tier. 'low' uses faster/cheaper models; 'max' uses the highest capability model available.",
    ),
  context: z
    .literal("fork")
    .optional()
    .describe(
      "When set to 'fork', the skill runs in an isolated Claude Code subagent context with its own session.",
    ),
  agent: z
    .string()
    .optional()
    .describe(
      "Name of a registered Codi agent to run this skill as. The agent's system prompt and tools are applied.",
    ),
  "user-invocable": z
    .boolean()
    .optional()
    .describe(
      "When true, users can invoke this skill via the '/skill-name' slash command in Claude Code.",
    ),
  paths: z
    .union([z.array(z.string()), z.string()])
    .optional()
    .describe(
      "File glob patterns the skill is allowed to read or write. Restricts file access for safety.",
    ),
  shell: z
    .enum(["bash", "powershell"])
    .optional()
    .describe("Shell interpreter for script-type skills. Defaults to the system shell."),
  hooks: HookConfigSchema.optional().describe(
    "Hook configuration passed verbatim to the agent's hook system.",
  ),
});

export type SkillFrontmatterInput = z.input<typeof SkillFrontmatterSchema>;
export type SkillFrontmatterOutput = z.output<typeof SkillFrontmatterSchema>;
