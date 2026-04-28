import fs from "node:fs/promises";
import path from "node:path";
import { ok } from "#src/types/result.js";
import type { Result } from "#src/types/result.js";
import { satisfiesVersion } from "#src/utils/semver.js";
import { StateManager } from "../config/state.js";
import { scanProjectDir } from "../config/parser.js";
import { resolveProjectDir } from "#src/utils/paths.js";
import { PROJECT_CLI, PROJECT_DIR, PROJECT_NAME, PROJECT_NAME_DISPLAY } from "#src/constants.js";
import { VERSION } from "#src/index.js";
import { AVAILABLE_TEMPLATES, loadTemplate } from "../scaffolder/template-loader.js";
import {
  AVAILABLE_SKILL_TEMPLATES,
  loadSkillTemplateContent,
} from "../scaffolder/skill-template-loader.js";
import {
  AVAILABLE_AGENT_TEMPLATES,
  loadAgentTemplate,
} from "../scaffolder/agent-template-loader.js";

export interface VersionCheckResult {
  check: string;
  passed: boolean;
  message: string;
}

export interface DoctorReport {
  results: VersionCheckResult[];
  allPassed: boolean;
}

export function checkProjectVersion(requiredVersion: string): VersionCheckResult {
  const currentVersion = VERSION;
  const passed = satisfiesVersion(currentVersion, requiredVersion);
  return {
    check: `${PROJECT_NAME}-version`,
    passed,
    message: passed
      ? `${PROJECT_NAME_DISPLAY} version ${currentVersion} satisfies ${requiredVersion}`
      : `${PROJECT_NAME_DISPLAY} version ${currentVersion} does not satisfy required ${requiredVersion}. Update ${PROJECT_CLI}.`,
  };
}

export async function checkGeneratedFreshness(
  projectRoot: string,
  driftMode: string = "warn",
): Promise<VersionCheckResult[]> {
  if (driftMode === "off") {
    return [
      {
        check: "generated-freshness",
        passed: true,
        message: "Drift detection is disabled.",
      },
    ];
  }

  const configDir = resolveProjectDir(projectRoot);
  const stateManager = new StateManager(configDir, projectRoot);
  const stateResult = await stateManager.read();

  if (!stateResult.ok) {
    return [
      {
        check: "generated-freshness",
        passed: false,
        message: `Could not read state file. Run \`${PROJECT_CLI} generate\` first.`,
      },
    ];
  }

  const state = stateResult.data;
  const results: VersionCheckResult[] = [];

  for (const [agentId, _files] of Object.entries(state.agents)) {
    const driftResult = await stateManager.detectDrift(agentId);
    if (!driftResult.ok) {
      results.push({
        check: `drift-${agentId}`,
        passed: false,
        message: `Could not check drift for ${agentId}.`,
      });
      continue;
    }

    const drifted = driftResult.data.files.filter(
      (f) => f.status === "drifted" || f.status === "missing",
    );

    if (drifted.length > 0) {
      const paths = drifted.map((f) => f.path).join(", ");
      results.push({
        check: `drift-${agentId}`,
        passed: false,
        message: `${agentId}: ${drifted.length} file(s) out of sync: ${paths}. Run \`${PROJECT_CLI} generate\`.`,
      });
    } else {
      results.push({
        check: `drift-${agentId}`,
        passed: true,
        message: `${agentId}: all generated files are up to date.`,
      });
    }
  }

  if (results.length === 0) {
    results.push({
      check: "generated-freshness",
      passed: true,
      message: "No generated files tracked yet.",
    });
  }

  return results;
}

function checkTemplatesLoadable(): VersionCheckResult {
  const errors: string[] = [];

  for (const name of AVAILABLE_TEMPLATES) {
    const r = loadTemplate(name);
    if (!r.ok || !r.data.trim()) errors.push(`rule "${name}": failed to load or empty`);
  }
  for (const name of AVAILABLE_SKILL_TEMPLATES) {
    const r = loadSkillTemplateContent(name);
    if (!r.ok || !r.data.trim()) errors.push(`skill "${name}": failed to load or empty`);
  }
  for (const name of AVAILABLE_AGENT_TEMPLATES) {
    const r = loadAgentTemplate(name);
    if (!r.ok || !r.data.trim()) errors.push(`agent "${name}": failed to load or empty`);
  }

  return {
    check: "templates-loadable",
    passed: errors.length === 0,
    message:
      errors.length === 0
        ? "all bundled templates load with non-empty content"
        : `${errors.length} template(s) failed to load:\n  ${errors.join("\n  ")}`,
  };
}

async function checkHookInstalled(
  projectRoot: string,
  hookFileName: string,
  checkName: string,
): Promise<VersionCheckResult> {
  const hookPath = path.join(projectRoot, ".git", "hooks", hookFileName);
  try {
    const stat = await fs.stat(hookPath);
    const isExec = (stat.mode & 0o111) !== 0;
    return {
      check: checkName,
      passed: isExec,
      message: isExec
        ? `${hookFileName} installed and executable`
        : `${hookFileName} present but not executable — run: ${PROJECT_CLI} init --reinstall-hooks`,
    };
  } catch {
    return {
      check: checkName,
      passed: false,
      message: `${hookFileName} not installed — run: ${PROJECT_CLI} init --reinstall-hooks`,
    };
  }
}

export async function checkProjectDirectory(projectRoot: string): Promise<VersionCheckResult> {
  const result = await scanProjectDir(projectRoot);
  return {
    check: `${PROJECT_NAME}-directory`,
    passed: result.ok,
    message: result.ok
      ? `${PROJECT_DIR}/ directory is valid.`
      : `${PROJECT_DIR}/ directory has issues: ${result.errors.map((e) => e.message).join("; ")}`,
  };
}

export async function runAllChecks(
  projectRoot: string,
  driftMode: string = "warn",
): Promise<Result<DoctorReport>> {
  const results: VersionCheckResult[] = [];

  // Check project directory validity
  const dirCheck = await checkProjectDirectory(projectRoot);
  results.push(dirCheck);

  // Check version requirement from manifest
  const configResult = await scanProjectDir(projectRoot);
  if (configResult.ok && configResult.data.manifest.engine?.requiredVersion) {
    const versionCheck = checkProjectVersion(configResult.data.manifest.engine.requiredVersion);
    results.push(versionCheck);
  }

  // Check generated files freshness
  const freshnessResults = await checkGeneratedFreshness(projectRoot, driftMode);
  results.push(...freshnessResults);

  // Check pre-commit and pre-push hooks are installed
  results.push(
    await checkHookInstalled(
      projectRoot,
      `${PROJECT_NAME}-version-bump.mjs`,
      "pre-commit-hook-installed",
    ),
  );
  results.push(
    await checkHookInstalled(
      projectRoot,
      `${PROJECT_NAME}-version-verify.mjs`,
      "pre-push-hook-installed",
    ),
  );

  // Check that all bundled templates load with non-empty content
  results.push(checkTemplatesLoadable());

  const allPassed = results.every((r) => r.passed);

  return ok({ results, allPassed });
}
