import { describe, it, expect } from "vitest";
import { FeedbackEntrySchema, FeedbackIssueSchema } from "../../../src/schemas/feedback.js";

describe("FeedbackIssueSchema", () => {
  it("accepts valid issue", () => {
    const result = FeedbackIssueSchema.safeParse({
      category: "missing-step",
      description: "No CSRF check",
      severity: "high",
    });
    expect(result.success).toBe(true);
  });

  it("defaults severity to medium", () => {
    const result = FeedbackIssueSchema.safeParse({
      category: "unclear-step",
      description: "Ambiguous instruction",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.severity).toBe("medium");
    }
  });

  it("rejects unknown category", () => {
    const result = FeedbackIssueSchema.safeParse({
      category: "unknown-cat",
      description: "test",
    });
    expect(result.success).toBe(false);
  });
});

describe("FeedbackEntrySchema", () => {
  const validEntry = {
    id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    skillName: "commit",
    timestamp: "2026-03-28T21:30:00.000Z",
    agent: "claude-code",
    taskSummary: "Created a conventional commit",
    outcome: "success",
    issues: [],
    suggestions: [],
  };

  it("accepts valid entry", () => {
    const result = FeedbackEntrySchema.safeParse(validEntry);
    expect(result.success).toBe(true);
  });

  it("accepts entry with issues and suggestions", () => {
    const result = FeedbackEntrySchema.safeParse({
      ...validEntry,
      outcome: "partial",
      issues: [
        { category: "missing-step", description: "No CSRF check", severity: "high" },
      ],
      suggestions: ["Add CSRF validation step"],
    });
    expect(result.success).toBe(true);
  });

  it("defaults issues and suggestions to empty arrays", () => {
    const { issues, suggestions, ...minimal } = validEntry;
    void issues;
    void suggestions;
    const result = FeedbackEntrySchema.safeParse(minimal);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.issues).toEqual([]);
      expect(result.data.suggestions).toEqual([]);
    }
  });

  it("rejects invalid UUID", () => {
    const result = FeedbackEntrySchema.safeParse({ ...validEntry, id: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid agent", () => {
    const result = FeedbackEntrySchema.safeParse({ ...validEntry, agent: "vscode" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid outcome", () => {
    const result = FeedbackEntrySchema.safeParse({ ...validEntry, outcome: "maybe" });
    expect(result.success).toBe(false);
  });

  it("rejects skill name with spaces", () => {
    const result = FeedbackEntrySchema.safeParse({ ...validEntry, skillName: "my skill" });
    expect(result.success).toBe(false);
  });

  it("rejects taskSummary over 500 chars", () => {
    const result = FeedbackEntrySchema.safeParse({
      ...validEntry,
      taskSummary: "x".repeat(501),
    });
    expect(result.success).toBe(false);
  });
});
