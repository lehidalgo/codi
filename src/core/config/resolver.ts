import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { ok, err } from "../../types/result.js";
import type { Result } from "../../types/result.js";
import type { NormalizedConfig } from "../../types/config.js";
import type { FlagDefinition } from "../../types/flags.js";
import {
  resolveProjectDir,
  resolveUserDir,
  resolveOrgFile,
  resolveTeamFile,
} from "../../utils/paths.js";
import { scanProjectDir } from "./parser.js";
import { composeConfig, flagsFromDefinitions } from "./composer.js";
import type { ConfigLayer } from "./composer.js";
import { validateConfig } from "./validator.js";
import { loadPreset } from "../preset/preset-loader.js";
import { FLAGS_FILENAME } from "../../constants.js";

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readYamlSafe(
  filePath: string,
): Promise<Record<string, unknown> | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = parseYaml(raw) as Record<string, unknown> | null;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function extractFlags(
  obj: Record<string, unknown>,
): Record<string, FlagDefinition> {
  const flagsRaw = obj["flags"] as Record<string, FlagDefinition> | undefined;
  if (!flagsRaw || typeof flagsRaw !== "object") return {};
  return flagsRaw;
}

async function buildLangLayers(configDir: string): Promise<ConfigLayer[]> {
  const langDir = path.join(configDir, "lang");
  if (!(await fileExists(langDir))) return [];

  const layers: ConfigLayer[] = [];
  const entries = await fs.readdir(langDir);
  for (const entry of entries) {
    if (!entry.endsWith(".yaml") && !entry.endsWith(".yml")) continue;
    const filePath = path.join(langDir, entry);
    const data = await readYamlSafe(filePath);
    if (!data) continue;

    const flags = extractFlags(data);
    layers.push({
      level: "lang",
      source: filePath,
      config: {
        flags: flagsFromDefinitions(flags, filePath),
      },
    });
  }
  return layers;
}

async function buildAgentLayers(configDir: string): Promise<ConfigLayer[]> {
  const agentsDir = path.join(configDir, "agents");
  if (!(await fileExists(agentsDir))) return [];

  const layers: ConfigLayer[] = [];
  const entries = await fs.readdir(agentsDir);
  for (const entry of entries) {
    if (!entry.endsWith(".yaml") && !entry.endsWith(".yml")) continue;
    const filePath = path.join(agentsDir, entry);
    const data = await readYamlSafe(filePath);
    if (!data) continue;

    const flags = extractFlags(data);
    layers.push({
      level: "agent",
      source: filePath,
      config: {
        flags: flagsFromDefinitions(flags, filePath),
      },
    });
  }
  return layers;
}

async function buildOrgLayer(): Promise<ConfigLayer | null> {
  const orgFile = resolveOrgFile();
  if (!(await fileExists(orgFile))) return null;

  const data = await readYamlSafe(orgFile);
  if (!data) return null;

  const flags = extractFlags(data);
  return {
    level: "org",
    source: orgFile,
    config: {
      flags: flagsFromDefinitions(flags, orgFile),
    },
  };
}

async function buildTeamLayer(teamName: string): Promise<ConfigLayer | null> {
  const teamFile = resolveTeamFile(teamName);
  if (!(await fileExists(teamFile))) return null;

  const data = await readYamlSafe(teamFile);
  if (!data) return null;

  const flags = extractFlags(data);
  return {
    level: "team",
    source: teamFile,
    config: {
      flags: flagsFromDefinitions(flags, teamFile),
    },
  };
}

async function buildFrameworkLayers(configDir: string): Promise<ConfigLayer[]> {
  const frameworksDir = path.join(configDir, "frameworks");
  if (!(await fileExists(frameworksDir))) return [];

  const layers: ConfigLayer[] = [];
  const entries = await fs.readdir(frameworksDir);
  for (const entry of entries) {
    if (!entry.endsWith(".yaml") && !entry.endsWith(".yml")) continue;
    const filePath = path.join(frameworksDir, entry);
    const data = await readYamlSafe(filePath);
    if (!data) continue;

    const flags = extractFlags(data);
    layers.push({
      level: "framework",
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
  const userFile = path.join(userDir, "user.yaml");
  if (!(await fileExists(userFile))) return null;

  const data = await readYamlSafe(userFile);
  if (!data) return null;

  const flags = extractFlags(data);
  return {
    level: "user",
    source: userFile,
    config: {
      flags: flagsFromDefinitions(flags, userFile),
    },
  };
}

async function buildPresetLayers(
  configDir: string,
  presetNames: string[],
): Promise<ConfigLayer[]> {
  const presetsDir = path.join(configDir, "presets");
  const layers: ConfigLayer[] = [];

  for (const name of presetNames) {
    const result = await loadPreset(name, presetsDir);
    if (!result.ok) continue;

    const preset = result.data;
    layers.push({
      level: "preset",
      source: `preset:${name}`,
      config: {
        rules: preset.rules,
        skills: preset.skills,
        agents: preset.agents,
        commands: preset.commands,
        brands: preset.brands,
        flags: flagsFromDefinitions(preset.flags, `preset:${name}`),
        mcp: preset.mcp,
      },
    });
  }

  return layers;
}

export async function resolveConfig(
  projectRoot: string,
): Promise<Result<NormalizedConfig>> {
  const configDir = resolveProjectDir(projectRoot);
  const scanResult = await scanProjectDir(projectRoot);
  if (!scanResult.ok) return scanResult;

  const parsed = scanResult.data;
  const repoLayer: ConfigLayer = {
    level: "repo",
    source: configDir,
    config: {
      manifest: parsed.manifest,
      rules: parsed.rules,
      skills: parsed.skills,
      commands: parsed.commands,
      agents: parsed.agents,
      brands: parsed.brands,
      flags: flagsFromDefinitions(
        parsed.flags,
        path.join(configDir, FLAGS_FILENAME),
      ),
      mcp: parsed.mcp,
    },
  };

  const orgLayer = await buildOrgLayer();
  const teamName = parsed.manifest.team;
  const teamLayer = teamName ? await buildTeamLayer(teamName) : null;
  const presetNames = parsed.manifest.presets ?? [];
  const presetLayers = await buildPresetLayers(configDir, presetNames);
  const langLayers = await buildLangLayers(configDir);
  const frameworkLayers = await buildFrameworkLayers(configDir);
  const agentLayers = await buildAgentLayers(configDir);
  const userLayer = await buildUserLayer();

  const layers: ConfigLayer[] = [
    ...(orgLayer ? [orgLayer] : []),
    ...(teamLayer ? [teamLayer] : []),
    ...presetLayers,
    repoLayer,
    ...langLayers,
    ...frameworkLayers,
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
