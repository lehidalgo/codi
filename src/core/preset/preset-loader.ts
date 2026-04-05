import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { ok, err } from "#src/types/result.js";
import type { Result } from "#src/types/result.js";
import type {
  ManagedBy,
  NormalizedRule,
  NormalizedSkill,
  NormalizedAgent,
  McpConfig,
} from "#src/types/config.js";
import type { FlagDefinition } from "#src/types/flags.js";
import { createError } from "../output/errors.js";
import { Logger } from "../output/logger.js";
import { PresetManifestSchema } from "#src/schemas/preset.js";
import { parseFrontmatter } from "#src/utils/frontmatter.js";
import {
  MCP_FILENAME,
  PRESET_MANIFEST_FILENAME,
  PROJECT_NAME,
  BRAND_CATEGORY,
} from "#src/constants.js";
import { detectCircularExtends } from "./preset-validator.js";
import { isBuiltinPreset as checkBuiltin, materializeBuiltinPreset } from "./preset-builtin.js";
import { loadTemplate } from "../scaffolder/template-loader.js";
import { loadSkillTemplateContent } from "../scaffolder/skill-template-loader.js";
import { loadAgentTemplate } from "../scaffolder/agent-template-loader.js";

export interface LoadedPreset {
  name: string;
  description: string;
  flags: Record<string, FlagDefinition>;
  rules: NormalizedRule[];
  skills: NormalizedSkill[];
  agents: NormalizedAgent[];
  mcp: McpConfig;
}

export async function loadPreset(name: string, presetsDir: string): Promise<Result<LoadedPreset>> {
  if (checkBuiltin(name)) {
    return materializeBuiltinPreset(name);
  }

  return loadPresetFromDir(name, presetsDir);
}

/**
 * Loads a preset from a directory under presetsDir.
 * Does NOT check for built-in presets — use loadPreset() for that.
 * Exported for use by preset-resolver which handles source routing separately.
 */
export async function loadPresetFromDir(
  name: string,
  presetsDir: string,
): Promise<Result<LoadedPreset>> {
  const log = Logger.getInstance();
  // Check if it's a built-in preset (backward compat for flag-only + full presets)
  if (checkBuiltin(name)) {
    return materializeBuiltinPreset(name);
  }

  const presetDir = path.join(presetsDir, name);
  const manifestPath = path.join(presetDir, PRESET_MANIFEST_FILENAME);

  let manifestRaw: string;
  try {
    manifestRaw = await fs.readFile(manifestPath, "utf8");
  } catch {
    return err([createError("E_CONFIG_NOT_FOUND", { path: manifestPath })]);
  }

  const parsed = parseYaml(manifestRaw) as Record<string, unknown>;
  const validated = PresetManifestSchema.safeParse(parsed);
  if (!validated.success) {
    return err([
      createError("E_CONFIG_INVALID", {
        message: `Invalid preset manifest: ${name}`,
      }),
    ]);
  }

  const manifest = validated.data;

  // Resolve extends: load parent preset first, then merge child on top
  let parentFlags: Record<string, FlagDefinition> = {};
  let parentRules: NormalizedRule[] = [];
  let parentSkills: NormalizedSkill[] = [];
  let parentAgents: NormalizedAgent[] = [];
  let parentMcp: McpConfig = { servers: {} };

  if (manifest.extends) {
    // Guard against circular extends before recursing
    const circularCheck = await detectCircularExtends(name, presetsDir);
    if (!circularCheck.ok) return circularCheck as unknown as Result<LoadedPreset>;

    const parentResult = await loadPreset(manifest.extends, presetsDir);
    if (parentResult.ok) {
      parentFlags = parentResult.data.flags;
      parentRules = parentResult.data.rules;
      parentSkills = parentResult.data.skills;
      parentAgents = parentResult.data.agents;
      parentMcp = parentResult.data.mcp;
    }
  }

  // Resolve artifacts by name from the artifacts field
  // If no artifacts field, treat as flags-only preset (empty artifact lists)
  // Try preset directory first (for bundled artifacts), fall back to project configDir
  const configDir = path.dirname(presetsDir);
  const resolved = manifest.artifacts
    ? await resolveArtifactsByName(manifest.artifacts, presetDir, configDir)
    : { rules: [], skills: [], agents: [] };
  const { rules, skills, agents } = resolved;

  let mcp: McpConfig = { servers: {} };
  try {
    const mcpRaw = await fs.readFile(path.join(presetDir, MCP_FILENAME), "utf8");
    const mcpParsed = parseYaml(mcpRaw) as Record<string, unknown>;
    if (mcpParsed && mcpParsed["servers"]) {
      mcp = mcpParsed as unknown as McpConfig;
    }
  } catch {
    /* no mcp.yaml */
  }

  // Merge: parent first, then child overrides (locked parent flags preserved)
  const childFlags = (manifest.flags ?? {}) as Record<string, FlagDefinition>;
  const mergedFlags = { ...parentFlags };
  for (const [key, childDef] of Object.entries(childFlags)) {
    const parentDef = parentFlags[key];
    if (parentDef?.locked) {
      log.debug(`Flag "${key}" is locked by parent preset — child override ignored`);
      continue;
    }
    mergedFlags[key] = childDef;
  }
  const mergedRules = mergeArtifacts(parentRules, rules);
  const mergedSkills = mergeArtifacts(parentSkills, skills);
  const mergedAgents = mergeArtifacts(parentAgents, agents);
  const mergedMcp: McpConfig = {
    servers: { ...parentMcp.servers, ...mcp.servers },
  };

  return ok({
    name: manifest.name,
    description: manifest.description ?? "",
    flags: mergedFlags,
    rules: mergedRules,
    skills: mergedSkills,
    agents: mergedAgents,
    mcp: mergedMcp,
  });
}

function mergeArtifacts<T extends { name: string }>(parent: T[], child: T[]): T[] {
  const childNames = new Set(child.map((c) => c.name));
  const fromParent = parent.filter((p) => !childNames.has(p.name));
  return [...fromParent, ...child];
}

interface ArtifactNames {
  rules?: string[];
  skills?: string[];
  agents?: string[];
  // @deprecated — use skills with category: brand instead
  brands?: string[];
}

interface ResolvedArtifacts {
  rules: NormalizedRule[];
  skills: NormalizedSkill[];
  agents: NormalizedAgent[];
}

/**
 * Resolves artifact names to full normalized objects.
 * Tries: preset directory first (for bundled artifacts), then built-in templates,
 * then custom files in project canonical dirs.
 */
async function resolveArtifactsByName(
  artifacts: ArtifactNames,
  primaryDir: string,
  fallbackDir?: string,
): Promise<ResolvedArtifacts> {
  const log = Logger.getInstance();

  const rules: NormalizedRule[] = [];
  for (const name of artifacts.rules ?? []) {
    const rule =
      (await loadRuleFromDir(name, primaryDir)) ??
      resolveRule(name) ??
      (fallbackDir ? await loadRuleFromDir(name, fallbackDir) : null);
    if (rule) {
      rules.push(rule);
    } else {
      log.warn(`Rule "${name}" listed in preset manifest but could not be resolved`);
    }
  }

  const skills: NormalizedSkill[] = [];
  for (const name of artifacts.skills ?? []) {
    const skill =
      (await loadSkillFromDir(name, primaryDir)) ??
      resolveSkill(name) ??
      (fallbackDir ? await loadSkillFromDir(name, fallbackDir) : null);
    if (skill) {
      skills.push(skill);
    } else {
      log.warn(`Skill "${name}" listed in preset manifest but could not be resolved`);
    }
  }

  const agents: NormalizedAgent[] = [];
  for (const name of artifacts.agents ?? []) {
    const agent =
      (await loadAgentFromDir(name, primaryDir)) ??
      resolveAgent(name) ??
      (fallbackDir ? await loadAgentFromDir(name, fallbackDir) : null);
    if (agent) {
      agents.push(agent);
    } else {
      log.warn(`Agent "${name}" listed in preset manifest but could not be resolved`);
    }
  }

  // Convert deprecated brands field to brand-category skills
  for (const name of artifacts.brands ?? []) {
    const brand = await loadLegacyBrandFromDir(name, primaryDir);
    if (!brand && fallbackDir) {
      const fallback = await loadLegacyBrandFromDir(name, fallbackDir);
      if (fallback) skills.push(fallback);
    } else if (brand) {
      skills.push(brand);
    }
  }

  return { rules, skills, agents };
}

/** Load a template by name, replace {{name}}, and parse frontmatter. */
function resolveTemplateArtifact(
  name: string,
  loader: (n: string) => Result<string>,
): { data: Record<string, unknown>; content: string } | null {
  const result = loader(name);
  if (!result.ok) return null;
  try {
    const replaced = result.data.replace(/\{\{name\}\}/g, name);
    return parseFrontmatter<Record<string, unknown>>(replaced);
  } catch {
    return null;
  }
}

function getArtifactVersion(data: Record<string, unknown>): number {
  const version = data["version"];
  return typeof version === "number" && Number.isInteger(version) && version > 0 ? version : 1;
}

function resolveRule(name: string): NormalizedRule | null {
  const parsed = resolveTemplateArtifact(name, loadTemplate);
  if (!parsed) return null;
  return {
    name,
    description: (parsed.data["description"] as string) ?? "",
    version: getArtifactVersion(parsed.data),
    content: parsed.content,
    priority: (parsed.data["priority"] as "high" | "medium" | "low") ?? "medium",
    alwaysApply: (parsed.data["alwaysApply"] as boolean) ?? true,
    managedBy: PROJECT_NAME,
  };
}

function resolveSkill(name: string): NormalizedSkill | null {
  const parsed = resolveTemplateArtifact(name, loadSkillTemplateContent);
  if (!parsed) return null;
  return {
    name,
    description: (parsed.data["description"] as string) ?? "",
    version: getArtifactVersion(parsed.data),
    content: parsed.content,
    managedBy: PROJECT_NAME,
  };
}

function resolveAgent(name: string): NormalizedAgent | null {
  const parsed = resolveTemplateArtifact(name, loadAgentTemplate);
  if (!parsed) return null;
  return {
    name,
    description: (parsed.data["description"] as string) ?? "",
    version: getArtifactVersion(parsed.data),
    content: parsed.content,
    tools: parsed.data["tools"] as string[] | undefined,
    model: parsed.data["model"] as string | undefined,
    managedBy: PROJECT_NAME,
  };
}

async function loadRuleFromDir(name: string, configDir: string): Promise<NormalizedRule | null> {
  const paths = [path.join(configDir, "rules", `${name}.md`)];
  for (const p of paths) {
    try {
      const raw = await fs.readFile(p, "utf8");
      const { data, content } = parseFrontmatter<Record<string, unknown>>(raw);
      const d = data as Record<string, unknown>;
      return {
        name,
        description: (d["description"] as string) ?? "",
        version: getArtifactVersion(d),
        content,
        priority: (d["priority"] as "high" | "medium" | "low") ?? "medium",
        alwaysApply: (d["alwaysApply"] as boolean) ?? true,
        managedBy: (d["managed_by"] as ManagedBy) ?? "user",
        ...(d["language"] !== undefined && {
          language: d["language"] as string,
        }),
        ...(d["scope"] !== undefined && { scope: d["scope"] as string[] }),
      };
    } catch {
      continue;
    }
  }
  return null;
}

async function loadSkillFromDir(name: string, configDir: string): Promise<NormalizedSkill | null> {
  try {
    const raw = await fs.readFile(path.join(configDir, "skills", name, "SKILL.md"), "utf8");
    const { data, content } = parseFrontmatter<Record<string, unknown>>(raw);
    const d = data as Record<string, unknown>;
    return {
      name,
      description: (d["description"] as string) ?? "",
      version: getArtifactVersion(d),
      content,
      managedBy: (d["managed_by"] as ManagedBy) ?? "user",
      ...(d["category"] !== undefined && {
        category: d["category"] as string,
      }),
      ...(d["model"] !== undefined && { model: d["model"] as string }),
      ...(d["license"] !== undefined && { license: d["license"] as string }),
      ...(d["tools"] !== undefined && { tools: d["tools"] as string[] }),
      ...(d["compatibility"] !== undefined && {
        compatibility: d["compatibility"] as string[],
      }),
      ...(d["disable-model-invocation"] !== undefined && {
        disableModelInvocation: d["disable-model-invocation"] as boolean,
      }),
      ...(d["argument-hint"] !== undefined && {
        argumentHint: d["argument-hint"] as string,
      }),
      ...(d["allowed-tools"] !== undefined && {
        allowedTools:
          (d["allowed-tools"] as string | string[]) instanceof Array
            ? (d["allowed-tools"] as string[])
            : String(d["allowed-tools"])
                .split(",")
                .map((s) => s.trim()),
      }),
      ...(d["effort"] !== undefined && {
        effort: d["effort"] as "low" | "medium" | "high" | "max",
      }),
      ...(d["context"] !== undefined && {
        context: d["context"] as "fork",
      }),
      ...(d["agent"] !== undefined && { agent: d["agent"] as string }),
      ...(d["user-invocable"] !== undefined && {
        userInvocable: d["user-invocable"] as boolean,
      }),
      ...(d["paths"] !== undefined && { paths: d["paths"] as string[] }),
      ...(d["shell"] !== undefined && {
        shell: d["shell"] as "bash" | "powershell",
      }),
      ...(d["metadata"] !== undefined && {
        metadata: d["metadata"] as Record<string, string>,
      }),
    };
  } catch (cause) {
    Logger.getInstance().debug(`Failed to load skill "${name}" from directory`, cause);
    return null;
  }
}

async function loadAgentFromDir(name: string, configDir: string): Promise<NormalizedAgent | null> {
  try {
    const raw = await fs.readFile(path.join(configDir, "agents", `${name}.md`), "utf8");
    const { data, content } = parseFrontmatter<Record<string, unknown>>(raw);
    return {
      name,
      description: (data["description"] as string) ?? "",
      version: getArtifactVersion(data),
      content,
      tools: data["tools"] as string[] | undefined,
      model: data["model"] as string | undefined,
      managedBy: (data["managed_by"] as ManagedBy) ?? "user",
    };
  } catch (cause) {
    Logger.getInstance().debug(`Failed to load agent "${name}" from directory`, cause);
    return null;
  }
}

async function loadLegacyBrandFromDir(
  name: string,
  configDir: string,
): Promise<NormalizedSkill | null> {
  try {
    const raw = await fs.readFile(path.join(configDir, "brands", name, "BRAND.md"), "utf8");
    const { data, content } = parseFrontmatter<Record<string, unknown>>(raw);
    return {
      name,
      description: (data["description"] as string) ?? "",
      version: getArtifactVersion(data),
      content,
      category: BRAND_CATEGORY,
      managedBy: (data["managed_by"] as ManagedBy) ?? "user",
    };
  } catch {
    return null;
  }
}
