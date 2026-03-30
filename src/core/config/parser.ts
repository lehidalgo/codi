import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import fg from "fast-glob";
import { resolveProjectDir } from "../../utils/paths.js";
import { ok, err } from "../../types/result.js";
import type { Result } from "../../types/result.js";
import type {
  ProjectManifest,
  ManagedBy,
  NormalizedRule,
  NormalizedSkill,
  NormalizedCommand,
  NormalizedAgent,
} from "../../types/config.js";
import type { FlagDefinition } from "../../types/flags.js";
import { ProjectManifestSchema } from "../../schemas/manifest.js";
import { FlagDefinitionSchema } from "../../schemas/flag.js";
import { RuleFrontmatterSchema } from "../../schemas/rule.js";
import { SkillFrontmatterSchema } from "../../schemas/skill.js";
import { AgentFrontmatterSchema } from "../../schemas/agent.js";
import { CommandFrontmatterSchema } from "../../schemas/command.js";
import { McpConfigSchema } from "../../schemas/mcp.js";
import { createError, zodToProjectErrors } from "../output/errors.js";
import { parseFrontmatter } from "../../utils/frontmatter.js";
import type { McpConfig } from "../../types/config.js";
import {
  MANIFEST_FILENAME,
  FLAGS_FILENAME,
  MCP_FILENAME,
  BRAND_CATEGORY,
} from "#src/constants.js";

export interface ParsedProjectDir {
  manifest: ProjectManifest;
  flags: Record<string, FlagDefinition>;
  rules: NormalizedRule[];
  skills: NormalizedSkill[];
  commands: NormalizedCommand[];
  agents: NormalizedAgent[];
  mcp: McpConfig;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readYamlFile(filePath: string): Promise<Result<unknown>> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed: unknown = parseYaml(raw);
    return ok(parsed);
  } catch (cause) {
    return err([
      createError("E_CONFIG_PARSE_FAILED", { file: filePath }, cause as Error),
    ]);
  }
}

export async function parseManifest(
  configDir: string,
): Promise<Result<ProjectManifest>> {
  const manifestPath = path.join(configDir, MANIFEST_FILENAME);
  if (!(await fileExists(manifestPath))) {
    return err([createError("E_CONFIG_NOT_FOUND", { path: manifestPath })]);
  }
  const rawResult = await readYamlFile(manifestPath);
  if (!rawResult.ok) return rawResult;

  const parsed = ProjectManifestSchema.safeParse(rawResult.data);
  if (!parsed.success) {
    return err(zodToProjectErrors(parsed.error, manifestPath));
  }
  return ok(parsed.data as ProjectManifest);
}

export async function parseFlags(
  configDir: string,
): Promise<Result<Record<string, FlagDefinition>>> {
  const flagsPath = path.join(configDir, FLAGS_FILENAME);
  if (!(await fileExists(flagsPath))) {
    return ok({});
  }
  const rawResult = await readYamlFile(flagsPath);
  if (!rawResult.ok) return rawResult;

  const rawObj = rawResult.data as Record<string, unknown> | null;
  if (!rawObj || typeof rawObj !== "object") {
    return ok({});
  }

  const flags: Record<string, FlagDefinition> = {};
  const errors: ReturnType<typeof createError>[] = [];

  for (const [key, value] of Object.entries(rawObj)) {
    const parsed = FlagDefinitionSchema.safeParse(value);
    if (!parsed.success) {
      errors.push(...zodToProjectErrors(parsed.error, `${flagsPath}#${key}`));
    } else {
      flags[key] = parsed.data as FlagDefinition;
    }
  }

  if (errors.length > 0) return err(errors);
  return ok(flags);
}

export async function scanRules(
  rulesDir: string,
): Promise<Result<NormalizedRule[]>> {
  if (!(await fileExists(rulesDir))) {
    return ok([]);
  }
  const rules: NormalizedRule[] = [];
  const errors: ReturnType<typeof createError>[] = [];

  const files = await collectMarkdownFiles(rulesDir);
  for (const file of files) {
    const result = await parseRuleFile(file);
    if (!result.ok) {
      errors.push(...result.errors);
    } else {
      rules.push(result.data);
    }
  }

  if (errors.length > 0) return err(errors);
  return ok(rules);
}

async function collectMarkdownFiles(dir: string): Promise<string[]> {
  if (!(await fileExists(dir))) return [];
  return fg("**/*.md", { cwd: dir, absolute: true });
}

export async function scanSkills(
  skillsDir: string,
): Promise<Result<NormalizedSkill[]>> {
  if (!(await fileExists(skillsDir))) {
    return ok([]);
  }
  const skills: NormalizedSkill[] = [];
  const errors: ReturnType<typeof createError>[] = [];

  const files = await fg("**/SKILL.md", { cwd: skillsDir, absolute: true });
  for (const file of files) {
    const result = await parseSkillFile(file);
    if (!result.ok) {
      errors.push(...result.errors);
    } else {
      skills.push(result.data);
    }
  }

  if (errors.length > 0) return err(errors);
  return ok(skills);
}

async function scanCommands(
  commandsDir: string,
): Promise<Result<NormalizedCommand[]>> {
  if (!(await fileExists(commandsDir))) {
    return ok([]);
  }
  const commands: NormalizedCommand[] = [];
  const errors: ReturnType<typeof createError>[] = [];

  const files = await collectMarkdownFiles(commandsDir);
  for (const file of files) {
    const result = await parseCommandFile(file);
    if (!result.ok) {
      errors.push(...result.errors);
    } else {
      commands.push(result.data);
    }
  }

  if (errors.length > 0) return err(errors);
  return ok(commands);
}

async function parseCommandFile(
  filePath: string,
): Promise<Result<NormalizedCommand>> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const { data, content } = parseFrontmatter<Record<string, unknown>>(raw);
    const parsed = CommandFrontmatterSchema.safeParse(data);
    if (!parsed.success) {
      return err(zodToProjectErrors(parsed.error, filePath));
    }
    const fm = parsed.data;
    const managedBy = (data["managed_by"] as string) ?? undefined;
    return ok({
      name: fm.name,
      description: fm.description,
      content,
      managedBy: managedBy as ManagedBy | undefined,
    });
  } catch (cause) {
    return err([
      createError("E_FRONTMATTER_INVALID", {
        file: filePath,
        message: (cause as Error).message,
      }),
    ]);
  }
}

async function scanAgents(
  agentsDir: string,
): Promise<Result<NormalizedAgent[]>> {
  if (!(await fileExists(agentsDir))) {
    return ok([]);
  }
  const agents: NormalizedAgent[] = [];
  const errors: ReturnType<typeof createError>[] = [];

  const files = await collectMarkdownFiles(agentsDir);
  for (const file of files) {
    const result = await parseAgentFile(file);
    if (!result.ok) {
      errors.push(...result.errors);
    } else {
      agents.push(result.data);
    }
  }

  if (errors.length > 0) return err(errors);
  return ok(agents);
}

async function parseAgentFile(
  filePath: string,
): Promise<Result<NormalizedAgent>> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const { data, content } = parseFrontmatter<Record<string, unknown>>(raw);
    const parsed = AgentFrontmatterSchema.safeParse(data);
    if (!parsed.success) {
      return err(zodToProjectErrors(parsed.error, filePath));
    }
    const fm = parsed.data;
    return ok({
      name: fm.name,
      description: fm.description,
      content,
      tools: fm.tools,
      model: fm.model,
      managedBy: fm.managed_by,
    });
  } catch (cause) {
    return err([
      createError("E_FRONTMATTER_INVALID", {
        file: filePath,
        message: (cause as Error).message,
      }),
    ]);
  }
}

async function scanLegacyBrands(
  brandsDir: string,
): Promise<Result<NormalizedSkill[]>> {
  if (!(await fileExists(brandsDir))) {
    return ok([]);
  }
  const skills: NormalizedSkill[] = [];
  const errors: ReturnType<typeof createError>[] = [];

  // Legacy brands are directory-based: brands/<name>/BRAND.md
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(brandsDir, { withFileTypes: true });
  } catch {
    return ok([]);
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const brandFile = path.join(brandsDir, entry.name, "BRAND.md");
    if (!(await fileExists(brandFile))) continue;

    const result = await parseLegacyBrandFile(brandFile);
    if (!result.ok) {
      errors.push(...result.errors);
    } else {
      skills.push(result.data);
    }
  }

  if (errors.length > 0) return err(errors);
  return ok(skills);
}

async function parseLegacyBrandFile(
  filePath: string,
): Promise<Result<NormalizedSkill>> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const { data, content } = parseFrontmatter<Record<string, unknown>>(raw);
    const name = data["name"] as string | undefined;
    const description = (data["description"] as string) ?? "";
    const managedBy = (data["managed_by"] as string) ?? undefined;
    if (!name) {
      return err([
        createError("E_FRONTMATTER_INVALID", {
          file: filePath,
          message: "Missing required field: name",
        }),
      ]);
    }
    return ok({
      name,
      description,
      content,
      category: BRAND_CATEGORY,
      managedBy: managedBy as ManagedBy | undefined,
    });
  } catch (cause) {
    return err([
      createError("E_FRONTMATTER_INVALID", {
        file: filePath,
        message: (cause as Error).message,
      }),
    ]);
  }
}

export async function parseSkillFile(
  filePath: string,
): Promise<Result<NormalizedSkill>> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const { data, content } = parseFrontmatter<Record<string, unknown>>(raw);
    const parsed = SkillFrontmatterSchema.safeParse(data);
    if (!parsed.success) {
      return err(zodToProjectErrors(parsed.error, filePath));
    }
    const fm = parsed.data;
    const pathsRaw = fm.paths;
    const normalizedPaths =
      typeof pathsRaw === "string"
        ? pathsRaw.split(",").map((p) => p.trim())
        : pathsRaw;
    return ok({
      name: fm.name,
      description: fm.description,
      content,
      compatibility: fm.compatibility,
      tools: fm.tools,
      license: fm.license,
      metadata: fm.metadata,
      managedBy: fm.managed_by,
      disableModelInvocation: fm.disableModelInvocation,
      argumentHint: fm.argumentHint,
      allowedTools: fm.allowedTools,
      model: fm.model,
      effort: fm.effort,
      context: fm.context,
      agent: fm.agent,
      userInvocable: fm["user-invocable"],
      paths: normalizedPaths,
      shell: fm.shell,
    });
  } catch (cause) {
    return err([
      createError("E_FRONTMATTER_INVALID", {
        file: filePath,
        message: (cause as Error).message,
      }),
    ]);
  }
}

async function parseRuleFile(
  filePath: string,
): Promise<Result<NormalizedRule>> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const { data, content } = parseFrontmatter<Record<string, unknown>>(raw);
    const parsed = RuleFrontmatterSchema.safeParse(data);
    if (!parsed.success) {
      return err(zodToProjectErrors(parsed.error, filePath));
    }
    const fm = parsed.data;
    return ok({
      name: fm.name,
      description: fm.description,
      content,
      language: fm.language,
      priority: fm.priority,
      scope: fm.scope,
      alwaysApply: fm.alwaysApply,
      managedBy: fm.managed_by,
    });
  } catch (cause) {
    return err([
      createError("E_FRONTMATTER_INVALID", {
        file: filePath,
        message: (cause as Error).message,
      }),
    ]);
  }
}

async function scanMcpServersDir(
  configDir: string,
): Promise<Record<string, Record<string, unknown>>> {
  const mcpServersDir = path.join(configDir, "mcp-servers");
  const servers: Record<string, Record<string, unknown>> = {};

  if (!(await fileExists(mcpServersDir))) return servers;
  const files = await fg("*.yaml", { cwd: mcpServersDir, absolute: true });
  for (const file of files) {
    const raw = await readYamlFile(file);
    if (!raw.ok) continue;
    const data = raw.data as Record<string, unknown>;
    const name = data["name"] as string;
    if (!name) continue;
    const { name: _name, managed_by: _managedBy, ...serverConfig } = data;
    servers[name] = serverConfig;
  }

  return servers;
}

async function parseMcpConfig(configDir: string): Promise<Result<McpConfig>> {
  // 1. Read legacy mcp.yaml
  let legacyServers: Record<string, Record<string, unknown>> = {};
  const mcpPath = path.join(configDir, MCP_FILENAME);
  if (await fileExists(mcpPath)) {
    const rawResult = await readYamlFile(mcpPath);
    if (rawResult.ok) {
      const parsed = McpConfigSchema.safeParse(rawResult.data);
      if (parsed.success) {
        legacyServers = (parsed.data as McpConfig).servers as Record<
          string,
          Record<string, unknown>
        >;
      } else {
        return err(zodToProjectErrors(parsed.error, mcpPath));
      }
    } else {
      return rawResult;
    }
  }

  // 2. Scan individual files from mcp-servers/
  const individualServers = await scanMcpServersDir(configDir);

  // 3. Merge: individual files take precedence over legacy
  const merged = { ...legacyServers, ...individualServers };

  return ok({ servers: merged } as McpConfig);
}

export async function scanProjectDir(
  projectRoot: string,
): Promise<Result<ParsedProjectDir>> {
  const configDir = resolveProjectDir(projectRoot);
  if (!(await fileExists(configDir))) {
    return err([createError("E_CONFIG_NOT_FOUND", { path: configDir })]);
  }

  const manifestResult = await parseManifest(configDir);
  if (!manifestResult.ok) return manifestResult;

  const flagsResult = await parseFlags(configDir);
  if (!flagsResult.ok) return flagsResult;

  const rulesResult = await scanRules(path.join(configDir, "rules"));
  if (!rulesResult.ok) return rulesResult;

  const skillsResult = await scanSkills(path.join(configDir, "skills"));
  if (!skillsResult.ok) return skillsResult;

  const commandsResult = await scanCommands(path.join(configDir, "commands"));
  if (!commandsResult.ok) return commandsResult;

  const agentsResult = await scanAgents(path.join(configDir, "agents"));
  if (!agentsResult.ok) return agentsResult;

  // Scan legacy brands/ directory and merge as brand-category skills
  const legacyBrandsResult = await scanLegacyBrands(
    path.join(configDir, "brands"),
  );
  if (!legacyBrandsResult.ok) return legacyBrandsResult;

  const mcpResult = await parseMcpConfig(configDir);
  if (!mcpResult.ok) return mcpResult;

  return ok({
    manifest: manifestResult.data,
    flags: flagsResult.data,
    rules: rulesResult.data,
    skills: [...skillsResult.data, ...legacyBrandsResult.data],
    commands: commandsResult.data,
    agents: agentsResult.data,
    mcp: mcpResult.data,
  });
}
