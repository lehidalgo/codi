import { z } from "zod";

/**
 * Validates a single evaluation test case for a skill.
 *
 * Eval cases define prompts and expected behaviors used to assess skill quality
 * during development and evolution.
 */
export const EvalCaseSchema = z.object({
  id: z.string().describe("Unique identifier for this eval case."),
  description: z.string().describe("Human-readable description of what this case tests."),
  prompt: z.string().describe("The input prompt sent to the skill during evaluation."),
  expectations: z
    .array(z.string())
    .default([])
    .describe("Natural language expectations the skill output must satisfy."),
  files: z
    .array(z.string())
    .default([])
    .describe("Relative paths to fixture files available during this eval."),
  passed: z
    .boolean()
    .optional()
    .describe("Result of the last evaluation run. Absent if never run."),
  lastRunAt: z
    .string()
    .datetime()
    .optional()
    .describe("ISO 8601 timestamp of the last evaluation run."),
  passRate: z.number().optional().describe("Rolling pass rate between 0 and 1 across recent runs."),
});

/**
 * Validates the `evals.json` file for a skill.
 *
 * Each skill can have an `evals.json` file in its directory containing test
 * cases used to evaluate the skill's behavior and guide evolution.
 */
export const EvalsDataSchema = z.object({
  skillName: z.string().describe("The name of the skill these evals belong to."),
  cases: z.array(EvalCaseSchema).default([]).describe("All eval cases for this skill."),
  lastUpdated: z
    .string()
    .datetime()
    .optional()
    .describe("ISO 8601 timestamp of the last time any case was updated."),
  // ISSUE-100 — per-skill override for the evolve-readiness threshold.
  // Most skills are well-served by the global `MIN_FEEDBACK_FOR_EVOLVE`
  // default. Skills that should NEVER evolve until a larger corpus is
  // collected (e.g. high-traffic skills with high cost per false-positive
  // change) can raise this; rarely-fired skills can lower it to 1-2.
  minFeedbackForEvolve: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Per-skill minimum feedback count needed to trigger evolve. Falls back to MIN_FEEDBACK_FOR_EVOLVE when omitted (ISSUE-100).",
    ),
});

export type EvalCase = z.infer<typeof EvalCaseSchema>;
export type EvalsData = z.infer<typeof EvalsDataSchema>;
