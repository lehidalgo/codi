import fs from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { ok, err } from '../../types/result.js';
import type { Result } from '../../types/result.js';
import type { NormalizedConfig } from '../../types/config.js';
import type { FlagDefinition } from '../../types/flags.js';
import { resolveCodiDir, resolveUserDir } from '../../utils/paths.js';
import { scanCodiDir } from './parser.js';
import { composeConfig, flagsFromDefinitions } from './composer.js';
import type { ConfigLayer } from './composer.js';
import { validateConfig } from './validator.js';

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readYamlSafe(filePath: string): Promise<Record<string, unknown> | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = parseYaml(raw) as Record<string, unknown> | null;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function extractFlags(obj: Record<string, unknown>): Record<string, FlagDefinition> {
  const flagsRaw = obj['flags'] as Record<string, FlagDefinition> | undefined;
  if (!flagsRaw || typeof flagsRaw !== 'object') return {};
  return flagsRaw;
}

async function buildLangLayers(codiDir: string): Promise<ConfigLayer[]> {
  const langDir = path.join(codiDir, 'lang');
  if (!(await fileExists(langDir))) return [];

  const layers: ConfigLayer[] = [];
  const entries = await fs.readdir(langDir);
  for (const entry of entries) {
    if (!entry.endsWith('.yaml') && !entry.endsWith('.yml')) continue;
    const filePath = path.join(langDir, entry);
    const data = await readYamlSafe(filePath);
    if (!data) continue;

    const flags = extractFlags(data);
    layers.push({
      level: 'lang',
      source: filePath,
      config: {
        flags: flagsFromDefinitions(flags, filePath),
      },
    });
  }
  return layers;
}

async function buildAgentLayers(codiDir: string): Promise<ConfigLayer[]> {
  const agentsDir = path.join(codiDir, 'agents');
  if (!(await fileExists(agentsDir))) return [];

  const layers: ConfigLayer[] = [];
  const entries = await fs.readdir(agentsDir);
  for (const entry of entries) {
    if (!entry.endsWith('.yaml') && !entry.endsWith('.yml')) continue;
    const filePath = path.join(agentsDir, entry);
    const data = await readYamlSafe(filePath);
    if (!data) continue;

    const flags = extractFlags(data);
    layers.push({
      level: 'agent',
      source: filePath,
      config: {
        flags: flagsFromDefinitions(flags, filePath),
      },
    });
  }
  return layers;
}

async function buildUserLayer(): Promise<ConfigLayer | null> {
  const userDir = resolveUserDir();
  const userFile = path.join(userDir, 'user.yaml');
  if (!(await fileExists(userFile))) return null;

  const data = await readYamlSafe(userFile);
  if (!data) return null;

  const flags = extractFlags(data);
  return {
    level: 'user',
    source: userFile,
    config: {
      flags: flagsFromDefinitions(flags, userFile),
    },
  };
}

export async function resolveConfig(projectRoot: string): Promise<Result<NormalizedConfig>> {
  const codiDir = resolveCodiDir(projectRoot);
  const scanResult = await scanCodiDir(projectRoot);
  if (!scanResult.ok) return scanResult;

  const parsed = scanResult.data;
  const repoLayer: ConfigLayer = {
    level: 'repo',
    source: codiDir,
    config: {
      manifest: parsed.manifest,
      rules: parsed.rules,
      skills: parsed.skills,
      commands: parsed.commands,
      agents: parsed.agents,
      context: parsed.context,
      flags: flagsFromDefinitions(parsed.flags, path.join(codiDir, 'flags.yaml')),
      mcp: { servers: {} },
    },
  };

  const langLayers = await buildLangLayers(codiDir);
  const agentLayers = await buildAgentLayers(codiDir);
  const userLayer = await buildUserLayer();

  const layers: ConfigLayer[] = [
    repoLayer,
    ...langLayers,
    ...agentLayers,
    ...(userLayer ? [userLayer] : []),
  ];

  const composed = composeConfig(layers);
  if (!composed.ok) return composed;

  const validationErrors = validateConfig(composed.data);
  if (validationErrors.length > 0) {
    return err(validationErrors);
  }

  return ok(composed.data);
}
