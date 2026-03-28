import { z } from "zod";
import {
  MAX_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  NAME_PATTERN_STRICT,
  MANAGED_BY_VALUES,
} from "../constants.js";

export const BrandFrontmatterSchema = z.object({
  name: z.string().regex(NAME_PATTERN_STRICT).max(MAX_NAME_LENGTH),
  description: z.string().max(MAX_DESCRIPTION_LENGTH).default(""),
  managed_by: z.enum(MANAGED_BY_VALUES).default("user"),
});

export type BrandFrontmatterInput = z.input<typeof BrandFrontmatterSchema>;
export type BrandFrontmatterOutput = z.output<typeof BrandFrontmatterSchema>;
