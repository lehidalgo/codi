/**
 * Phase-ref chain section renderer (F2 plan §Q11).
 *
 * Pure function: takes a list of `ChainEntry` from the workflow definition
 * and emits the auto-generated section that lives between BEGIN/END
 * markers inside `references/phase-<name>.md`.
 *
 * The 3 role templates map 1:1 to the verbs already used in current
 * phase-refs ("MUST invoke", "Alternatively", "Optionally"). Hints from
 * the yaml become the conjunction tail.
 *
 * Hash protection (Q6): callers compute SHA-256 over the rendered output
 * to detect drift inside the markers at build time.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ChainEntry, ChainRole, WorkflowDefinitionShape } from "./seed-workflows.js";

export const CHAIN_BLOCK_BEGIN = "<!-- BEGIN auto-generated chain — DO NOT EDIT -->";
export const CHAIN_BLOCK_END = "<!-- END auto-generated chain -->";

type RoleTemplate = (skill: string, hint: string | undefined) => string;

const TEMPLATES = {
  required: (skill, hint) =>
    hint === undefined
      ? `You **MUST** invoke \`codi:${skill}\`.`
      : `You **MUST** invoke \`codi:${skill}\` (${hint}).`,
  "alt-entry": (skill, hint) => `Alternatively, invoke \`codi:${skill}\` if ${hint}.`,
  optional: (skill, hint) => `Optionally, invoke \`codi:${skill}\` when ${hint}.`,
} as const satisfies Record<ChainRole, RoleTemplate>;

export function renderChainLine(entry: ChainEntry): string {
  const template = TEMPLATES[entry.role];
  // Q11 invariant — already enforced by validator: alt-entry and optional
  // require a hint. The runtime check guards against bypass paths.
  if (entry.role !== "required" && entry.hint === undefined) {
    throw new Error(`renderChainLine: role '${entry.role}' requires a hint (skill=${entry.skill})`);
  }
  return `- ${template(entry.skill, entry.hint)}`;
}

export function renderChainSection(chains: readonly ChainEntry[]): string {
  if (chains.length === 0) {
    return [
      CHAIN_BLOCK_BEGIN,
      "",
      "## Chain skills",
      "",
      "_No chained skills declared for this phase._",
      "",
      CHAIN_BLOCK_END,
    ].join("\n");
  }
  const lines = chains.map(renderChainLine);
  return [CHAIN_BLOCK_BEGIN, "", "## Chain skills", "", ...lines, "", CHAIN_BLOCK_END].join("\n");
}

/**
 * SHA-256 of the rendered section. Stable across whitespace-equivalent
 * outputs because the renderer itself is deterministic. Build pipeline
 * compares this hash against the hash of the BEGIN..END block found in
 * the on-disk phase-ref to detect drift inside the markers.
 */
export function chainSectionHash(rendered: string): string {
  return createHash("sha256").update(rendered, "utf8").digest("hex");
}

/**
 * Extract the content between the BEGIN and END markers from an existing
 * markdown file. Returns null if either marker is missing. Used by the
 * build step to compute the on-disk hash.
 */
export function extractChainBlock(markdown: string): string | null {
  const beginIdx = markdown.indexOf(CHAIN_BLOCK_BEGIN);
  const endIdx = markdown.indexOf(CHAIN_BLOCK_END);
  if (beginIdx === -1 || endIdx === -1 || endIdx < beginIdx) return null;
  return markdown.slice(beginIdx, endIdx + CHAIN_BLOCK_END.length);
}

const TERMINAL_PHASES = new Set(["done", "abandoned"]);

const WORKFLOW_DIR_BY_ID: Record<string, string> = {
  feature: "feature-workflow",
  "bug-fix": "bug-fix-workflow",
  refactor: "refactor-workflow",
  migration: "migration-workflow",
  project: "project-workflow",
};

export interface PhaseRefDriftDetail {
  readonly path: string;
  readonly expectedHash: string;
  readonly foundHash: string;
}

export interface PhaseRefGenResult {
  readonly written: readonly string[];
  readonly skippedOptOut: readonly string[];
  readonly skippedNoChange: readonly string[];
  readonly missingMd: readonly string[];
  readonly missingMarkers: readonly string[];
  readonly drift: readonly PhaseRefDriftDetail[];
}

export interface PhaseRefGenOptions {
  readonly skillsRoot: string;
  /**
   * When true, drift INSIDE the BEGIN/END block (manual edits to the
   * auto-generated section) is repaired by overwriting with the regenerated
   * content. Default false: drift is reported in `drift` and the file is
   * left untouched so the caller can fail the build (Q6).
   */
  readonly force?: boolean;
}

/**
 * Walk every workflow → phase pair, regenerate the chain block, and either
 * write the file (no drift, content out of date) or report drift (Q6 build
 * error path). Pure I/O — no console, no process.exit; the caller decides.
 */
export function regeneratePhaseRefs(
  workflows: readonly WorkflowDefinitionShape[],
  opts: PhaseRefGenOptions,
): PhaseRefGenResult {
  const written: string[] = [];
  const skippedOptOut: string[] = [];
  const skippedNoChange: string[] = [];
  const missingMd: string[] = [];
  const missingMarkers: string[] = [];
  const drift: PhaseRefDriftDetail[] = [];

  for (const wf of workflows) {
    if (wf.auto_generate_phase_refs === false) {
      skippedOptOut.push(wf.id);
      continue;
    }
    const dirName = WORKFLOW_DIR_BY_ID[wf.id];
    if (dirName === undefined) continue;
    const refsDir = resolve(opts.skillsRoot, dirName, "references");

    for (const [phaseName, spec] of Object.entries(wf.phases)) {
      if (TERMINAL_PHASES.has(phaseName)) continue;
      const mdPath = resolve(refsDir, `phase-${phaseName}.md`);
      if (!existsSync(mdPath)) {
        missingMd.push(`${wf.id}.${phaseName}`);
        continue;
      }
      const md = readFileSync(mdPath, "utf8");
      const currentBlock = extractChainBlock(md);
      if (currentBlock === null) {
        missingMarkers.push(`${wf.id}.${phaseName}`);
        continue;
      }
      const expected = renderChainSection(spec.chains ?? []);
      const expectedHash = chainSectionHash(expected);
      const foundHash = chainSectionHash(currentBlock);

      if (expectedHash === foundHash) {
        skippedNoChange.push(`${wf.id}.${phaseName}`);
        continue;
      }

      if (opts.force !== true) {
        drift.push({ path: mdPath, expectedHash, foundHash });
        continue;
      }

      const updated = md.replace(currentBlock, expected);
      writeFileSync(mdPath, updated);
      written.push(`${wf.id}.${phaseName}`);
    }
  }

  return { written, skippedOptOut, skippedNoChange, missingMd, missingMarkers, drift };
}
