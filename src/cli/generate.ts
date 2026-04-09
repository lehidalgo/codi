import type { Command } from "commander";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { resolveConfig } from "../core/config/resolver.js";
import { registerAllAdapters } from "../adapters/index.js";
import { generate } from "../core/generator/generator.js";
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
import { checkHookDependencies } from "../core/hooks/hook-dependency-checker.js";
import { detectHookSetup } from "../core/hooks/hook-detector.js";
import { generateHooksConfig } from "../core/hooks/hook-config-generator.js";
import { installHooks } from "../core/hooks/hook-installer.js";
import { detectStack } from "../core/hooks/stack-detector.js";
import { OperationsLedgerManager } from "../core/audit/operations-ledger.js";

interface GenerateCommandOptions extends GlobalOptions {
  agent?: string[];
  dryRun?: boolean;
  force?: boolean;
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

  const genResult = await generate(configResult.data, projectRoot, {
    agents: options.agent,
    dryRun: options.dryRun,
    force: options.force,
  });

  if (!genResult.ok) {
    return createCommandResult({
      success: false,
      command: "generate",
      data: { agents: [], filesGenerated: 0, files: [] },
      errors: genResult.errors,
      exitCode: EXIT_CODES.GENERATION_FAILED,
    });
  }

  if (!options.dryRun) {
    const configDir = resolveProjectDir(projectRoot);
    const stateManager = new StateManager(configDir, projectRoot);

    const agentUpdates: Record<string, GeneratedFileState[]> = {};
    for (const agentId of genResult.data.agents) {
      agentUpdates[agentId] = (genResult.data.filesByAgent[agentId] ?? []).map(
        (f): GeneratedFileState => ({
          path: f.path,
          sourceHash: hashContent(f.sources.join(",")),
          generatedHash: f.hash,
          sources: f.sources,
          timestamp: new Date().toISOString(),
        }),
      );
    }
    await stateManager.updateAgentsBatch(agentUpdates);

    await writeAuditEntry(configDir, {
      type: "generate",
      timestamp: new Date().toISOString(),
      details: {
        agents: genResult.data.agents,
        filesGenerated: genResult.data.files.length,
      },
    });
  }

  // Re-install hooks to stay in sync with config changes
  if (!options.dryRun) {
    try {
      const hookSetup = await detectHookSetup(projectRoot);
      const languages = await detectStack(projectRoot);
      const hooksConfig = generateHooksConfig(configResult.data.flags, languages);
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
          artifactValidation: hooksConfig.artifactValidation,
          importDepthCheck: hooksConfig.importDepthCheck,
          skillYamlValidation: hooksConfig.skillYamlValidation,
          skillResourceCheck: hooksConfig.skillResourceCheck,
          stagedJunkCheck: hooksConfig.stagedJunkCheck,
          docCheck: hooksConfig.docCheck,
          docProtectedBranches: hooksConfig.docProtectedBranches,
        });
        if (hookResult.ok) {
          const missingDeps = await checkHookDependencies(hooksConfig.hooks, projectRoot);
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
      const ledgerFiles = genResult.data.agents.flatMap((agentId) =>
        (genResult.data.filesByAgent[agentId] ?? []).map((f) => ({
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
          agents: genResult.data.agents,
          filesGenerated: genResult.data.files.length,
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
      agents: genResult.data.agents,
      filesGenerated: genResult.data.files.length,
      files: genResult.data.files.map((f) => f.path),
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
    .option("--force", "Force regeneration even if unchanged")
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
