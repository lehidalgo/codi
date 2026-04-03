import fs from "node:fs/promises";
import path from "node:path";
import { stringify as stringifyYaml } from "yaml";
import { countChanges } from "../../utils/diff.js";
import { hashContent } from "../../utils/hash.js";
import { resolveConflicts, type ConflictEntry } from "../../utils/conflict-resolver.js";
import { StateManager } from "../config/state.js";
import type { ArtifactFileState } from "../config/state.js";
import type { LoadedPreset } from "./preset-loader.js";
import type { NormalizedRule, NormalizedSkill, NormalizedAgent } from "../../types/config.js";
import { SKIP_DIRS, SKIP_FILES } from "../../adapters/skill-generator.js";

export interface ApplyOptions {
  force?: boolean;
  json?: boolean;
}

export interface ConflictDetail {
  artifact: string;
  additions: number;
  removals: number;
}

export interface ApplyResult {
  added: string[];
  skipped: string[];
  overwritten: string[];
  conflicts: string[];
  conflictDetails: ConflictDetail[];
  resourcesCopied: number;
}

interface ConflictFile {
  type: ArtifactType;
  name: string;
  localPath: string;
  currentContent: string;
  incomingContent: string;
  additions: number;
  removals: number;
}

type ArtifactType = "rule" | "skill" | "agent" | "mcp-server";

/**
 * Serializes a frontmatter string value safely.
 * Values containing newlines or YAML special characters are JSON-stringified,
 * which produces a valid YAML double-quoted scalar.
 */
function fmStr(val: string): string {
  if (/[\n\r:#\[\]{},&*?|>'"]/.test(val) || val.startsWith(" ")) {
    return JSON.stringify(val.replace(/\n+/g, " ").trim());
  }
  return val;
}

export function reconstructRuleContent(rule: NormalizedRule): string {
  const fm = [
    "---",
    `name: ${rule.name}`,
    `description: ${fmStr(rule.description)}`,
    `priority: ${rule.priority}`,
    `alwaysApply: ${rule.alwaysApply}`,
    `managed_by: ${rule.managedBy}`,
  ];
  if (rule.language) fm.push(`language: ${rule.language}`);
  if (rule.scope?.length) fm.push(`scope: [${rule.scope.join(", ")}]`);
  fm.push("---");
  return fm.join("\n") + "\n\n" + rule.content.trim() + "\n";
}

export function reconstructSkillContent(skill: NormalizedSkill): string {
  const fm: string[] = ["---", `name: ${skill.name}`];
  fm.push(`description: ${fmStr(skill.description)}`);
  if (skill.category) fm.push(`category: ${fmStr(skill.category)}`);
  if (skill.model) fm.push(`model: ${skill.model}`);
  if (skill.effort) fm.push(`effort: ${skill.effort}`);
  if (skill.context) fm.push(`context: ${skill.context}`);
  if (skill.agent) fm.push(`agent: ${skill.agent}`);
  if (skill.license) fm.push(`license: ${fmStr(skill.license)}`);
  if (skill.userInvocable !== undefined) fm.push(`user-invocable: ${skill.userInvocable}`);
  if (skill.disableModelInvocation !== undefined)
    fm.push(`disable-model-invocation: ${skill.disableModelInvocation}`);
  if (skill.argumentHint) fm.push(`argument-hint: ${fmStr(skill.argumentHint)}`);
  if (skill.allowedTools?.length) fm.push(`allowed-tools: ${skill.allowedTools.join(", ")}`);
  if (skill.tools?.length) fm.push(`tools:\n${skill.tools.map((t) => `  - ${t}`).join("\n")}`);
  if (skill.compatibility?.length)
    fm.push(`compatibility:\n${skill.compatibility.map((c) => `  - ${c}`).join("\n")}`);
  if (skill.paths?.length) fm.push(`paths:\n${skill.paths.map((p) => `  - ${p}`).join("\n")}`);
  if (skill.shell) fm.push(`shell: ${skill.shell}`);
  if (skill.intentHints) {
    fm.push(`intentHints:\n  taskType: ${fmStr(skill.intentHints.taskType)}`);
    fm.push(
      `  examples:\n${skill.intentHints.examples.map((e) => `    - ${fmStr(e)}`).join("\n")}`,
    );
  }
  if (skill.metadata && Object.keys(skill.metadata).length > 0) {
    fm.push(
      `metadata:\n${Object.entries(skill.metadata)
        .map(([k, v]) => `  ${k}: ${fmStr(v)}`)
        .join("\n")}`,
    );
  }
  if (skill.managedBy) fm.push(`managed_by: ${skill.managedBy}`);
  fm.push("---");
  return fm.join("\n") + "\n\n" + skill.content.trim() + "\n";
}

export function reconstructAgentContent(agent: NormalizedAgent): string {
  const fm: string[] = ["---", `name: ${agent.name}`];
  fm.push(`description: ${fmStr(agent.description)}`);
  if (agent.model) fm.push(`model: ${agent.model}`);
  if (agent.tools?.length) fm.push(`tools:\n${agent.tools.map((t) => `  - ${t}`).join("\n")}`);
  if (agent.managedBy) fm.push(`managed_by: ${agent.managedBy}`);
  fm.push("---");
  return fm.join("\n") + "\n\n" + agent.content.trim() + "\n";
}

function getArtifactPath(configDir: string, type: ArtifactType, name: string): string {
  switch (type) {
    case "rule":
      return path.join(configDir, "rules", `${name}.md`);
    case "skill":
      return path.join(configDir, "skills", name, "SKILL.md");
    case "agent":
      return path.join(configDir, "agents", `${name}.md`);
    case "mcp-server":
      return path.join(configDir, "mcp-servers", `${name}.yaml`);
  }
}

async function readFileOrNull(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

/**
 * Reads the original artifact file from the preset source directory.
 * Returns raw file content (preserving all frontmatter fields and formatting),
 * or null if the preset has no directory source (e.g. built-in presets).
 */
async function readOriginalArtifact(
  configDir: string,
  presetName: string,
  type: ArtifactType,
  name: string,
): Promise<string | null> {
  const presetDir = path.join(configDir, "presets", presetName);
  switch (type) {
    case "rule":
      return readFileOrNull(path.join(presetDir, "rules", `${name}.md`));
    case "skill":
      return readFileOrNull(path.join(presetDir, "skills", name, "SKILL.md"));
    case "agent":
      return readFileOrNull(path.join(presetDir, "agents", `${name}.md`));
    default:
      return null;
  }
}

async function copyResourceTree(srcDir: string, destDir: string, force: boolean): Promise<number> {
  let copied = 0;
  let entries;
  try {
    entries = await fs.readdir(srcDir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      copied += await copyResourceTree(srcPath, destPath, force);
      continue;
    }
    if (entry.name === "SKILL.md") continue;
    if (SKIP_FILES.has(entry.name)) continue;
    if (!force) {
      try {
        await fs.access(destPath);
        continue; // file exists — skip
      } catch {
        // doesn't exist — proceed
      }
    }
    await fs.mkdir(destDir, { recursive: true });
    await fs.copyFile(srcPath, destPath);
    copied++;
  }
  return copied;
}

async function copySkillResources(
  configDir: string,
  presetName: string,
  skillNames: string[],
  force: boolean,
): Promise<number> {
  let total = 0;
  for (const name of skillNames) {
    const src = path.join(configDir, "presets", presetName, "skills", name);
    const dest = path.join(configDir, "skills", name);
    total += await copyResourceTree(src, dest, force);
  }
  return total;
}

async function collectArtifacts(
  configDir: string,
  type: ArtifactType,
  items: Array<{ name: string; content: string }>,
  result: ApplyResult,
  conflicts: ConflictFile[],
): Promise<void> {
  for (const item of items) {
    const targetPath = getArtifactPath(configDir, type, item.name);
    const current = await readFileOrNull(targetPath);

    if (current === null) {
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, item.content, "utf-8");
      result.added.push(`${type}s/${item.name}`);
    } else if (current.trim() === item.content.trim()) {
      // Identical — skip silently
    } else {
      const changes = countChanges(current, item.content);
      conflicts.push({
        type,
        name: item.name,
        localPath: targetPath,
        currentContent: current,
        incomingContent: item.content,
        additions: changes.additions,
        removals: changes.removals,
      });
    }
  }
}

/**
 * Applies preset artifacts to the project .codi/ directory with conflict resolution.
 * New files are written directly. Conflicting files trigger an interactive diff/merge UI.
 */
export async function applyPresetArtifacts(
  configDir: string,
  preset: LoadedPreset,
  options: ApplyOptions = {},
): Promise<ApplyResult> {
  const result: ApplyResult = {
    added: [],
    skipped: [],
    overwritten: [],
    conflicts: [],
    conflictDetails: [],
    resourcesCopied: 0,
  };

  const conflicts: ConflictFile[] = [];

  // Use original files from preset directory when available (preserves all frontmatter
  // fields and formatting). Falls back to reconstruction for built-in presets.
  const ruleItems = await Promise.all(
    preset.rules.map(async (r) => ({
      name: r.name,
      content:
        (await readOriginalArtifact(configDir, preset.name, "rule", r.name)) ??
        reconstructRuleContent(r),
    })),
  );
  const skillItems = await Promise.all(
    preset.skills.map(async (s) => ({
      name: s.name,
      content:
        (await readOriginalArtifact(configDir, preset.name, "skill", s.name)) ??
        reconstructSkillContent(s),
    })),
  );
  const agentItems = await Promise.all(
    preset.agents.map(async (a) => ({
      name: a.name,
      content:
        (await readOriginalArtifact(configDir, preset.name, "agent", a.name)) ??
        reconstructAgentContent(a),
    })),
  );
  const mcpItems = Object.entries(preset.mcp.servers).map(([name, serverConfig]) => ({
    name,
    content: stringifyYaml({ name, ...serverConfig }).trimEnd() + "\n",
  }));

  // Track all items for drift recording
  const allItems: Array<{ type: ArtifactType; name: string; content: string }> = [
    ...ruleItems.map((i) => ({ type: "rule" as const, ...i })),
    ...skillItems.map((i) => ({ type: "skill" as const, ...i })),
    ...agentItems.map((i) => ({ type: "agent" as const, ...i })),
    ...mcpItems.map((i) => ({ type: "mcp-server" as const, ...i })),
  ];

  await collectArtifacts(configDir, "rule", ruleItems, result, conflicts);
  await collectArtifacts(configDir, "skill", skillItems, result, conflicts);
  await collectArtifacts(configDir, "agent", agentItems, result, conflicts);
  await collectArtifacts(configDir, "mcp-server", mcpItems, result, conflicts);

  // Copy skill resource files (scripts, assets, references, agents, LICENSE.txt)
  // from the preset source directory. SKILL.md itself is handled above via conflict
  // resolution; this copies everything else.
  result.resourcesCopied = await copySkillResources(
    configDir,
    preset.name,
    preset.skills.map((s) => s.name),
    options.force ?? false,
  );

  if (conflicts.length === 0) {
    await recordArtifactHashes(configDir, preset.name, allItems);
    return result;
  }

  result.conflicts = conflicts.map((c) => `${c.type}s/${c.name}`);
  result.conflictDetails = conflicts.map((c) => ({
    artifact: `${c.type}s/${c.name}`,
    additions: c.additions,
    removals: c.removals,
  }));

  const conflictEntries: ConflictEntry[] = conflicts.map((c) => ({
    label: `${c.type}s/${c.name}`,
    fullPath: c.localPath,
    currentContent: c.currentContent,
    incomingContent: c.incomingContent,
    additions: c.additions,
    removals: c.removals,
  }));

  const resolution = await resolveConflicts(conflictEntries, options);

  for (const entry of [...resolution.accepted, ...resolution.merged]) {
    await fs.writeFile(entry.fullPath, entry.incomingContent, "utf-8");
    result.overwritten.push(entry.label);
  }
  for (const entry of resolution.skipped) {
    result.skipped.push(entry.label);
  }

  // Record artifact hashes for drift tracking
  await recordArtifactHashes(configDir, preset.name, allItems);

  return result;
}

async function recordArtifactHashes(
  configDir: string,
  presetName: string,
  items: Array<{ type: ArtifactType; name: string; content: string }>,
): Promise<void> {
  const projectRoot = path.dirname(configDir);
  const stateManager = new StateManager(configDir, projectRoot);
  const now = new Date().toISOString();

  const artifactStates: ArtifactFileState[] = [];
  for (const item of items) {
    const filePath = getArtifactPath(configDir, item.type, item.name);
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const relativePath = path.relative(projectRoot, filePath);
      artifactStates.push({
        path: relativePath,
        hash: hashContent(content),
        preset: presetName,
        timestamp: now,
      });
    } catch {
      // File may not exist if it was skipped during conflict resolution
    }
  }

  if (artifactStates.length > 0) {
    await stateManager.updatePresetArtifacts(artifactStates);
  }
}
