import { z } from "zod";
import {
  MAX_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  NAME_PATTERN_STRICT,
  MANAGED_BY_VALUES,
} from "../constants.js";

export const AgentFrontmatterSchema = z.object({
  name: z.string().regex(NAME_PATTERN_STRICT).max(MAX_NAME_LENGTH),
  description: z.string().max(MAX_DESCRIPTION_LENGTH).default(""),
  tools: z.array(z.string()).optional(),
  disallowedTools: z.array(z.string()).optional(),
  model: z.string().optional(),
  maxTurns: z.number().int().positive().optional(),
  effort: z.enum(["low", "medium", "high", "max"]).optional(),
  managed_by: z.enum(MANAGED_BY_VALUES).default("user"),
});

export type AgentFrontmatterInput = z.input<typeof AgentFrontmatterSchema>;
export type AgentFrontmatterOutput = z.output<typeof AgentFrontmatterSchema>;
