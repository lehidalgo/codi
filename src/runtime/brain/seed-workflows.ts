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
 *
 * CORE-017: public API surface (`readBuiltinDefinitions`,
 * `seedWorkflowDefinitions`) returns `Result<…, ProjectError[]>`. Inner
 * `validateShape`/`validatePhaseChains`/`validateChainEntry` keep their
 * `asserts` type-narrowing semantics by throwing; the throws are caught
 * at the module boundary and mapped to `E_WORKFLOW_DEFINITION_INVALID`.
 */

import type Database from "better-sqlite3";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { err, ok, type Result } from "#src/types/result.js";
import { createError } from "#src/core/output/errors.js";
import type { ProjectError } from "#src/core/output/types.js";

const HERE = dirname(fileURLToPath(import.meta.url));

export type ChainRole = "required" | "alt-entry" | "optional";

export const CHAIN_ROLES: readonly ChainRole[] = ["required", "alt-entry", "optional"] as const;

export interface ChainEntry {
  readonly skill: string;
  readonly role: ChainRole;
  readonly hint?: string;
}

interface PhaseSpec {
  readonly gates: readonly string[];
  readonly next: readonly string[];
  readonly chains?: readonly ChainEntry[];
}

export interface WorkflowDefinitionShape {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: number;
  readonly phases: Record<string, PhaseSpec>;
  readonly flags?: Record<string, unknown>;
  /**
   * Q12: when explicitly false, the phase-ref generator skips this workflow.
   * Default behaviour (undefined or true) is to regenerate. Users override by
   * setting `auto_generate_phase_refs: false` in their workflow yaml when
   * they need the on-disk phase-*.md files to remain manually authored.
   */
  readonly auto_generate_phase_refs?: boolean;
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

export function readBuiltinDefinitions(
  override?: string,
): Result<readonly WorkflowDefinitionShape[], ProjectError[]> {
  const dir = workflowsDir(override);
  if (!existsSync(dir)) return ok([]);
  const out: WorkflowDefinitionShape[] = [];
  for (const entry of readdirSync(dir)) {
    if (!entry.endsWith(".yaml")) continue;
    const full = resolve(dir, entry);
    if (!statSync(full).isFile()) continue;
    const text = readFileSync(full, "utf8");
    const parsed = parseYaml(text) as WorkflowDefinitionShape;
    try {
      validateShape(parsed, entry);
    } catch (e) {
      const message = e instanceof Error ? e.message.replace(/^workflow definition [^:]+:\s*/, "") : String(e);
      return err([createError("E_WORKFLOW_DEFINITION_INVALID", { source: entry, message })]);
    }
    out.push(parsed);
  }
  return ok(out);
}

// Internal throwing assertion: `asserts d is …` requires throw semantics.
// CORE-017 — these throws are caught at the public API boundary
// (`readBuiltinDefinitions`) and mapped to `E_WORKFLOW_DEFINITION_INVALID`.
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
  if (
    x["auto_generate_phase_refs"] !== undefined &&
    typeof x["auto_generate_phase_refs"] !== "boolean"
  ) {
    throw new Error(
      `workflow definition ${source}: 'auto_generate_phase_refs' must be boolean when present`,
    );
  }
  validatePhaseChains(x["phases"] as Record<string, unknown>, source);
}

function validatePhaseChains(phases: Record<string, unknown>, source: string): void {
  for (const [phaseName, phaseSpec] of Object.entries(phases)) {
    if (typeof phaseSpec !== "object" || phaseSpec === null) continue;
    const chains = (phaseSpec as Record<string, unknown>)["chains"];
    if (chains === undefined) continue;
    if (!Array.isArray(chains)) {
      throw new Error(
        `workflow definition ${source}: phase '${phaseName}' chains must be an array`,
      );
    }
    chains.forEach((entry, idx) => validateChainEntry(entry, source, phaseName, idx));
  }
}

function validateChainEntry(
  entry: unknown,
  source: string,
  phaseName: string,
  idx: number,
): asserts entry is ChainEntry {
  const where = `workflow definition ${source}: phase '${phaseName}' chains[${idx}]`;
  if (typeof entry !== "object" || entry === null) {
    throw new Error(`${where}: must be an object`);
  }
  const e = entry as Record<string, unknown>;
  if (typeof e["skill"] !== "string" || (e["skill"] as string).length === 0) {
    throw new Error(`${where}: 'skill' must be a non-empty string`);
  }
  if (typeof e["role"] !== "string" || !CHAIN_ROLES.includes(e["role"] as ChainRole)) {
    throw new Error(
      `${where}: 'role' must be one of ${CHAIN_ROLES.join(", ")}, got ${String(e["role"])}`,
    );
  }
  if (e["hint"] !== undefined && typeof e["hint"] !== "string") {
    throw new Error(`${where}: 'hint' must be a string when present`);
  }
  // Q11 invariant: alt-entry and optional MUST carry a hint
  const role = e["role"] as ChainRole;
  if ((role === "alt-entry" || role === "optional") && typeof e["hint"] !== "string") {
    throw new Error(`${where}: role '${role}' requires a 'hint' string`);
  }
}

export function seedWorkflowDefinitions(
  raw: Database.Database,
  opts: { sourceDir?: string } = {},
): Result<SeedResult, ProjectError[]> {
  const definitionsResult = readBuiltinDefinitions(opts.sourceDir);
  if (!definitionsResult.ok) return definitionsResult;
  const definitions = definitionsResult.data;
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

  return ok({ inserted, updated, skipped });
}
