import fs from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { ok } from '../../types/result.js';
import type { Result } from '../../types/result.js';
import { satisfiesVersion } from '../../utils/semver.js';
import { StateManager } from '../config/state.js';
import { scanCodiDir } from '../config/parser.js';
import { resolveOrgFile, resolveTeamFile } from '../../utils/paths.js';
import { VERSION } from '../../index.js';

export interface VersionCheckResult {
  check: string;
  passed: boolean;
  message: string;
}

export interface DoctorReport {
  results: VersionCheckResult[];
  allPassed: boolean;
}

export function checkCodiVersion(requiredVersion: string): VersionCheckResult {
  const currentVersion = VERSION;
  const passed = satisfiesVersion(currentVersion, requiredVersion);
  return {
    check: 'codi-version',
    passed,
    message: passed
      ? `Codi version ${currentVersion} satisfies ${requiredVersion}`
      : `Codi version ${currentVersion} does not satisfy required ${requiredVersion}. Update codi.`,
  };
}

export async function checkGeneratedFreshness(
  projectRoot: string,
): Promise<VersionCheckResult[]> {
  const codiDir = path.join(projectRoot, '.codi');
  const stateManager = new StateManager(codiDir, projectRoot);
  const stateResult = await stateManager.read();

  if (!stateResult.ok) {
    return [{
      check: 'generated-freshness',
      passed: false,
      message: 'Could not read state file. Run `codi generate` first.',
    }];
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
      (f) => f.status === 'drifted' || f.status === 'missing',
    );

    if (drifted.length > 0) {
      const paths = drifted.map((f) => f.path).join(', ');
      results.push({
        check: `drift-${agentId}`,
        passed: false,
        message: `${agentId}: ${drifted.length} file(s) out of sync: ${paths}. Run \`codi generate\`.`,
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
      check: 'generated-freshness',
      passed: true,
      message: 'No generated files tracked yet.',
    });
  }

  return results;
}

export async function checkCodiDirectory(
  projectRoot: string,
): Promise<VersionCheckResult> {
  const result = await scanCodiDir(projectRoot);
  return {
    check: 'codi-directory',
    passed: result.ok,
    message: result.ok
      ? '.codi/ directory is valid.'
      : `.codi/ directory has issues: ${result.errors.map((e) => e.message).join('; ')}`,
  };
}

export async function checkOrgConfig(): Promise<VersionCheckResult> {
  const orgFile = resolveOrgFile();
  try {
    const raw = await fs.readFile(orgFile, 'utf8');
    const parsed = parseYaml(raw);
    if (parsed && typeof parsed === 'object') {
      return { check: 'org-config', passed: true, message: `Org config found at ${orgFile}.` };
    }
    return { check: 'org-config', passed: false, message: `Org config at ${orgFile} is not valid YAML.` };
  } catch {
    return { check: 'org-config', passed: true, message: 'No org config found (optional).' };
  }
}

export async function checkTeamConfig(teamName: string): Promise<VersionCheckResult> {
  const teamFile = resolveTeamFile(teamName);
  try {
    const raw = await fs.readFile(teamFile, 'utf8');
    const parsed = parseYaml(raw);
    if (parsed && typeof parsed === 'object') {
      return { check: 'team-config', passed: true, message: `Team config "${teamName}" found at ${teamFile}.` };
    }
    return { check: 'team-config', passed: false, message: `Team config at ${teamFile} is not valid YAML.` };
  } catch {
    return { check: 'team-config', passed: false, message: `Team "${teamName}" referenced in manifest but not found at ${teamFile}.` };
  }
}

export async function runAllChecks(
  projectRoot: string,
): Promise<Result<DoctorReport>> {
  const results: VersionCheckResult[] = [];

  // Check codi directory validity
  const dirCheck = await checkCodiDirectory(projectRoot);
  results.push(dirCheck);

  // Check version requirement from manifest
  const configResult = await scanCodiDir(projectRoot);
  if (configResult.ok && configResult.data.manifest.codi?.requiredVersion) {
    const versionCheck = checkCodiVersion(
      configResult.data.manifest.codi.requiredVersion,
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
  const freshnessResults = await checkGeneratedFreshness(projectRoot);
  results.push(...freshnessResults);

  const allPassed = results.every((r) => r.passed);

  return ok({ results, allPassed });
}
