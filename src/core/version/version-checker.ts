import fs from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { ok } from "../../types/result.js";
import type { Result } from "../../types/result.js";
import { satisfiesVersion } from "../../utils/semver.js";
import { StateManager } from "../config/state.js";
import { scanProjectDir } from "../config/parser.js";
import {
  resolveProjectDir,
  resolveOrgFile,
  resolveTeamFile,
} from "../../utils/paths.js";
import {
  PROJECT_CLI,
  PROJECT_DIR,
  PROJECT_NAME,
  PROJECT_NAME_DISPLAY,
} from "#src/constants.js";
import { VERSION } from "../../index.js";

export interface VersionCheckResult {
  check: string;
  passed: boolean;
  message: string;
}

export interface DoctorReport {
  results: VersionCheckResult[];
  allPassed: boolean;
}

export function checkProjectVersion(
  requiredVersion: string,
): VersionCheckResult {
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

export async function checkProjectDirectory(
  projectRoot: string,
): Promise<VersionCheckResult> {
  const result = await scanProjectDir(projectRoot);
  return {
    check: `${PROJECT_NAME}-directory`,
    passed: result.ok,
    message: result.ok
      ? `${PROJECT_DIR}/ directory is valid.`
      : `${PROJECT_DIR}/ directory has issues: ${result.errors.map((e) => e.message).join("; ")}`,
  };
}

export async function checkOrgConfig(): Promise<VersionCheckResult> {
  const orgFile = resolveOrgFile();
  try {
    const raw = await fs.readFile(orgFile, "utf8");
    const parsed = parseYaml(raw);
    if (parsed && typeof parsed === "object") {
      return {
        check: "org-config",
        passed: true,
        message: `Org config found at ${orgFile}.`,
      };
    }
    return {
      check: "org-config",
      passed: false,
      message: `Org config at ${orgFile} is not valid YAML.`,
    };
  } catch {
    return {
      check: "org-config",
      passed: true,
      message: "No org config found (optional).",
    };
  }
}

export async function checkTeamConfig(
  teamName: string,
): Promise<VersionCheckResult> {
  const teamFile = resolveTeamFile(teamName);
  try {
    const raw = await fs.readFile(teamFile, "utf8");
    const parsed = parseYaml(raw);
    if (parsed && typeof parsed === "object") {
      return {
        check: "team-config",
        passed: true,
        message: `Team config "${teamName}" found at ${teamFile}.`,
      };
    }
    return {
      check: "team-config",
      passed: false,
      message: `Team config at ${teamFile} is not valid YAML.`,
    };
  } catch {
    return {
      check: "team-config",
      passed: false,
      message: `Team "${teamName}" referenced in manifest but not found at ${teamFile}.`,
    };
  }
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
    const versionCheck = checkProjectVersion(
      configResult.data.manifest.engine.requiredVersion,
    );
    results.push(versionCheck);
  }

  // Check org config
  const orgCheck = await checkOrgConfig();
  results.push(orgCheck);

  // Check team config if referenced in manifest
  if (configResult.ok && configResult.data.manifest.team) {
    const teamCheck = await checkTeamConfig(configResult.data.manifest.team);
    results.push(teamCheck);
  }

  // Check generated files freshness
  const freshnessResults = await checkGeneratedFreshness(
    projectRoot,
    driftMode,
  );
  results.push(...freshnessResults);

  const allPassed = results.every((r) => r.passed);

  return ok({ results, allPassed });
}
