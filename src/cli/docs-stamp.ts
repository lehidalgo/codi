import type { Command } from "commander";
import { writeStamp, ensureDocProjectDir } from "../core/docs/doc-stamp.js";
import { createCommandResult } from "../core/output/formatter.js";
import { EXIT_CODES } from "../core/output/exit-codes.js";
import type { CommandResult } from "../core/output/types.js";
import { initFromOptions, handleOutput } from "./shared.js";
import type { GlobalOptions } from "./shared.js";
import { DOC_PROJECT_DIR, DOC_STAMP_FILENAME } from "#src/constants.js";

interface DocsStampData {
  commit: string;
  verified_at: string;
  verified_by: string;
  stamp_path: string;
}

export async function docsStampHandler(
  projectRoot: string,
  verifiedBy: "human" | "agent",
): Promise<CommandResult<DocsStampData>> {
  await ensureDocProjectDir(projectRoot);
  const stamp = await writeStamp(projectRoot, verifiedBy);

  return createCommandResult({
    success: true,
    command: "docs-stamp",
    data: {
      commit: stamp.commit,
      verified_at: stamp.verified_at,
      verified_by: stamp.verified_by,
      stamp_path: `${DOC_PROJECT_DIR}/${DOC_STAMP_FILENAME}`,
    },
    exitCode: EXIT_CODES.SUCCESS,
  });
}

export function registerDocsStampCommand(program: Command): void {
  program
    .command("docs-stamp")
    .description(
      "Mark documentation as verified at the current commit. Run after reviewing docs/project/.",
    )
    .option("--by <verifier>", "Who verified the docs: human or agent", "human")
    .action(async (options: { by: string }) => {
      const globalOptions = program.opts() as GlobalOptions;
      initFromOptions(globalOptions);

      const verifiedBy = options.by === "agent" ? "agent" : "human";
      const result = await docsStampHandler(process.cwd(), verifiedBy);

      if (result.exitCode === EXIT_CODES.SUCCESS && !globalOptions.json) {
        const d = result.data as DocsStampData;
        console.log(
          `\n[codi] Documentation stamped at ${d.commit.slice(0, 7)} (${d.verified_by})\n` +
            `  Stamp written to: ${d.stamp_path}\n` +
            `  Commit this file to unblock your push.\n`,
        );
        process.exit(EXIT_CODES.SUCCESS);
        return;
      }

      handleOutput(result, globalOptions);
      process.exit(result.exitCode);
    });
}
