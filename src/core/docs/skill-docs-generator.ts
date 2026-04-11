import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseFrontmatter } from "#src/utils/frontmatter.js";
import {
  AVAILABLE_SKILL_TEMPLATES,
  loadSkillTemplate,
} from "../scaffolder/skill-template-loader.js";
import {
  AVAILABLE_TEMPLATES as AVAILABLE_RULE_TEMPLATES,
  loadTemplate as loadRuleTemplate,
} from "../scaffolder/template-loader.js";
import {
  AVAILABLE_AGENT_TEMPLATES,
  loadAgentTemplate,
} from "../scaffolder/agent-template-loader.js";
import { BUILTIN_PRESETS } from "#src/templates/presets/index.js";
import { ALL_SKILL_CATEGORIES } from "#src/constants.js";

export interface SkillDocEntry {
  name: string;
  description: string;
  category: string;
  userInvocable: boolean;
  compatibility: string[];
  body: string;
  readme?: string;
}

interface SkillFrontmatter {
  name: string;
  description: string;
  category?: string;
  "user-invocable"?: boolean;
  compatibility?: string[];
}

const DEFAULT_CATEGORY = "Uncategorized";

function resolveTemplatePlaceholders(content: string, name: string): string {
  return content.replace(/\{\{name\}\}/g, name);
}

function flattenDescription(desc: string): string {
  return desc.replace(/\n\s*/g, " ").trim();
}

/**
 * Remove backslash escapes from template literal output.
 * Templates use \\\` to produce \` at runtime — strip the backslash
 * so markdown renders correctly (``` not \`\`\`).
 * Also handles \${...} → ${...}.
 */
function unescapeTemplateOutput(content: string): string {
  return content.replace(/\\`/g, "`").replace(/\\\$/g, "$");
}

export function collectSkillEntries(): SkillDocEntry[] {
  const entries: SkillDocEntry[] = [];

  for (const templateName of AVAILABLE_SKILL_TEMPLATES) {
    const result = loadSkillTemplate(templateName);
    if (!result.ok) continue;

    const descriptor = result.data;
    const raw = resolveTemplatePlaceholders(descriptor.template, templateName);
    const { data, content } = parseFrontmatter<SkillFrontmatter>(raw);

    let readme: string | undefined;
    if (descriptor.staticDir) {
      const readmePath = join(descriptor.staticDir, "README.md");
      if (existsSync(readmePath)) {
        const rawReadme = readFileSync(readmePath, "utf-8");
        // Strip leading h1 title — skill name is already shown in the card header
        readme = unescapeTemplateOutput(rawReadme.replace(/^#[^\n]*\n/, "").trimStart());
      }
    }

    entries.push({
      name: data.name ?? templateName,
      description: flattenDescription(data.description ?? ""),
      category: data.category ?? DEFAULT_CATEGORY,
      userInvocable: data["user-invocable"] !== false,
      compatibility: data.compatibility ?? [],
      body: unescapeTemplateOutput(content),
      readme,
    });
  }

  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

export interface CategoryGroup {
  name: string;
  skills: SkillDocEntry[];
}

export function groupByCategory(entries: SkillDocEntry[]): CategoryGroup[] {
  const map = new Map<string, SkillDocEntry[]>();
  for (const entry of entries) {
    const list = map.get(entry.category) ?? [];
    list.push(entry);
    map.set(entry.category, list);
  }

  // Sort: known categories in canonical order first, then unknown categories alphabetically.
  const knownOrder = new Map<string, number>(ALL_SKILL_CATEGORIES.map((cat, i) => [cat, i]));
  return Array.from(map.entries())
    .sort(([a], [b]) => {
      const ai = knownOrder.get(a);
      const bi = knownOrder.get(b);
      if (ai !== undefined && bi !== undefined) return ai - bi;
      if (ai !== undefined) return -1;
      if (bi !== undefined) return 1;
      return a.localeCompare(b);
    })
    .map(([name, skills]) => ({ name, skills }));
}

/**
 * Export skill catalog as JSON for consumption by build scripts.
 * Used by the documentation skill's build-docs script.
 */
export function exportSkillCatalogJson(): string {
  const entries = collectSkillEntries();
  const groups = groupByCategory(entries);
  return JSON.stringify({ totalSkills: entries.length, groups }, null, 2);
}

// ---------------------------------------------------------------------------
// Rule, Agent, and Preset collectors
// ---------------------------------------------------------------------------

export interface RuleDocEntry {
  type: "rule";
  name: string;
  description: string;
  priority: string;
  alwaysApply: boolean;
  version: number;
  body: string;
}

export interface AgentDocEntry {
  type: "agent";
  name: string;
  description: string;
  tools: string[];
  model: string;
  version: number;
  body: string;
}

export interface PresetDocEntry {
  type: "preset";
  name: string;
  description: string;
  version: string;
  tags: string[];
  compatibilityAgents: string[];
  rules: string[];
  skills: string[];
  flagCount: number;
}

interface RuleFrontmatter {
  name?: string;
  description?: string;
  priority?: string;
  alwaysApply?: boolean;
  version?: number;
}

interface AgentFrontmatter {
  name?: string;
  description?: string;
  tools?: string | string[];
  model?: string;
  version?: number;
}

function parseToolsField(tools: string | string[] | undefined): string[] {
  if (!tools) return [];
  if (Array.isArray(tools)) return tools;
  // Handle YAML inline array: "[Read, Grep, Bash]"
  return tools
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export function collectRuleEntries(): RuleDocEntry[] {
  const entries: RuleDocEntry[] = [];

  for (const templateName of AVAILABLE_RULE_TEMPLATES) {
    const result = loadRuleTemplate(templateName);
    if (!result.ok) continue;

    const raw = resolveTemplatePlaceholders(result.data, templateName);
    const { data, content } = parseFrontmatter<RuleFrontmatter>(raw);

    entries.push({
      type: "rule",
      name: data.name ?? templateName,
      description: flattenDescription(data.description ?? ""),
      priority: data.priority ?? "medium",
      alwaysApply: data.alwaysApply ?? true,
      version: data.version ?? 1,
      body: unescapeTemplateOutput(content),
    });
  }

  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

export function collectAgentEntries(): AgentDocEntry[] {
  const entries: AgentDocEntry[] = [];

  for (const templateName of AVAILABLE_AGENT_TEMPLATES) {
    const result = loadAgentTemplate(templateName);
    if (!result.ok) continue;

    const raw = resolveTemplatePlaceholders(result.data, templateName);
    const { data, content } = parseFrontmatter<AgentFrontmatter>(raw);

    entries.push({
      type: "agent",
      name: data.name ?? templateName,
      description: flattenDescription(data.description ?? ""),
      tools: parseToolsField(data.tools),
      model: data.model ?? "inherit",
      version: data.version ?? 1,
      body: unescapeTemplateOutput(content),
    });
  }

  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

export function collectPresetEntries(): PresetDocEntry[] {
  return Object.entries(BUILTIN_PRESETS).map(([key, preset]) => ({
    type: "preset",
    name: preset.name ?? key,
    description: preset.description ?? "",
    version: preset.version ?? "1.0.0",
    tags: preset.tags ?? [],
    compatibilityAgents: preset.compatibility?.agents ?? [],
    rules: preset.rules ?? [],
    skills: preset.skills ?? [],
    flagCount: Object.keys(preset.flags ?? {}).length,
  }));
}
