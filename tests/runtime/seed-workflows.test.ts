/**
 * Seeder for workflow_definitions (F2 of v3 zero closure).
 */
import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openBrain } from "#src/runtime/brain/db.js";
import { applyMigrations } from "#src/runtime/brain/migrate.js";
import {
  seedWorkflowDefinitions,
  readBuiltinDefinitions,
} from "#src/runtime/brain/seed-workflows.js";
import { unwrap } from "./_brain-helper.js";

function tmpBrain() {
  const dir = mkdtempSync(join(tmpdir(), "codi-seed-wf-"));
  const handle = openBrain({ dbPath: join(dir, "brain.db") });
  applyMigrations(handle.raw);
  // applyMigrations now auto-seeds `workflow_definitions` from the built-in
  // YAMLs (so the brain is usable end-to-end). These tests exercise the
  // seedWorkflowDefinitions function in isolation, so clear the table to
  // get back to the pre-seed state every test expects.
  handle.raw.prepare("DELETE FROM workflow_definitions").run();
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

function expectInvalidDefinition(dir: string, pattern: RegExp): void {
  const r = readBuiltinDefinitions(dir);
  expect(r.ok).toBe(false);
  if (!r.ok) {
    expect(r.errors[0]?.code).toBe("E_WORKFLOW_DEFINITION_INVALID");
    expect(r.errors[0]?.message).toMatch(pattern);
  }
}

describe("readBuiltinDefinitions", () => {
  it("loads all 7 builtin workflow YAMLs", () => {
    const defs = unwrap(readBuiltinDefinitions());
    const ids = defs.map((d) => d.id).sort();
    expect(ids).toEqual([
      "bug-fix",
      "feature",
      "migration",
      "project",
      "quick",
      "refactor",
      "team-consolidation",
    ]);
  });

  it("each definition has required fields", () => {
    const defs = unwrap(readBuiltinDefinitions());
    for (const d of defs) {
      expect(d.id).toBeTruthy();
      expect(d.name).toBeTruthy();
      expect(d.description).toBeTruthy();
      expect(d.version).toBeGreaterThanOrEqual(1);
      expect(typeof d.phases).toBe("object");
      expect(Object.keys(d.phases).length).toBeGreaterThan(0);
    }
  });

  it("rejects malformed YAML with a clear error", () => {
    const t = tmpYamls({ "bad.yaml": "not: a workflow\n" });
    try {
      expectInvalidDefinition(t.dir, /missing or invalid 'id'/);
    } finally {
      t.cleanup();
    }
  });
});

describe("validateShape — chains: per phase", () => {
  const baseHeader = `id: t1
name: T1
description: test
version: 1
phases:
`;

  it("accepts a phase with no chains field (backward compat)", () => {
    const t = tmpYamls({
      "ok.yaml": `${baseHeader}  intent: { gates: [], next: [done] }
  done: { gates: [], next: [] }
`,
    });
    try {
      const r = readBuiltinDefinitions(t.dir);
      expect(r.ok).toBe(true);
    } finally {
      t.cleanup();
    }
  });

  it("accepts required role without hint", () => {
    const t = tmpYamls({
      "ok.yaml": `${baseHeader}  intent:
    gates: []
    next: [done]
    chains:
      - { skill: discover, role: required }
  done: { gates: [], next: [] }
`,
    });
    try {
      const r = readBuiltinDefinitions(t.dir);
      expect(r.ok).toBe(true);
    } finally {
      t.cleanup();
    }
  });

  it("accepts alt-entry and optional with hint", () => {
    const t = tmpYamls({
      "ok.yaml": `${baseHeader}  intent:
    gates: []
    next: [done]
    chains:
      - { skill: discover, role: required }
      - { skill: brainstorming, role: alt-entry, hint: "no workflow context" }
      - { skill: step-documenter, role: optional, hint: "domain terms emerge" }
  done: { gates: [], next: [] }
`,
    });
    try {
      const r = readBuiltinDefinitions(t.dir);
      expect(r.ok).toBe(true);
    } finally {
      t.cleanup();
    }
  });

  it("rejects unknown role", () => {
    const t = tmpYamls({
      "bad.yaml": `${baseHeader}  intent:
    gates: []
    next: [done]
    chains:
      - { skill: discover, role: mandatory }
  done: { gates: [], next: [] }
`,
    });
    try {
      expectInvalidDefinition(t.dir, /'role' must be one of/);
    } finally {
      t.cleanup();
    }
  });

  it("rejects alt-entry without hint", () => {
    const t = tmpYamls({
      "bad.yaml": `${baseHeader}  intent:
    gates: []
    next: [done]
    chains:
      - { skill: brainstorming, role: alt-entry }
  done: { gates: [], next: [] }
`,
    });
    try {
      expectInvalidDefinition(t.dir, /role 'alt-entry' requires a 'hint' string/);
    } finally {
      t.cleanup();
    }
  });

  it("rejects optional without hint", () => {
    const t = tmpYamls({
      "bad.yaml": `${baseHeader}  intent:
    gates: []
    next: [done]
    chains:
      - { skill: step-documenter, role: optional }
  done: { gates: [], next: [] }
`,
    });
    try {
      expectInvalidDefinition(t.dir, /role 'optional' requires a 'hint' string/);
    } finally {
      t.cleanup();
    }
  });

  it("rejects empty skill name", () => {
    const t = tmpYamls({
      "bad.yaml": `${baseHeader}  intent:
    gates: []
    next: [done]
    chains:
      - { skill: "", role: required }
  done: { gates: [], next: [] }
`,
    });
    try {
      expectInvalidDefinition(t.dir, /'skill' must be a non-empty string/);
    } finally {
      t.cleanup();
    }
  });

  it("rejects chains that is not an array", () => {
    const t = tmpYamls({
      "bad.yaml": `${baseHeader}  intent:
    gates: []
    next: [done]
    chains: "not-an-array"
  done: { gates: [], next: [] }
`,
    });
    try {
      expectInvalidDefinition(t.dir, /chains must be an array/);
    } finally {
      t.cleanup();
    }
  });

  it("rejects non-string hint when present", () => {
    const t = tmpYamls({
      "bad.yaml": `${baseHeader}  intent:
    gates: []
    next: [done]
    chains:
      - { skill: discover, role: required, hint: 123 }
  done: { gates: [], next: [] }
`,
    });
    try {
      expectInvalidDefinition(t.dir, /'hint' must be a string when present/);
    } finally {
      t.cleanup();
    }
  });

  it("error includes phase name and chain index for diagnosability", () => {
    const t = tmpYamls({
      "bad.yaml": `${baseHeader}  plan:
    gates: []
    next: [done]
    chains:
      - { skill: discover, role: required }
      - { skill: x, role: alt-entry }
  done: { gates: [], next: [] }
`,
    });
    try {
      expectInvalidDefinition(t.dir, /phase 'plan' chains\[1\]/);
    } finally {
      t.cleanup();
    }
  });
});

describe("seedWorkflowDefinitions", () => {
  it("inserts 7 codi-managed rows on a fresh brain", () => {
    const t = tmpBrain();
    try {
      const r = unwrap(seedWorkflowDefinitions(t.handle.raw));
      expect(r.inserted.slice().sort()).toEqual([
        "bug-fix",
        "feature",
        "migration",
        "project",
        "quick",
        "refactor",
        "team-consolidation",
      ]);
      expect(r.updated).toEqual([]);
      expect(r.skipped).toEqual([]);
      const count = (
        t.handle.raw.prepare("SELECT COUNT(*) as c FROM workflow_definitions").get() as {
          c: number;
        }
      ).c;
      expect(count).toBe(7);
    } finally {
      t.cleanup();
    }
  });

  it("re-running upserts codi-managed rows (no duplicates, updated)", () => {
    const t = tmpBrain();
    try {
      unwrap(seedWorkflowDefinitions(t.handle.raw));
      const r2 = unwrap(seedWorkflowDefinitions(t.handle.raw));
      expect(r2.inserted).toEqual([]);
      expect(r2.updated.slice().sort()).toEqual([
        "bug-fix",
        "feature",
        "migration",
        "project",
        "quick",
        "refactor",
        "team-consolidation",
      ]);
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

      const r = unwrap(seedWorkflowDefinitions(t.handle.raw));
      expect(r.skipped).toContain("feature");
      expect(r.inserted.slice().sort()).toEqual([
        "bug-fix",
        "migration",
        "project",
        "quick",
        "refactor",
        "team-consolidation",
      ]);

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
      unwrap(seedWorkflowDefinitions(t.handle.raw));
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
