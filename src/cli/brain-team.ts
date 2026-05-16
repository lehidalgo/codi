/**
 * ISSUE-055 — team-consolidation CLI shortcuts.
 *
 * Two thin commands that close the friction loop the team-consolidation
 * workflow expects:
 *
 *   `codi brain export-for-team --to <path>`
 *     Each dev runs this on their machine. It copies the live brain.db into
 *     `<path>/<actor_id>/brain.db`, ready to be handed to the team lead.
 *
 *   `codi brain team-check <dir>`
 *     The lead runs this against the shared directory before starting
 *     `codi run team-consolidation`. It pre-validates every candidate file
 *     (schema-version probe per phase-collect.md) and surfaces the inventory
 *     so the `brains_listed` / `dev_layout_validated` gates fire on a clean
 *     corpus.
 *
 * Neither command mutates the source brains.
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { Logger } from "../core/output/logger.js";
import { createCommandResult } from "../core/output/formatter.js";
import { EXIT_CODES } from "../core/output/exit-codes.js";
import { defaultBrainPath, openBrain } from "#src/runtime/brain/db.js";
import { resolveActorId } from "#src/core/audit/resolve-actor.js";
import type { CommandResult } from "../core/output/types.js";

export interface BrainExportForTeamFlags {
  readonly to: string;
  readonly brainPath?: string;
}

export interface BrainExportForTeamData {
  readonly actorId: string;
  readonly source: string;
  readonly destination: string;
  readonly sizeBytes: number;
  readonly sessions: number;
}

export async function brainExportForTeamHandler(
  flags: BrainExportForTeamFlags,
): Promise<CommandResult<BrainExportForTeamData>> {
  const log = Logger.getInstance();
  const emptyData: BrainExportForTeamData = {
    actorId: "",
    source: "",
    destination: "",
    sizeBytes: 0,
    sessions: 0,
  };
  if (!flags.to || flags.to.length === 0) {
    return createCommandResult({
      success: false,
      command: "brain export-for-team",
      data: emptyData,
      errors: [
        {
          code: "E_BRAIN_EXPORT_MISSING_TO",
          message: "--to <path> is required",
          hint: "Pass --to <directory> pointing at the shared team-brains folder.",
          severity: "error",
          context: {},
        },
      ],
      exitCode: EXIT_CODES.FLAG_CONFLICT,
    });
  }
  const source = flags.brainPath ? resolve(flags.brainPath) : defaultBrainPath();
  if (!existsSync(source)) {
    return createCommandResult({
      success: false,
      command: "brain export-for-team",
      data: emptyData,
      errors: [
        {
          code: "E_BRAIN_EXPORT_SOURCE_NOT_FOUND",
          message: `Brain DB not found at ${source}`,
          hint: "Use --brain-path to override, or run any codi command once to seed the brain.",
          severity: "error",
          context: { source },
        },
      ],
      exitCode: EXIT_CODES.CONFIG_NOT_FOUND,
    });
  }
  const actorId = resolveActorId();
  const actorSlug = actorIdToSlug(actorId);
  const destDir = resolve(flags.to, actorSlug);
  mkdirSync(destDir, { recursive: true });
  const destination = join(destDir, "brain.db");
  copyFileSync(source, destination);

  let sessions = 0;
  const handle = openBrain({ dbPath: destination, readonly: true });
  try {
    const row = handle.raw.prepare("SELECT COUNT(*) AS n FROM sessions").get() as { n: number };
    sessions = row.n;
  } finally {
    handle.close();
  }
  const sizeBytes = statSync(destination).size;
  log.info(`Exported brain → ${destination}`);
  return createCommandResult({
    success: true,
    command: "brain export-for-team",
    data: { actorId, source, destination, sizeBytes, sessions },
    exitCode: EXIT_CODES.SUCCESS,
  });
}

export interface BrainTeamCheckFlags {
  readonly dir: string;
}

export interface BrainCandidateReport {
  readonly devId: string;
  readonly path: string;
  readonly valid: boolean;
  readonly schemaVersion?: number;
  readonly projects?: number;
  readonly sessions?: number;
  readonly error?: string;
}

export interface BrainTeamCheckData {
  readonly dir: string;
  readonly valid: number;
  readonly invalid: number;
  readonly candidates: ReadonlyArray<BrainCandidateReport>;
}

export async function brainTeamCheckHandler(
  flags: BrainTeamCheckFlags,
): Promise<CommandResult<BrainTeamCheckData>> {
  const emptyData: BrainTeamCheckData = { dir: "", valid: 0, invalid: 0, candidates: [] };
  if (!flags.dir || flags.dir.length === 0) {
    return createCommandResult({
      success: false,
      command: "brain team-check",
      data: emptyData,
      errors: [
        {
          code: "E_BRAIN_TEAM_CHECK_MISSING_DIR",
          message: "<dir> argument is required",
          hint: "Pass the directory holding each dev's exported brain.db.",
          severity: "error",
          context: {},
        },
      ],
      exitCode: EXIT_CODES.FLAG_CONFLICT,
    });
  }
  const root = resolve(flags.dir);
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    return createCommandResult({
      success: false,
      command: "brain team-check",
      data: emptyData,
      errors: [
        {
          code: "E_BRAIN_TEAM_CHECK_DIR_NOT_FOUND",
          message: `Directory not found: ${root}`,
          hint: "Verify the path exists. Use absolute paths for predictability.",
          severity: "error",
          context: { dir: root },
        },
      ],
      exitCode: EXIT_CODES.CONFIG_NOT_FOUND,
    });
  }
  const candidates: BrainCandidateReport[] = [];
  for (const file of findDbFiles(root)) {
    candidates.push(probeBrain(file));
  }
  const valid = candidates.filter((c) => c.valid).length;
  const invalid = candidates.length - valid;
  return createCommandResult({
    success: true,
    command: "brain team-check",
    data: { dir: root, valid, invalid, candidates },
    exitCode: EXIT_CODES.SUCCESS,
  });
}

function findDbFiles(root: string, depth = 0): string[] {
  if (depth > 4) return [];
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      out.push(...findDbFiles(full, depth + 1));
    } else if (entry.isFile() && entry.name.endsWith(".db")) {
      out.push(full);
    }
  }
  return out;
}

function probeBrain(file: string): BrainCandidateReport {
  const devId = basename(dirname(file));
  try {
    const handle = openBrain({ dbPath: file, readonly: true });
    try {
      const versionRow = handle.raw
        .prepare("SELECT MAX(version) AS v FROM _codi_schema_version")
        .get() as { v: number | null };
      if (versionRow.v === null) {
        return {
          devId,
          path: file,
          valid: false,
          error: "_codi_schema_version table is empty",
        };
      }
      const projects = (
        handle.raw.prepare("SELECT COUNT(*) AS n FROM projects").get() as {
          n: number;
        }
      ).n;
      const sessions = (
        handle.raw.prepare("SELECT COUNT(*) AS n FROM sessions").get() as {
          n: number;
        }
      ).n;
      return {
        devId,
        path: file,
        valid: true,
        schemaVersion: versionRow.v,
        projects,
        sessions,
      };
    } finally {
      handle.close();
    }
  } catch (e) {
    return {
      devId,
      path: file,
      valid: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Convert a `<type>:<id>` actor string into a filesystem-safe directory name.
 * Strips the type prefix and replaces unsafe chars; falls back to "unknown"
 * for fully-stripped output.
 */
function actorIdToSlug(actorId: string): string {
  const colon = actorId.indexOf(":");
  const tail = colon === -1 ? actorId : actorId.slice(colon + 1);
  const slug = tail.replace(/[^a-zA-Z0-9._-]/g, "_");
  return slug.length > 0 ? slug : "unknown";
}

/** Test-only — exposed for table-row inspection of the validator. */
export const _internals = { actorIdToSlug, findDbFiles, probeBrain };
