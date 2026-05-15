/**
 * ISSUE-089 — `codi team join <source>` wizard.
 *
 * Pulls another team member's `.codi/` directory and merges it into
 * the local one via the canonical conflict resolver. The source can
 * be:
 *   - A local directory: `codi team join ../colleague-repo`
 *   - A git repo: `codi team join github:org/repo` (or any spec the
 *     `connectGithubRepo` connector accepts).
 *
 * No data outside `.codi/` is touched. The team_id stamp from
 * ISSUE-053 is preserved on rows the local capture pipeline writes
 * after the join — this command is config-only.
 */

import type { Command } from "commander";
import { resolve, dirname } from "node:path";
import { existsSync, statSync } from "node:fs";
import { writeFile, mkdir } from "node:fs/promises";
import { Logger } from "../core/output/logger.js";
import { createCommandResult } from "../core/output/formatter.js";
import { EXIT_CODES } from "../core/output/exit-codes.js";
import { initFromOptions, handleOutput, type GlobalOptions } from "./shared.js";
import { PROJECT_DIR } from "#src/constants.js";
import { resolveConflicts } from "#src/utils/conflict-resolver.js";
import { collectCodiDirConflicts } from "#src/utils/codi-dir-diff.js";
import { connectLocalDirectory, connectGithubRepo } from "#src/core/external-source/connectors.js";
import type { CommandResult } from "../core/output/types.js";

export interface TeamJoinFlags {
  readonly force?: boolean;
  readonly keepCurrent?: boolean;
}

export interface TeamJoinData {
  readonly source: string;
  readonly accepted: number;
  readonly skipped: number;
  readonly merged: number;
}

export async function teamJoinHandler(
  projectRoot: string,
  sourceSpec: string,
  flags: TeamJoinFlags,
): Promise<CommandResult<TeamJoinData>> {
  const log = Logger.getInstance();
  const localCodiDir = resolve(projectRoot, PROJECT_DIR);
  if (!existsSync(localCodiDir) || !statSync(localCodiDir).isDirectory()) {
    return createCommandResult({
      success: false,
      command: "team join",
      data: { source: sourceSpec, accepted: 0, skipped: 0, merged: 0 },
      errors: [
        {
          code: "E_TEAM_JOIN_LOCAL_MISSING",
          message: `Local ${PROJECT_DIR}/ not found at ${localCodiDir}`,
          hint: `Run \`codi init\` first to create the project's ${PROJECT_DIR}/ tree.`,
          severity: "error",
          context: { localCodiDir },
        },
      ],
      exitCode: EXIT_CODES.CONFIG_NOT_FOUND,
    });
  }

  // ISSUE-088 / ISSUE-089 — feed the source through the existing external
  // connectors so local paths, zips, and github repos all work.
  const isLocalDir = existsSync(sourceSpec) && statSync(sourceSpec).isDirectory();
  const source = isLocalDir
    ? await connectLocalDirectory(sourceSpec)
    : await connectGithubRepo(sourceSpec);
  try {
    const incomingCodiDir = resolve(source.rootPath, PROJECT_DIR);
    if (!existsSync(incomingCodiDir)) {
      return createCommandResult({
        success: false,
        command: "team join",
        data: { source: sourceSpec, accepted: 0, skipped: 0, merged: 0 },
        errors: [
          {
            code: "E_TEAM_JOIN_INCOMING_MISSING",
            message: `Source has no ${PROJECT_DIR}/ to merge`,
            hint: "Verify the source repo is codi-initialised.",
            severity: "error",
            context: { incomingCodiDir },
          },
        ],
        exitCode: EXIT_CODES.CONFIG_NOT_FOUND,
      });
    }
    const conflicts = await collectCodiDirConflicts(localCodiDir, incomingCodiDir);
    if (conflicts.length === 0) {
      log.info(`No diffs between local ${PROJECT_DIR}/ and ${sourceSpec} — nothing to merge.`);
      return createCommandResult({
        success: true,
        command: "team join",
        data: { source: sourceSpec, accepted: 0, skipped: 0, merged: 0 },
        exitCode: EXIT_CODES.SUCCESS,
      });
    }
    const resolution = await resolveConflicts(conflicts, {
      force: Boolean(flags.force),
      keepCurrent: Boolean(flags.keepCurrent),
      log,
    });
    // Persist accepted + merged entries.
    for (const entry of [...resolution.accepted, ...resolution.merged]) {
      await mkdir(dirname(entry.fullPath), { recursive: true });
      await writeFile(entry.fullPath, entry.incomingContent, "utf-8");
    }
    // CORE-007: surface unresolvable conflicts via exit code instead of the
    // legacy in-resolver `process.exitCode = 2` side effect.
    if (resolution.unresolvable.length > 0) {
      if (resolution.nonInteractivePayload) {
        process.stderr.write(JSON.stringify(resolution.nonInteractivePayload) + "\n");
      }
      return createCommandResult({
        success: false,
        command: "team join",
        data: {
          source: sourceSpec,
          accepted: resolution.accepted.length,
          skipped: resolution.skipped.length,
          merged: resolution.merged.length,
        },
        errors: [
          {
            code: "E_UNRESOLVABLE_CONFLICTS",
            message: `${resolution.unresolvable.length} file(s) have unresolvable conflicts in non-interactive mode.`,
            hint: "Run interactively to resolve, or use --force / --keep-current.",
            severity: "error",
            context: { files: resolution.unresolvable.map((e) => e.label) },
          },
        ],
        exitCode: EXIT_CODES.UNRESOLVABLE_CONFLICTS,
      });
    }
    return createCommandResult({
      success: true,
      command: "team join",
      data: {
        source: sourceSpec,
        accepted: resolution.accepted.length,
        skipped: resolution.skipped.length,
        merged: resolution.merged.length,
      },
      exitCode: EXIT_CODES.SUCCESS,
    });
  } finally {
    await source.cleanup();
  }
}

export function registerTeamCommand(program: Command): void {
  const team = program
    .command("team")
    .description("Cross-team operations on .codi/ artifacts (ISSUE-088 / ISSUE-089)");
  team
    .command("join <source>")
    .description(
      "Merge another teammate's .codi/ into the local one. Source may be a local directory or a GitHub repo spec.",
    )
    .option("--force", "Accept all incoming files without prompting")
    .option("--keep-current", "Skip every conflict (keep current content)")
    .argument("<source>")
    .action(async (sourceSpec: string, opts: { force?: boolean; keepCurrent?: boolean }) => {
      const globalOpts = program.opts() as GlobalOptions;
      initFromOptions(globalOpts);
      const result = await teamJoinHandler(process.cwd(), sourceSpec, opts);
      handleOutput(result, globalOpts);
      process.exit(result.exitCode);
    });
}
