/**
 * `codi init` orchestrator (CORE-020).
 *
 * Before CORE-020: `initHandler` was a 665-LOC blob mutating 14+ shared
 * variables across 12 implicit phases. Now: this file holds the slim
 * orchestrator + CLI registration; each phase lives in `init-helpers.ts`
 * as a typed function operating on `InitContext` (immutable inputs) and
 * `InitState` (accumulator). Phases that can short-circuit return a
 * `PhaseResult` discriminated union carrying the early-exit
 * `CommandResult<InitData>`.
 *
 * The contract is unchanged: same `CommandResult<InitData>` shape, same
 * exit codes, same error codes. Tests at the `initHandler(tmpDir, opts)`
 * boundary remain green by design.
 */

import type { Command } from "commander";
import { getPresetNames } from "../core/flags/flag-presets.js";
import { DEFAULT_PRESET, PROJECT_DIR } from "../constants.js";
import { Logger } from "../core/output/logger.js";
import type { CommandResult } from "../core/output/types.js";
import { initFromOptions, handleOutput } from "./shared.js";
import {
  // Types — re-exported below so external callers keep importing from
  // `init.ts` (back-compat).
  type InitOptions,
  type InitData,
  // Phase functions
  createInitContext,
  createInitState,
  detectExistingInstall,
  detectStackAndAdapters,
  initialPresetState,
  isInteractiveInit,
  runInteractiveIntake,
  runNonInteractiveIntake,
  scaffoldArtifacts,
  syncPresetAndManifest,
  applyConfigAndBackup,
  ensureDocsStampIfEnabled,
  installPreCommitHooks,
  injectDocsSections,
  writeOperationsLedger,
  postInitBindingsProbe,
  buildInitSuccess,
  withConfigDir,
} from "./init-helpers.js";

export type { InitOptions, InitData } from "./init-helpers.js";

/**
 * Orchestrate the 12 init phases. Each phase reads `InitContext` +
 * mutates `InitState` in place; phases that can short-circuit return
 * a `PhaseResult` and the orchestrator early-returns the carried
 * `CommandResult<InitData>`.
 */
export async function initHandler(
  projectRoot: string,
  options: InitOptions,
): Promise<CommandResult<InitData>> {
  const ctx = createInitContext(projectRoot, options);
  const state = createInitState();

  // P1 — detect existing install (sets isUpdate / existingSelections / existingInstall).
  await detectExistingInstall(ctx, state);

  // P2 — detect language stack + register adapters.
  await detectStackAndAdapters(ctx, state);

  // P3 — seed preset names from --preset (or defaults).
  initialPresetState(state, ctx.options);

  // P4 / P5 — collect selections. Interactive vs non-interactive branches
  // each produce the same accumulated shape on `state`; only one runs.
  const intake = isInteractiveInit(ctx.options)
    ? await runInteractiveIntake(ctx, state)
    : await runNonInteractiveIntake(ctx, state);
  if (!intake.ok) return intake.earlyExit;

  // P6 — scaffold rules / skills / agents / mcp-servers (additive over prev).
  await scaffoldArtifacts(ctx, state);

  // P7 — record preset state, sync artifact manifest, write preset lock.
  // (Three best-effort blocks preserved inside the helper.)
  await syncPresetAndManifest(ctx, state);

  // P8 — validate + apply configuration with optional pre-init backup.
  const { phase: applyPhase, output: applyOutput } = await applyConfigAndBackup(ctx, state);
  if (!applyPhase.ok) return applyPhase.earlyExit;

  // P9 — docs/project/ stamp when require_documentation is enabled.
  await ensureDocsStampIfEnabled(ctx, applyOutput.configResult);

  // P10 — install pre-commit hooks (gated on configResult.ok).
  await installPreCommitHooks(ctx, state, applyOutput.configResult);

  // P11 — inject code-driven documentation sections (best-effort).
  await injectDocsSections(ctx);

  // P12 — persist the operations ledger (best-effort).
  await writeOperationsLedger(ctx, state);

  // Post-init: probe native bindings + return the success payload.
  await postInitBindingsProbe(ctx.log);

  return withConfigDir(buildInitSuccess(state), ctx.configDir);
}

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description(`Initialize a new ${PROJECT_DIR}/ configuration directory`)
    .option("--force", `Reinitialize even if ${PROJECT_DIR}/ exists`)
    .option("--agents <agents...>", "Specify agent IDs (skips wizard)")
    .option(
      "--preset <preset>",
      `Flag preset: ${getPresetNames().join(", ")} (default: ${DEFAULT_PRESET})`,
    )
    .option(
      "--on-conflict <strategy>",
      "Conflict strategy when generated files have local changes: keep-current (default) or keep-incoming",
    )
    .action(async (cmdOptions: Record<string, unknown>) => {
      const globalOptions = program.opts() as Record<string, unknown>;
      const options = { ...globalOptions, ...cmdOptions } as InitOptions;
      initFromOptions(options);
      const result = await initHandler(process.cwd(), options);
      handleOutput(result, options);
      if (result.success && !options.json && !options.quiet) {
        Logger.getInstance().info(
          "\nNext step: run /codi-codebase-onboarding inside your coding agent\n" +
            "to add project-specific context to your configuration files.\n",
        );
      }
      process.exit(result.exitCode);
    });
}
