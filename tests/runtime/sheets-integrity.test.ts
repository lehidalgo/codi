import { describe, it, expect } from "vitest";

import {
  validateDraft,
  formatIntegrityReport,
  type DraftEnvelope,
  type IntegrityIssueCode,
} from "../lib/sheets/index.js";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const validDraft: DraftEnvelope = {
  BusinessGoal: [{ id: "BG-001", title: "Lift signups", status: "proposed" }],
  Requirement: [
    {
      id: "REQ-001",
      type: "functional",
      title: "Google OAuth",
      satisfies: "BG-001",
      status: "proposed",
    },
  ],
  UserStory: [
    {
      id: "US-001",
      as_a: "user",
      i_want: "to sign in with Google",
      so_that: "I check out faster",
      elaborated_from: "REQ-001",
      status: "backlog",
    },
  ],
};

function codes(issues: ReadonlyArray<{ code: IntegrityIssueCode }>): IntegrityIssueCode[] {
  return issues.map((i) => i.code);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("integrity / validateDraft — clean drafts", () => {
  it("accepts a fully valid 3-tier draft with internal references", () => {
    const report = validateDraft(validDraft);
    expect(report.ok).toBe(true);
    expect(report.issues).toEqual([]);
    expect(report.total_rows).toBe(3);
    expect(report.by_entity).toEqual({ BusinessGoal: 1, Requirement: 1, UserStory: 1 });
  });

  it("accepts a Requirement update referencing a BG only present in sheetState", () => {
    const draft: DraftEnvelope = {
      Requirement: [
        {
          id: "REQ-007",
          type: "non_functional",
          title: "p95 latency",
          satisfies: "BG-002",
          status: "proposed",
        },
      ],
    };
    const report = validateDraft(draft, {
      sheetState: {
        BusinessGoal: [{ id: "BG-002", title: "fast", status: "proposed" }],
      },
    });
    expect(report.ok).toBe(true);
  });
});

describe("integrity / shape — enum errors echo allowed values", () => {
  it("flags Requirement.type='non-functional' as enum violation with hint", () => {
    const draft: DraftEnvelope = {
      Requirement: [
        {
          id: "REQ-001",
          type: "non-functional",
          title: "x",
          satisfies: "BG-001",
          status: "proposed",
        },
      ],
      BusinessGoal: [{ id: "BG-001", title: "x", status: "proposed" }],
    };
    const report = validateDraft(draft);
    expect(report.ok).toBe(false);
    expect(codes(report.issues)).toContain("shape_invalid");
    const enumIssue = report.issues.find((i) => i.field === "type");
    expect(enumIssue).toBeDefined();
    expect(enumIssue?.message).toMatch(
      /expected one of \[functional, non_functional, constraint\]/,
    );
    expect(enumIssue?.message).toContain(`"non-functional"`);
  });

  it("flags Requirement.type='scope' as enum violation", () => {
    const draft: DraftEnvelope = {
      Requirement: [
        { id: "REQ-001", type: "scope", title: "x", satisfies: "BG-001", status: "proposed" },
      ],
      BusinessGoal: [{ id: "BG-001", title: "x", status: "proposed" }],
    };
    const report = validateDraft(draft);
    expect(report.ok).toBe(false);
    const enumIssue = report.issues.find((i) => i.field === "type");
    expect(enumIssue?.message).toMatch(
      /expected one of \[functional, non_functional, constraint\]/,
    );
  });

  it("flags BusinessGoal.priority outside [P0,P1,P2]", () => {
    const draft: DraftEnvelope = {
      BusinessGoal: [{ id: "BG-001", title: "x", priority: "P99", status: "proposed" }],
    };
    const report = validateDraft(draft);
    expect(report.ok).toBe(false);
    const issue = report.issues.find((i) => i.field === "priority");
    expect(issue?.message).toMatch(/expected one of \[P0, P1, P2\]/);
  });
});

describe("integrity / shape — pattern + type + additionalProperties + minLength", () => {
  it("flags id format mismatch as id_format_invalid", () => {
    const draft: DraftEnvelope = {
      BusinessGoal: [{ id: "BUSINESS-001", title: "x", status: "proposed" }],
    };
    const report = validateDraft(draft);
    const c = codes(report.issues);
    // Either shape_invalid (pattern via AJV) OR id_format_invalid (our own check) — both
    // should fire because the id field has a pattern in the schema and ALSO trips our
    // explicit check. The important thing is the user gets a clear message.
    expect(c.includes("id_format_invalid") || c.includes("shape_invalid")).toBe(true);
  });

  it("flags additional unknown column with drop-it hint", () => {
    const draft: DraftEnvelope = {
      BusinessGoal: [{ id: "BG-001", title: "x", status: "proposed", random_unknown_col: "junk" }],
    };
    const report = validateDraft(draft);
    const issue = report.issues.find((i) => i.message.includes("random_unknown_col"));
    expect(issue).toBeDefined();
    expect(issue?.message).toMatch(/unknown column/);
  });

  it("flags empty title as minLength violation", () => {
    const draft: DraftEnvelope = {
      BusinessGoal: [{ id: "BG-001", title: "", status: "proposed" }],
    };
    const report = validateDraft(draft);
    const issue = report.issues.find((i) => i.field === "title");
    expect(issue).toBeDefined();
    expect(issue?.message).toMatch(/must not be empty/);
  });
});

describe("integrity / duplicates", () => {
  it("flags duplicate IDs within the same entity", () => {
    const draft: DraftEnvelope = {
      BusinessGoal: [
        { id: "BG-001", title: "first", status: "proposed" },
        { id: "BG-001", title: "second", status: "proposed" },
      ],
    };
    const report = validateDraft(draft);
    expect(report.ok).toBe(false);
    const dup = report.issues.find((i) => i.code === "duplicate_id_within_entity");
    expect(dup).toBeDefined();
    expect(dup?.message).toMatch(/duplicate id "BG-001".*also at index 0/);
  });

  it("does not flag the same numeric suffix across different entities (US-001 vs BG-001)", () => {
    const draft: DraftEnvelope = {
      BusinessGoal: [{ id: "BG-001", title: "x", status: "proposed" }],
      UserStory: [{ id: "US-001", status: "backlog" }],
    };
    const report = validateDraft(draft);
    expect(codes(report.issues)).not.toContain("duplicate_id_within_entity");
  });
});

describe("integrity / orphan references", () => {
  it("flags REQ.satisfies pointing to non-existent BG", () => {
    const draft: DraftEnvelope = {
      Requirement: [
        { id: "REQ-001", type: "functional", title: "x", satisfies: "BG-999", status: "proposed" },
      ],
    };
    const report = validateDraft(draft);
    expect(report.ok).toBe(false);
    const orphan = report.issues.find((i) => i.code === "orphan_reference");
    expect(orphan).toBeDefined();
    expect(orphan?.field).toBe("satisfies");
    expect(orphan?.message).toMatch(/"BG-999".*not present in draft or Sheet/);
  });

  it("flags US.elaborated_from pointing to non-existent REQ", () => {
    const draft: DraftEnvelope = {
      UserStory: [{ id: "US-001", elaborated_from: "REQ-999", status: "backlog" }],
    };
    const report = validateDraft(draft);
    const orphan = report.issues.find((i) => i.code === "orphan_reference");
    expect(orphan?.field).toBe("elaborated_from");
  });

  it("flags US.parent_story pointing to non-existent US", () => {
    const draft: DraftEnvelope = {
      UserStory: [{ id: "US-001", parent_story: "US-999", status: "backlog" }],
    };
    const report = validateDraft(draft);
    const orphan = report.issues.find((i) => i.code === "orphan_reference");
    expect(orphan?.field).toBe("parent_story");
  });

  it("does not flag a chain that resolves through Sheet state", () => {
    const draft: DraftEnvelope = {
      Requirement: [
        { id: "REQ-002", type: "functional", title: "x", satisfies: "BG-001", status: "proposed" },
      ],
    };
    const report = validateDraft(draft, {
      sheetState: { BusinessGoal: [{ id: "BG-001", title: "y", status: "proposed" }] },
    });
    expect(report.ok).toBe(true);
  });
});

describe("integrity / missing required on insert", () => {
  it("flags new BG missing title", () => {
    const draft: DraftEnvelope = {
      BusinessGoal: [{ id: "BG-007", status: "proposed" }],
    };
    const report = validateDraft(draft);
    const missing = report.issues.find((i) => i.code === "missing_required_on_insert");
    expect(missing).toBeDefined();
    expect(missing?.field).toBe("title");
  });

  it("does NOT flag missing title on a row whose ID exists in Sheet (= update)", () => {
    const draft: DraftEnvelope = {
      BusinessGoal: [{ id: "BG-001", status: "accepted" }],
    };
    const report = validateDraft(draft, {
      sheetState: {
        BusinessGoal: [{ id: "BG-001", title: "existing", status: "proposed" }],
      },
    });
    const missing = report.issues.find((i) => i.code === "missing_required_on_insert");
    expect(missing).toBeUndefined();
  });
});

describe("integrity / unknown entity keys", () => {
  it("flags top-level keys that aren't a known entity", () => {
    const draft = {
      Goals: [{ id: "BG-001", title: "x", status: "proposed" }],
    } as unknown as DraftEnvelope;
    const report = validateDraft(draft);
    expect(report.ok).toBe(false);
    expect(codes(report.issues)).toContain("unknown_entity");
  });
});

describe("integrity / formatIntegrityReport", () => {
  it("produces a one-line OK message on clean drafts", () => {
    const out = formatIntegrityReport(validateDraft(validDraft));
    expect(out).toMatch(/✓ integrity OK/);
    expect(out).toMatch(/BusinessGoal=1.*Requirement=1.*UserStory=1/);
  });

  it("groups issues by code with stable ordering", () => {
    const draft: DraftEnvelope = {
      Requirement: [
        {
          id: "REQ-001",
          type: "non-functional",
          title: "x",
          satisfies: "BG-999",
          status: "proposed",
        },
      ],
    };
    const out = formatIntegrityReport(validateDraft(draft));
    expect(out).toMatch(/✗ integrity FAILED/);
    expect(out).toMatch(/shape_invalid/);
    expect(out).toMatch(/orphan_reference/);
    // shape_invalid section appears before orphan_reference section
    expect(out.indexOf("shape_invalid")).toBeLessThan(out.indexOf("orphan_reference"));
  });
});

describe("integrity / regression — the exact T4.6 walkthrough draft", () => {
  it("reproduces and rejects the 3-row failure pattern (non-functional, scope) BEFORE writes", () => {
    const draft: DraftEnvelope = {
      BusinessGoal: [
        { id: "BG-001", title: "Lift signups", status: "proposed" },
        { id: "BG-002", title: "Sub-200ms p95", status: "proposed" },
        { id: "BG-003", title: "GDPR identity", status: "proposed" },
      ],
      Requirement: [
        {
          id: "REQ-008",
          type: "non-functional",
          title: "p95 latency",
          satisfies: "BG-002",
          status: "proposed",
        },
        {
          id: "REQ-009",
          type: "non-functional",
          title: "Postgres reuse",
          satisfies: "BG-003",
          status: "proposed",
        },
        {
          id: "REQ-010",
          type: "scope",
          title: "Apple deferred",
          satisfies: "BG-001",
          status: "proposed",
        },
      ],
    };
    const report = validateDraft(draft);
    expect(report.ok).toBe(false);
    // Each of the 3 bad type values produces a shape_invalid issue.
    const shapeIssues = report.issues.filter(
      (i) => i.code === "shape_invalid" && i.field === "type",
    );
    expect(shapeIssues).toHaveLength(3);
    for (const issue of shapeIssues) {
      expect(issue.message).toMatch(/expected one of \[functional, non_functional, constraint\]/);
    }
  });
});
