import { z } from "zod";
import { MAX_NAME_LENGTH, NAME_PATTERN } from "../constants.js";

export const FEEDBACK_AGENTS = [
  "claude-code",
  "codex",
  "cursor",
  "windsurf",
  "cline",
] as const;

export const FEEDBACK_OUTCOMES = [
  "success",
  "partial",
  "failure",
] as const;

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
