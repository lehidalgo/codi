import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { parse as parseYaml } from "yaml";
import type { ArtifactType, TemplateHashRegistry } from "../core/version/template-hash-registry.js";
import { buildTemplateHashRegistry } from "../core/version/template-hash-registry.js";
import { ArtifactManifestManager } from "../core/version/artifact-manifest.js";
import { hashContent } from "../utils/hash.js";
import type { InstalledArtifactVersion } from "../core/version/artifact-version.js";
import { loadTemplate } from "../core/scaffolder/template-loader.js";
import { loadSkillTemplateContent } from "../core/scaffolder/skill-template-loader.js";
import { loadAgentTemplate } from "../core/scaffolder/agent-template-loader.js";
import { loadCommandTemplate } from "../core/scaffolder/command-template-loader.js";
import { loadMcpServerTemplate } from "../core/scaffolder/mcp-template-loader.js";
import { extractTemplateHint } from "./artifact-categories.js";
import type { ExistingSelections } from "./init-wizard.js";

export type InstalledArtifactStatus =
  | "builtin-original"
  | "builtin-modified"
  | "builtin-new"
  | "builtin-removed"
  | "custom-user";

export interface InstalledArtifactInventoryEntry {
  name: string;
  type: ArtifactType;
  status: InstalledArtifactStatus;
  installed: boolean;
  managedBy: "codi" | "user";
  installedArtifactVersion: InstalledArtifactVersion | null;
  hint: string;
}

export interface InstalledArtifactInventory {
  entries: InstalledArtifactInventoryEntry[];
  selections: ExistingSelections;
}

interface InstalledArtifactFile {
  name: string;
  type: ArtifactType;
  content: string;
  managedBy: "codi" | "user";
  hint: string;
}

function extractYamlDescription(content: string): string {
  try {
    const parsed = parseYaml(content) as Record<string, unknown> | null;
    return typeof parsed?.description === "string" ? parsed.description : "";
  } catch {
    return "";
  }
}

function getBuiltinHint(name: string, type: ArtifactType): string {
  switch (type) {
    case "rule": {
      const result = loadTemplate(name);
      return result.ok ? extractTemplateHint(result.data) : "";
    }
    case "skill": {
      const result = loadSkillTemplateContent(name);
      return result.ok ? extractTemplateHint(result.data) : "";
    }
    case "agent": {
      const result = loadAgentTemplate(name);
      return result.ok ? extractTemplateHint(result.data) : "";
    }
    case "command": {
      const result = loadCommandTemplate(name);
      return result.ok ? extractTemplateHint(result.data) : "";
    }
    case "mcp-server": {
      const result = loadMcpServerTemplate(name);
      return result.ok ? result.data.description : "";
    }
  }
}

async function readMarkdownArtifacts(
  dir: string,
  type: Extract<ArtifactType, "rule" | "agent" | "command">,
): Promise<InstalledArtifactFile[]> {
  try {
    const entries = await fs.readdir(dir);
    const files = await Promise.all(
      entries
        .filter((entry) => entry.endsWith(".md"))
        .map(async (entry) => {
          const filePath = path.join(dir, entry);
          const content = await fs.readFile(filePath, "utf8");
          const parsed = matter(content);
          return {
            name: entry.replace(/\.md$/, ""),
            type,
            content,
            managedBy: parsed.data["managed_by"] === "user" ? "user" : "codi",
            hint: extractTemplateHint(content),
          } satisfies InstalledArtifactFile;
        }),
    );
    return files;
  } catch {
    return [];
  }
}

async function readSkillArtifacts(configDir: string): Promise<InstalledArtifactFile[]> {
  const skillsDir = path.join(configDir, "skills");
  try {
    const entries = await fs.readdir(skillsDir, { withFileTypes: true });
    const files = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          const filePath = path.join(skillsDir, entry.name, "SKILL.md");
          const content = await fs.readFile(filePath, "utf8");
          const parsed = matter(content);
          return {
            name: entry.name,
            type: "skill" as const,
            content,
            managedBy: parsed.data["managed_by"] === "user" ? "user" : "codi",
            hint: extractTemplateHint(content),
          } satisfies InstalledArtifactFile;
        }),
    );
    return files;
  } catch {
    return [];
  }
}

async function readMcpArtifacts(configDir: string): Promise<InstalledArtifactFile[]> {
  const mcpDir = path.join(configDir, "mcp-servers");
  try {
    const entries = await fs.readdir(mcpDir);
    const files = await Promise.all(
      entries
        .filter((entry) => entry.endsWith(".yaml") || entry.endsWith(".yml"))
        .map(async (entry) => {
          const filePath = path.join(mcpDir, entry);
          const content = await fs.readFile(filePath, "utf8");
          let managedBy: "codi" | "user" = "codi";
          try {
            const parsed = parseYaml(content) as Record<string, unknown> | null;
            if (parsed?.managed_by === "user") {
              managedBy = "user";
            }
          } catch {
            // Keep default for malformed local files; picker should still surface them.
          }
          return {
            name: entry.replace(/\.(yaml|yml)$/, ""),
            type: "mcp-server" as const,
            content,
            managedBy,
            hint: extractYamlDescription(content),
          } satisfies InstalledArtifactFile;
        }),
    );
    return files;
  } catch {
    return [];
  }
}

async function scanInstalledArtifacts(configDir: string): Promise<InstalledArtifactFile[]> {
  const [rules, skills, agents, commands, mcpServers] = await Promise.all([
    readMarkdownArtifacts(path.join(configDir, "rules"), "rule"),
    readSkillArtifacts(configDir),
    readMarkdownArtifacts(path.join(configDir, "agents"), "agent"),
    readMarkdownArtifacts(path.join(configDir, "commands"), "command"),
    readMcpArtifacts(configDir),
  ]);
  return [...rules, ...skills, ...agents, ...commands, ...mcpServers];
}

function buildSelections(entries: InstalledArtifactInventoryEntry[]): ExistingSelections {
  const installed = entries.filter((entry) => entry.installed);
  return {
    preset: "current-install",
    rules: installed.filter((entry) => entry.type === "rule").map((entry) => entry.name),
    skills: installed.filter((entry) => entry.type === "skill").map((entry) => entry.name),
    agents: installed.filter((entry) => entry.type === "agent").map((entry) => entry.name),
    commands: installed.filter((entry) => entry.type === "command").map((entry) => entry.name),
    mcpServers: installed.filter((entry) => entry.type === "mcp-server").map((entry) => entry.name),
  };
}

function getManifestVersion(
  manifestVersions: Map<string, InstalledArtifactVersion>,
  name: string,
): InstalledArtifactVersion | null {
  return manifestVersions.get(name) ?? null;
}

function buildManifestVersionMap(registry: TemplateHashRegistry): Map<string, number> {
  return new Map(
    Object.entries(registry.templates).map(([name, template]) => [name, template.artifactVersion]),
  );
}

export async function buildInstalledArtifactInventory(
  configDir: string,
): Promise<InstalledArtifactInventory> {
  const registry = buildTemplateHashRegistry();
  const manifestMgr = new ArtifactManifestManager(configDir);
  const [installedFiles, manifestResult] = await Promise.all([
    scanInstalledArtifacts(configDir),
    manifestMgr.read(),
  ]);

  const manifestVersions = new Map<string, InstalledArtifactVersion>();
  if (manifestResult.ok) {
    for (const [name, artifact] of Object.entries(manifestResult.data.artifacts)) {
      manifestVersions.set(name, artifact.installedArtifactVersion);
    }
  }

  const installedByName = new Map(installedFiles.map((entry) => [entry.name, entry]));
  const entries: InstalledArtifactInventoryEntry[] = [];

  for (const [name, template] of Object.entries(registry.templates)) {
    const installed = installedByName.get(name);
    const builtinHint = getBuiltinHint(name, template.type);
    if (!installed) {
      entries.push({
        name,
        type: template.type,
        status: "builtin-new",
        installed: false,
        managedBy: "codi",
        installedArtifactVersion: null,
        hint: builtinHint,
      });
      continue;
    }

    installedByName.delete(name);
    const installedHash = hashContent(installed.content);
    const status =
      installed.managedBy === "user"
        ? "custom-user"
        : installedHash === template.contentHash
          ? "builtin-original"
          : "builtin-modified";

    entries.push({
      name,
      type: template.type,
      status,
      installed: true,
      managedBy: installed.managedBy,
      installedArtifactVersion: getManifestVersion(manifestVersions, name),
      hint: builtinHint || installed.hint,
    });
  }

  const fallbackVersions = buildManifestVersionMap(registry);
  for (const installed of installedByName.values()) {
    entries.push({
      name: installed.name,
      type: installed.type,
      status: installed.managedBy === "user" ? "custom-user" : "builtin-removed",
      installed: true,
      managedBy: installed.managedBy,
      installedArtifactVersion:
        getManifestVersion(manifestVersions, installed.name) ??
        fallbackVersions.get(installed.name) ??
        null,
      hint: installed.hint,
    });
  }

  entries.sort((left, right) => left.name.localeCompare(right.name));
  return {
    entries,
    selections: buildSelections(entries),
  };
}

export function filterInventoryByType(
  entries: InstalledArtifactInventoryEntry[],
  type: ArtifactType,
): InstalledArtifactInventoryEntry[] {
  return entries.filter((entry) => entry.type === type);
}
