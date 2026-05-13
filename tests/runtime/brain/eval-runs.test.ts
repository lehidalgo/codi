/**
 * ISSUE-050 — eval_runs writer + reader + summary.
 *
 * Drives the real schema (v13 migration) + writer/reader pair against a
 * tmp brain.db. No mocks — every test opens openBrain → applyMigrations
 * → recordEvalRun → getRecentEvalRuns / summarizeEvalRunsByProject.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openBrain } from "#src/runtime/brain/db.js";
import { applyMigrations } from "#src/runtime/brain/migrate.js";
import {
  recordEvalRun,
  getRecentEvalRuns,
  summarizeEvalRunsByProject,
} from "#src/runtime/brain/eval-runs.js";

describe("ISSUE-050 — eval_runs writer + reader", () => {
  let tmpDir: string;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "codi-evals-"));
    dbPath = join(tmpDir, "brain.db");
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("recordEvalRun inserts a row with required fields populated", () => {
    const handle = openBrain({ dbPath });
    applyMigrations(handle.raw);
    try {
      const runId = recordEvalRun(handle.raw, {
        ts: 1_700_000_000_000,
        projectId: "proj-a",
        skillName: "codi-commit",
        caseId: "case-1",
        passed: true,
        triggerSource: "run-eval",
      });
      expect(runId).toBeGreaterThan(0);

      const row = handle.raw.prepare(`SELECT * FROM eval_runs WHERE run_id = ?`).get(runId) as {
        skill_name: string;
        passed: number;
        runs: number;
        trigger_source: string;
        metadata: string | null;
      };
      expect(row.skill_name).toBe("codi-commit");
      expect(row.passed).toBe(1);
      expect(row.runs).toBe(1);
      expect(row.trigger_source).toBe("run-eval");
      expect(row.metadata).toBeNull();
    } finally {
      handle.close();
    }
  });

  it("metadata is serialised as JSON when supplied", () => {
    const handle = openBrain({ dbPath });
    applyMigrations(handle.raw);
    try {
      const runId = recordEvalRun(handle.raw, {
        ts: 1_700_000_000_000,
        projectId: "proj-a",
        skillName: "codi-test",
        caseId: "case-x",
        passed: false,
        triggerSource: "ci",
        metadata: { branch: "feature/test", duration: 42 },
      });
      const row = handle.raw
        .prepare(`SELECT metadata FROM eval_runs WHERE run_id = ?`)
        .get(runId) as { metadata: string };
      expect(JSON.parse(row.metadata)).toEqual({ branch: "feature/test", duration: 42 });
    } finally {
      handle.close();
    }
  });

  it("getRecentEvalRuns returns rows for a skill newest-first, respecting limit", () => {
    const handle = openBrain({ dbPath });
    applyMigrations(handle.raw);
    try {
      for (let i = 0; i < 5; i++) {
        recordEvalRun(handle.raw, {
          ts: 1_700_000_000_000 + i * 1000,
          projectId: "proj-a",
          skillName: "codi-commit",
          caseId: `case-${i}`,
          passed: i % 2 === 0,
          triggerSource: "run-eval",
        });
      }
      const rows = getRecentEvalRuns(handle.raw, "codi-commit", 3);
      expect(rows).toHaveLength(3);
      // Newest first
      expect(rows[0]!.case_id).toBe("case-4");
      expect(rows[1]!.case_id).toBe("case-3");
      expect(rows[2]!.case_id).toBe("case-2");
    } finally {
      handle.close();
    }
  });

  it("summarizeEvalRunsByProject aggregates pass-rate per skill", () => {
    const handle = openBrain({ dbPath });
    applyMigrations(handle.raw);
    try {
      // codi-commit: 3 runs, 2 pass → passRate 2/3
      // codi-test:   2 runs, 0 pass → passRate 0
      recordEvalRun(handle.raw, {
        ts: 1_000,
        projectId: "proj-a",
        skillName: "codi-commit",
        caseId: "c1",
        passed: true,
        triggerSource: "run-eval",
      });
      recordEvalRun(handle.raw, {
        ts: 2_000,
        projectId: "proj-a",
        skillName: "codi-commit",
        caseId: "c2",
        passed: true,
        triggerSource: "run-eval",
      });
      recordEvalRun(handle.raw, {
        ts: 3_000,
        projectId: "proj-a",
        skillName: "codi-commit",
        caseId: "c3",
        passed: false,
        triggerSource: "run-eval",
      });
      recordEvalRun(handle.raw, {
        ts: 4_000,
        projectId: "proj-a",
        skillName: "codi-test",
        caseId: "t1",
        passed: false,
        triggerSource: "run-eval",
      });
      recordEvalRun(handle.raw, {
        ts: 5_000,
        projectId: "proj-a",
        skillName: "codi-test",
        caseId: "t2",
        passed: false,
        triggerSource: "run-eval",
      });

      const summary = summarizeEvalRunsByProject(handle.raw, "proj-a");
      const bySkill = new Map(summary.map((s) => [s.skillName, s]));
      expect(bySkill.get("codi-commit")?.totalRuns).toBe(3);
      expect(bySkill.get("codi-commit")?.passRate).toBeCloseTo(2 / 3, 5);
      expect(bySkill.get("codi-test")?.totalRuns).toBe(2);
      expect(bySkill.get("codi-test")?.passRate).toBe(0);
    } finally {
      handle.close();
    }
  });

  it("rows in other projects are not surfaced by summarizeEvalRunsByProject", () => {
    const handle = openBrain({ dbPath });
    applyMigrations(handle.raw);
    try {
      recordEvalRun(handle.raw, {
        ts: 1,
        projectId: "proj-a",
        skillName: "codi-commit",
        caseId: "c1",
        passed: true,
        triggerSource: "run-eval",
      });
      recordEvalRun(handle.raw, {
        ts: 2,
        projectId: "proj-b",
        skillName: "codi-commit",
        caseId: "c2",
        passed: false,
        triggerSource: "run-eval",
      });
      const summaryA = summarizeEvalRunsByProject(handle.raw, "proj-a");
      const summaryB = summarizeEvalRunsByProject(handle.raw, "proj-b");
      expect(summaryA).toHaveLength(1);
      expect(summaryA[0]!.passRate).toBe(1);
      expect(summaryB).toHaveLength(1);
      expect(summaryB[0]!.passRate).toBe(0);
    } finally {
      handle.close();
    }
  });
});
