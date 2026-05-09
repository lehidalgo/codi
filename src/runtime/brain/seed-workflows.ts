/**
 * Seed `workflow_definitions` from `src/templates/workflows/*.yaml`.
 *
 * Idempotent: re-running upserts the same rows for managed_by='codi'
 * entries. user-managed entries (managed_by='user') are NEVER touched —
 * a re-init does not clobber custom workflows the user authored via
 * `codi workflow create`.
 *
 * Schema (per F1): one row per workflow type with the JSON definition
 * blob. F1 shape: { id, name, description, version, phases, flags }.
 */

import type Database from "better-sqlite3";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const HERE = dirname(fileURLToPath(import.meta.url));

interface PhaseSpec {
  readonly gates: readonly string[];
  readonly next: readonly string[];
}

export interface WorkflowDefinitionShape {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: number;
  readonly phases: Record<string, PhaseSpec>;
  readonly flags?: Record<string, unknown>;
}

export interface SeedResult {
  readonly inserted: readonly string[];
  readonly updated: readonly string[];
  readonly skipped: readonly string[]; // managed_by='user' rows preserved
}

/** Resolve the directory holding the .yaml files for both src and dist. */
function workflowsDir(override?: string): string {
  if (override) return override;
  // dist layout:  dist/runtime/brain/seed-workflows.js
  //               dist/templates/workflows/*.yaml
  // src layout:   src/runtime/brain/seed-workflows.ts
  //               src/templates/workflows/*.yaml
  const fromHere = resolve(HERE, "..", "..", "templates", "workflows");
  if (existsSync(fromHere)) return fromHere;
  return resolve(HERE, "..", "..", "..", "src", "templates", "workflows");
}

export function readBuiltinDefinitions(override?: string): readonly WorkflowDefinitionShape[] {
  const dir = workflowsDir(override);
  if (!existsSync(dir)) return [];
  const out: WorkflowDefinitionShape[] = [];
  for (const entry of readdirSync(dir)) {
    if (!entry.endsWith(".yaml")) continue;
    const full = resolve(dir, entry);
    if (!statSync(full).isFile()) continue;
    const text = readFileSync(full, "utf8");
    const parsed = parseYaml(text) as WorkflowDefinitionShape;
    validateShape(parsed, entry);
    out.push(parsed);
  }
  return out;
}

function validateShape(d: unknown, source: string): asserts d is WorkflowDefinitionShape {
  if (typeof d !== "object" || d === null) {
    throw new Error(`workflow definition ${source}: not an object`);
  }
  const x = d as Record<string, unknown>;
  for (const key of ["id", "name", "description"]) {
    if (typeof x[key] !== "string" || (x[key] as string).length === 0) {
      throw new Error(`workflow definition ${source}: missing or invalid '${key}'`);
    }
  }
  if (typeof x["version"] !== "number") {
    throw new Error(`workflow definition ${source}: 'version' must be a number`);
  }
  if (typeof x["phases"] !== "object" || x["phases"] === null) {
    throw new Error(`workflow definition ${source}: 'phases' must be an object`);
  }
}

export function seedWorkflowDefinitions(
  raw: Database.Database,
  opts: { sourceDir?: string } = {},
): SeedResult {
  const definitions = readBuiltinDefinitions(opts.sourceDir);
  const inserted: string[] = [];
  const updated: string[] = [];
  const skipped: string[] = [];

  const now = Date.now();
  const select = raw.prepare(
    `SELECT id, version, managed_by FROM workflow_definitions WHERE id = ?`,
  );
  const insert = raw.prepare(
    `INSERT INTO workflow_definitions
       (id, name, description, version, managed_by, definition, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'codi', ?, ?, ?)`,
  );
  const update = raw.prepare(
    `UPDATE workflow_definitions
       SET name = ?, description = ?, version = ?, definition = ?, updated_at = ?
     WHERE id = ? AND managed_by = 'codi'`,
  );

  const txn = raw.transaction(() => {
    for (const def of definitions) {
      const row = select.get(def.id) as
        | { id: string; version: number; managed_by: string }
        | undefined;
      const blob = JSON.stringify(def);
      if (!row) {
        insert.run(def.id, def.name, def.description, def.version, blob, now, now);
        inserted.push(def.id);
      } else if (row.managed_by === "user") {
        skipped.push(def.id);
      } else {
        update.run(def.name, def.description, def.version, blob, now, def.id);
        updated.push(def.id);
      }
    }
  });
  txn();

  return { inserted, updated, skipped };
}
