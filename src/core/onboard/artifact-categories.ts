/**
 * Artifact category tables — pure data + helpers consumed by both the CLI
 * wizard (cli/artifact-categories.ts) and the catalog renderer
 * (core/onboard/catalog-renderer.ts). The category maps and frontmatter
 * helpers are presentation-agnostic, so they live in core/ rather than cli/.
 *
 * The cli/ layer wraps these with prompt-specific builders (badge formatting,
 * groupMultiselect option shapes) — those wrappers stay in cli/.
 */

import { MCP_SERVER_GROUPS } from "#src/templates/mcp-servers/index.js";
import { ALL_SKILL_CATEGORIES, PLATFORM_CATEGORY } from "#src/constants.js";

// Static category maps for rules and agents.
// Each array lists the fully-prefixed artifact names that belong to that group.
// Any name not present in the map will fall into an "Other" catch-all group.

export const RULE_CATEGORIES: Record<string, string[]> = {
  "Language-Specific": [
    "codi-typescript",
    "codi-react",
    "codi-python",
    "codi-golang",
    "codi-java",
    "codi-kotlin",
    "codi-rust",
    "codi-swift",
    "codi-csharp",
    "codi-nextjs",
    "codi-django",
    "codi-spring-boot",
  ],
  "Code Quality": ["codi-code-style", "codi-testing", "codi-error-handling", "codi-security"],
  "Architecture & Design": [
    "codi-architecture",
    "codi-api-design",
    "codi-performance",
    "codi-simplicity-first",
    "codi-production-mindset",
  ],
  "Workflow & Process": [
    "codi-workflow",
    "codi-git-workflow",
    "codi-documentation",
    "codi-spanish-orthography",
    "codi-output-discipline",
    "codi-contribution-discipline",
  ],
  [PLATFORM_CATEGORY]: ["codi-agent-usage", "codi-improvement-dev", "codi-capture-everything"],
};

// Artifacts that are always pre-selected regardless of preset or custom choice.
// These are the Codi Platform artifacts — they govern how Codi itself operates in the project.
export const PLATFORM_RULE_DEFAULTS: readonly string[] = RULE_CATEGORIES[PLATFORM_CATEGORY] ?? [];

// Platform skill defaults are derived at runtime from frontmatter because skill
// categories live in template content, not in a static map.
// Call this once per wizard session using the same loadFn already in scope.
export function getPlatformSkillDefaults(
  templates: string[],
  loadFn: (name: string) => { ok: boolean; data?: string },
): string[] {
  const categoryMap = buildSkillCategoryMap(templates, loadFn);
  return categoryMap[PLATFORM_CATEGORY] ?? [];
}

export const AGENT_CATEGORIES: Record<string, string[]> = {
  "Code Quality": [
    "codi-code-reviewer",
    "codi-test-generator",
    "codi-security-analyzer",
    "codi-refactorer",
    "codi-performance-auditor",
  ],
  "Architecture & Design": [
    "codi-api-designer",
    "codi-codebase-explorer",
    "codi-scalability-expert",
  ],
  "Data & ML": [
    "codi-data-analytics-bi-expert",
    "codi-data-engineering-expert",
    "codi-data-intensive-architect",
    "codi-data-science-specialist",
    "codi-mlops-engineer",
  ],
  "Web & Frontend": [
    "codi-nextjs-researcher",
    "codi-payload-cms-auditor",
    "codi-marketing-seo-specialist",
  ],
  "Business & Compliance": [
    "codi-legal-compliance-eu",
    "codi-ai-engineering-expert",
    "codi-openai-agents-specialist",
    "codi-python-expert",
  ],
  "Exploration & Docs": ["codi-docs-lookup"],
};

// MCP server categories derived from the grouped registry in the template index.
export const MCP_SERVER_CATEGORIES: Record<string, string[]> = MCP_SERVER_GROUPS;

// Dynamic skill category extraction.
// Skills store their category in YAML frontmatter: `category: <group name>`.

const SKILL_CATEGORY_PATTERN = /^category:\s*(.+)$/m;
const PLATFORM_PLACEHOLDER = /\$\{[^}]+\}/g;

function resolveSkillCategory(raw: string): string {
  // Template strings may contain interpolation tokens like ${PROJECT_NAME_DISPLAY}.
  // Treat any value containing a placeholder as the platform category.
  if (PLATFORM_PLACEHOLDER.test(raw)) return PLATFORM_CATEGORY;
  return raw.trim();
}

export function buildSkillCategoryMap(
  templates: string[],
  loadFn: (name: string) => { ok: boolean; data?: string },
): Record<string, string[]> {
  // Pre-seed known categories in canonical order so CLI wizard groups are stable.
  const groups: Record<string, string[]> = Object.fromEntries(
    ALL_SKILL_CATEGORIES.map((cat) => [cat, [] as string[]]),
  );

  for (const name of templates) {
    const result = loadFn(name);
    const content = result.ok ? (result.data ?? "") : "";
    const match = SKILL_CATEGORY_PATTERN.exec(content);
    const category = match ? resolveSkillCategory(match[1]!) : "Other";
    (groups[category] ??= []).push(name);
  }

  // Remove empty known-category buckets (no skills assigned).
  for (const cat of ALL_SKILL_CATEGORIES) {
    if (groups[cat]?.length === 0) delete groups[cat];
  }

  return groups;
}

// Parse the first line of a template's `description:` frontmatter entry.
// Used by both the CLI wizard (for hint text) and the catalog renderer
// (for the Markdown summary column).
export function extractTemplateHint(content: string): string {
  const multiLine = content.match(/^description:\s*\|\s*\n\s+(.+)/m);
  if (multiLine?.[1]) return multiLine[1].trim();
  const singleLine = content.match(/^description:\s*(.+)$/m);
  if (singleLine?.[1]) return singleLine[1].trim();
  return "";
}
