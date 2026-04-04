import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { parseFrontmatter } from "#src/utils/frontmatter.js";
import {
  AVAILABLE_SKILL_TEMPLATES,
  loadSkillTemplateContent,
} from "../scaffolder/skill-template-loader.js";
import { renderSkillDocsPage } from "./skill-docs-template.js";
import { ALL_SKILL_CATEGORIES } from "#src/constants.js";

export interface SkillDocEntry {
  name: string;
  description: string;
  category: string;
  userInvocable: boolean;
  compatibility: string[];
  body: string;
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
    const result = loadSkillTemplateContent(templateName);
    if (!result.ok) continue;

    const raw = resolveTemplatePlaceholders(result.data, templateName);
    const { data, content } = parseFrontmatter<SkillFrontmatter>(raw);

    entries.push({
      name: data.name ?? templateName,
      description: flattenDescription(data.description ?? ""),
      category: data.category ?? DEFAULT_CATEGORY,
      userInvocable: data["user-invocable"] !== false,
      compatibility: data.compatibility ?? [],
      body: unescapeTemplateOutput(content),
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

/**
 * Generate the full HTML skill catalog page.
 */
export function generateSkillDocsHtml(): string {
  const entries = collectSkillEntries();
  const groups = groupByCategory(entries);
  return renderSkillDocsPage(groups, entries.length);
}

/**
 * Build and write the HTML skill catalog to docs/codi_docs/index.html.
 * Returns the absolute path of the written file.
 */
export async function buildSkillDocsFile(projectRoot: string): Promise<string> {
  const html = generateSkillDocsHtml();
  const outPath = join(projectRoot, "docs", "codi_docs", "index.html");
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, html, "utf-8");
  return outPath;
}
