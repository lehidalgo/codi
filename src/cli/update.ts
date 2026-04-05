import type { Command } from "commander";
import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import matter from "gray-matter";
import os from "node:os";
import { resolveProjectDir } from "../utils/paths.js";
import { safeRm } from "../utils/fs.js";
import { resolveArtifactName } from "../constants.js";
import { FLAG_CATALOG } from "../core/flags/flag-catalog.js";
import { getPreset, getPresetNames } from "../core/flags/flag-presets.js";
import type { PresetName } from "../core/flags/flag-presets.js";
import {
  FLAGS_FILENAME,
  GIT_CLONE_DEPTH,
  PROJECT_CLI,
  PROJECT_DIR,
  PROJECT_NAME,
  prefixedName,
} from "../constants.js";
import { registerAllAdapters } from "../adapters/index.js";
import { resolveConfig } from "../core/config/resolver.js";
import { generate } from "../core/generator/generator.js";
import {
  loadTemplate,
  AVAILABLE_TEMPLATES,
  getTemplateVersion,
} from "../core/scaffolder/template-loader.js";
import {
  loadSkillTemplateContent,
  AVAILABLE_SKILL_TEMPLATES,
  getSkillTemplateVersion,
} from "../core/scaffolder/skill-template-loader.js";
import {
  loadAgentTemplate,
  AVAILABLE_AGENT_TEMPLATES,
  getAgentTemplateVersion,
} from "../core/scaffolder/agent-template-loader.js";
import {
  loadMcpServerTemplate,
  AVAILABLE_MCP_SERVER_TEMPLATES,
} from "../core/scaffolder/mcp-template-loader.js";
import { createCommandResult } from "../core/output/formatter.js";
import { EXIT_CODES } from "../core/output/exit-codes.js";
import { Logger } from "../core/output/logger.js";
import { writeAuditEntry } from "../core/audit/audit-log.js";
import type { CommandResult } from "../core/output/types.js";
import type { Result } from "../types/result.js";
import { initFromOptions, handleOutput } from "./shared.js";
import type { GlobalOptions } from "./shared.js";
import { OperationsLedgerManager } from "../core/audit/operations-ledger.js";
import { execFileAsync } from "../utils/exec.js";
import { readLockFile } from "../core/preset/preset-registry.js";
import { loadPreset } from "../core/preset/preset-loader.js";
import { applyPresetArtifacts } from "../core/preset/preset-applier.js";
import { syncManifestOnUpdate } from "../core/version/artifact-manifest.js";
import { injectFrontmatterVersion } from "../core/version/artifact-version.js";
import {
  resolveConflicts,
  makeConflictEntry,
  type ConflictEntry,
} from "../utils/conflict-resolver.js";

interface UpdateOptions extends GlobalOptions {
  preset?: string;
  from?: string;
  rules?: boolean;
  skills?: boolean;
  agents?: boolean;
  mcpServers?: boolean;
  // regenerate is now always-on (removed --regenerate flag)
  dryRun?: boolean;
  force?: boolean;
}

interface UpdateData {
  flagsAdded: string[];
  flagsReset: boolean;
  preset: string | null;
  rulesUpdated: string[];
  rulesSkipped: string[];
  skillsUpdated: string[];
  skillsSkipped: string[];
  agentsUpdated: string[];
  agentsSkipped: string[];
  mcpServersUpdated: string[];
  mcpServersSkipped: string[];
  sourceUpdated: string[];
  regenerated: boolean;
}

interface RefreshArtifactOptions {
  configDir: string;
  subDir: string;
  label: string;
  availableTemplates: string[];
  loadTemplate: (name: string) => Result<string>;
  getTemplateVersion: (name: string) => number | undefined;
  nameMappings?: Record<string, string>;
  dryRun: boolean;
  force?: boolean;
  json?: boolean;
  log: Logger;
}

async function refreshManagedArtifacts(
  opts: RefreshArtifactOptions,
): Promise<{ updated: string[]; skipped: string[] }> {
  const dir = path.join(opts.configDir, opts.subDir);
  const updated: string[] = [];
  const skipped: string[] = [];

  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return { updated, skipped };
  }

  const conflicts: ConflictEntry[] = [];

  for (const entry of entries) {
    if (!entry.endsWith(".md")) continue;
    const filePath = path.join(dir, entry);
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = matter(raw);
    const name = (parsed.data["name"] as string) ?? entry.replace(".md", "");
    const templateName = findMatchingTemplate(name, opts.availableTemplates, opts.nameMappings);

    if (!templateName) {
      skipped.push(name);
      continue;
    }

    const templateResult = opts.loadTemplate(templateName);
    if (!templateResult.ok) continue;
    const version = opts.getTemplateVersion(templateName);
    const newContent = (
      version !== undefined
        ? injectFrontmatterVersion(templateResult.data, version)
        : templateResult.data
    ).replace(/\{\{name\}\}/g, name);

    const normalized = newContent.endsWith("\n") ? newContent : newContent + "\n";

    if (raw.trim() === normalized.trim()) {
      // identical — nothing to do
      continue;
    }

    const label = `${opts.subDir}/${name}`;
    conflicts.push(makeConflictEntry(label, filePath, raw, normalized));
  }

  if (opts.dryRun) {
    for (const c of conflicts) {
      const name = c.label.split("/")[1] ?? c.label;
      opts.log.info(`Would update ${opts.label}: ${name}`);
      updated.push(name);
    }
    return { updated, skipped };
  }

  if (conflicts.length > 0) {
    const resolution = await resolveConflicts(conflicts, {
      force: opts.force,
      json: opts.json,
    });

    for (const entry of [...resolution.accepted, ...resolution.merged]) {
      await fs.writeFile(entry.fullPath, entry.incomingContent, "utf-8");
      const name = entry.label.split("/")[1] ?? entry.label;
      opts.log.info(`Updated ${opts.label}: ${name}`);
      updated.push(name);
    }

    for (const entry of resolution.skipped) {
      const name = entry.label.split("/")[1] ?? entry.label;
      skipped.push(name);
    }
  }

  return { updated, skipped };
}

function findMatchingTemplate(
  name: string,
  available: string[],
  mappings: Record<string, string> = {},
): string | null {
  if (available.includes(name)) return name;
  return mappings[name] ?? null;
}

const RULE_NAME_MAPPINGS: Record<string, string> = {
  "code-quality": prefixedName("code-style"),
  "testing-standards": prefixedName("testing"),
};

async function refreshManagedMcpServers(
  configDir: string,
  dryRun: boolean,
  log: Logger,
): Promise<{ updated: string[]; skipped: string[] }> {
  const mcpDir = path.join(configDir, "mcp-servers");
  const updated: string[] = [];
  const skipped: string[] = [];

  let entries: string[];
  try {
    entries = await fs.readdir(mcpDir);
  } catch {
    return { updated, skipped };
  }

  for (const entry of entries) {
    if (!entry.endsWith(".yaml")) continue;
    const filePath = path.join(mcpDir, entry);
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = parseYaml(raw) as Record<string, unknown>;
    const managedBy = parsed["managed_by"] as string | undefined;

    if (managedBy !== PROJECT_NAME) {
      skipped.push(entry.replace(".yaml", ""));
      continue;
    }

    const serverName = (parsed["name"] as string) ?? entry.replace(".yaml", "");
    if (!AVAILABLE_MCP_SERVER_TEMPLATES.includes(serverName)) {
      skipped.push(serverName);
      continue;
    }

    const templateResult = loadMcpServerTemplate(serverName);
    if (!templateResult.ok) continue;

    const tmpl = templateResult.data;
    const yamlObj: Record<string, unknown> = {
      name: tmpl.name,
      version: tmpl.version,
      managed_by: PROJECT_NAME,
      ...(tmpl.type && { type: tmpl.type }),
      ...(tmpl.command && { command: tmpl.command }),
      ...(tmpl.args && tmpl.args.length > 0 && { args: tmpl.args }),
      ...(tmpl.env && Object.keys(tmpl.env).length > 0 && { env: tmpl.env }),
      ...(tmpl.url && { url: tmpl.url }),
      ...(tmpl.headers && Object.keys(tmpl.headers).length > 0 && { headers: tmpl.headers }),
    };

    if (!dryRun) {
      await fs.writeFile(filePath, stringifyYaml(yamlObj), "utf-8");
    }
    updated.push(serverName);
    log.info(`${dryRun ? "Would update" : "Updated"} MCP server: ${serverName}`);
  }

  return { updated, skipped };
}

async function pullFromSource(
  repo: string,
  configDir: string,
  dryRun: boolean,
  log: Logger,
  options: { force?: boolean; json?: boolean } = {},
): Promise<string[]> {
  const updated: string[] = [];
  const cloneDir = path.join(os.tmpdir(), `${PROJECT_NAME}-pull-${Date.now()}`);

  try {
    const repoUrl = `https://github.com/${repo}.git`;
    await execFileAsync("git", ["clone", "--depth", GIT_CLONE_DEPTH, repoUrl, cloneDir]);
  } catch (cause) {
    log.warn(`Failed to clone source repo: ${repo}`, cause);
    return updated;
  }

  const sourcePaths = ["rules", "skills", "agents"];
  const conflicts: ConflictEntry[] = [];
  const directWrites: Array<{ localFile: string; content: string; label: string }> = [];

  for (const syncPath of sourcePaths) {
    const sourceDir = path.join(cloneDir, PROJECT_DIR, syncPath);
    const localDir = path.join(configDir, syncPath);

    let entries: string[];
    try {
      entries = await fs.readdir(sourceDir);
    } catch {
      continue;
    }

    await fs.mkdir(localDir, { recursive: true });

    for (const entry of entries) {
      if (!entry.endsWith(".md")) continue;
      const sourceFile = path.join(sourceDir, entry);
      const localFile = path.join(localDir, entry);

      const sourceContent = await fs.readFile(sourceFile, "utf8");
      const sourceParsed = matter(sourceContent);
      if (sourceParsed.data["managed_by"] !== PROJECT_NAME) continue;

      const label = `${syncPath}/${entry}`;

      let localContent: string | null = null;
      try {
        localContent = await fs.readFile(localFile, "utf8");
      } catch {
        // new file — direct write
      }

      if (localContent === null) {
        directWrites.push({ localFile, content: sourceContent, label });
      } else if (localContent.trim() === sourceContent.trim()) {
        // identical — no-op
      } else {
        conflicts.push(makeConflictEntry(label, localFile, localContent, sourceContent));
      }
    }
  }

  await safeRm(cloneDir);

  if (dryRun) {
    for (const { label } of [...directWrites, ...conflicts]) {
      log.info(`Would pull: ${label}`);
      updated.push(label);
    }
    return updated;
  }

  for (const { localFile, content, label } of directWrites) {
    await fs.writeFile(localFile, content, "utf-8");
    log.info(`Pulled: ${label}`);
    updated.push(label);
  }

  if (conflicts.length > 0) {
    const resolution = await resolveConflicts(conflicts, options);
    for (const entry of [...resolution.accepted, ...resolution.merged]) {
      await fs.writeFile(entry.fullPath, entry.incomingContent, "utf-8");
      log.info(`Pulled: ${entry.label}`);
      updated.push(entry.label);
    }
  }

  return updated;
}

export async function updateHandler(
  projectRoot: string,
  options: UpdateOptions,
): Promise<CommandResult<UpdateData>> {
  const log = Logger.getInstance();
  const configDir = resolveProjectDir(projectRoot);
  const flagsFile = path.join(configDir, FLAGS_FILENAME);

  let currentFlags: Record<string, unknown>;
  try {
    const raw = await fs.readFile(flagsFile, "utf8");
    currentFlags = (parseYaml(raw) as Record<string, unknown>) ?? {};
  } catch {
    return createCommandResult({
      success: false,
      command: "update",
      data: {
        flagsAdded: [],
        flagsReset: false,
        preset: null,
        rulesUpdated: [],
        rulesSkipped: [],
        skillsUpdated: [],
        skillsSkipped: [],
        agentsUpdated: [],
        agentsSkipped: [],
        mcpServersUpdated: [],
        mcpServersSkipped: [],
        sourceUpdated: [],
        regenerated: false,
      },
      errors: [
        {
          code: "E_CONFIG_NOT_FOUND",
          message: `No ${PROJECT_DIR}/flags.yaml found. Run \`${PROJECT_CLI} init\` first.`,
          hint: `Run \`${PROJECT_CLI} init\` to create the configuration.`,
          severity: "error",
          context: { path: flagsFile },
        },
      ],
      exitCode: EXIT_CODES.CONFIG_NOT_FOUND,
    });
  }

  const flagsAdded: string[] = [];
  let flagsReset = false;

  // Merge builtin + installed preset names for validation
  const builtinPresets = getPresetNames() as string[];
  const lock = await readLockFile(configDir);
  const installedNames = Object.keys(lock.presets);
  const validPresets = [...builtinPresets, ...installedNames];

  const presetName = options.preset ? resolveArtifactName(options.preset, validPresets) : undefined;

  if (options.preset && !presetName) {
    return createCommandResult({
      success: false,
      command: "update",
      data: {
        flagsAdded: [],
        flagsReset: false,
        preset: options.preset,
        rulesUpdated: [],
        rulesSkipped: [],
        skillsUpdated: [],
        skillsSkipped: [],
        agentsUpdated: [],
        agentsSkipped: [],
        mcpServersUpdated: [],
        mcpServersSkipped: [],
        sourceUpdated: [],
        regenerated: false,
      },
      errors: [
        {
          code: "E_CONFIG_INVALID",
          message: `Invalid preset "${options.preset}". Available: ${validPresets.join(", ")}`,
          hint: `Use one of: ${validPresets.join(", ")}`,
          severity: "error",
          context: { preset: options.preset },
        },
      ],
      exitCode: EXIT_CODES.CONFIG_INVALID,
    });
  }

  if (presetName) {
    const isBuiltin = builtinPresets.includes(presetName);

    if (isBuiltin) {
      // Builtin preset: apply flags only
      const preset = getPreset(presetName as PresetName);
      const updatedFlags: Record<string, unknown> = {};
      for (const [key, def] of Object.entries(preset)) {
        const entry: Record<string, unknown> = {
          mode: def.mode,
          value: def.value,
        };
        if (def.locked) entry["locked"] = true;
        updatedFlags[key] = entry;
      }
      currentFlags = updatedFlags;
      flagsReset = true;
      log.info(`Reset all flags to "${presetName}" preset`);
    } else {
      // User-installed preset: apply flags + artifacts
      const presetsDir = path.join(configDir, "presets");
      const loadResult = await loadPreset(presetName, presetsDir);
      if (!loadResult.ok) {
        return createCommandResult({
          success: false,
          command: "update",
          data: {
            flagsAdded: [],
            flagsReset: false,
            preset: presetName,
            rulesUpdated: [],
            rulesSkipped: [],
            skillsUpdated: [],
            skillsSkipped: [],
            agentsUpdated: [],
            agentsSkipped: [],
            mcpServersUpdated: [],
            mcpServersSkipped: [],
            sourceUpdated: [],
            regenerated: false,
          },
          errors: loadResult.errors.map((e) => ({
            code: e.code,
            message: e.message,
            hint: e.hint,
            severity: e.severity as "error",
            context: e.context,
          })),
          exitCode: EXIT_CODES.GENERAL_ERROR,
        });
      }

      const loaded = loadResult.data;
      // Apply flags from user preset
      const updatedFlags: Record<string, unknown> = {};
      for (const [key, def] of Object.entries(loaded.flags)) {
        const entry: Record<string, unknown> = {
          mode: def.mode,
          value: def.value,
        };
        if (def.locked) entry["locked"] = true;
        updatedFlags[key] = entry;
      }
      currentFlags = updatedFlags;
      flagsReset = true;
      log.info(`Reset all flags to "${presetName}" preset`);

      // Apply artifacts with conflict resolution
      if (!options.dryRun) {
        const applyResult = await applyPresetArtifacts(configDir, loaded, {
          force: false,
          json: options.json,
        });
        log.info(
          `Applied preset artifacts: ${applyResult.added.length} added, ${applyResult.overwritten.length} updated, ${applyResult.skipped.length} skipped, ${applyResult.resourcesCopied} resources copied`,
        );
      }
    }
  } else {
    for (const flagName of Object.keys(FLAG_CATALOG)) {
      if (!(flagName in currentFlags)) {
        const spec = FLAG_CATALOG[flagName]!;
        currentFlags[flagName] = { mode: "enabled", value: spec.default };
        flagsAdded.push(flagName);
        log.info(`Added missing flag: ${flagName}`);
      }
    }
  }

  if (!options.dryRun) {
    await fs.writeFile(flagsFile, stringifyYaml(currentFlags), "utf-8");
  }

  const dryRun = options.dryRun ?? false;

  let rulesUpdated: string[] = [];
  let rulesSkipped: string[] = [];
  if (options.rules) {
    const result = await refreshManagedArtifacts({
      configDir,
      subDir: "rules",
      label: "rule",
      dryRun,
      log,
      force: options.force,
      json: options.json,
      availableTemplates: AVAILABLE_TEMPLATES,
      loadTemplate,
      getTemplateVersion,
      nameMappings: RULE_NAME_MAPPINGS,
    });
    rulesUpdated = result.updated;
    rulesSkipped = result.skipped;
  }

  let skillsUpdated: string[] = [];
  let skillsSkipped: string[] = [];
  if (options.skills) {
    const result = await refreshManagedArtifacts({
      configDir,
      subDir: "skills",
      label: "skill",
      dryRun,
      log,
      force: options.force,
      json: options.json,
      availableTemplates: AVAILABLE_SKILL_TEMPLATES,
      loadTemplate: loadSkillTemplateContent,
      getTemplateVersion: getSkillTemplateVersion,
    });
    skillsUpdated = result.updated;
    skillsSkipped = result.skipped;
  }

  let agentsUpdated: string[] = [];
  let agentsSkipped: string[] = [];
  if (options.agents) {
    const result = await refreshManagedArtifacts({
      configDir,
      subDir: "agents",
      label: "agent",
      dryRun,
      log,
      force: options.force,
      json: options.json,
      availableTemplates: AVAILABLE_AGENT_TEMPLATES,
      loadTemplate: loadAgentTemplate,
      getTemplateVersion: getAgentTemplateVersion,
    });
    agentsUpdated = result.updated;
    agentsSkipped = result.skipped;
  }

  let mcpServersUpdated: string[] = [];
  let mcpServersSkipped: string[] = [];
  if (options.mcpServers) {
    const result = await refreshManagedMcpServers(configDir, options.dryRun ?? false, log);
    mcpServersUpdated = result.updated;
    mcpServersSkipped = result.skipped;
  }

  let sourceUpdated: string[] = [];
  if (options.from) {
    sourceUpdated = await pullFromSource(options.from, configDir, options.dryRun ?? false, log, {
      force: options.force,
      json: options.json,
    });
  }

  let regenerated = false;
  if (!options.dryRun) {
    registerAllAdapters();
    const configResult = await resolveConfig(projectRoot);
    if (configResult.ok) {
      const genResult = await generate(configResult.data, projectRoot, {
        json: options.json,
        force: options.force,
      });
      regenerated = genResult.ok;
    }
  }

  // Sync artifact manifest for refreshed artifacts
  if (!options.dryRun) {
    await syncManifestOnUpdate(configDir, {
      rules: rulesUpdated,
      skills: skillsUpdated,
      agents: agentsUpdated,
      mcpServers: mcpServersUpdated,
    }).catch((e: unknown) => log.debug("Artifact manifest sync failed; non-critical.", e));
  }

  if (!options.dryRun) {
    await writeAuditEntry(configDir, {
      type: "update",
      timestamp: new Date().toISOString(),
      details: {
        flagsAdded,
        flagsReset,
        preset: presetName ?? null,
        rulesUpdated,
        skillsUpdated,
        agentsUpdated,
        mcpServersUpdated,
        regenerated,
      },
    });

    try {
      const ledger = new OperationsLedgerManager(configDir);
      await ledger.logOperation({
        type: "update",
        timestamp: new Date().toISOString(),
        details: {
          flagsAdded,
          flagsReset,
          preset: presetName ?? null,
          rulesUpdated,
          skillsUpdated,
          agentsUpdated,
          mcpServersUpdated,
          regenerated,
        },
      });
    } catch (cause) {
      log.debug("Ledger write failed during update", cause);
    }
  }

  return createCommandResult({
    success: true,
    command: "update",
    data: {
      flagsAdded,
      flagsReset,
      preset: presetName ?? null,
      rulesUpdated,
      rulesSkipped,
      skillsUpdated,
      skillsSkipped,
      agentsUpdated,
      agentsSkipped,
      mcpServersUpdated,
      mcpServersSkipped,
      sourceUpdated,
      regenerated,
    },
    exitCode: EXIT_CODES.SUCCESS,
  });
}

export function registerUpdateCommand(program: Command): void {
  program
    .command("update")
    .description("Update flags, rules, skills, agents, and MCP servers to latest versions")
    .option("--preset <preset>", `Reset flags to preset: ${getPresetNames().join(", ")}`)
    .option("--from <repo>", "Pull centralized artifacts from a GitHub repo")
    .option("--rules", "Refresh template-managed rules to latest versions")
    .option("--skills", "Refresh template-managed skills to latest versions")
    .option("--agents", "Refresh template-managed agents to latest versions")
    .option("--mcp-servers", "Refresh template-managed MCP servers to latest versions")
    .option("--dry-run", "Show what would change without writing")
    .option("--force", "Accept all incoming changes without prompting (overwrites local)")
    .action(async (cmdOptions: Record<string, unknown>) => {
      const globalOptions = program.opts() as GlobalOptions;
      const options: UpdateOptions = { ...globalOptions, ...cmdOptions };
      initFromOptions(options);
      const result = await updateHandler(process.cwd(), options);
      handleOutput(result, options);
      process.exit(result.exitCode);
    });
}
