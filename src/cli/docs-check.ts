import type { Command } from "commander";
import { checkStaleness } from "../core/docs/doc-stamp.js";
import { createCommandResult } from "../core/output/formatter.js";
import { EXIT_CODES } from "../core/output/exit-codes.js";
import type { CommandResult } from "../core/output/types.js";
import { initFromOptions, handleOutput } from "./shared.js";
import type { GlobalOptions } from "./shared.js";

interface DocsCheckData {
  stale: boolean;
  reason?: string;
  commit_count?: number;
  stamp_commit?: string;
}

export async function docsCheckHandler(projectRoot: string): Promise<CommandResult<DocsCheckData>> {
  const check = await checkStaleness(projectRoot);

  if (!check.stale) {
    return createCommandResult({
      success: true,
      command: "docs-check",
      data: {
        stale: false,
        commit_count: check.commitCount,
        stamp_commit: check.stampCommit,
      },
      exitCode: EXIT_CODES.SUCCESS,
    });
  }

  return createCommandResult({
    success: false,
    command: "docs-check",
    data: {
      stale: true,
      reason: check.reason,
      commit_count: check.commitCount,
      stamp_commit: check.stampCommit,
    },
    exitCode: EXIT_CODES.GENERAL_ERROR,
  });
}

export function registerDocsCheckCommand(program: Command): void {
  program
    .command("docs-check")
    .description("Check if documentation is up to date. Exits 0 if fresh, 1 if stale.")
    .action(async () => {
      const globalOptions = program.opts() as GlobalOptions;
      initFromOptions(globalOptions);

      const result = await docsCheckHandler(process.cwd());

      if (!globalOptions.json) {
        const d = result.data as DocsCheckData;
        if (!d.stale) {
          console.log(
            `\n[codi] Documentation is up to date (stamp: ${(d.stamp_commit ?? "").slice(0, 7)})\n`,
          );
        } else {
          const messages: Record<string, string> = {
            no_stamp: "No stamp file found. Run: codi docs-stamp",
            invalid_hash: "Stamp hash not in history (rebase?). Re-verify and run: codi docs-stamp",
            unverified_commits: `${d.commit_count} commits since last verification (stamp: ${(d.stamp_commit ?? "").slice(0, 7)}). Review docs/project/ and run: codi docs-stamp`,
          };
          console.error(
            `\n[codi] Documentation is stale.\n  ${messages[d.reason ?? ""] ?? d.reason}\n`,
          );
        }
        process.exit(result.exitCode);
        return;
      }

      handleOutput(result, globalOptions);
      process.exit(result.exitCode);
    });
}
