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
import { copyDir, readLockFile } from "../core/preset/preset-registry.js";
import {
  SKILL_OUTPUT_FILENAME,
  PRESET_MANIFEST_FILENAME,
  NAME_PATTERN_STRICT,
  MAX_NAME_LENGTH,
  PROJECT_REPO,
  PROJECT_TARGET_BRANCH,
  PROJECT_CLI,
  PROJECT_NAME,
  PROJECT_DIR,
} from "../constants.js";
import { execFileAsync } from "../utils/exec.js";
import {
  getGitRepoUrl,
  detectDefaultBranch,
  detectClonedBranch,
  checkRepoAccess,
  logCloneAccessError,
  logPushAccessError,
  pushToEmptyRepo,
} from "./contribute-git.js";
import { normalizeGithubRepo } from "../utils/github.js";

interface ContributeData {
  action: "pr" | "zip" | "cancelled";
  artifacts?: string[];
  prUrl?: string;
  zipPath?: string;
}

interface ContributionTarget {
  repo: string; // e.g. "lehidalgo/codi" or "myorg/presets"
  branch: string; // e.g. "develop" or "main"
}

async function resolveContributionTarget(
  configDir: string,
  cliRepo?: string,
  cliBranch?: string,
): Promise<ContributionTarget | symbol> {
  // CLI flags take precedence — skip interactive prompt
  if (cliRepo) {
    const repo = normalizeGithubRepo(cliRepo);
    if (!repo) {
      p.log.error("--repo must be owner/repo or a GitHub URL (https://github.com/owner/repo)");
      return Symbol("cancel");
    }
    const branch =
      cliBranch ??
      (repo === PROJECT_REPO ? PROJECT_TARGET_BRANCH : await detectDefaultBranch(repo));
    return { repo, branch };
  }

  // Build options: always include official repo, then lock file suggestions
  type RepoOption = { label: string; value: string; hint: string };
  const options: RepoOption[] = [
    {
      label: `${PROJECT_NAME} (official)`,
      value: PROJECT_REPO,
      hint: `targets ${PROJECT_TARGET_BRANCH} branch`,
    },
  ];

  try {
    const lock = await readLockFile(configDir);
    const seen = new Set<string>([PROJECT_REPO]);
    for (const entry of Object.values(lock.presets)) {
      if (entry.sourceType === "github" && entry.source.startsWith("github:")) {
        const repoSlug = entry.source.slice("github:".length);
        if (!seen.has(repoSlug)) {
          seen.add(repoSlug);
          options.push({
            label: repoSlug,
            value: repoSlug,
            hint: "from installed preset",
          });
        }
      }
    }
  } catch {
    // Lock file may not exist — continue with default options
  }

  options.push({
    label: "Other repository",
    value: "__other__",
    hint: "enter owner/repo manually",
  });

  const selected = await p.select({
    message: "Select target GitHub repository",
    options,
  });

  if (p.isCancel(selected)) return selected;

  let repoSlug = selected as string;
  if (repoSlug === "__other__") {
    const custom = await p.text({
      message: "Enter target repository",
      placeholder: "owner/repo or https://github.com/owner/repo",
      validate: (val = "") => {
        if (!normalizeGithubRepo(val)) {
          return "Must be owner/repo or a GitHub URL (https://github.com/owner/repo)";
        }
        return undefined;
      },
    });
    if (p.isCancel(custom)) return custom;
    repoSlug = normalizeGithubRepo(custom as string) ?? (custom as string);
  }

  const branch =
    cliBranch ??
    (repoSlug === PROJECT_REPO ? PROJECT_TARGET_BRANCH : await detectDefaultBranch(repoSlug));

  return { repo: repoSlug, branch };
}

export interface ArtifactEntry {
  name: string;
  type: "rule" | "skill" | "agent";
  managedBy: string;
  path: string;
}

/**
 * Discovers all artifacts in the project config directory.
 * Handles both flat .md files (rules, agents) and
 * directory-based skills (skills/{name}/SKILL.md).
 */
export async function discoverArtifacts(configDir: string): Promise<ArtifactEntry[]> {
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

  const scanDirBased = async (dir: string, type: ArtifactEntry["type"], indexFile: string) => {
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
  await scanDirBased(path.join(configDir, "skills"), "skill", SKILL_OUTPUT_FILENAME);
  await scanFlatDir(path.join(configDir, "agents"), "agent");

  return artifacts;
}

/** Builds a valid preset package directory from selected artifacts (preset.yaml + artifact files). */
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
      await fs.copyFile(artifact.path, path.join(typeDir, path.basename(artifact.path)));
    }

    (artifactNames[typeKey] ??= []).push(artifact.name);
  }

  const manifest = {
    name: presetName,
    description: "Community contribution",
    version: "1.0.0",
    artifacts: Object.fromEntries(Object.entries(artifactNames).filter(([, v]) => v.length > 0)),
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

async function createContributionPR(
  artifacts: ArtifactEntry[],
  target: ContributionTarget,
  presetName: string,
  log: Logger,
): Promise<string | null> {
  const repoName = target.repo.split("/")[1] ?? "contribution";
  const cloneDir = path.join(os.tmpdir(), `${repoName}-contribute-${Date.now()}`);

  try {
    // 1. Get the authenticated GitHub username
    const { stdout: userLogin } = await execFileAsync("gh", ["api", "user", "--jq", ".login"]);
    const ghUser = userLogin.trim();
    if (!ghUser) throw new Error("Could not determine GitHub username");

    // 2. Verify access to the target repo before attempting clone
    log.info(`Checking access to ${target.repo}...`);
    const access = await checkRepoAccess(target.repo);
    if (!access.ok) {
      log.error(access.message);
      for (const hint of access.hints) log.info(`  ${hint}`);
      throw new Error(access.message);
    }

    const repoUrl = await getGitRepoUrl(target.repo);

    // 3. Handle empty repos: push initial commit directly (no fork/PR possible)
    if (access.empty) {
      return await pushToEmptyRepo({
        artifacts,
        targetRepo: target.repo,
        targetBranch: target.branch,
        presetName,
        repoUrl,
        cloneDir,
        buildPackage: (dir) => buildPresetPackage(artifacts, presetName, dir).then(() => {}),
        log,
      });
    }

    // 4. Clone the target repo (respect user's git protocol)
    log.info(`Cloning ${target.repo}...`);
    let effectiveBranch = target.branch;
    try {
      await execFileAsync("git", [
        "clone",
        "--depth",
        "1",
        "--branch",
        target.branch,
        repoUrl,
        cloneDir,
      ]);
    } catch (cloneError) {
      const msg = cloneError instanceof Error ? cloneError.message : String(cloneError);
      if (
        msg.includes("Remote branch") ||
        msg.includes("not found in upstream") ||
        msg.includes("did not match any file(s) known to git")
      ) {
        // Branch name was wrong — clone without --branch to use the remote's default
        log.warn(`Branch '${target.branch}' not found — cloning remote default branch instead.`);
        await execFileAsync("git", ["clone", "--depth", "1", repoUrl, cloneDir]);
        effectiveBranch = await detectClonedBranch(cloneDir);
        log.info(`Using default branch: ${effectiveBranch}`);
      } else {
        logCloneAccessError(log, msg, target.repo);
        throw cloneError;
      }
    }

    // 5. Fork the target repo (idempotent — no-op if fork exists or user owns it)
    try {
      await execFileAsync("gh", ["repo", "fork", target.repo, "--clone=false"]);
    } catch (forkError) {
      const msg = forkError instanceof Error ? forkError.message : String(forkError);
      if (msg.includes("not fork") || msg.includes("forbidden") || msg.includes("403")) {
        log.warn(`Could not fork ${target.repo} — you may be the owner or forking is restricted.`);
      }
    }

    // 6. Add user's fork as a remote and create branch
    const userRepoUrl = await getGitRepoUrl(`${ghUser}/${repoName}`);
    await execFileAsync("git", ["remote", "add", "user", userRepoUrl], {
      cwd: cloneDir,
    });

    const branchName = `contrib/add-${artifacts[0]?.name ?? "artifacts"}-${Date.now()}`;
    await execFileAsync("git", ["checkout", "-b", branchName], {
      cwd: cloneDir,
    });

    // 7. Build preset package, commit, and push
    await buildPresetPackage(artifacts, presetName, cloneDir);
    await execFileAsync("git", ["add", "."], { cwd: cloneDir });

    const { summary, details } = formatArtifactSummary(artifacts);
    const commitMsg = `feat: contribute ${summary}\n\n${details}`;
    await execFileAsync("git", ["commit", "-m", commitMsg], { cwd: cloneDir });

    try {
      await execFileAsync("git", ["push", "user", branchName], {
        cwd: cloneDir,
      });
    } catch (pushError) {
      const msg = pushError instanceof Error ? pushError.message : String(pushError);
      logPushAccessError(log, msg, ghUser, repoName);
      throw pushError;
    }

    // 8. Open PR from user's fork to target repo's effective base branch
    const { stdout: prUrl } = await execFileAsync(
      "gh",
      [
        "pr",
        "create",
        "--repo",
        target.repo,
        "--base",
        effectiveBranch,
        "--head",
        `${ghUser}:${branchName}`,
        "--title",
        `feat: contribute ${summary}`,
        "--body",
        `## Contributed Artifacts\n\n${details}\n\n---\nGenerated by \`${PROJECT_CLI} contribute\`.`,
      ],
      { cwd: cloneDir },
    );

    return prUrl.trim();
  } catch (error) {
    log.error(`PR creation failed: ${error instanceof Error ? error.message : String(error)}`);
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

function formatArtifactSummary(artifacts: ArtifactEntry[]): { summary: string; details: string } {
  const grouped: Record<string, string[]> = {};
  for (const a of artifacts) {
    (grouped[a.type] ??= []).push(a.name);
  }
  const summary = Object.entries(grouped)
    .map(([type, names]) => `${names.length} ${type}(s)`)
    .join(", ");
  const details = Object.entries(grouped)
    .map(
      ([type, names]) =>
        `### ${type.charAt(0).toUpperCase() + type.slice(1)}s\n${names.map((n) => `- ${n}`).join("\n")}`,
    )
    .join("\n\n");
  return { summary, details };
}

export async function contributeHandler(
  projectRoot: string,
  cliRepo?: string,
  cliBranch?: string,
): Promise<CommandResult<ContributeData>> {
  const log = Logger.getInstance();
  const configDir = resolveProjectDir(projectRoot);
  p.intro(`${PROJECT_CLI} — Contribute Artifacts`);

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

  const selectedArtifacts = allArtifacts.filter((a) => selected.includes(a.name));

  // Step 3: Choose contribution method
  printSection("Distribution");
  const method = await p.select({
    message: "How do you want to contribute?",
    options: [
      {
        label: "Open PR to a GitHub repository",
        value: "pr" as const,
        hint: "Requires gh CLI — fork and PR workflow",
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

    printSection("Target Repository");
    const target = await resolveContributionTarget(configDir, cliRepo, cliBranch);
    if (p.isCancel(target)) {
      p.cancel("Operation cancelled.");
      return cancelResult();
    }

    printSection("Preset Name");
    const prPresetNameInput = await p.text({
      message: "Preset name for the contributed package",
      placeholder: "my-preset",
      validate: (val = "") => {
        if (!NAME_PATTERN_STRICT.test(val))
          return "Must be lowercase kebab-case starting with a letter";
        if (val.length > MAX_NAME_LENGTH) return `Max ${MAX_NAME_LENGTH} characters`;
        return undefined;
      },
    });

    if (p.isCancel(prPresetNameInput)) {
      p.cancel("Operation cancelled.");
      return cancelResult();
    }
    const prPresetName = prPresetNameInput as string;

    log.info(`Contributing ${selectedArtifacts.length} artifact(s) via PR to ${target.repo}...`);
    const prUrl = await createContributionPR(selectedArtifacts, target, prPresetName, log);

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
      if (val.length > MAX_NAME_LENGTH) return `Max ${MAX_NAME_LENGTH} characters`;
      return undefined;
    },
  });

  if (p.isCancel(presetNameInput)) {
    p.cancel("Operation cancelled.");
    return cancelResult();
  }
  const presetName = presetNameInput as string;

  const stagingDir = path.join(os.tmpdir(), `${PROJECT_NAME}-contrib-${Date.now()}`);
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
    .description("Contribute artifacts as a preset via PR or ZIP")
    .option("--repo <repo>", "Target GitHub repository (owner/repo or full URL)")
    .option("--branch <name>", "Target branch for the PR")
    .action(async (options: { repo?: string; branch?: string }) => {
      const globalOptions = program.opts() as GlobalOptions;
      initFromOptions(globalOptions);
      const result = await contributeHandler(process.cwd(), options.repo, options.branch);
      handleOutput(result, globalOptions);
      process.exit(result.exitCode);
    });
}
