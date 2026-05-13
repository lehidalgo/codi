/**
 * v2-to-v3 migration planner (Sprint 7).
 */
import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { detectV2Layout, planMigration, formatPlan } from "#src/core/migration/v2-to-v3.js";
function tmpRepo(): { root: string; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), "codi-mig-"));
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

function seedV2(root: string): void {
  mkdirSync(join(root, ".codi"), { recursive: true });
  writeFileSync(
    join(root, ".codi", "artifact-manifest.json"),
    JSON.stringify(
      {
        artifacts: {
          "codi-security": { type: "rule" },
          "codi-code-review": { type: "skill" },
          "codi-dev-skill-creator": { type: "skill" },
          "codi-code-reviewer": { type: "agent" },
        },
      },
      null,
      2,
    ),
  );
  writeFileSync(join(root, ".codi", "codi.yaml"), "version: 2.14\n");
}

describe("detectV2Layout", () => {
  it("returns isV2=false when no .codi/ exists", () => {
    const t = tmpRepo();
    try {
      const result = detectV2Layout(t.root);
      expect(result.isV2).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
    } finally {
      t.cleanup();
    }
  });

  it("counts artifacts from artifact-manifest.json", () => {
    const t = tmpRepo();
    try {
      seedV2(t.root);
      const result = detectV2Layout(t.root);
      expect(result.isV2).toBe(true);
      expect(result.artifactCounts).toEqual({ rules: 1, skills: 2, agents: 1 });
    } finally {
      t.cleanup();
    }
  });

  it("flags missing yaml as a warning even when manifest exists", () => {
    const t = tmpRepo();
    try {
      mkdirSync(join(t.root, ".codi"), { recursive: true });
      writeFileSync(
        join(t.root, ".codi", "artifact-manifest.json"),
        JSON.stringify({ artifacts: {} }),
      );
      const result = detectV2Layout(t.root);
      expect(result.isV2).toBe(false);
      expect(result.warnings).toContain("missing .codi/codi.yaml");
    } finally {
      t.cleanup();
    }
  });

  it("flags malformed manifest with a warning", () => {
    const t = tmpRepo();
    try {
      mkdirSync(join(t.root, ".codi"), { recursive: true });
      writeFileSync(join(t.root, ".codi", "artifact-manifest.json"), "{not json");
      writeFileSync(join(t.root, ".codi", "codi.yaml"), "x");
      const result = detectV2Layout(t.root);
      expect(result.warnings).toContain("artifact-manifest.json is not valid JSON");
    } finally {
      t.cleanup();
    }
  });
});

describe("planMigration", () => {
  it("returns canProceed=true with 5 steps for a valid v2 install", () => {
    const t = tmpRepo();
    try {
      seedV2(t.root);
      const plan = planMigration(t.root);
      expect(plan.canProceed).toBe(true);
      expect(plan.blockers).toEqual([]);
      expect(plan.steps).toHaveLength(5);
      expect(plan.steps.map((s) => s.kind)).toEqual([
        "backup_codi_dir",
        "bootstrap_brain_db",
        "rewrite_codi_yaml",
        "regenerate_per_agent_output",
        "report_summary",
      ]);
    } finally {
      t.cleanup();
    }
  });

  it("blocks when source is not v2", () => {
    const t = tmpRepo();
    try {
      const plan = planMigration(t.root);
      expect(plan.canProceed).toBe(false);
      expect(plan.blockers.some((b) => b.includes("not a recognised Codi v2 install"))).toBe(true);
    } finally {
      t.cleanup();
    }
  });

  it("blocks when the chosen backup name already exists", () => {
    const t = tmpRepo();
    try {
      seedV2(t.root);
      const backupName = ".codi.v2.backup-existing";
      mkdirSync(join(t.root, backupName), { recursive: true });
      const plan = planMigration(t.root, { backupName });
      expect(plan.canProceed).toBe(false);
      expect(plan.blockers.some((b) => b.includes("backup path already exists"))).toBe(true);
    } finally {
      t.cleanup();
    }
  });

  it("respects the requested destination mode", () => {
    const t = tmpRepo();
    try {
      seedV2(t.root);
      const plan = planMigration(t.root, { mode: "lite" });
      expect(plan.destinationMode).toBe("lite");
      expect(plan.steps.some((s) => s.description.includes("mode: lite"))).toBe(true);
    } finally {
      t.cleanup();
    }
  });
});

describe("formatPlan", () => {
  it("renders a human-readable preview when canProceed", () => {
    const t = tmpRepo();
    try {
      seedV2(t.root);
      const plan = planMigration(t.root);
      const text = formatPlan(plan);
      expect(text).toContain("Codi v2 → v3 migration plan");
      expect(text).toContain("Steps:");
      expect(text).toContain("backup_codi_dir");
      expect(text).toContain("--apply");
    } finally {
      t.cleanup();
    }
  });

  it("renders BLOCKED with the reasons when planning fails", () => {
    const t = tmpRepo();
    try {
      const plan = planMigration(t.root);
      const text = formatPlan(plan);
      expect(text).toContain("BLOCKED");
      expect(text).toContain("not a recognised Codi v2 install");
    } finally {
      t.cleanup();
    }
  });
});
