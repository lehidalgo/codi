import type { Command } from "commander";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { stringify as stringifyYaml } from "yaml";
import * as p from "@clack/prompts";
import { resolveProjectDir } from "../utils/paths.js";
import { createCommandResult } from "../core/output/formatter.js";
import { EXIT_CODES } from "../core/output/exit-codes.js";
import { Logger } from "../core/output/logger.js";
import type { CommandResult } from "../core/output/types.js";
import { initFromOptions, handleOutput, printSection } from "./shared.js";
import type { GlobalOptions } from "./shared.js";
import { parseFrontmatter } from "../utils/frontmatter.js";
import { copyDir } from "../core/preset/preset-registry.js";
import {
  SKILL_OUTPUT_FILENAME,
  PRESET_MANIFEST_FILENAME,
  NAME_PATTERN_STRICT,
  MAX_NAME_LENGTH,
  PROJECT_REPO,
  PROJECT_TARGET_BRANCH,
  PROJECT_CLI,
  PROJECT_NAME,
  PROJECT_NAME_DISPLAY,
  PROJECT_DIR,
} from "../constants.js";
import { execFileAsync } from "../utils/exec.js";

interface ContributeData {
  action: "pr" | "zip" | "cancelled";
  artifacts?: string[];
  prUrl?: string;
  zipPath?: string;
}

export interface ArtifactEntry {
  name: string;
  type: "rule" | "skill" | "agent" | "command";
  managedBy: string;
  path: string;
}

/**
 * Discovers all artifacts in the project config directory.
 * Handles both flat .md files (rules, agents, commands) and
 * directory-based skills (skills/{name}/SKILL.md).
 */
export async function discoverArtifacts(
  configDir: string,
): Promise<ArtifactEntry[]> {
  const artifacts: ArtifactEntry[] = [];

  const scanFlatDir = async (dir: string, type: ArtifactEntry["type"]) => {
    try {
      const entries = await fs.readdir(dir);
      for (const entry of entries) {
        if (!entry.endsWith(".md")) continue;
        const filePath = path.join(dir, entry);
        try {
          const raw = await fs.readFile(filePath, "utf8");
          const { data } = parseFrontmatter<Record<string, unknown>>(raw);
          artifacts.push({
            name: (data["name"] as string) ?? path.basename(entry, ".md"),
            type,
            managedBy: (data["managed_by"] as string) ?? "user",
            path: filePath,
          });
        } catch {
          /* skip invalid files */
        }
      }
    } catch {
      /* dir doesn't exist */
    }
  };

  const scanDirBased = async (
    dir: string,
    type: ArtifactEntry["type"],
    indexFile: string,
  ) => {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const mdPath = path.join(dir, entry.name, indexFile);
        try {
          const raw = await fs.readFile(mdPath, "utf8");
          const { data } = parseFrontmatter<Record<string, unknown>>(raw);
          artifacts.push({
            name: (data["name"] as string) ?? entry.name,
            type,
            managedBy: (data["managed_by"] as string) ?? "user",
            path: path.join(dir, entry.name),
          });
        } catch {
          /* skip invalid entries */
        }
      }
    } catch {
      /* dir doesn't exist */
    }
  };

  await scanFlatDir(path.join(configDir, "rules"), "rule");
  await scanDirBased(
    path.join(configDir, "skills"),
    "skill",
    SKILL_OUTPUT_FILENAME,
  );
  await scanFlatDir(path.join(configDir, "agents"), "agent");
  await scanFlatDir(path.join(configDir, "commands"), "command");

  return artifacts;
}

/**
 * Builds a valid preset package directory from selected artifacts.
 * The resulting directory contains preset.yaml + artifact files,
 * compatible with the ZIP import flow.
 */
export async function buildPresetPackage(
  artifacts: ArtifactEntry[],
  presetName: string,
  stagingDir: string,
): Promise<string> {
  const presetDir = path.join(stagingDir, presetName);
  const artifactNames: Record<string, string[]> = {};

  for (const artifact of artifacts) {
    const typeKey = artifact.type + "s";
    const typeDir = path.join(presetDir, typeKey);
    await fs.mkdir(typeDir, { recursive: true });

    if (artifact.type === "skill") {
      const destSkillDir = path.join(typeDir, artifact.name);
      await fs.mkdir(destSkillDir, { recursive: true });
      await copyDir(artifact.path, destSkillDir);
    } else {
      await fs.copyFile(
        artifact.path,
        path.join(typeDir, path.basename(artifact.path)),
      );
    }

    (artifactNames[typeKey] ??= []).push(artifact.name);
  }

  const manifest = {
    name: presetName,
    description: "Community contribution",
    version: "1.0.0",
    artifacts: Object.fromEntries(
      Object.entries(artifactNames).filter(([, v]) => v.length > 0),
    ),
  };
  await fs.writeFile(
    path.join(presetDir, PRESET_MANIFEST_FILENAME),
    stringifyYaml(manifest),
    "utf8",
  );

  return presetDir;
}

async function checkGhAuth(log: Logger): Promise<boolean> {
  try {
    await execFileAsync("gh", ["auth", "status"]);
    return true;
  } catch (cause) {
    log.warn("GitHub CLI not authenticated.", cause);
    log.warn("Run: gh auth login");
    return false;
  }
}

function getTemplateDir(type: ArtifactEntry["type"]): string {
  switch (type) {
    case "rule":
      return "src/templates/rules";
    case "skill":
      return "src/templates/skills";
    case "agent":
      return "src/templates/agents";
    case "command":
      return "src/templates/commands";
  }
}

/**
 * Reads an artifact's markdown content and wraps it as a TypeScript template export.
 * For skills (directory-based), reads the SKILL.md file.
 */
async function artifactToTemplate(artifact: ArtifactEntry): Promise<string> {
  const dirBasedIndex: Record<string, string> = {
    skill: SKILL_OUTPUT_FILENAME,
  };
  const indexFile = dirBasedIndex[artifact.type];
  const mdPath = indexFile
    ? path.join(artifact.path, indexFile)
    : artifact.path;
  const raw = await fs.readFile(mdPath, "utf8");
  const escaped = raw.replace(/`/g, "\\`").replace(/\$/g, "\\$");
  return `export const template = \`${escaped}\`;\n`;
}

async function createContributionPR(
  artifacts: ArtifactEntry[],
  log: Logger,
): Promise<string | null> {
  const cloneDir = path.join(
    os.tmpdir(),
    `${PROJECT_NAME}-contribute-${Date.now()}`,
  );

  try {
    // 1. Get the authenticated GitHub username
    const { stdout: userLogin } = await execFileAsync("gh", [
      "api",
      "user",
      "--jq",
      ".login",
    ]);
    const ghUser = userLogin.trim();
    if (!ghUser) throw new Error("Could not determine GitHub username");

    // 2. Clone the official repo
    log.info(`Cloning ${PROJECT_NAME} repository...`);
    await execFileAsync("git", [
      "clone",
      "--depth",
      "1",
      `https://github.com/${PROJECT_REPO}.git`,
      cloneDir,
    ]);

    // 3. Ensure user has a repo on their account
    try {
      await execFileAsync("gh", [
        "repo",
        "view",
        `${ghUser}/${PROJECT_NAME}`,
        "--json",
        "name",
      ]);
    } catch {
      log.info(`Creating ${ghUser}/${PROJECT_NAME} on GitHub...`);
      await execFileAsync("gh", [
        "repo",
        "create",
        `${ghUser}/${PROJECT_NAME}`,
        "--public",
        "--description",
        `${PROJECT_NAME_DISPLAY} contributions`,
      ]);
    }

    // 4. Add user's repo as a remote and create branch
    await execFileAsync(
      "git",
      [
        "remote",
        "add",
        "user",
        `https://github.com/${ghUser}/${PROJECT_NAME}.git`,
      ],
      { cwd: cloneDir },
    );

    const branchName = `contrib/add-${artifacts[0]?.name ?? "artifacts"}-${Date.now()}`;
    await execFileAsync("git", ["checkout", "-b", branchName], {
      cwd: cloneDir,
    });

    // 5. Convert each artifact to a TypeScript template
    for (const artifact of artifacts) {
      const destDir = path.join(cloneDir, getTemplateDir(artifact.type));
      const destFile = path.join(destDir, `${artifact.name}.ts`);
      const templateContent = await artifactToTemplate(artifact);
      await fs.mkdir(destDir, { recursive: true });
      await fs.writeFile(destFile, templateContent, "utf8");
    }

    // 6. Commit and push to user's remote
    await execFileAsync("git", ["add", "."], { cwd: cloneDir });
    const names = artifacts.map((a) => `${a.type}:${a.name}`).join(", ");
    await execFileAsync("git", ["commit", "-m", `feat: contribute ${names}`], {
      cwd: cloneDir,
    });

    await execFileAsync("git", ["push", "user", branchName], {
      cwd: cloneDir,
    });

    // 7. Open PR from user's repo to official develop branch
    const { stdout: prUrl } = await execFileAsync(
      "gh",
      [
        "pr",
        "create",
        "--repo",
        PROJECT_REPO,
        "--base",
        PROJECT_TARGET_BRANCH,
        "--head",
        `${ghUser}:${branchName}`,
        "--title",
        `feat: contribute ${names}`,
        "--body",
        `## Contributed Artifacts\n\n${artifacts.map((a) => `- **${a.type}**: ${a.name}`).join("\n")}\n\nGenerated by \`${PROJECT_CLI} contribute\`.`,
      ],
      { cwd: cloneDir },
    );

    return prUrl.trim();
  } catch (error) {
    log.info(
      `PR creation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  } finally {
    await fs.rm(cloneDir, { recursive: true, force: true }).catch(() => {});
  }
}

function cancelResult(): CommandResult<ContributeData> {
  return createCommandResult({
    success: false,
    command: "contribute",
    data: { action: "cancelled" },
    errors: [
      {
        code: "E_GENERAL",
        message: "Operation cancelled.",
        hint: "",
        severity: "error",
        context: {},
      },
    ],
    exitCode: EXIT_CODES.GENERAL_ERROR,
  });
}

export async function contributeHandler(
  projectRoot: string,
): Promise<CommandResult<ContributeData>> {
  const log = Logger.getInstance();
  const configDir = resolveProjectDir(projectRoot);
  p.intro(
    `${PROJECT_CLI} — Contribute to ${PROJECT_NAME_DISPLAY.toUpperCase()}`,
  );

  // Step 1: Discover all artifacts
  const allArtifacts = await discoverArtifacts(configDir);
  if (allArtifacts.length === 0) {
    log.info(`No artifacts found in ${PROJECT_DIR}/. Nothing to contribute.`);
    return createCommandResult({
      success: false,
      command: "contribute",
      data: { action: "cancelled" },
      errors: [
        {
          code: "E_GENERAL",
          message: "No artifacts found.",
          hint: "Add some artifacts first.",
          severity: "error",
          context: {},
        },
      ],
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }

  // Step 2: Select artifacts
  printSection("Select Artifacts");
  const selected = await p.multiselect({
    message: "Select artifacts to contribute",
    options: allArtifacts.map((a) => ({
      label: `[${a.type}] ${a.name}`,
      value: a.name,
      hint: `managed_by: ${a.managedBy}`,
    })),
    required: false,
  });

  if (p.isCancel(selected)) {
    p.cancel("Operation cancelled.");
    return cancelResult();
  }

  if (selected.length === 0) {
    return createCommandResult({
      success: false,
      command: "contribute",
      data: { action: "cancelled" },
      errors: [
        {
          code: "E_GENERAL",
          message: "No artifacts selected.",
          hint: "",
          severity: "error",
          context: {},
        },
      ],
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }

  const selectedArtifacts = allArtifacts.filter((a) =>
    selected.includes(a.name),
  );

  // Step 3: Choose contribution method
  printSection("Distribution");
  const method = await p.select({
    message: "How do you want to contribute?",
    options: [
      {
        label: `Open PR to ${PROJECT_NAME} repository`,
        value: "pr" as const,
        hint: `Requires gh CLI — PR targets ${PROJECT_TARGET_BRANCH} branch`,
      },
      {
        label: "Export as ZIP",
        value: "zip" as const,
        hint: "Re-importable preset package for sharing",
      },
    ],
  });

  if (p.isCancel(method)) {
    p.cancel("Operation cancelled.");
    return cancelResult();
  }

  // Step 4: Execute
  if (method === "pr") {
    if (!(await checkGhAuth(log))) {
      return createCommandResult({
        success: false,
        command: "contribute",
        data: { action: "pr" },
        errors: [
          {
            code: "E_GENERAL",
            message: "GitHub CLI not authenticated.",
            hint: "Run: gh auth login",
            severity: "error",
            context: {},
          },
        ],
        exitCode: EXIT_CODES.GENERAL_ERROR,
      });
    }

    log.info(`Contributing ${selectedArtifacts.length} artifact(s) via PR...`);
    const prUrl = await createContributionPR(selectedArtifacts, log);

    if (prUrl) {
      log.info(`PR created: ${prUrl}`);
      p.outro("Contribution submitted.");
      return createCommandResult({
        success: true,
        command: "contribute",
        data: {
          action: "pr",
          artifacts: selectedArtifacts.map((a) => a.name),
          prUrl,
        },
        exitCode: EXIT_CODES.SUCCESS,
      });
    }

    return createCommandResult({
      success: false,
      command: "contribute",
      data: { action: "pr" },
      errors: [
        {
          code: "E_GENERAL",
          message: "Failed to create PR. Try exporting as ZIP instead.",
          hint: "",
          severity: "error",
          context: {},
        },
      ],
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }

  // ZIP export — builds a re-importable preset package
  printSection("Preset Name");
  const presetNameInput = await p.text({
    message: "Preset name for the exported package",
    placeholder: "my-contribution",
    validate: (val = "") => {
      if (!NAME_PATTERN_STRICT.test(val))
        return "Must be lowercase kebab-case starting with a letter";
      if (val.length > MAX_NAME_LENGTH)
        return `Max ${MAX_NAME_LENGTH} characters`;
      return undefined;
    },
  });

  if (p.isCancel(presetNameInput)) {
    p.cancel("Operation cancelled.");
    return cancelResult();
  }
  const presetName = presetNameInput as string;

  const stagingDir = path.join(
    os.tmpdir(),
    `${PROJECT_NAME}-contrib-${Date.now()}`,
  );
  await fs.mkdir(stagingDir, { recursive: true });

  await buildPresetPackage(selectedArtifacts, presetName, stagingDir);

  const zipPath = path.join(projectRoot, `${presetName}.zip`);
  try {
    await execFileAsync("zip", ["-r", zipPath, presetName], {
      cwd: stagingDir,
    });
    log.info(`Exported to ${zipPath}`);
    p.outro("Contribution exported.");
    return createCommandResult({
      success: true,
      command: "contribute",
      data: {
        action: "zip",
        artifacts: selectedArtifacts.map((a) => a.name),
        zipPath,
      },
      exitCode: EXIT_CODES.SUCCESS,
    });
  } finally {
    await fs.rm(stagingDir, { recursive: true, force: true }).catch(() => {});
  }
}

export function registerContributeCommand(program: Command): void {
  program
    .command("contribute")
    .description(
      `Contribute artifacts as a preset to the ${PROJECT_NAME} community`,
    )
    .action(async () => {
      const globalOptions = program.opts() as GlobalOptions;
      initFromOptions(globalOptions);
      const result = await contributeHandler(process.cwd());
      handleOutput(result, globalOptions);
      process.exit(result.exitCode);
    });
}
