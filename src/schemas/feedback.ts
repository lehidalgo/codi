import { z } from "zod";
import { MAX_NAME_LENGTH, NAME_PATTERN } from "../constants.js";

export const FEEDBACK_AGENTS = [
  "claude-code",
  "codex",
  "cursor",
  "windsurf",
  "cline",
] as const;

export const FEEDBACK_OUTCOMES = ["success", "partial", "failure"] as const;

export const ISSUE_CATEGORIES = [
  "trigger-miss",
  "trigger-false",
  "unclear-step",
  "missing-step",
  "wrong-output",
  "context-overflow",
  "other",
] as const;

export const ISSUE_SEVERITIES = ["low", "medium", "high"] as const;

export const FeedbackIssueSchema = z.object({
  category: z.enum(ISSUE_CATEGORIES),
  description: z.string().max(500),
  severity: z.enum(ISSUE_SEVERITIES).default("medium"),
});

export const FeedbackEntrySchema = z.object({
  id: z.string().uuid(),
  skillName: z.string().regex(NAME_PATTERN).max(MAX_NAME_LENGTH),
  timestamp: z.string().datetime(),
  agent: z.enum(FEEDBACK_AGENTS),
  taskSummary: z.string().max(500),
  outcome: z.enum(FEEDBACK_OUTCOMES),
  issues: z.array(FeedbackIssueSchema).default([]),
  suggestions: z.array(z.string().max(500)).default([]),
});

export type FeedbackIssue = z.infer<typeof FeedbackIssueSchema>;
export type FeedbackEntry = z.infer<typeof FeedbackEntrySchema>;
export type FeedbackAgent = (typeof FEEDBACK_AGENTS)[number];
export type FeedbackOutcome = (typeof FEEDBACK_OUTCOMES)[number];
export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];

// --- Rule observation feedback ---

export const RULE_OBSERVATION_CATEGORIES = [
  "new-pattern",
  "outdated-rule",
  "missing-example",
  "user-correction",
] as const;

export const RULE_OBSERVATION_SOURCES = [
  "pattern-detection",
  "user-correction",
  "api-deprecation",
] as const;

export const RuleObservationSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("rule-observation"),
  timestamp: z.string().datetime(),
  category: z.enum(RULE_OBSERVATION_CATEGORIES),
  ruleName: z.string().max(MAX_NAME_LENGTH).nullable(),
  observation: z.string().max(500),
  evidence: z.array(z.string().max(300)).min(1),
  suggestedChange: z.string().max(500),
  severity: z.enum(ISSUE_SEVERITIES),
  source: z.enum(RULE_OBSERVATION_SOURCES),
  resolved: z.boolean().default(false),
});

export type RuleObservation = z.infer<typeof RuleObservationSchema>;
export type RuleObservationCategory =
  (typeof RULE_OBSERVATION_CATEGORIES)[number];
export type RuleObservationSource = (typeof RULE_OBSERVATION_SOURCES)[number];
