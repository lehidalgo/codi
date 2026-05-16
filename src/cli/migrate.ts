import type { Command } from "commander";
import { Logger } from "../core/output/logger.js";
import { createCommandResult } from "../core/output/formatter.js";
import { EXIT_CODES } from "../core/output/exit-codes.js";
import { initFromOptions, handleOutput } from "./shared.js";
import { executeMigration, type ExecuteResult } from "#src/core/migration/executor.js";
import { planMigration, formatPlan } from "#src/core/migration/v2-to-v3.js";
import type { GlobalOptions } from "./shared.js";
import type { CommandResult } from "../core/output/types.js";

interface MigrateData {
  readonly canProceed: boolean;
  readonly applied: boolean;
  readonly steps: ExecuteResult["steps"];
  readonly abortReason: string | null;
}

interface MigrateFlags {
  readonly mode?: string;
  readonly apply?: boolean;
  readonly dryRun?: boolean;
}

export async function migrateHandler(
  projectRoot: string,
  flags: MigrateFlags,
): Promise<CommandResult<MigrateData>> {
  const log = Logger.getInstance();
  const mode = (flags.mode ?? "zero") as "zero" | "lite" | "standard" | "full";

  const plan = planMigration(projectRoot, { mode });
  log.info(formatPlan(plan));

  if (!plan.canProceed) {
    return createCommandResult({
      success: false,
      command: "migrate v2-to-v3",
      data: {
        canProceed: false,
        applied: false,
        steps: [],
        abortReason: plan.blockers.join("; "),
      },
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }

  if (!flags.apply) {
    log.info("\nDry-run only — re-run with --apply to execute.");
    return createCommandResult({
      success: true,
      command: "migrate v2-to-v3",
      data: { canProceed: true, applied: false, steps: [], abortReason: null },
      exitCode: EXIT_CODES.SUCCESS,
    });
  }

  const result = executeMigration({
    plan,
    repoRoot: projectRoot,
    dryRun: flags.dryRun ?? false,
  });

  for (const step of result.steps) {
    log.info(`  [${step.status}] ${step.kind} — ${step.detail}`);
  }
  if (result.success) {
    log.info("\nMigration complete. Run `codi generate --force` to refresh per-agent output.");
  } else {
    log.error(`\nMigration aborted: ${result.abortReason}`);
  }

  return createCommandResult({
    success: result.success,
    command: "migrate v2-to-v3",
    data: {
      canProceed: true,
      applied: result.success,
      steps: result.steps,
      abortReason: result.abortReason,
    },
    exitCode: result.success ? EXIT_CODES.SUCCESS : EXIT_CODES.GENERAL_ERROR,
  });
}

export function registerMigrateCommand(program: Command): void {
  program
    .command("migrate")
    .description("Migrate a Codi v2 install to v3 (planner + executor)")
    .argument("[direction]", "migration direction (currently only 'v2-to-v3')", "v2-to-v3")
    .option("--mode <mode>", "destination install mode: zero|lite|standard|full", "zero")
    .option("--apply", "apply the plan (default: dry-run preview only)")
    .option("--dry-run", "force dry-run even with --apply (used by tests)")
    .action(async (direction: string, opts: MigrateFlags) => {
      if (direction !== "v2-to-v3") {
        Logger.getInstance().error(`Unsupported migration direction: ${direction}`);
        process.exit(EXIT_CODES.GENERAL_ERROR);
      }
      const globalOpts = program.opts() as GlobalOptions;
      initFromOptions(globalOpts);
      const result = await migrateHandler(process.cwd(), opts);
      handleOutput(result, globalOpts);
    });
}
