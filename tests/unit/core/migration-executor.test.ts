/**
 * v2-to-v3 migration executor (Sprint 7.b).
 */
import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { executeMigration } from "#src/core/migration/executor.js";
import { planMigration } from "#src/core/migration/v2-to-v3.js";
function tmpRepo(): { root: string; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), "codi-exec-"));
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

function seedV2(root: string): void {
  mkdirSync(join(root, ".codi"), { recursive: true });
  writeFileSync(
    join(root, ".codi", "artifact-manifest.json"),
    JSON.stringify({ artifacts: { "codi-x": { type: "rule" } } }),
  );
  writeFileSync(join(root, ".codi", "codi.yaml"), "mode: zero\nversion: 2.14\n");
}

describe("executeMigration — dry-run", () => {
  it("records every step as skipped without touching disk", () => {
    const t = tmpRepo();
    try {
      seedV2(t.root);
      const plan = planMigration(t.root, { mode: "lite" });
      const result = executeMigration({ plan, repoRoot: t.root, dryRun: true });
      expect(result.success).toBe(true);
      expect(result.steps).toHaveLength(5);
      const yaml = readFileSync(join(t.root, ".codi", "codi.yaml"), "utf8");
      expect(yaml).toContain("mode: zero"); // unchanged
      expect(existsSync(plan.backupPath)).toBe(false);
    } finally {
      t.cleanup();
    }
  });
});

describe("executeMigration — apply", () => {
  it("backs up .codi/ then rewrites codi.yaml mode", () => {
    const t = tmpRepo();
    try {
      seedV2(t.root);
      const plan = planMigration(t.root, { mode: "standard" });
      const result = executeMigration({ plan, repoRoot: t.root });
      expect(result.success).toBe(true);
      expect(existsSync(plan.backupPath)).toBe(true);
      expect(existsSync(join(plan.backupPath, "codi.yaml"))).toBe(true);
      const yaml = readFileSync(join(t.root, ".codi", "codi.yaml"), "utf8");
      expect(yaml).toContain("mode: standard");
      expect(yaml).not.toContain("mode: zero");
    } finally {
      t.cleanup();
    }
  });

  it("aborts when the plan is blocked", () => {
    const t = tmpRepo();
    try {
      const plan = planMigration(t.root); // no .codi/ → blocked
      const result = executeMigration({ plan, repoRoot: t.root });
      expect(result.success).toBe(false);
      expect(result.aborted).toBe(true);
      expect(result.abortReason).toContain("plan blocked");
    } finally {
      t.cleanup();
    }
  });

  it("preserves the original yaml content under the backup path", () => {
    const t = tmpRepo();
    try {
      seedV2(t.root);
      const plan = planMigration(t.root, { mode: "lite" });
      executeMigration({ plan, repoRoot: t.root });
      const backupYaml = readFileSync(join(plan.backupPath, "codi.yaml"), "utf8");
      expect(backupYaml).toContain("mode: zero");
    } finally {
      t.cleanup();
    }
  });
});
