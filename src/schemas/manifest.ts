import { z } from "zod";
import {
  MAX_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  NAME_PATTERN,
} from "../constants.js";

export const ProjectManifestSchema = z.object({
  name: z.string().regex(NAME_PATTERN).max(MAX_NAME_LENGTH),
  version: z.enum(["1"]),
  description: z.string().max(MAX_DESCRIPTION_LENGTH).optional(),
  agents: z.array(z.string()).optional(),
  layers: z
    .object({
      rules: z.boolean().default(true),
      skills: z.boolean().default(true),
      commands: z.boolean().default(true),
      agents: z.boolean().default(true),
      context: z.boolean().default(true),
    })
    .optional(),
  engine: z
    .object({
      requiredVersion: z.string().optional(),
    })
    .optional(),
  team: z.string().max(MAX_NAME_LENGTH).optional(),
  source: z
    .object({
      repo: z.string(),
      branch: z.string().default("main"),
      paths: z.array(z.string()).default(["rules", "skills", "agents"]),
    })
    .optional(),
  marketplace: z
    .object({
      registry: z.string(),
      branch: z.string().default("main"),
    })
    .optional(),
  presetRegistry: z
    .object({
      url: z.string(),
      branch: z.string().default("main"),
    })
    .optional(),
  presets: z.array(z.string()).optional(),
});

export type ProjectManifestInput = z.input<typeof ProjectManifestSchema>;
export type ProjectManifestOutput = z.output<typeof ProjectManifestSchema>;
