import fs from "node:fs/promises";
import path from "node:path";
import type { Result } from "#src/types/result.js";
import { ok, err } from "#src/types/result.js";
import { createError } from "../output/errors.js";
import type { HookSetup } from "./hook-detector.js";
import type { HookEntry } from "./hook-registry.js";
import type { ResolvedFlags } from "#src/types/flags.js";
import {
  RUNNER_TEMPLATE,
  SECRET_SCAN_TEMPLATE,
  FILE_SIZE_CHECK_TEMPLATE,
  VERSION_CHECK_TEMPLATE,
  TEMPLATE_WIRING_CHECK_TEMPLATE,
  DOC_NAMING_CHECK_TEMPLATE,
  ARTIFACT_VALIDATE_TEMPLATE,
  SKILL_RESOURCE_CHECK_TEMPLATE,
  SKILL_PATH_WRAP_CHECK_TEMPLATE,
  STAGED_JUNK_CHECK_TEMPLATE,
} from "./hook-templates.js";
import { BRAND_SKILL_VALIDATE_TEMPLATE } from "./brand-skill-validate-template.js";
import { renderShellHooks } from "./renderers/shell-renderer.js";
import {
  COMMIT_MSG_TEMPLATE,
  PRE_PUSH_DOC_CHECK_TEMPLATE,
  IMPORT_DEPTH_CHECK_TEMPLATE,
  SKILL_YAML_VALIDATE_TEMPLATE,
} from "./hook-policy-templates.js";
import { VERSION_BUMP_TEMPLATE } from "./version-bump-template.js";
import { VERSION_VERIFY_PRE_PUSH_TEMPLATE } from "./version-verify-pre-push-template.js";
import { PRE_COMMIT_MAX_FILE_LINES, PROJECT_NAME, PROJECT_NAME_DISPLAY } from "#src/constants.js";
import type { DependencyCheck } from "./hook-dependency-checker.js";
import {
  PRE_COMMIT_BEGIN_MARKER,
  PRE_COMMIT_END_MARKER,
  globToPythonRegex,
  renderPreCommitBlock,
  findReposInsertionPoint,
  stripPreCommitGeneratedBlock,
  installPreCommitFramework,
} from "./pre-commit-framework.js";

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
  templateWiringCheck?: boolean;
  docNamingCheck?: boolean;
  artifactValidation?: boolean;
  importDepthCheck?: boolean;
  skillYamlValidation?: boolean;
  skillResourceCheck?: boolean;
  skillPathWrapCheck?: boolean;
  stagedJunkCheck?: boolean;
  versionBump?: boolean;
  versionVerify?: boolean;
  brandSkillValidation?: boolean;
  docCheck?: boolean;
  docProtectedBranches?: string[];
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

function buildTemplateWiringScript(): string {
  return TEMPLATE_WIRING_CHECK_TEMPLATE;
}

function buildArtifactValidateScript(): string {
  return ARTIFACT_VALIDATE_TEMPLATE;
}

function buildVersionBumpScript(): string {
  return VERSION_BUMP_TEMPLATE;
}

function buildStagedJunkCheckScript(): string {
  return STAGED_JUNK_CHECK_TEMPLATE;
}

async function writeAuxiliaryScripts(hookDir: string, options: InstallOptions): Promise<string[]> {
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
  if (options.templateWiringCheck) {
    const wiringPath = path.join(hookDir, `${PROJECT_NAME}-template-wiring-check.mjs`);
    const wiringScript = buildTemplateWiringScript();
    await fs.writeFile(wiringPath, wiringScript, {
      encoding: "utf-8",
      mode: 0o755,
    });
    files.push(path.relative(options.projectRoot, wiringPath));
  }
  if (options.docNamingCheck) {
    const docNamingPath = path.join(hookDir, `${PROJECT_NAME}-doc-naming-check.mjs`);
    await fs.writeFile(docNamingPath, DOC_NAMING_CHECK_TEMPLATE, {
      encoding: "utf-8",
      mode: 0o755,
    });
    files.push(path.relative(options.projectRoot, docNamingPath));
  }
  if (options.artifactValidation) {
    const artifactPath = path.join(hookDir, `${PROJECT_NAME}-artifact-validate.mjs`);
    const artifactScript = buildArtifactValidateScript();
    await fs.writeFile(artifactPath, artifactScript, {
      encoding: "utf-8",
      mode: 0o755,
    });
    files.push(path.relative(options.projectRoot, artifactPath));
  }
  if (options.importDepthCheck) {
    const importDepthPath = path.join(hookDir, `${PROJECT_NAME}-import-depth-check.mjs`);
    await fs.writeFile(importDepthPath, IMPORT_DEPTH_CHECK_TEMPLATE, {
      encoding: "utf-8",
      mode: 0o755,
    });
    files.push(path.relative(options.projectRoot, importDepthPath));
  }
  if (options.skillYamlValidation) {
    const skillYamlPath = path.join(hookDir, `${PROJECT_NAME}-skill-yaml-validate.mjs`);
    await fs.writeFile(skillYamlPath, SKILL_YAML_VALIDATE_TEMPLATE, {
      encoding: "utf-8",
      mode: 0o755,
    });
    files.push(path.relative(options.projectRoot, skillYamlPath));
  }
  if (options.skillResourceCheck) {
    const resourceCheckPath = path.join(hookDir, `${PROJECT_NAME}-skill-resource-check.mjs`);
    await fs.writeFile(resourceCheckPath, SKILL_RESOURCE_CHECK_TEMPLATE, {
      encoding: "utf-8",
      mode: 0o755,
    });
    files.push(path.relative(options.projectRoot, resourceCheckPath));
  }
  if (options.skillPathWrapCheck) {
    const pathWrapCheckPath = path.join(hookDir, `${PROJECT_NAME}-skill-path-wrap-check.mjs`);
    await fs.writeFile(pathWrapCheckPath, SKILL_PATH_WRAP_CHECK_TEMPLATE, {
      encoding: "utf-8",
      mode: 0o755,
    });
    files.push(path.relative(options.projectRoot, pathWrapCheckPath));
  }
  if (options.stagedJunkCheck) {
    const junkCheckPath = path.join(hookDir, `${PROJECT_NAME}-staged-junk-check.mjs`);
    await fs.writeFile(junkCheckPath, STAGED_JUNK_CHECK_TEMPLATE, {
      encoding: "utf-8",
      mode: 0o755,
    });
    files.push(path.relative(options.projectRoot, junkCheckPath));
  }
  if (options.versionBump) {
    const versionBumpPath = path.join(hookDir, `${PROJECT_NAME}-version-bump.mjs`);
    const versionBumpScript = buildVersionBumpScript();
    await fs.writeFile(versionBumpPath, versionBumpScript, {
      encoding: "utf-8",
      mode: 0o755,
    });
    files.push(path.relative(options.projectRoot, versionBumpPath));
  }
  if (options.versionVerify) {
    const versionVerifyPath = path.join(hookDir, `${PROJECT_NAME}-version-verify.mjs`);
    await fs.writeFile(versionVerifyPath, VERSION_VERIFY_PRE_PUSH_TEMPLATE, {
      encoding: "utf-8",
      mode: 0o755,
    });
    files.push(path.relative(options.projectRoot, versionVerifyPath));
  }
  if (options.brandSkillValidation) {
    const brandSkillPath = path.join(hookDir, `${PROJECT_NAME}-brand-skill-validate.mjs`);
    await fs.writeFile(brandSkillPath, BRAND_SKILL_VALIDATE_TEMPLATE, {
      encoding: "utf-8",
      mode: 0o755,
    });
    files.push(path.relative(options.projectRoot, brandSkillPath));
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
  const lines: string[] = [`STAGED=$(git diff --cached --name-only --diff-filter=ACMR)`];

  // Track which variable names hold files modified by formatters
  const modifiedVars: string[] = [];
  let lastLanguage: string | undefined;

  for (const h of hooks) {
    // Insert a language-group comment whenever the language changes
    const currentLang = h.language ?? "";
    if (currentLang !== lastLanguage) {
      lines.push(currentLang ? `# — ${currentLang} —` : `# — global —`);
      lastLanguage = currentLang;
    }

    const cmd = h.shell.command;
    const passFiles = h.shell.passFiles;
    const modifiesFiles = h.shell.modifiesFiles;

    if (!h.files) {
      // Global hook (no filter) — always runs; guard tool presence for required hooks
      const globalTool = cmd.split(/\s+/)[0]!;
      if (h.required === true) {
        const hint = h.installHint.command || `install ${globalTool}`;
        lines.push(
          `if ! command -v ${globalTool} > /dev/null 2>&1; then`,
          `  echo "  ✗ BLOCKING — install ${h.name} to commit: ${hint}"`,
          `  exit 1`,
          `fi`,
          cmd,
        );
      } else {
        lines.push(cmd);
      }
      continue;
    }

    const grepPattern = globToGrepPattern(h.files);
    const varName = h.name.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase();

    if (!grepPattern) {
      // Catch-all filter (e.g. **/*) — use all staged files directly
      if (passFiles === false) {
        lines.push(`[ -n "$STAGED" ] && ${cmd}`);
      } else {
        lines.push(`[ -n "$STAGED" ] && printf '%s\\n' $STAGED | xargs ${cmd}`);
      }
      if (modifiesFiles) modifiedVars.push("STAGED");
      continue;
    }

    lines.push(`${varName}=$(echo "$STAGED" | grep -E '${grepPattern}' || true)`);

    if (h.required === true) {
      const tool = h.shell.toolBinary;
      const hint = h.installHint.command || `install ${tool}`;
      if (passFiles === false) {
        lines.push(
          `if [ -n "$${varName}" ]; then`,
          `  if ! command -v ${tool} > /dev/null 2>&1 && ! [ -f "./node_modules/.bin/${tool}" ]; then`,
          `    echo "  ✗ BLOCKING — install ${h.name} to commit: ${hint}"`,
          `    exit 1`,
          `  fi`,
          `  ${cmd}`,
          `fi`,
        );
      } else {
        lines.push(
          `if [ -n "$${varName}" ]; then`,
          `  if ! command -v ${tool} > /dev/null 2>&1 && ! [ -f "./node_modules/.bin/${tool}" ]; then`,
          `    echo "  ✗ BLOCKING — install ${h.name} to commit: ${hint}"`,
          `    exit 1`,
          `  fi`,
          `  printf '%s\\n' $${varName} | xargs ${cmd}`,
          `fi`,
        );
      }
    } else if (passFiles === false) {
      lines.push(`[ -n "$${varName}" ] && ${cmd}`);
    } else {
      lines.push(`[ -n "$${varName}" ] && printf '%s\\n' $${varName} | xargs ${cmd}`);
    }

    if (modifiesFiles) modifiedVars.push(varName);
  }

  // Re-stage files after formatters modify them on disk
  if (modifiedVars.length > 0) {
    const unique = [...new Set(modifiedVars)];
    for (const v of unique) {
      lines.push(`[ -n "$${v}" ] && printf '%s\\n' $${v} | xargs git add || true`);
    }
  }

  return lines.join("\n");
}

async function installHusky(
  projectRoot: string,
  hooks: HookEntry[],
): Promise<Result<HookFileResult>> {
  const huskyFile = path.join(projectRoot, ".husky", "pre-commit");

  const commands = renderShellHooks(hooks, "husky");
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
      await fs.writeFile(huskyFile, `# ${PROJECT_NAME_DISPLAY} hooks\n${COMMIT_MSG_TEMPLATE}`, {
        encoding: "utf-8",
        mode: 0o755,
      });
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

async function installPrePushHook(
  projectRoot: string,
  runner: string,
  protectedBranches: string[],
): Promise<Result<HookFileResult>> {
  const script = PRE_PUSH_DOC_CHECK_TEMPLATE.replace(
    "{{PROTECTED_BRANCHES}}",
    protectedBranches.join(" "),
  );

  if (runner === "husky") {
    const huskyFile = path.join(projectRoot, ".husky", "pre-push");
    try {
      await fs.writeFile(huskyFile, script, { encoding: "utf-8", mode: 0o755 });
      return ok({ files: [path.relative(projectRoot, huskyFile)] });
    } catch (cause) {
      return err([
        createError("E_HOOK_FAILED", {
          hook: "pre-push",
          reason: `Failed to write husky pre-push: ${(cause as Error).message}`,
        }),
      ]);
    }
  }

  // standalone, lefthook, pre-commit framework: write directly to .git/hooks/pre-push
  const hookDir = path.join(projectRoot, ".git", "hooks");
  try {
    await fs.mkdir(hookDir, { recursive: true });
    const hookPath = path.join(hookDir, "pre-push");
    await fs.writeFile(hookPath, script, { encoding: "utf-8", mode: 0o755 });
    return ok({ files: [path.relative(projectRoot, hookPath)] });
  } catch (cause) {
    return err([
      createError("E_HOOK_FAILED", {
        hook: "pre-push",
        reason: `Failed to write pre-push hook: ${(cause as Error).message}`,
      }),
    ]);
  }
}

async function cleanStaleHooksFromOtherRunner(
  projectRoot: string,
  activeRunner: string,
): Promise<void> {
  const PRE_COMMIT_MARKER = `${PROJECT_NAME_DISPLAY} pre-commit hook runner`;
  const COMMIT_MSG_MARKER = `${PROJECT_NAME_DISPLAY} commit message validator`;
  const PRE_PUSH_MARKER = `${PROJECT_NAME_DISPLAY} documentation checkpoint`;

  if (activeRunner === "husky") {
    // Clean stale standalone hooks in .git/hooks/ — husky doesn't use them
    for (const [file, marker] of [
      ["pre-commit", PRE_COMMIT_MARKER],
      ["commit-msg", COMMIT_MSG_MARKER],
      ["pre-push", PRE_PUSH_MARKER],
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
    for (const file of ["pre-commit", "commit-msg", "pre-push"]) {
      const huskyPath = path.join(projectRoot, ".husky", file);
      try {
        const content = await fs.readFile(huskyPath, "utf-8");
        if (content.includes(`# ${PROJECT_NAME_DISPLAY} hooks`)) await fs.unlink(huskyPath);
      } catch {
        /* doesn't exist */
      }
    }
  }
}

export async function installHooks(options: InstallOptions): Promise<Result<HookInstallResult>> {
  const { projectRoot, runner, hooks, flags } = options;

  if (hooks.length === 0 && !options.docCheck) {
    return ok({ files: [], missingDeps: [] });
  }

  // Clean stale generated hooks from a previous runner before installing
  await cleanStaleHooksFromOtherRunner(projectRoot, runner);

  const allFiles: string[] = [];

  if (options.docCheck) {
    const branches = options.docProtectedBranches ?? ["main", "develop", "release/*"];
    const prePushResult = await installPrePushHook(projectRoot, runner, branches);
    if (!prePushResult.ok) return prePushResult;
    allFiles.push(...prePushResult.data.files);
  }

  if (hooks.length === 0) {
    return ok({ files: allFiles, missingDeps: [] });
  }

  if (options.commitMsgValidation) {
    const msgResult = await installCommitMsgHook(projectRoot, runner);
    if (!msgResult.ok) return msgResult;
    allFiles.push(...msgResult.data.files);
  }

  let runnerResult: Result<HookFileResult>;
  switch (runner) {
    case "none":
      runnerResult = await installStandalone(projectRoot, hooks, flags, options);
      break;
    case "husky":
      runnerResult = await installHusky(projectRoot, hooks);
      break;
    case "pre-commit":
      runnerResult = await installPreCommitFramework(projectRoot, hooks);
      break;
    case "lefthook":
      runnerResult = await installStandalone(projectRoot, hooks, flags, options);
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
  buildTemplateWiringScript,
  buildVersionBumpScript,
  buildStagedJunkCheckScript,
  stripGeneratedSection,
  stripPreCommitGeneratedBlock,
  globToGrepPattern,
  globToPythonRegex,
  renderPreCommitBlock,
  findReposInsertionPoint,
  buildHuskyCommands,
  installPreCommitFramework,
  PRE_COMMIT_BEGIN_MARKER,
  PRE_COMMIT_END_MARKER,
};
