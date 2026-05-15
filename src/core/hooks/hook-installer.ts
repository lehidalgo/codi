import fs from "node:fs/promises";
import path from "node:path";
import type { Result } from "#src/types/result.js";
import { ok, err } from "#src/types/result.js";
import { createError } from "../output/errors.js";
import type { HookSetup } from "./hook-detector.js";
import type { HookEntry } from "./hook-registry.js";
import type { ResolvedFlags } from "#src/types/flags.js";
import {
  VERSION_CHECK_TEMPLATE,
  DOC_NAMING_CHECK_TEMPLATE,
  SKILL_RESOURCE_CHECK_TEMPLATE,
  SKILL_PATH_WRAP_CHECK_TEMPLATE,
} from "./hook-templates.js";
import {
  buildRunnerScript,
  buildSecretScanScript,
  buildFileSizeScript,
  buildTemplateWiringScript,
  buildArtifactValidateScript,
  buildVersionBumpScript,
  buildStagedJunkCheckScript,
} from "./hook-installer-scripts.js";
import { CONFLICT_MARKER_CHECK_TEMPLATE } from "./conflict-marker-template.js";
import { BRAND_SKILL_VALIDATE_TEMPLATE } from "./brand-skill-validate-template.js";
import { renderShellHooks } from "./renderers/shell-renderer.js";
import {
  COMMIT_MSG_TEMPLATE,
  PRE_PUSH_DOC_CHECK_TEMPLATE,
  IMPORT_DEPTH_CHECK_TEMPLATE,
  SKILL_YAML_VALIDATE_TEMPLATE,
} from "./hook-policy-templates.js";
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
  conflictMarkerCheck?: boolean;
  versionBump?: boolean;
  versionVerify?: boolean;
  brandSkillValidation?: boolean;
  docCheck?: boolean;
  docProtectedBranches?: string[];
}

/**
 * CORE-014 — declarative table of auxiliary hook scripts written
 * alongside the standalone pre-commit runner. Pre-CORE-014 each entry
 * here was a hand-rolled `if (options.flag) { … writeFile … push … }`
 * block in `writeAuxiliaryScripts`; the table consolidates the 15
 * blocks into a single iterator below.
 *
 * `body` is a thunk so constant templates and `buildXScript()` factory
 * calls coexist on the same surface. Adding aux-hook #N is now a
 * single row here plus the matching `InstallOptions` flag.
 *
 * Order MUST stay stable — the order of `writeFile` calls is part of
 * the byte-equal contract that the existing installer tests rely on.
 */
const AUX_HOOKS: ReadonlyArray<{
  readonly flag: keyof InstallOptions;
  readonly slug: string;
  readonly body: () => string;
}> = [
  { flag: "secretScan", slug: "secret-scan", body: buildSecretScanScript },
  {
    flag: "fileSizeCheck",
    slug: "file-size-check",
    body: () => buildFileSizeScript(PRE_COMMIT_MAX_FILE_LINES),
  },
  { flag: "versionCheck", slug: "version-check", body: () => VERSION_CHECK_TEMPLATE },
  { flag: "templateWiringCheck", slug: "template-wiring-check", body: buildTemplateWiringScript },
  { flag: "docNamingCheck", slug: "doc-naming-check", body: () => DOC_NAMING_CHECK_TEMPLATE },
  { flag: "artifactValidation", slug: "artifact-validate", body: buildArtifactValidateScript },
  {
    flag: "importDepthCheck",
    slug: "import-depth-check",
    body: () => IMPORT_DEPTH_CHECK_TEMPLATE,
  },
  {
    flag: "skillYamlValidation",
    slug: "skill-yaml-validate",
    body: () => SKILL_YAML_VALIDATE_TEMPLATE,
  },
  {
    flag: "skillResourceCheck",
    slug: "skill-resource-check",
    body: () => SKILL_RESOURCE_CHECK_TEMPLATE,
  },
  {
    flag: "skillPathWrapCheck",
    slug: "skill-path-wrap-check",
    body: () => SKILL_PATH_WRAP_CHECK_TEMPLATE,
  },
  { flag: "stagedJunkCheck", slug: "staged-junk-check", body: buildStagedJunkCheckScript },
  {
    flag: "conflictMarkerCheck",
    slug: "conflict-marker-check",
    body: () => CONFLICT_MARKER_CHECK_TEMPLATE,
  },
  { flag: "versionBump", slug: "version-bump", body: buildVersionBumpScript },
  { flag: "versionVerify", slug: "version-verify", body: () => VERSION_VERIFY_PRE_PUSH_TEMPLATE },
  {
    flag: "brandSkillValidation",
    slug: "brand-skill-validate",
    body: () => BRAND_SKILL_VALIDATE_TEMPLATE,
  },
];

/**
 * Write every auxiliary script whose `InstallOptions` flag is enabled.
 * Pre-CORE-014 this function was 129 LOC of hand-rolled if-blocks
 * with the same shape (mkdir was not needed; only writeFile + push);
 * the table-driven loop below collapses them to ~10 LOC of logic
 * while preserving order and byte-equal output.
 */
async function writeAuxiliaryScripts(hookDir: string, options: InstallOptions): Promise<string[]> {
  const files: string[] = [];
  for (const { flag, slug, body } of AUX_HOOKS) {
    if (!options[flag]) continue;
    const filePath = path.join(hookDir, `${PROJECT_NAME}-${slug}.mjs`);
    await fs.writeFile(filePath, body(), { encoding: "utf-8", mode: 0o755 });
    files.push(path.relative(options.projectRoot, filePath));
  }
  return files;
}

async function installStandalone(
  projectRoot: string,
  hooks: HookEntry[],
  _flags: ResolvedFlags,
  options: InstallOptions,
): Promise<Result<HookFileResult>> {
  const script = buildRunnerScript(hooks);
  const result = await writeHookFile({
    projectRoot,
    runner: "standalone",
    kind: "pre-commit",
    content: script,
  });
  if (!result.ok) return result;

  // Auxiliary scripts (secret-scan, file-size-check, …) live alongside
  // the pre-commit runner in `.git/hooks/`. CORE-014 will table-drive
  // this; for now the orchestration stays here.
  const hookDir = path.join(projectRoot, ".git", "hooks");
  const auxFiles = await writeAuxiliaryScripts(hookDir, options);
  return ok({ files: [...result.data.files, ...auxFiles] });
}

/**
 * CORE-013 — unified hook file writer.
 *
 * Pre-CORE-013, four sibling helpers (`installStandalone`,
 * `installHusky`, `installCommitMsgHook`, `installPrePushHook`)
 * duplicated the same `mkdir + writeFile mode 0o755 + try/catch +
 * Result<HookFileResult>` skeleton. Differences were target path
 * (`.git/hooks/<kind>` vs `.husky/<kind>`), an optional husky banner
 * prefix, and the husky pre-commit read-modify-write strip-and-append.
 * This single function captures the variants.
 *
 * `runner === "husky"` writes to `.husky/<kind>` and never `mkdir`s
 * (husky-init owns the directory). Everything else writes to
 * `.git/hooks/<kind>` with `mkdir -p`. The `huskyHeader` flag prepends
 * `# ${PROJECT_NAME_DISPLAY} hooks\n` — required by the commit-msg
 * husky variant and by the husky pre-commit append; intentionally
 * absent from husky pre-push (preserves the existing inconsistency
 * so byte-equal tests stay green). `stripPriorGenerated` is the
 * read-modify-write knob for the husky pre-commit case: read existing
 * file, strip any prior block matching the banner, then append the
 * new block separated by a blank line.
 */
async function writeHookFile(opts: {
  projectRoot: string;
  runner: "standalone" | "husky" | "lefthook" | "pre-commit";
  kind: "pre-commit" | "commit-msg" | "pre-push";
  content: string;
  huskyHeader?: boolean;
  stripPriorGenerated?: boolean;
}): Promise<Result<HookFileResult>> {
  const targetDir =
    opts.runner === "husky"
      ? path.join(opts.projectRoot, ".husky")
      : path.join(opts.projectRoot, ".git", "hooks");
  const hookPath = path.join(targetDir, opts.kind);

  try {
    if (opts.runner !== "husky") {
      await fs.mkdir(targetDir, { recursive: true });
    }

    let payload = opts.content;
    if (opts.stripPriorGenerated) {
      let existing = "";
      try {
        existing = await fs.readFile(hookPath, "utf-8");
      } catch {
        // file doesn't exist yet
      }
      const cleaned = stripGeneratedSection(existing);
      // The husky pre-commit case feeds the block content (commands)
      // and lets writeHookFile compose the banner + leading newline.
      const block = opts.huskyHeader
        ? `\n# ${PROJECT_NAME_DISPLAY} hooks\n${opts.content}\n`
        : `\n${opts.content}\n`;
      payload = cleaned + block;
    } else if (opts.huskyHeader) {
      payload = `# ${PROJECT_NAME_DISPLAY} hooks\n${opts.content}`;
    }

    await fs.writeFile(hookPath, payload, { encoding: "utf-8", mode: 0o755 });
    return ok({ files: [path.relative(opts.projectRoot, hookPath)] });
  } catch (cause) {
    return err([
      createError("E_HOOK_FAILED", {
        hook: opts.kind,
        reason: `Failed to write ${opts.kind} hook: ${(cause as Error).message}`,
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

/**
 * Legacy husky shell renderer. Retained as a byte-for-byte parity baseline
 * for the test suite. Production code uses `renderShellHooks` from
 * `./renderers/shell-renderer.js`. Both implementations filter hooks to
 * those declaring `stages.includes("pre-commit")` — pre-push and commit-msg
 * specs are routed to their own hook files by the installer.
 */
function buildHuskyCommands(hooks: HookEntry[]): string {
  const stageHooks = hooks.filter((h) => h.stages.includes("pre-commit"));

  const lines: string[] = [`STAGED=$(git diff --cached --name-only --diff-filter=ACMR)`];

  // Track which variable names hold files modified by formatters
  const modifiedVars: string[] = [];
  let lastLanguage: string | undefined;

  for (const h of stageHooks) {
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
  const commands = renderShellHooks(hooks, "husky");
  // writeHookFile composes the banner + leading newline when both
  // `huskyHeader` and `stripPriorGenerated` are set — passing the raw
  // command body keeps byte-equal with the legacy `cleaned + "\n# X\n
  // <commands>\n"` shape.
  return writeHookFile({
    projectRoot,
    runner: "husky",
    kind: "pre-commit",
    content: commands,
    huskyHeader: true,
    stripPriorGenerated: true,
  });
}

async function installCommitMsgHook(
  projectRoot: string,
  runner: string,
): Promise<Result<HookFileResult>> {
  if (runner === "none" || runner === "lefthook") {
    return writeHookFile({
      projectRoot,
      runner: "standalone",
      kind: "commit-msg",
      content: COMMIT_MSG_TEMPLATE,
    });
  }
  if (runner === "husky") {
    return writeHookFile({
      projectRoot,
      runner: "husky",
      kind: "commit-msg",
      content: COMMIT_MSG_TEMPLATE,
      huskyHeader: true,
    });
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
  return writeHookFile({
    projectRoot,
    runner: runner === "husky" ? "husky" : "standalone",
    kind: "pre-push",
    content: script,
  });
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
