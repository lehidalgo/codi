/**
 * Seeder for workflow_definitions (F2 of v3 zero closure).
 */
import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  openBrain,
  applyMigrations,
  seedWorkflowDefinitions,
  readBuiltinDefinitions,
} from "#src/runtime/brain/index.js";

function tmpBrain() {
  const dir = mkdtempSync(join(tmpdir(), "codi-seed-wf-"));
  const handle = openBrain({ dbPath: join(dir, "brain.db") });
  applyMigrations(handle.raw);
  return {
    handle,
    cleanup: () => {
      handle.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

function tmpYamls(yamls: Record<string, string>): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "codi-seed-yaml-"));
  for (const [name, content] of Object.entries(yamls)) {
    writeFileSync(join(dir, name), content);
  }
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

describe("readBuiltinDefinitions", () => {
  it("loads all 5 builtin workflow YAMLs", () => {
    const defs = readBuiltinDefinitions();
    const ids = defs.map((d) => d.id).sort();
    expect(ids).toEqual(["bug-fix", "feature", "migration", "project", "refactor"]);
  });

  it("each definition has required fields", () => {
    const defs = readBuiltinDefinitions();
    for (const d of defs) {
      expect(d.id).toBeTruthy();
      expect(d.name).toBeTruthy();
      expect(d.description).toBeTruthy();
      expect(d.version).toBe(1);
      expect(typeof d.phases).toBe("object");
      expect(Object.keys(d.phases).length).toBeGreaterThan(0);
    }
  });

  it("rejects malformed YAML with a clear error", () => {
    const t = tmpYamls({ "bad.yaml": "not: a workflow\n" });
    try {
      expect(() => readBuiltinDefinitions(t.dir)).toThrow(/missing or invalid 'id'/);
    } finally {
      t.cleanup();
    }
  });
});

describe("seedWorkflowDefinitions", () => {
  it("inserts 5 codi-managed rows on a fresh brain", () => {
    const t = tmpBrain();
    try {
      const r = seedWorkflowDefinitions(t.handle.raw);
      expect(r.inserted.sort()).toEqual(["bug-fix", "feature", "migration", "project", "refactor"]);
      expect(r.updated).toEqual([]);
      expect(r.skipped).toEqual([]);
      const count = (
        t.handle.raw.prepare("SELECT COUNT(*) as c FROM workflow_definitions").get() as {
          c: number;
        }
      ).c;
      expect(count).toBe(5);
    } finally {
      t.cleanup();
    }
  });

  it("re-running upserts codi-managed rows (no duplicates, updated)", () => {
    const t = tmpBrain();
    try {
      seedWorkflowDefinitions(t.handle.raw);
      const r2 = seedWorkflowDefinitions(t.handle.raw);
      expect(r2.inserted).toEqual([]);
      expect(r2.updated.sort()).toEqual(["bug-fix", "feature", "migration", "project", "refactor"]);
      expect(r2.skipped).toEqual([]);
    } finally {
      t.cleanup();
    }
  });

  it("preserves user-managed rows on re-seed", () => {
    const t = tmpBrain();
    try {
      // Pre-existing user row with same id as a builtin — must be skipped.
      const now = Date.now();
      t.handle.raw
        .prepare(
          `INSERT INTO workflow_definitions
             (id, name, description, version, managed_by, definition, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'user', ?, ?, ?)`,
        )
        .run("feature", "Custom Feature", "user override", 99, "{}", now, now);

      const r = seedWorkflowDefinitions(t.handle.raw);
      expect(r.skipped).toContain("feature");
      expect(r.inserted.sort()).toEqual(["bug-fix", "migration", "project", "refactor"]);

      const stillUser = t.handle.raw
        .prepare(`SELECT name, version FROM workflow_definitions WHERE id = 'feature'`)
        .get() as { name: string; version: number };
      expect(stillUser.name).toBe("Custom Feature");
      expect(stillUser.version).toBe(99);
    } finally {
      t.cleanup();
    }
  });

  it("definition column round-trips JSON shape", () => {
    const t = tmpBrain();
    try {
      seedWorkflowDefinitions(t.handle.raw);
      const row = t.handle.raw
        .prepare(`SELECT definition FROM workflow_definitions WHERE id = 'feature'`)
        .get() as { definition: string };
      const parsed = JSON.parse(row.definition);
      expect(parsed.id).toBe("feature");
      expect(parsed.phases.intent.next).toContain("plan");
      expect(parsed.phases.verify.gates).toContain("validation_passes");
    } finally {
      t.cleanup();
    }
  });
});
