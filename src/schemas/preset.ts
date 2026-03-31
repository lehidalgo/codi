import { z } from "zod";
import { MAX_NAME_LENGTH, NAME_PATTERN_STRICT } from "../constants.js";

const PresetCompatibilitySchema = z
  .object({
    engine: z.string().optional(),
    agents: z.array(z.string()).optional(),
  })
  .optional();

const PresetFlagSchema = z.object({
  mode: z.enum([
    "enforced",
    "enabled",
    "disabled",
    "inherited",
    "delegated_to_agent_default",
    "conditional",
  ]),
  value: z.unknown().optional(),
  locked: z.boolean().optional(),
});

const PresetArtifactsSchema = z
  .object({
    rules: z.array(z.string()).optional(),
    skills: z.array(z.string()).optional(),
    agents: z.array(z.string()).optional(),
    commands: z.array(z.string()).optional(),
    // @deprecated — use skills with category: brand instead
    brands: z.array(z.string()).optional(),
  })
  .optional();

export const PresetManifestSchema = z.object({
  name: z.string().regex(NAME_PATTERN_STRICT).max(MAX_NAME_LENGTH),
  description: z.string().optional(),
  version: z.string().optional(),
  extends: z.string().optional(),
  author: z.string().optional(),
  license: z.string().optional(),
  tags: z.array(z.string()).optional(),
  category: z
    .enum(["engineering", "design", "data", "platform", "security", "custom"])
    .optional(),
  compatibility: PresetCompatibilitySchema,
  dependencies: z.array(z.string()).optional(),
  artifacts: PresetArtifactsSchema,
  flags: z.record(z.string(), PresetFlagSchema).optional(),
});

export type PresetManifest = z.infer<typeof PresetManifestSchema>;
export type PresetManifestInput = z.input<typeof PresetManifestSchema>;
