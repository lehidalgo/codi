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

export const SkillFrontmatterSchema = z.object({
  name: z.string().regex(NAME_PATTERN).max(MAX_NAME_LENGTH),
  description: z.string().max(MAX_SKILL_DESCRIPTION_LENGTH),
  version: z.number().int().positive().default(1),
  type: z.literal("skill").default("skill"),
  compatibility: z.array(z.enum(SUPPORTED_PLATFORMS)).optional(),
  tools: z.array(z.string()).optional(),
  model: z.string().optional(),
  managed_by: z.enum(MANAGED_BY_VALUES).default("user"),
  disableModelInvocation: z.boolean().optional(),
  argumentHint: z.string().optional(),
  allowedTools: z.array(z.string()).optional(),
  category: z.enum([...ALL_SKILL_CATEGORIES] as [string, ...string[]]).optional(),
  license: z.string().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
  // Official Claude Code frontmatter fields
  effort: z.enum(["low", "medium", "high", "max"]).optional(),
  context: z.literal("fork").optional(),
  agent: z.string().optional(),
  "user-invocable": z.boolean().optional(),
  paths: z.union([z.array(z.string()), z.string()]).optional(),
  shell: z.enum(["bash", "powershell"]).optional(),
  hooks: HookConfigSchema.optional(),
});

export type SkillFrontmatterInput = z.input<typeof SkillFrontmatterSchema>;
export type SkillFrontmatterOutput = z.output<typeof SkillFrontmatterSchema>;
