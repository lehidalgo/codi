import { writeFile, mkdir, rm, readdir, readFile } from "node:fs/promises";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import {
  collectSkillEntries,
  collectRuleEntries,
  collectAgentEntries,
  collectPresetEntries,
} from "./skill-docs-generator.js";
import type {
  SkillDocEntry,
  RuleDocEntry,
  AgentDocEntry,
  PresetDocEntry,
} from "./skill-docs-generator.js";
import { BUILTIN_PRESETS } from "#src/templates/presets/index.js";
import { PROJECT_NAME } from "#src/constants.js";

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/**
 * Absolute path to src/templates/skills/ directory, resolved from this
 * source file so it works in both dev (ts-node/vitest) and bundled modes.
 */
function resolveSkillTemplatesDir(): string {
  const thisDir = dirname(fileURLToPath(import.meta.url));
  // From src/core/docs/ go up to src/, then into templates/skills/
  return join(thisDir, "..", "..", "templates", "skills");
}

/**
 * Given a skill name like "codi-debugging", return "debugging" (the dir name).
 */
function skillNameToDir(skillName: string): string {
  const prefix = `${PROJECT_NAME}-`;
  return skillName.startsWith(prefix) ? skillName.slice(prefix.length) : skillName;
}

// ---------------------------------------------------------------------------
// YAML helpers
// ---------------------------------------------------------------------------

/**
 * Escape a string for use in a YAML double-quoted scalar.
 */
function yamlQuoteLabel(value: string): string {
  return value.replace(/"/g, '\\"');
}

/**
 * Format a multiline YAML block scalar (literal block style).
 * The description value may contain colons and special characters.
 */
function yamlBlockScalar(value: string, indent: string = "  "): string {
  return `>\n${indent}${value.replace(/\n/g, `\n${indent}`)}`;
}

/**
 * Format a YAML list from a string array.
 */
function yamlList(items: string[]): string {
  if (items.length === 0) return "[]";
  return items.map((item) => `\n  - ${item}`).join("");
}

// ---------------------------------------------------------------------------
// Reference loading
// ---------------------------------------------------------------------------

interface ReferenceSection {
  title: string;
  content: string;
}

async function loadSkillReferences(skillName: string): Promise<ReferenceSection[]> {
  const skillDir = join(resolveSkillTemplatesDir(), skillNameToDir(skillName));
  const refsDir = join(skillDir, "references");

  let files: string[];
  try {
    files = await readdir(refsDir);
  } catch {
    return [];
  }

  const mdFiles = files.filter((f) => f.endsWith(".md")).sort();
  const sections: ReferenceSection[] = [];

  for (const file of mdFiles) {
    try {
      const content = await readFile(join(refsDir, file), "utf-8");
      const title = basename(file, ".md");
      sections.push({ title, content: content.trim() });
    } catch {
      // skip unreadable files
    }
  }

  return sections;
}

// ---------------------------------------------------------------------------
// Markdown formatters
// ---------------------------------------------------------------------------

function buildSkillMarkdown(entry: SkillDocEntry, refs: ReferenceSection[]): string {
  const compatList = entry.compatibility.length > 0 ? yamlList(entry.compatibility) : "[]";

  const lines: string[] = [
    "---",
    `title: ${entry.name}`,
    `description: ${yamlBlockScalar(entry.description)}`,
    `sidebar:`,
    `  label: "${yamlQuoteLabel(entry.name)}"`,
    `artifactType: skill`,
    `artifactCategory: ${entry.category}`,
    `userInvocable: ${entry.userInvocable}`,
    `compatibility:${compatList}`,
    `version: 1`,
    "---",
    "",
  ];

  // README section — only for skills that have one
  if (entry.readme) {
    lines.push("# README", "", entry.readme.trim(), "", "---", "");
  }

  // SKILL.md section — strip leading h1 (e.g. "# codi-skill-name") to avoid duplicate
  const bodyLines = entry.body.trim().split("\n");
  const bodyContent = bodyLines[0]?.startsWith("# ")
    ? bodyLines.slice(1).join("\n").trimStart()
    : entry.body.trim();
  lines.push("# SKILL.md", "", bodyContent);

  for (const ref of refs) {
    lines.push("", "---", "", `## Reference: ${ref.title}`, "", ref.content);
  }

  lines.push("");
  return lines.join("\n");
}

function buildRuleMarkdown(entry: RuleDocEntry): string {
  const lines: string[] = [
    "---",
    `title: ${entry.name}`,
    `description: ${yamlBlockScalar(entry.description)}`,
    `sidebar:`,
    `  label: "${yamlQuoteLabel(entry.name)}"`,
    `artifactType: rule`,
    `priority: ${entry.priority}`,
    `alwaysApply: ${entry.alwaysApply}`,
    `version: ${entry.version}`,
    "---",
    "",
    entry.body.trim(),
    "",
  ];
  return lines.join("\n");
}

function buildAgentMarkdown(entry: AgentDocEntry): string {
  const toolsList = entry.tools.length > 0 ? yamlList(entry.tools) : "[]";

  const lines: string[] = [
    "---",
    `title: ${entry.name}`,
    `description: ${yamlBlockScalar(entry.description)}`,
    `sidebar:`,
    `  label: "${yamlQuoteLabel(entry.name)}"`,
    `artifactType: agent`,
    `tools:${toolsList}`,
    `model: ${entry.model}`,
    `version: ${entry.version}`,
    "---",
    "",
    entry.body.trim(),
    "",
  ];
  return lines.join("\n");
}

function buildPresetMarkdown(entry: PresetDocEntry, presetKey: string): string {
  const tagsList = entry.tags.length > 0 ? yamlList(entry.tags) : "[]";
  const agentsList =
    entry.compatibilityAgents.length > 0 ? yamlList(entry.compatibilityAgents) : "[]";

  const preset = BUILTIN_PRESETS[presetKey];
  const flags = preset?.flags ?? {};

  const lines: string[] = [
    "---",
    `title: ${entry.name}`,
    `description: ${yamlBlockScalar(entry.description)}`,
    `sidebar:`,
    `  label: "${yamlQuoteLabel(entry.name)}"`,
    `artifactType: preset`,
    `version: ${entry.version}`,
    `tags:${tagsList}`,
    `compatibilityAgents:${agentsList}`,
    "---",
    "",
    `## Included Rules`,
    "",
  ];

  if (entry.rules.length > 0) {
    for (const rule of entry.rules) {
      lines.push(`- \`${rule}\``);
    }
  } else {
    lines.push("_No rules included._");
  }

  lines.push("", "## Included Skills", "");

  if (entry.skills.length > 0) {
    for (const skill of entry.skills) {
      lines.push(`- \`${skill}\``);
    }
  } else {
    lines.push("_No skills included._");
  }

  lines.push("", "## Flag Configuration", "");

  const flagEntries = Object.entries(flags);
  if (flagEntries.length > 0) {
    lines.push("| Flag | Mode | Value |");
    lines.push("| ---- | ---- | ----- |");
    for (const [flagName, flagDef] of flagEntries) {
      const value = JSON.stringify(flagDef.value ?? null);
      lines.push(`| \`${flagName}\` | ${flagDef.mode} | \`${value}\` |`);
    }
  } else {
    lines.push("_No flags configured._");
  }

  lines.push("");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Catalog directory management
// ---------------------------------------------------------------------------

const ARTIFACT_TYPES = ["skills", "rules", "agents", "presets"] as const;
type ArtifactType = (typeof ARTIFACT_TYPES)[number];

function catalogDir(projectRoot: string, type: ArtifactType): string {
  return join(projectRoot, "docs", "src", "content", "docs", "catalog", type);
}

async function resetCatalogDirs(projectRoot: string): Promise<void> {
  const baseDir = join(projectRoot, "docs", "src", "content", "docs", "catalog");
  await rm(baseDir, { recursive: true, force: true });
  await Promise.all(ARTIFACT_TYPES.map((type) => mkdir(join(baseDir, type), { recursive: true })));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate one Markdown file per artifact into the Astro Starlight catalog.
 *
 * Output structure:
 *   {projectRoot}/docs/src/content/docs/catalog/{type}/{name}.md
 */
export async function generateCatalogMarkdownFiles(projectRoot: string): Promise<void> {
  await resetCatalogDirs(projectRoot);

  const [skills, rules, agents, presets] = await Promise.all([
    Promise.resolve(collectSkillEntries()),
    Promise.resolve(collectRuleEntries()),
    Promise.resolve(collectAgentEntries()),
    Promise.resolve(collectPresetEntries()),
  ]);

  // Skill writes include async reference loading — run in parallel
  const skillWrites = skills.map(async (entry) => {
    const refs = await loadSkillReferences(entry.name);
    const content = buildSkillMarkdown(entry, refs);
    const filePath = join(catalogDir(projectRoot, "skills"), `${entry.name}.md`);
    return writeFile(filePath, content, "utf-8");
  });

  const ruleWrites = rules.map((entry) => {
    const content = buildRuleMarkdown(entry);
    const filePath = join(catalogDir(projectRoot, "rules"), `${entry.name}.md`);
    return writeFile(filePath, content, "utf-8");
  });

  const agentWrites = agents.map((entry) => {
    const content = buildAgentMarkdown(entry);
    const filePath = join(catalogDir(projectRoot, "agents"), `${entry.name}.md`);
    return writeFile(filePath, content, "utf-8");
  });

  // Build a map from preset name -> preset key for flag lookup
  const presetKeyByName = new Map<string, string>(
    Object.entries(BUILTIN_PRESETS).map(([key, p]) => [p.name ?? key, key]),
  );

  const presetWrites = presets.map((entry) => {
    const key = presetKeyByName.get(entry.name) ?? entry.name;
    const content = buildPresetMarkdown(entry, key);
    const filePath = join(catalogDir(projectRoot, "presets"), `${entry.name}.md`);
    return writeFile(filePath, content, "utf-8");
  });

  await Promise.all([...skillWrites, ...ruleWrites, ...agentWrites, ...presetWrites]);
}

// ---------------------------------------------------------------------------
// Meta JSON export
// ---------------------------------------------------------------------------

interface SkillMetaArtifact {
  type: "skill";
  name: string;
  description: string;
  slug: string;
  category: string;
  userInvocable: boolean;
  compatibility: string[];
}

interface RuleMetaArtifact {
  type: "rule";
  name: string;
  description: string;
  slug: string;
  priority: string;
  alwaysApply: boolean;
}

interface AgentMetaArtifact {
  type: "agent";
  name: string;
  description: string;
  slug: string;
  tools: string[];
  model: string;
}

interface PresetMetaArtifact {
  type: "preset";
  name: string;
  description: string;
  slug: string;
  tags: string[];
  compatibilityAgents: string[];
}

type MetaArtifact = SkillMetaArtifact | RuleMetaArtifact | AgentMetaArtifact | PresetMetaArtifact;

interface CatalogMeta {
  generatedAt: string;
  counts: Record<string, number>;
  categories: string[];
  compatibilities: string[];
  artifacts: MetaArtifact[];
}

/**
 * Build and return catalog metadata as a JSON string.
 * Does not write any files — suitable for in-process consumption.
 */
export function exportCatalogMetaJson(): string {
  const skills = collectSkillEntries();
  const rules = collectRuleEntries();
  const agents = collectAgentEntries();
  const presets = collectPresetEntries();

  const skillArtifacts: SkillMetaArtifact[] = skills.map((e) => ({
    type: "skill",
    name: e.name,
    description: e.description,
    slug: `catalog/skills/${e.name}`,
    category: e.category,
    userInvocable: e.userInvocable,
    compatibility: e.compatibility,
  }));

  const ruleArtifacts: RuleMetaArtifact[] = rules.map((e) => ({
    type: "rule",
    name: e.name,
    description: e.description,
    slug: `catalog/rules/${e.name}`,
    priority: e.priority,
    alwaysApply: e.alwaysApply,
  }));

  const agentArtifacts: AgentMetaArtifact[] = agents.map((e) => ({
    type: "agent",
    name: e.name,
    description: e.description,
    slug: `catalog/agents/${e.name}`,
    tools: e.tools,
    model: e.model,
  }));

  const presetArtifacts: PresetMetaArtifact[] = presets.map((e) => ({
    type: "preset",
    name: e.name,
    description: e.description,
    slug: `catalog/presets/${e.name}`,
    tags: e.tags,
    compatibilityAgents: e.compatibilityAgents,
  }));

  const allArtifacts: MetaArtifact[] = [
    ...skillArtifacts,
    ...ruleArtifacts,
    ...agentArtifacts,
    ...presetArtifacts,
  ];

  const categories = [...new Set(skills.map((s) => s.category))].sort();
  const compatibilities = [...new Set(skills.flatMap((s) => s.compatibility))].sort();

  const meta: CatalogMeta = {
    generatedAt: new Date().toISOString(),
    counts: {
      skills: skills.length,
      rules: rules.length,
      agents: agents.length,
      presets: presets.length,
      total: allArtifacts.length,
    },
    categories,
    compatibilities,
    artifacts: allArtifacts,
  };

  return JSON.stringify(meta, null, 2);
}

/**
 * Write the catalog metadata JSON to docs/generated/catalog-meta.json.
 * Returns the absolute path of the written file.
 */
export async function writeCatalogMetaJson(projectRoot: string): Promise<string> {
  const json = exportCatalogMetaJson();
  const outPath = join(projectRoot, "docs", "generated", "catalog-meta.json");
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, json, "utf-8");
  return outPath;
}
