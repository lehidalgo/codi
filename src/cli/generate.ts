import type { Command } from "commander";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { resolveConfig } from "../core/config/resolver.js";
import { registerAllAdapters } from "../adapters/index.js";
import { applyConfiguration } from "../core/generator/apply.js";
import { StateManager } from "../core/config/state.js";
import type { GeneratedFileState } from "../core/config/state.js";
import { resolveProjectDir } from "../utils/paths.js";
import { createCommandResult } from "../core/output/formatter.js";
import { EXIT_CODES } from "../core/output/exit-codes.js";
import { hashContent } from "../utils/hash.js";
import type { CommandResult } from "../core/output/types.js";
import { writeAuditEntry } from "../core/audit/audit-log.js";
import { createBackup } from "../core/backup/backup-manager.js";
import { initFromOptions, handleOutput } from "./shared.js";
import type { GlobalOptions } from "./shared.js";
import { Logger } from "../core/output/logger.js";
import { checkHookDependencies, filterMissing } from "../core/hooks/hook-dependency-checker.js";
import { detectHookSetup } from "../core/hooks/hook-detector.js";
import { generateHooksConfig } from "../core/hooks/hook-config-generator.js";
import { installHooks } from "../core/hooks/hook-installer.js";
import { detectStack } from "../core/hooks/stack-detector.js";
import { OperationsLedgerManager } from "../core/audit/operations-ledger.js";
import {
  buildDetectionContext,
  resolvePythonTypeChecker,
  resolveJsFormatLint,
  resolveCommitTypeCheck,
  resolveCommitTestRun,
} from "../core/hooks/auto-detection.js";
import type { ResolvedFlags } from "#src/types/flags.js";

/**
 * Resolve any 'auto' values among the four tooling-default flags
 * (python_type_checker, js_format_lint, commit_type_check, commit_test_run)
 * using the project's filesystem signals. Explicit flag values pass through
 * unchanged. Skips the detection-context build entirely when no flag is set
 * to 'auto', so this is cheap on every-commit regenerates.
 */
async function resolveAutoFlags(projectRoot: string, flags: ResolvedFlags): Promise<ResolvedFlags> {
  const needs = (key: string): boolean => flags[key]?.value === "auto";
  if (
    !needs("python_type_checker") &&
    !needs("js_format_lint") &&
    !needs("commit_type_check") &&
    !needs("commit_test_run")
  ) {
    return flags;
  }
  const ctx = await buildDetectionContext(projectRoot);
  const out: ResolvedFlags = { ...flags };
  if (needs("python_type_checker")) {
    out["python_type_checker"] = {
      ...out["python_type_checker"]!,
      value: resolvePythonTypeChecker(ctx),
    };
  }
  if (needs("js_format_lint")) {
    out["js_format_lint"] = { ...out["js_format_lint"]!, value: resolveJsFormatLint(ctx) };
  }
  if (needs("commit_type_check")) {
    out["commit_type_check"] = { ...out["commit_type_check"]!, value: resolveCommitTypeCheck(ctx) };
  }
  if (needs("commit_test_run")) {
    out["commit_test_run"] = { ...out["commit_test_run"]!, value: resolveCommitTestRun(ctx) };
  }
  return out;
}

interface GenerateCommandOptions extends GlobalOptions {
  agent?: string[];
  dryRun?: boolean;
  force?: boolean;
  onConflict?: "keep-current" | "keep-incoming";
  /** Opt into the legacy 7-option per-file prompt. Default is union merge. */
  interactive?: boolean;
}

interface GenerateSummary {
  agents: string[];
  filesGenerated: number;
  files: string[];
}

export async function generateHandler(
  projectRoot: string,
  options: GenerateCommandOptions,
): Promise<CommandResult<GenerateSummary>> {
  const log = Logger.getInstance();
  const configResult = await resolveConfig(projectRoot);
  if (!configResult.ok) {
    return createCommandResult({
      success: false,
      command: "generate",
      data: { agents: [], filesGenerated: 0, files: [] },
      errors: configResult.errors,
      exitCode:
        configResult.errors[0]?.code === "E_CONFIG_NOT_FOUND"
          ? EXIT_CODES.CONFIG_NOT_FOUND
          : EXIT_CODES.CONFIG_INVALID,
    });
  }

  registerAllAdapters();

  if (!options.dryRun) {
    const configDirForBackup = resolveProjectDir(projectRoot);
    await createBackup(projectRoot, configDirForBackup);
  }

  // Default conflict strategy: union merge (auto-accept both, in-editor markers)
  // unless the user opted into interactive prompts or specified a strategy.
  const unionMerge =
    !options.interactive &&
    !options.force &&
    !options.onConflict &&
    process.stdout.isTTY &&
    !options.dryRun;

  const result = await applyConfiguration(configResult.data, projectRoot, {
    agents: options.agent,
    dryRun: options.dryRun,
    force: options.force || options.onConflict === "keep-incoming",
    keepCurrent: options.onConflict === "keep-current",
    unionMerge,
    forceDeleteDriftedOrphans: options.force || options.onConflict === "keep-incoming",
  });

  if (!result.ok) {
    return createCommandResult({
      success: false,
      command: "generate",
      data: { agents: [], filesGenerated: 0, files: [] },
      errors: result.errors,
      exitCode: EXIT_CODES.GENERATION_FAILED,
    });
  }

  const generation = result.data.generation;
  const reconciliation = result.data.reconciliation;

  if (!options.dryRun) {
    if (reconciliation.pruned.length > 0) {
      log.info(
        `Pruned ${reconciliation.pruned.length} orphaned file(s) removed from source templates`,
      );
    }
    if (reconciliation.preservedDrifted.length > 0) {
      log.warn(
        `${reconciliation.preservedDrifted.length} orphaned file(s) have local edits — preserved. ` +
          `Use --on-conflict keep-incoming to force delete.`,
      );
    }

    const configDir = resolveProjectDir(projectRoot);
    await writeAuditEntry(configDir, {
      type: "generate",
      timestamp: new Date().toISOString(),
      details: {
        agents: generation.agents,
        filesGenerated: generation.files.length,
      },
    });
  }

  // Re-install hooks to stay in sync with config changes
  if (!options.dryRun) {
    try {
      const hookSetup = await detectHookSetup(projectRoot);
      const languages = await detectStack(projectRoot);
      const flagsForHooks = await resolveAutoFlags(projectRoot, configResult.data.flags);
      const hooksConfig = generateHooksConfig(flagsForHooks, languages);
      if (hooksConfig.hooks.length > 0 || hooksConfig.docCheck) {
        if (hooksConfig.docCheck) {
          try {
            const { ensureDocProjectDir } = await import("../core/docs/doc-stamp.js");
            await ensureDocProjectDir(projectRoot);
          } catch {
            /* non-critical */
          }
        }
        const hookResult = await installHooks({
          projectRoot,
          runner: hookSetup.runner,
          hooks: hooksConfig.hooks,
          flags: configResult.data.flags,
          commitMsgValidation: hooksConfig.commitMsgValidation,
          secretScan: hooksConfig.secretScan,
          fileSizeCheck: hooksConfig.fileSizeCheck,
          versionCheck: hooksConfig.versionCheck,
          templateWiringCheck: hooksConfig.templateWiringCheck,
          docNamingCheck: hooksConfig.docNamingCheck,
          versionBump: hooksConfig.versionBump,
          versionVerify: hooksConfig.versionVerify,
          artifactValidation: hooksConfig.artifactValidation,
          importDepthCheck: hooksConfig.importDepthCheck,
          skillYamlValidation: hooksConfig.skillYamlValidation,
          skillResourceCheck: hooksConfig.skillResourceCheck,
          skillPathWrapCheck: hooksConfig.skillPathWrapCheck,
          stagedJunkCheck: hooksConfig.stagedJunkCheck,
          brandSkillValidation: hooksConfig.brandSkillValidation,
          docCheck: hooksConfig.docCheck,
          docProtectedBranches: hooksConfig.docProtectedBranches,
        });
        if (hookResult.ok) {
          const missingDeps = filterMissing(
            await checkHookDependencies(hooksConfig.hooks, projectRoot),
          );
          if (missingDeps.length > 0) {
            const log = Logger.getInstance();
            log.warn("Missing hook tools — install before committing:");
            for (const dep of missingDeps) {
              log.warn(`  ${dep.name}: ${dep.installHint}`);
            }
          }
        }
        if (hookResult.ok && hookResult.data.files.length > 0) {
          const configDirHooks = resolveProjectDir(projectRoot);
          const stateManagerHooks = new StateManager(configDirHooks, projectRoot);
          const now = new Date().toISOString();
          const hookStates: GeneratedFileState[] = [];
          for (const f of hookResult.data.files) {
            let generatedHash = "";
            try {
              const content = await readFile(resolve(projectRoot, f), "utf-8");
              generatedHash = hashContent(content);
            } catch {
              // File may not be readable (e.g. binary); store empty hash
            }
            hookStates.push({
              path: f,
              sourceHash: hashContent(f),
              generatedHash,
              sources: ["hooks"],
              timestamp: now,
            });
          }
          await stateManagerHooks.updateHooks(hookStates);

          const ledger = new OperationsLedgerManager(configDirHooks);
          await ledger.addHookFiles(
            hookResult.data.files.map((f) => ({
              path: f,
              framework:
                hookSetup.runner === "none"
                  ? ("standalone" as const)
                  : (hookSetup.runner as "husky" | "pre-commit" | "lefthook"),
              type: inferHookFileType(f),
              createdAt: now,
            })),
          );
        }
      }
    } catch (cause) {
      log.debug("Hook installation failed during generate", cause);
    }
  }

  // Log generate operation to ledger
  if (!options.dryRun) {
    try {
      const configDirLedger = resolveProjectDir(projectRoot);
      const ledger = new OperationsLedgerManager(configDirLedger);
      const now = new Date().toISOString();
      const ledgerFiles = generation.agents.flatMap((agentId) =>
        (generation.filesByAgent[agentId] ?? []).map((f) => ({
          path: f.path,
          agent: agentId,
          type: inferGeneratedFileType(f.path),
          createdAt: now,
          updatedAt: now,
        })),
      );
      await ledger.addGeneratedFiles(ledgerFiles);
      await ledger.logOperation({
        type: "generate",
        timestamp: now,
        details: {
          agents: generation.agents,
          filesGenerated: generation.files.length,
        },
      });
    } catch (cause) {
      log.debug("Ledger write failed during generate", cause);
    }
  }

  return createCommandResult({
    success: true,
    command: "generate",
    data: {
      agents: generation.agents,
      filesGenerated: generation.files.length,
      files: generation.files.map((f) => f.path),
    },
    exitCode: EXIT_CODES.SUCCESS,
  });
}

function inferHookFileType(
  filePath: string,
): "pre-commit" | "commit-msg" | "secret-scan" | "file-size-check" | "version-check" {
  if (filePath.includes("secret-scan")) return "secret-scan";
  if (filePath.includes("file-size-check")) return "file-size-check";
  if (filePath.includes("version-check")) return "version-check";
  if (filePath.includes("commit-msg")) return "commit-msg";
  return "pre-commit";
}

function inferGeneratedFileType(
  filePath: string,
): "instruction" | "rule" | "skill" | "agent" | "mcp" | "settings" {
  if (filePath.includes("/rules/")) return "rule";
  if (filePath.includes("/skills/")) return "skill";
  if (filePath.includes("/agents/")) return "agent";
  if (filePath.includes("mcp.json") || filePath.includes("mcp.toml")) return "mcp";
  if (filePath.includes("settings.json")) return "settings";
  return "instruction";
}

export function registerGenerateCommand(program: Command): void {
  program
    .command("generate")
    .alias("gen")
    .description("Generate agent configuration files")
    .option("--agent <agents...>", "Generate for specific agents only")
    .option("--dry-run", "Show what would be generated without writing")
    .option(
      "--force",
      "Skip no-op detection and rewrite every generated file (implies --on-conflict keep-incoming)",
    )
    .option(
      "--interactive",
      "Prompt per-file for each conflict (overrides the default union-merge behavior)",
    )
    .option(
      "--on-conflict <strategy>",
      "How to resolve local edits to generated files: keep-current (skip) or keep-incoming (overwrite). Default is union merge with in-editor markers on a TTY, auto-merge off-TTY.",
    )
    .action(async (cmdOptions: Record<string, unknown>) => {
      const globalOptions = program.opts() as GlobalOptions;
      const options: GenerateCommandOptions = {
        ...globalOptions,
        ...cmdOptions,
      };
      initFromOptions(options);
      const result = await generateHandler(process.cwd(), options);
      handleOutput(result, options);
      process.exit(result.exitCode);
    });
}
