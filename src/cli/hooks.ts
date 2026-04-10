import { execFileSync } from "node:child_process";
import type { Command } from "commander";
import { detectStack } from "../core/hooks/stack-detector.js";
import { generateHooksConfig } from "../core/hooks/hook-config-generator.js";
import { checkHookDependencies } from "../core/hooks/hook-dependency-checker.js";
import { resolveConfig } from "../core/config/resolver.js";
import { Logger } from "../core/output/logger.js";
import { initFromOptions } from "./shared.js";
import type { GlobalOptions } from "./shared.js";
import type { DependencyDiagnostic } from "../core/hooks/hook-dependency-checker.js";
import { PROJECT_CLI } from "../constants.js";

interface HooksDoctorOptions extends GlobalOptions {
  fix?: boolean;
}

async function hooksDoctorHandler(
  projectRoot: string,
  options: HooksDoctorOptions,
): Promise<void> {
  const logger = Logger.getInstance();

  const stackResult = await detectStack(projectRoot);
  const languages = stackResult.ok ? stackResult.data.languages : [];

  const configResult = await resolveConfig(projectRoot);
  const flags = configResult.ok ? configResult.data.flags : {};

  const config = generateHooksConfig(flags as never, languages);

  const diagnostics: DependencyDiagnostic[] = await checkHookDependencies(
    config.hooks,
    projectRoot,
  );

  const errors = diagnostics.filter((d) => d.severity === "error");
  const warnings = diagnostics.filter((d) => d.severity === "warning");
  const ok = diagnostics.filter((d) => d.severity === "ok");

  logger.info(`\ncodi hooks doctor — ${projectRoot}\n`);
  logger.info(
    `  Languages detected: ${languages.length > 0 ? languages.join(", ") : "(none)"}`,
  );
  logger.info(`  Hooks checked: ${diagnostics.length}`);
  logger.info(`  ✓ Installed: ${ok.length}`);

  if (warnings.length > 0) {
    logger.info(`\n  Optional tools not installed (${warnings.length}):`);
    for (const w of warnings) {
      logger.warn(`    ⚠ ${w.name} [${w.category ?? "unknown"}]`);
      if (w.installHint) {
        logger.warn(`      Install: ${w.installHint.command}`);
      }
    }
  }

  if (errors.length > 0) {
    logger.info(
      `\n  Required tools not installed (${errors.length}) — commits will be BLOCKED:`,
    );
    for (const e of errors) {
      logger.error(`    ✗ ${e.name} [${e.category ?? "unknown"}]`);
      if (e.installHint) {
        logger.error(`      Install: ${e.installHint.command}`);
        if (e.installHint.url) {
          logger.error(`      See:     ${e.installHint.url}`);
        }
      }
    }
    if (!options.fix) {
      process.exitCode = 1;
    }
  } else {
    logger.info(`\n  All required tools are installed.`);
  }

  // --fix: print all install commands for missing tools
  if (options.fix) {
    const allMissing = [...errors, ...warnings];
    if (allMissing.length === 0) {
      logger.info(`\n  Nothing to fix.`);
    } else {
      logger.info(`\n  Run these commands to install missing tools:`);
      for (const d of allMissing) {
        if (d.installHint) {
          logger.info(`    ${d.installHint.command}`);
        }
      }
    }
  }
}

async function hooksReinstallHandler(projectRoot: string): Promise<void> {
  const logger = Logger.getInstance();
  logger.info("Reinstalling codi pre-commit hooks...");
  try {
    execFileSync(
      "node",
      [`${projectRoot}/node_modules/.bin/${PROJECT_CLI}`, "generate"],
      { stdio: "inherit", cwd: projectRoot },
    );
  } catch {
    // Fall back to npx if local binary not found
    execFileSync("npx", [PROJECT_CLI, "generate"], {
      stdio: "inherit",
      cwd: projectRoot,
    });
  }
}

export function registerHooksCommand(program: Command): void {
  const hooksCmd = program
    .command("hooks")
    .description("Manage and diagnose pre-commit hooks");

  hooksCmd
    .command("doctor")
    .description("Check that all required hook tools are installed")
    .option("--fix", "Print install commands for all missing tools")
    .action(async (cmdOptions: Record<string, unknown>) => {
      const globalOptions = program.opts() as GlobalOptions;
      const options: HooksDoctorOptions = { ...globalOptions, ...cmdOptions };
      initFromOptions(options);
      await hooksDoctorHandler(process.cwd(), options);
    });

  hooksCmd
    .command("reinstall")
    .description("Re-run codi generate to reinstall pre-commit hooks")
    .action(async () => {
      const globalOptions = program.opts() as GlobalOptions;
      initFromOptions(globalOptions);
      await hooksReinstallHandler(process.cwd());
    });
}
