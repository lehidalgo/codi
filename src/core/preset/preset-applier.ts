import fs from "node:fs/promises";
import path from "node:path";
import { stringify as stringifyYaml } from "yaml";
import { countChanges } from "../../utils/diff.js";
import { hashContent } from "../../utils/hash.js";
import {
  resolveConflicts,
  type ConflictEntry,
} from "../../utils/conflict-resolver.js";
import { StateManager } from "../config/state.js";
import type { ArtifactFileState } from "../config/state.js";
import type { LoadedPreset } from "./preset-loader.js";
import type {
  NormalizedRule,
  NormalizedSkill,
  NormalizedAgent,
  NormalizedCommand,
} from "../../types/config.js";

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

type ArtifactType = "rule" | "skill" | "agent" | "command" | "mcp-server";

export function reconstructRuleContent(rule: NormalizedRule): string {
  const fm = [
    "---",
    `name: ${rule.name}`,
    `description: ${rule.description}`,
    `priority: ${rule.priority}`,
    `alwaysApply: ${rule.alwaysApply}`,
    `managed_by: ${rule.managedBy}`,
    "---",
  ];
  return fm.join("\n") + "\n\n" + rule.content.trim() + "\n";
}

export function reconstructSkillContent(skill: NormalizedSkill): string {
  const fm: string[] = ["---", `name: ${skill.name}`];
  fm.push(`description: ${skill.description}`);
  if (skill.category) fm.push(`category: ${skill.category}`);
  if (skill.model) fm.push(`model: ${skill.model}`);
  if (skill.managedBy) fm.push(`managed_by: ${skill.managedBy}`);
  fm.push("---");
  return fm.join("\n") + "\n\n" + skill.content.trim() + "\n";
}

export function reconstructAgentContent(agent: NormalizedAgent): string {
  const fm: string[] = ["---", `name: ${agent.name}`];
  fm.push(`description: ${agent.description}`);
  if (agent.model) fm.push(`model: ${agent.model}`);
  if (agent.managedBy) fm.push(`managed_by: ${agent.managedBy}`);
  fm.push("---");
  return fm.join("\n") + "\n\n" + agent.content.trim() + "\n";
}

export function reconstructCommandContent(cmd: NormalizedCommand): string {
  const fm: string[] = ["---", `name: ${cmd.name}`];
  fm.push(`description: ${cmd.description}`);
  if (cmd.managedBy) fm.push(`managed_by: ${cmd.managedBy}`);
  fm.push("---");
  return fm.join("\n") + "\n\n" + cmd.content.trim() + "\n";
}

function getArtifactPath(
  configDir: string,
  type: ArtifactType,
  name: string,
): string {
  switch (type) {
    case "rule":
      return path.join(configDir, "rules", `${name}.md`);
    case "skill":
      return path.join(configDir, "skills", name, "SKILL.md");
    case "agent":
      return path.join(configDir, "agents", `${name}.md`);
    case "command":
      return path.join(configDir, "commands", `${name}.md`);
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
  };

  const conflicts: ConflictFile[] = [];

  // Reconstruct content for each artifact type and collect conflicts
  const ruleItems = preset.rules.map((r) => ({
    name: r.name,
    content: reconstructRuleContent(r),
  }));
  const skillItems = preset.skills.map((s) => ({
    name: s.name,
    content: reconstructSkillContent(s),
  }));
  const agentItems = preset.agents.map((a) => ({
    name: a.name,
    content: reconstructAgentContent(a),
  }));
  const commandItems = preset.commands.map((c) => ({
    name: c.name,
    content: reconstructCommandContent(c),
  }));

  const mcpItems = Object.entries(preset.mcp.servers).map(
    ([name, serverConfig]) => ({
      name,
      content: stringifyYaml({ name, ...serverConfig }).trimEnd() + "\n",
    }),
  );

  // Track all items for drift recording
  const allItems: Array<{ type: ArtifactType; name: string; content: string }> =
    [
      ...ruleItems.map((i) => ({ type: "rule" as const, ...i })),
      ...skillItems.map((i) => ({ type: "skill" as const, ...i })),
      ...agentItems.map((i) => ({ type: "agent" as const, ...i })),
      ...commandItems.map((i) => ({ type: "command" as const, ...i })),
      ...mcpItems.map((i) => ({ type: "mcp-server" as const, ...i })),
    ];

  await collectArtifacts(configDir, "rule", ruleItems, result, conflicts);
  await collectArtifacts(configDir, "skill", skillItems, result, conflicts);
  await collectArtifacts(configDir, "agent", agentItems, result, conflicts);
  await collectArtifacts(configDir, "command", commandItems, result, conflicts);
  await collectArtifacts(configDir, "mcp-server", mcpItems, result, conflicts);

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

  for (const entry of resolution.accepted) {
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
