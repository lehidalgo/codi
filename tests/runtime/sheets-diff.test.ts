import { describe, it, expect } from "vitest";

import { computeDiff, formatDiffSummary, type DraftEnvelope } from "../lib/sheets/index.js";

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("diff / computeDiff — categorization", () => {
  it("classifies a row with no matching id as INSERT", () => {
    const draft: DraftEnvelope = {
      BusinessGoal: [{ id: "BG-001", title: "lift", status: "proposed" }],
    };
    const diff = computeDiff(draft, { sheetState: { BusinessGoal: [] } });
    expect(diff.rows[0]?.kind).toBe("insert");
    expect(diff.by_entity.BusinessGoal?.inserts).toBe(1);
  });

  it("classifies an id-matching row with identical values as NO_OP", () => {
    const draft: DraftEnvelope = {
      BusinessGoal: [{ id: "BG-001", title: "lift", status: "proposed" }],
    };
    const diff = computeDiff(draft, {
      sheetState: { BusinessGoal: [{ id: "BG-001", title: "lift", status: "proposed" }] },
    });
    expect(diff.rows[0]?.kind).toBe("no_op");
    expect(diff.rows[0]?.changed_columns).toEqual([]);
  });

  it("classifies an id-matching row with diverging values as UPDATE with column-level changes", () => {
    const draft: DraftEnvelope = {
      BusinessGoal: [{ id: "BG-001", title: "Lift signups 10% by Q3", status: "accepted" }],
    };
    const diff = computeDiff(draft, {
      sheetState: { BusinessGoal: [{ id: "BG-001", title: "lift", status: "proposed" }] },
    });
    const row = diff.rows[0];
    expect(row?.kind).toBe("update");
    expect(row?.changed_columns).toHaveLength(2);
    const titleChange = row?.changed_columns.find((c) => c.column === "title");
    expect(titleChange?.before).toBe("lift");
    expect(titleChange?.after).toBe("Lift signups 10% by Q3");
  });

  it("classifies a row with __intent='archive' as DELETE_INTENT regardless of other fields", () => {
    const draft: DraftEnvelope = {
      BusinessGoal: [{ id: "BG-002", title: "anything", status: "proposed", __intent: "archive" }],
    };
    const diff = computeDiff(draft, {
      sheetState: { BusinessGoal: [{ id: "BG-002", title: "old", status: "proposed" }] },
    });
    expect(diff.rows[0]?.kind).toBe("delete_intent");
    expect(diff.by_entity.BusinessGoal?.delete_intents).toBe(1);
  });
});

describe("diff / computeDiff — stale-pull detection", () => {
  it("marks STALE_PULL when sheetState differs from pulledState on a column the draft writes", () => {
    const draft: DraftEnvelope = {
      BusinessGoal: [{ id: "BG-001", title: "agent's revised title", status: "accepted" }],
    };
    const diff = computeDiff(draft, {
      // Agent pulled this earlier:
      pulledState: { BusinessGoal: [{ id: "BG-001", title: "old title", status: "proposed" }] },
      // But the Sheet now has THIS — a stakeholder edited "title" between pull and write:
      sheetState: {
        BusinessGoal: [{ id: "BG-001", title: "STAKEHOLDER EDIT", status: "proposed" }],
      },
    });
    const row = diff.rows[0];
    expect(row?.kind).toBe("stale_pull");
    expect(row?.stale_columns).toContain("title");
    expect(row?.stale_columns).not.toContain("status");
  });

  it("does NOT flag stale_pull when divergence is on a column the draft does not write", () => {
    const draft: DraftEnvelope = {
      BusinessGoal: [{ id: "BG-001", status: "accepted" }],
    };
    const diff = computeDiff(draft, {
      pulledState: { BusinessGoal: [{ id: "BG-001", title: "old", status: "proposed" }] },
      sheetState: {
        BusinessGoal: [{ id: "BG-001", title: "STAKEHOLDER EDIT", status: "proposed" }],
      },
    });
    expect(diff.rows[0]?.kind).toBe("update");
  });
});

describe("diff / cell equality treats undefined/null/empty-string as equal", () => {
  it("does not call a row UPDATE when before=null and after=''", () => {
    const draft: DraftEnvelope = {
      BusinessGoal: [{ id: "BG-001", title: "x", status: "proposed", outcome: "" }],
    };
    const diff = computeDiff(draft, {
      sheetState: {
        BusinessGoal: [{ id: "BG-001", title: "x", status: "proposed", outcome: null }],
      },
    });
    expect(diff.rows[0]?.kind).toBe("no_op");
  });
});

describe("diff / formatDiffSummary", () => {
  it("renders insert/update/no-op counts per entity in stable order", () => {
    const draft: DraftEnvelope = {
      BusinessGoal: [
        { id: "BG-001", title: "x", status: "proposed" }, // no_op
        { id: "BG-002", title: "new", status: "proposed" }, // insert
      ],
      Requirement: [
        { id: "REQ-001", type: "functional", title: "y", satisfies: "BG-001", status: "accepted" }, // update
      ],
    };
    const out = formatDiffSummary(
      computeDiff(draft, {
        sheetState: {
          BusinessGoal: [{ id: "BG-001", title: "x", status: "proposed" }],
          Requirement: [
            {
              id: "REQ-001",
              type: "functional",
              title: "y",
              satisfies: "BG-001",
              status: "proposed",
            },
          ],
        },
      }),
    );
    expect(out).toContain("BusinessGoal");
    expect(out).toContain("Requirement");
    expect(out.indexOf("BusinessGoal")).toBeLessThan(out.indexOf("Requirement"));
    expect(out).toMatch(/1 insert/);
    expect(out).toMatch(/1 update/);
    expect(out).toMatch(/1 no-op/);
  });

  it("flags stale-pull rows with a warning section", () => {
    const draft: DraftEnvelope = {
      BusinessGoal: [{ id: "BG-001", title: "draft says X", status: "proposed" }],
    };
    const out = formatDiffSummary(
      computeDiff(draft, {
        pulledState: { BusinessGoal: [{ id: "BG-001", title: "old", status: "proposed" }] },
        sheetState: { BusinessGoal: [{ id: "BG-001", title: "STAKEHOLDER", status: "proposed" }] },
      }),
    );
    expect(out).toMatch(/stale-pull/);
    expect(out).toMatch(/re-pull recommended/);
  });
});
