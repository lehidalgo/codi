import { z } from "zod";

export const EvalCaseSchema = z.object({
  id: z.string(),
  description: z.string(),
  input: z.string().optional(),
  expectedOutput: z.string().optional(),
  passed: z.boolean().optional(),
  lastRunAt: z.string().datetime().optional(),
});

export const EvalsDataSchema = z.object({
  skillName: z.string(),
  cases: z.array(EvalCaseSchema).default([]),
  lastUpdated: z.string().datetime().optional(),
});

export type EvalCase = z.infer<typeof EvalCaseSchema>;
export type EvalsData = z.infer<typeof EvalsDataSchema>;
