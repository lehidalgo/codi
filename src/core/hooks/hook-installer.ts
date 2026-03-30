import fs from "node:fs/promises";
import path from "node:path";
import type { Result } from "../../types/result.js";
import { ok, err } from "../../types/result.js";
import { createError } from "../output/errors.js";
import type { HookSetup } from "./hook-detector.js";
import type { HookEntry } from "./hook-registry.js";
import type { ResolvedFlags } from "../../types/flags.js";
import {
  RUNNER_TEMPLATE,
  SECRET_SCAN_TEMPLATE,
  FILE_SIZE_CHECK_TEMPLATE,
  COMMIT_MSG_TEMPLATE,
  VERSION_CHECK_TEMPLATE,
} from "./hook-templates.js";
import {
  PRE_COMMIT_MAX_FILE_LINES,
  PROJECT_NAME,
  PROJECT_NAME_DISPLAY,
} from "#src/constants.js";
import type { DependencyCheck } from "./hook-dependency-checker.js";

/** Internal result type for helper functions (no dep checks) */
interface HookFileResult {
  files: string[];
}

export interface HookInstallResult {
  files: string[];
  missingDeps: DependencyCheck[];
}

export interface InstallOptions {
  projectRoot: string;
  runner: HookSetup["runner"];
  hooks: HookEntry[];
  flags: ResolvedFlags;
  commitMsgValidation?: boolean;
  secretScan?: boolean;
  fileSizeCheck?: boolean;
  versionCheck?: boolean;
}

function buildRunnerScript(hooks: HookEntry[]): string {
  const hooksJson = JSON.stringify(hooks, null, 2);
  return RUNNER_TEMPLATE.replace("{{HOOKS_JSON}}", hooksJson);
}

function buildSecretScanScript(): string {
  return SECRET_SCAN_TEMPLATE;
}

function buildFileSizeScript(maxLines: number): string {
  return FILE_SIZE_CHECK_TEMPLATE.replace("{{MAX_LINES}}", String(maxLines));
}

async function writeAuxiliaryScripts(
  hookDir: string,
  options: InstallOptions,
): Promise<string[]> {
  const files: string[] = [];
  if (options.secretScan) {
    const secretPath = path.join(hookDir, `${PROJECT_NAME}-secret-scan.mjs`);
    const secretScript = buildSecretScanScript();
    await fs.writeFile(secretPath, secretScript, {
      encoding: "utf-8",
      mode: 0o755,
    });
    files.push(path.relative(options.projectRoot, secretPath));
  }
  if (options.fileSizeCheck) {
    const sizePath = path.join(hookDir, `${PROJECT_NAME}-file-size-check.mjs`);
    const sizeScript = buildFileSizeScript(PRE_COMMIT_MAX_FILE_LINES);
    await fs.writeFile(sizePath, sizeScript, {
      encoding: "utf-8",
      mode: 0o755,
    });
    files.push(path.relative(options.projectRoot, sizePath));
  }
  if (options.versionCheck) {
    const versionPath = path.join(hookDir, `${PROJECT_NAME}-version-check.mjs`);
    await fs.writeFile(versionPath, VERSION_CHECK_TEMPLATE, {
      encoding: "utf-8",
      mode: 0o755,
    });
    files.push(path.relative(options.projectRoot, versionPath));
  }
  return files;
}

async function installStandalone(
  projectRoot: string,
  hooks: HookEntry[],
  _flags: ResolvedFlags,
  options: InstallOptions,
): Promise<Result<HookFileResult>> {
  const hookDir = path.join(projectRoot, ".git", "hooks");
  try {
    await fs.mkdir(hookDir, { recursive: true });
  } catch {
    return err([
      createError("E_HOOK_FAILED", {
        hook: "pre-commit",
        reason: `Cannot create .git/hooks directory at ${hookDir}`,
      }),
    ]);
  }

  const script = buildRunnerScript(hooks);
  const hookPath = path.join(hookDir, "pre-commit");

  try {
    await fs.writeFile(hookPath, script, { encoding: "utf-8", mode: 0o755 });
    const files: string[] = [path.relative(projectRoot, hookPath)];
    const auxFiles = await writeAuxiliaryScripts(hookDir, options);
    files.push(...auxFiles);
    return ok({ files });
  } catch (cause) {
    return err([
      createError("E_HOOK_FAILED", {
        hook: "pre-commit",
        reason: `Failed to write hook: ${(cause as Error).message}`,
      }),
    ]);
  }
}

function stripGeneratedSection(content: string): string {
  const lines = content.split("\n");
  const filtered: string[] = [];
  let inGeneratedSection = false;

  for (const line of lines) {
    if (line.trim() === `# ${PROJECT_NAME_DISPLAY} hooks`) {
      inGeneratedSection = true;
      continue;
    }
    if (inGeneratedSection && line.trim() === "") {
      inGeneratedSection = false;
      continue;
    }
    if (!inGeneratedSection) {
      filtered.push(line);
    }
  }

  return filtered
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\n+$/, "\n");
}

/**
 * Convert a stagedFilter glob (e.g. `**\/*.{ts,tsx}`) to a grep -E pattern.
 * All registry globs follow `**\/*.ext` or `**\/*.{ext1,ext2}` shape.
 */
function globToGrepPattern(glob: string): string {
  const match = glob.match(/\*\*\/\*\.(?:\{([^}]+)\}|(\w+))$/);
  if (!match) return "";
  const extensions = match[1] ? match[1].split(",") : [match[2]];
  return `\\.(${extensions.join("|")})$`;
}

function buildHuskyCommands(hooks: HookEntry[]): string {
  const lines: string[] = [
    `STAGED=$(git diff --cached --name-only --diff-filter=ACMR)`,
  ];

  // Track which variable names hold files modified by formatters
  const modifiedVars: string[] = [];

  for (const h of hooks) {
    if (!h.stagedFilter) {
      // Global hook (no filter) — always runs
      lines.push(h.command);
      continue;
    }

    const grepPattern = globToGrepPattern(h.stagedFilter);
    const varName = h.name.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase();

    if (!grepPattern) {
      // Catch-all filter (e.g. **/*) — use all staged files directly
      if (h.passFiles === false) {
        lines.push(`[ -n "$STAGED" ] && ${h.command}`);
      } else {
        // Use printf + xargs to safely handle filenames with spaces or special chars
        lines.push(
          `[ -n "$STAGED" ] && printf '%s\\n' $STAGED | xargs ${h.command}`,
        );
      }
      if (h.modifiesFiles) modifiedVars.push("STAGED");
      continue;
    }

    lines.push(
      `${varName}=$(echo "$STAGED" | grep -E '${grepPattern}' || true)`,
    );

    if (h.passFiles === false) {
      // Tool uses project config — run without file args when matching files exist
      lines.push(`[ -n "$${varName}" ] && ${h.command}`);
    } else {
      // Use printf + xargs to safely handle filenames with spaces or special chars
      lines.push(
        `[ -n "$${varName}" ] && printf '%s\\n' $${varName} | xargs ${h.command}`,
      );
    }

    if (h.modifiesFiles) modifiedVars.push(varName);
  }

  // Re-stage files after formatters modify them on disk
  if (modifiedVars.length > 0) {
    const unique = [...new Set(modifiedVars)];
    for (const v of unique) {
      lines.push(`[ -n "$${v}" ] && printf '%s\\n' $${v} | xargs git add`);
    }
  }

  return lines.join("\n");
}

async function installHusky(
  projectRoot: string,
  hooks: HookEntry[],
): Promise<Result<HookFileResult>> {
  const huskyFile = path.join(projectRoot, ".husky", "pre-commit");

  const commands = buildHuskyCommands(hooks);
  const block = `\n# ${PROJECT_NAME_DISPLAY} hooks\n${commands}\n`;

  try {
    let existing = "";
    try {
      existing = await fs.readFile(huskyFile, "utf-8");
    } catch {
      // file doesn't exist yet
    }

    // Remove any existing generated section before appending to prevent duplicates
    const cleaned = stripGeneratedSection(existing);
    await fs.writeFile(huskyFile, cleaned + block, {
      encoding: "utf-8",
      mode: 0o755,
    });
    return ok({ files: [path.relative(projectRoot, huskyFile)] });
  } catch (cause) {
    return err([
      createError("E_HOOK_FAILED", {
        hook: "husky",
        reason: `Failed to write husky hook: ${(cause as Error).message}`,
      }),
    ]);
  }
}

async function installPreCommitFramework(
  projectRoot: string,
  hooks: HookEntry[],
): Promise<Result<HookFileResult>> {
  const configPath = path.join(projectRoot, ".pre-commit-config.yaml");

  const localHooks = hooks
    .map((h) => {
      const lines = [
        `  - id: ${h.name}`,
        `    name: ${h.name}`,
        `    entry: ${h.command}`,
        `    language: system`,
        `    files: '${h.stagedFilter}'`,
      ];
      if (h.passFiles === false) {
        lines.push(`    pass_filenames: false`);
      }
      return lines.join("\n");
    })
    .join("\n");

  const block = `\n# ${PROJECT_NAME_DISPLAY} hooks\n- repo: local\n  hooks:\n${localHooks}\n`;

  try {
    let existing = "";
    try {
      existing = await fs.readFile(configPath, "utf-8");
    } catch {
      // file doesn't exist yet
    }
    await fs.writeFile(configPath, existing + block, "utf-8");
    return ok({ files: [path.relative(projectRoot, configPath)] });
  } catch (cause) {
    return err([
      createError("E_HOOK_FAILED", {
        hook: "pre-commit-config",
        reason: `Failed to write config: ${(cause as Error).message}`,
      }),
    ]);
  }
}

async function installCommitMsgHook(
  projectRoot: string,
  runner: string,
): Promise<Result<HookFileResult>> {
  if (runner === "none" || runner === "lefthook") {
    const hookDir = path.join(projectRoot, ".git", "hooks");
    try {
      await fs.mkdir(hookDir, { recursive: true });
      const hookPath = path.join(hookDir, "commit-msg");
      await fs.writeFile(hookPath, COMMIT_MSG_TEMPLATE, {
        encoding: "utf-8",
        mode: 0o755,
      });
      return ok({ files: [path.relative(projectRoot, hookPath)] });
    } catch (cause) {
      return err([
        createError("E_HOOK_FAILED", {
          hook: "commit-msg",
          reason: `Failed to write commit-msg hook: ${(cause as Error).message}`,
        }),
      ]);
    }
  }
  if (runner === "husky") {
    const huskyFile = path.join(projectRoot, ".husky", "commit-msg");
    try {
      await fs.writeFile(
        huskyFile,
        `# ${PROJECT_NAME_DISPLAY} hooks\n${COMMIT_MSG_TEMPLATE}`,
        {
          encoding: "utf-8",
          mode: 0o755,
        },
      );
      return ok({ files: [path.relative(projectRoot, huskyFile)] });
    } catch (cause) {
      return err([
        createError("E_HOOK_FAILED", {
          hook: "commit-msg",
          reason: `Failed to write husky commit-msg: ${(cause as Error).message}`,
        }),
      ]);
    }
  }
  return ok({ files: [] });
}

async function cleanStaleHooksFromOtherRunner(
  projectRoot: string,
  activeRunner: string,
): Promise<void> {
  const PRE_COMMIT_MARKER = `${PROJECT_NAME_DISPLAY} pre-commit hook runner`;
  const COMMIT_MSG_MARKER = `${PROJECT_NAME_DISPLAY} commit message validator`;

  if (activeRunner === "husky") {
    // Clean stale standalone hooks in .git/hooks/ — husky doesn't use them
    for (const [file, marker] of [
      ["pre-commit", PRE_COMMIT_MARKER],
      ["commit-msg", COMMIT_MSG_MARKER],
    ] as const) {
      const hookPath = path.join(projectRoot, ".git", "hooks", file);
      try {
        const content = await fs.readFile(hookPath, "utf-8");
        if (content.includes(marker)) await fs.unlink(hookPath);
      } catch {
        /* doesn't exist */
      }
    }
  } else if (activeRunner === "none") {
    // Clean stale husky hooks — standalone doesn't use them
    for (const file of ["pre-commit", "commit-msg"]) {
      const huskyPath = path.join(projectRoot, ".husky", file);
      try {
        const content = await fs.readFile(huskyPath, "utf-8");
        if (content.includes(`# ${PROJECT_NAME_DISPLAY} hooks`))
          await fs.unlink(huskyPath);
      } catch {
        /* doesn't exist */
      }
    }
  }
}

export async function installHooks(
  options: InstallOptions,
): Promise<Result<HookInstallResult>> {
  const { projectRoot, runner, hooks, flags } = options;

  if (hooks.length === 0) {
    return ok({ files: [], missingDeps: [] });
  }

  // Clean stale generated hooks from a previous runner before installing
  await cleanStaleHooksFromOtherRunner(projectRoot, runner);

  const allFiles: string[] = [];

  if (options.commitMsgValidation) {
    const msgResult = await installCommitMsgHook(projectRoot, runner);
    if (!msgResult.ok) return msgResult;
    allFiles.push(...msgResult.data.files);
  }

  let runnerResult: Result<HookFileResult>;
  switch (runner) {
    case "none":
      runnerResult = await installStandalone(
        projectRoot,
        hooks,
        flags,
        options,
      );
      break;
    case "husky":
      runnerResult = await installHusky(projectRoot, hooks);
      break;
    case "pre-commit":
      runnerResult = await installPreCommitFramework(projectRoot, hooks);
      break;
    case "lefthook":
      runnerResult = await installStandalone(
        projectRoot,
        hooks,
        flags,
        options,
      );
      break;
    default:
      return err([
        createError("E_HOOK_FAILED", {
          hook: "install",
          reason: `Unsupported runner: ${runner as string}`,
        }),
      ]);
  }

  if (!runnerResult.ok) return runnerResult;
  allFiles.push(...runnerResult.data.files);

  // Write auxiliary .mjs scripts to .git/hooks/ regardless of runner —
  // both husky and standalone reference them by path
  if (runner !== "none") {
    const hookDir = path.join(projectRoot, ".git", "hooks");
    await fs.mkdir(hookDir, { recursive: true });
    const auxFiles = await writeAuxiliaryScripts(hookDir, options);
    allFiles.push(...auxFiles);
  }

  return ok({ files: allFiles, missingDeps: [] });
}

export {
  buildRunnerScript,
  buildSecretScanScript,
  buildFileSizeScript,
  stripGeneratedSection,
  globToGrepPattern,
  buildHuskyCommands,
};
