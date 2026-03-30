import type { Command } from "commander";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { resolveProjectDir } from "../utils/paths.js";
import { isPathSafe } from "../utils/path-guard.js";
import { resolveConfig } from "../core/config/resolver.js";
import { createCommandResult } from "../core/output/formatter.js";
import { EXIT_CODES } from "../core/output/exit-codes.js";
import { Logger } from "../core/output/logger.js";
import type { CommandResult } from "../core/output/types.js";
import { initFromOptions, handleOutput } from "./shared.js";
import type { GlobalOptions } from "./shared.js";
import {
  GIT_CLONE_DEPTH,
  REGISTRY_INDEX_FILENAME,
  PROJECT_CLI,
  PROJECT_NAME,
  PROJECT_DIR,
} from "../constants.js";
import { scanSkillFile } from "../core/security/content-scanner.js";
import { promptSecurityFindings } from "../core/security/scan-prompt.js";
import { execFileAsync } from "../utils/exec.js";
import { z } from "zod";

const DEFAULT_REGISTRY = `https://github.com/${PROJECT_NAME}-registry/skills.git`;
const DEFAULT_BRANCH = "main";

const MarketplaceEntrySchema = z.object({
  name: z.string(),
  description: z.string(),
  path: z.string(),
});

type RegistryEntry = z.infer<typeof MarketplaceEntrySchema>;

interface MarketplaceData {
  action: "search" | "install";
  results?: RegistryEntry[];
  installed?: string;
}

async function cloneRegistry(
  registry: string,
  branch: string,
): Promise<string> {
  const tmpDir = path.join(
    os.tmpdir(),
    `${PROJECT_NAME}-registry-${Date.now()}`,
  );
  await execFileAsync("git", [
    "clone",
    "--depth",
    GIT_CLONE_DEPTH,
    "--branch",
    branch,
    registry,
    tmpDir,
  ]);
  return tmpDir;
}

async function readRegistryIndex(
  registryDir: string,
): Promise<RegistryEntry[]> {
  const indexPath = path.join(registryDir, REGISTRY_INDEX_FILENAME);
  const raw = await fs.readFile(indexPath, "utf8");
  const parsed: unknown = JSON.parse(raw);
  const result = z.array(MarketplaceEntrySchema).safeParse(parsed);
  if (!result.success) return [];
  return result.data;
}

function filterEntries(
  entries: RegistryEntry[],
  query: string,
): RegistryEntry[] {
  const lower = query.toLowerCase();
  return entries.filter(
    (e) =>
      e.name.toLowerCase().includes(lower) ||
      e.description.toLowerCase().includes(lower),
  );
}

export async function marketplaceSearchHandler(
  projectRoot: string,
  query: string,
  _options: GlobalOptions,
): Promise<CommandResult<MarketplaceData>> {
  const log = Logger.getInstance();
  const { registry, branch } = await getRegistryConfig(projectRoot);

  let registryDir: string | null = null;
  try {
    log.info(`Searching registry: ${registry}`);
    registryDir = await cloneRegistry(registry, branch);
    const entries = await readRegistryIndex(registryDir);
    const results = filterEntries(entries, query);

    if (results.length === 0) {
      log.info(`No skills found matching "${query}".`);
    } else {
      for (const r of results) {
        log.info(`  ${r.name} — ${r.description}`);
      }
    }

    return createCommandResult({
      success: true,
      command: "marketplace search",
      data: { action: "search", results },
      exitCode: EXIT_CODES.SUCCESS,
    });
  } finally {
    if (registryDir) {
      await fs
        .rm(registryDir, { recursive: true, force: true })
        .catch(() => {});
    }
  }
}

export async function marketplaceInstallHandler(
  projectRoot: string,
  skillName: string,
  _options: GlobalOptions,
): Promise<CommandResult<MarketplaceData>> {
  const log = Logger.getInstance();
  const configDir = resolveProjectDir(projectRoot);
  const { registry, branch } = await getRegistryConfig(projectRoot);

  let registryDir: string | null = null;
  try {
    log.info(`Installing skill "${skillName}" from registry...`);
    registryDir = await cloneRegistry(registry, branch);
    const entries = await readRegistryIndex(registryDir);

    const entry = entries.find((e) => e.name === skillName);
    if (!entry) {
      return createCommandResult({
        success: false,
        command: "marketplace install",
        data: { action: "install" },
        errors: [
          {
            code: "E_GENERAL",
            message: `Skill "${skillName}" not found in registry.`,
            hint: `Use \`${PROJECT_CLI} marketplace search <query>\` to find available skills.`,
            severity: "error",
            context: {},
          },
        ],
        exitCode: EXIT_CODES.GENERAL_ERROR,
      });
    }

    // Validate entry.path stays within registry directory to prevent path traversal
    if (!isPathSafe(registryDir, entry.path)) {
      return createCommandResult({
        success: false,
        command: "marketplace install",
        data: { action: "install" },
        errors: [
          {
            code: "E_GENERAL",
            message: `Invalid path in registry entry for "${skillName}": path traversal detected.`,
            hint: "The registry may be compromised. Do not install from this source.",
            severity: "error",
            context: {},
          },
        ],
        exitCode: EXIT_CODES.GENERAL_ERROR,
      });
    }

    const sourcePath = path.join(registryDir, entry.path);

    // Security scan on skill content before installing
    const content = await fs.readFile(sourcePath, "utf8");
    const scanReport = scanSkillFile(sourcePath, content);
    if (scanReport.verdict !== "pass") {
      const proceed = await promptSecurityFindings(scanReport);
      if (!proceed) {
        return createCommandResult({
          success: false,
          command: "marketplace install",
          data: { action: "install" },
          errors: [
            {
              code: "E_SECURITY_SCAN_BLOCKED",
              message: `Security scan blocked installation of "${skillName}"`,
              hint: "Review the findings above. Re-run and accept to override.",
              severity: "error",
              context: {},
            },
          ],
          exitCode: EXIT_CODES.GENERAL_ERROR,
        });
      }
    }

    const destDir = path.join(configDir, "skills");
    await fs.mkdir(destDir, { recursive: true });

    const destPath = path.join(destDir, `${skillName}.md`);
    await fs.copyFile(sourcePath, destPath);

    log.info(
      `Installed skill "${skillName}" to ${PROJECT_DIR}/skills/${skillName}.md`,
    );

    return createCommandResult({
      success: true,
      command: "marketplace install",
      data: { action: "install", installed: skillName },
      exitCode: EXIT_CODES.SUCCESS,
    });
  } finally {
    if (registryDir) {
      await fs
        .rm(registryDir, { recursive: true, force: true })
        .catch(() => {});
    }
  }
}

async function getRegistryConfig(
  projectRoot: string,
): Promise<{ registry: string; branch: string }> {
  try {
    const configResult = await resolveConfig(projectRoot);
    if (configResult.ok) {
      const manifest = configResult.data.manifest;
      const mp = manifest.marketplace;
      if (mp) {
        return { registry: mp.registry, branch: mp.branch ?? DEFAULT_BRANCH };
      }
    }
  } catch {
    // Fall through to defaults
  }
  return { registry: DEFAULT_REGISTRY, branch: DEFAULT_BRANCH };
}

export function registerMarketplaceCommand(program: Command): void {
  const cmd = program
    .command("marketplace")
    .description("Search and install skills from a registry");

  cmd
    .command("search <query>")
    .description("Search for skills in the registry")
    .action(async (query: string) => {
      const globalOptions = program.opts() as GlobalOptions;
      initFromOptions(globalOptions);
      const result = await marketplaceSearchHandler(
        process.cwd(),
        query,
        globalOptions,
      );
      handleOutput(result, globalOptions);
      process.exit(result.exitCode);
    });

  cmd
    .command("install <name>")
    .description("Install a skill from the registry")
    .action(async (name: string) => {
      const globalOptions = program.opts() as GlobalOptions;
      initFromOptions(globalOptions);
      const result = await marketplaceInstallHandler(
        process.cwd(),
        name,
        globalOptions,
      );
      handleOutput(result, globalOptions);
      process.exit(result.exitCode);
    });
}
