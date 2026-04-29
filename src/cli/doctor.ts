import type { Command } from "commander";
import { PROJECT_CLI, PROJECT_NAME } from "../constants.js";
import { runAllChecks } from "../core/version/version-checker.js";
import { resolveConfig } from "../core/config/resolver.js";
import { validateContentSize } from "../core/config/validator.js";
import { checkDocSync } from "../core/docs/doc-sync.js";
import { createError } from "../core/output/errors.js";
import { detectHookSetup } from "../core/hooks/hook-detector.js";
import { generateHooksConfig } from "../core/hooks/hook-config-generator.js";
import { checkHookDependencies } from "../core/hooks/hook-dependency-checker.js";
import type { DependencyDiagnostic } from "../core/hooks/hook-dependency-checker.js";
import { detectStack } from "../core/hooks/stack-detector.js";
import { resolveAutoFlags } from "../core/hooks/auto-detection.js";
import { createCommandResult } from "../core/output/formatter.js";
import { EXIT_CODES } from "../core/output/exit-codes.js";
import type { CommandResult } from "../core/output/types.js";
import { Logger } from "../core/output/logger.js";
import { initFromOptions, handleOutput } from "./shared.js";
import type { GlobalOptions } from "./shared.js";

interface DoctorOptions extends GlobalOptions {
  ci?: boolean;
  hooks?: boolean;
}

interface DoctorData {
  results: Array<{
    check: string;
    passed: boolean;
    message: string;
  }>;
  allPassed: boolean;
  hookDiagnostics?: DependencyDiagnostic[];
}

export async function doctorHandler(
  projectRoot: string,
  options: DoctorOptions,
): Promise<CommandResult<DoctorData>> {
  if (options.hooks) {
    return doctorHooks(projectRoot, options);
  }

  const configResult = await resolveConfig(projectRoot);
  const driftMode = configResult.ok
    ? ((configResult.data.flags["drift_detection"]?.value as string) ?? "warn")
    : "warn";

  const reportResult = await runAllChecks(projectRoot, driftMode);

  if (!reportResult.ok) {
    return createCommandResult({
      success: false,
      command: "doctor",
      data: { results: [], allPassed: false },
      errors: reportResult.errors,
      exitCode: EXIT_CODES.DOCTOR_FAILED,
    });
  }

  const report = reportResult.data;
  const hasDriftFailures = report.results.some((r) => !r.passed && r.check.startsWith("drift-"));
  const exitCode = report.allPassed
    ? EXIT_CODES.SUCCESS
    : options.ci || (driftMode === "error" && hasDriftFailures)
      ? EXIT_CODES.DOCTOR_FAILED
      : EXIT_CODES.SUCCESS;

  const errors = report.results
    .filter((r) => !r.passed)
    .map((r) => ({
      code: r.check === `${PROJECT_NAME}-version` ? "E_VERSION_MISMATCH" : "E_FILES_STALE",
      message: r.message,
      hint: r.message,
      severity: "error" as const,
      context: { check: r.check },
    }));

  const contentWarnings = configResult.ok ? validateContentSize(configResult.data) : [];

  const docIssues = await checkDocSync(projectRoot);
  const docWarnings = docIssues.map((issue) => {
    let message = issue.fixable
      ? `${issue.description} — run: ${PROJECT_CLI} docs-update`
      : issue.description;
    if (issue.action) {
      message += `\n  ACTION: ${issue.action}`;
    }
    return createError("W_DOCS_STALE", { message });
  });

  // Check if hooks are installed
  const hookWarnings = [];
  try {
    const hookSetup = await detectHookSetup(projectRoot);
    if (hookSetup.runner === "none") {
      // Check if .git/hooks/pre-commit exists (standalone)
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      try {
        await fs.access(path.join(projectRoot, ".git", "hooks", "pre-commit"));
      } catch {
        hookWarnings.push(
          createError("W_DOCS_STALE", {
            message: `No pre-commit hooks detected — run: ${PROJECT_CLI} generate`,
          }),
        );
      }
    }
  } catch (cause) {
    Logger.getInstance().warn("Hook detection failed during doctor check", cause);
  }

  return createCommandResult({
    success: report.allPassed,
    command: "doctor",
    data: report,
    errors: report.allPassed ? [] : errors,
    warnings: [...contentWarnings, ...docWarnings, ...hookWarnings],
    exitCode,
  });
}

async function doctorHooks(
  projectRoot: string,
  _options: DoctorOptions,
): Promise<CommandResult<DoctorData>> {
  const cfgResult = await resolveConfig(projectRoot);
  if (!cfgResult.ok) {
    return createCommandResult({
      success: false,
      command: "doctor",
      data: { results: [], allPassed: false, hookDiagnostics: [] },
      errors: cfgResult.errors,
      exitCode: EXIT_CODES.DOCTOR_FAILED,
    });
  }
  const config = cfgResult.data;

  const stack = await detectStack(projectRoot);
  const flagsForHooks = await resolveAutoFlags(projectRoot, config.flags);
  const hooksConfig = generateHooksConfig(flagsForHooks, stack, config.manifest);
  const diagnostics = await checkHookDependencies(hooksConfig.hooks, projectRoot);

  renderHookDiagnosticsTable(diagnostics);

  const requiredMissing = diagnostics.some((d) => d.severity === "error" && d.found === false);

  return createCommandResult({
    success: !requiredMissing,
    command: "doctor",
    data: {
      results: [],
      allPassed: !requiredMissing,
      hookDiagnostics: diagnostics,
    },
    exitCode: requiredMissing ? EXIT_CODES.DOCTOR_FAILED : EXIT_CODES.SUCCESS,
  });
}

function renderHookDiagnosticsTable(diagnostics: DependencyDiagnostic[]): void {
  const log = Logger.getInstance();
  if (diagnostics.length === 0) {
    log.info("No hooks configured for this project.");
    return;
  }
  log.info("Hook dependencies for current configuration:");
  log.info("");
  for (const d of diagnostics) {
    const status =
      d.severity === "ok" ? "ok     " : d.severity === "warning" ? "warning" : "error  ";
    const location = d.found
      ? (d.resolvedPath ?? "(found)")
      : `missing — ${d.installHint?.command ?? "install manually"}`;
    log.info(`  ${status}  ${d.name.padEnd(16)}  ${(d.category ?? "").padEnd(10)}  ${location}`);
  }
  log.info("");
}

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description(
      "Check project health: version, generated files, config validity, drift, hook tool availability (--hooks)",
    )
    .option("--ci", "Exit non-zero on any failure (for CI/hooks)")
    .option("--hooks", "Show per-hook tool availability diagnostics")
    .action(async (cmdOptions: Record<string, unknown>) => {
      const globalOptions = program.opts() as GlobalOptions;
      const options: DoctorOptions = { ...globalOptions, ...cmdOptions };
      initFromOptions(options);
      const result = await doctorHandler(process.cwd(), options);
      handleOutput(result, options);
      process.exit(result.exitCode);
    });
}
