import type { Command } from "commander";
import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import {
  exportSkillCatalogJson,
  buildSkillDocsFile,
} from "../core/docs/skill-docs-generator.js";
import {
  injectSections,
  validateSections,
} from "../core/docs/docs-generator.js";
import { createCommandResult } from "../core/output/formatter.js";
import { EXIT_CODES } from "../core/output/exit-codes.js";
import type { CommandResult } from "../core/output/types.js";
import { initFromOptions, handleOutput } from "./shared.js";
import type { GlobalOptions } from "./shared.js";

interface DocsData {
  outputPath: string;
  totalSkills: number;
  sectionsUpdated?: number;
  sectionsStale?: number;
}

interface DocsCommandOptions extends GlobalOptions {
  output?: string;
  json?: boolean;
  html?: boolean;
  generate?: boolean;
  validate?: boolean;
}

export async function docsHandler(
  projectRoot: string,
  options: DocsCommandOptions,
): Promise<CommandResult<DocsData>> {
  // --validate: check if code-driven doc sections are in sync
  if (options.validate) {
    const result = await validateSections(projectRoot);
    if (!result.ok) {
      return createCommandResult({
        success: false,
        command: "docs",
        data: {
          outputPath: "",
          totalSkills: 0,
          sectionsStale: result.errors.length,
        },
        errors: result.errors.map((e) => ({
          code: e.code,
          message: e.message,
          hint: e.hint,
          severity: e.severity as "warn" | "error",
          context: {},
        })),
        exitCode: EXIT_CODES.GENERAL_ERROR,
      });
    }
    return createCommandResult({
      success: true,
      command: "docs",
      data: { outputPath: "", totalSkills: 0, sectionsStale: 0 },
      exitCode: EXIT_CODES.SUCCESS,
    });
  }

  // --generate: inject code-driven sections into doc files
  if (options.generate) {
    const result = await injectSections(projectRoot);
    if (!result.ok) {
      return createCommandResult({
        success: false,
        command: "docs",
        data: { outputPath: "", totalSkills: 0 },
        errors: result.errors.map((e) => ({
          code: e.code,
          message: e.message,
          hint: e.hint,
          severity: e.severity as "error",
          context: {},
        })),
        exitCode: EXIT_CODES.GENERAL_ERROR,
      });
    }
    const report = result.data;
    return createCommandResult({
      success: true,
      command: "docs",
      data: {
        outputPath: projectRoot,
        totalSkills: 0,
        sectionsUpdated: report.updated.length,
      },
      exitCode: EXIT_CODES.SUCCESS,
    });
  }

  // --json: export JSON catalog to stdout
  if (options.json) {
    const catalog = exportSkillCatalogJson();
    const parsed = JSON.parse(catalog) as { totalSkills: number };
    process.stdout.write(catalog);
    return createCommandResult({
      success: true,
      command: "docs",
      data: { outputPath: "stdout", totalSkills: parsed.totalSkills },
      exitCode: EXIT_CODES.SUCCESS,
    });
  }

  // Default / --html: generate HTML skill catalog
  const outputPath = await buildSkillDocsFile(projectRoot);

  // Also write JSON catalog alongside if no custom output specified
  if (!options.output) {
    const catalog = exportSkillCatalogJson();
    const jsonPath = join(projectRoot, "docs", "_site", "skill-catalog.json");
    await mkdir(dirname(jsonPath), { recursive: true });
    await writeFile(jsonPath, catalog, "utf-8");
  }

  const parsed = JSON.parse(exportSkillCatalogJson()) as {
    totalSkills: number;
  };

  return createCommandResult({
    success: true,
    command: "docs",
    data: { outputPath, totalSkills: parsed.totalSkills },
    exitCode: EXIT_CODES.SUCCESS,
  });
}

export function registerDocsCommand(program: Command): void {
  program
    .command("docs")
    .description("Generate and validate documentation")
    .option("--json", "Output JSON skill catalog to stdout")
    .option("--html", "Generate HTML skill catalog site (default)")
    .option("--generate", "Regenerate code-driven doc sections")
    .option("--validate", "Check if docs are in sync with code")
    .option("--output <path>", "Output file path")
    .action(async (options: DocsCommandOptions) => {
      const globalOptions = program.opts() as GlobalOptions;
      initFromOptions(globalOptions);
      const mergedOptions = { ...globalOptions, ...options };
      const result = await docsHandler(process.cwd(), mergedOptions);
      if (!mergedOptions.json) {
        handleOutput(result, globalOptions);
      }
      process.exit(result.exitCode);
    });
}
