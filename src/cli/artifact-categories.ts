import type { ArtifactUpgradeInfo } from "../core/version/upgrade-detector.js";
import type { InstalledArtifactInventoryEntry } from "./installed-artifact-inventory.js";
import { MCP_SERVER_GROUPS } from "../templates/mcp-servers/index.js";

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
  ],
  "Codi Platform": ["codi-agent-usage", "codi-improvement-dev"],
};

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
  "Exploration & Docs": ["codi-docs-lookup", "codi-onboarding-guide"],
};

// MCP server categories derived from the grouped registry in the template index.
export const MCP_SERVER_CATEGORIES: Record<string, string[]> = MCP_SERVER_GROUPS;

// Dynamic skill category extraction.
// Skills store their category in YAML frontmatter: `category: <group name>`.

const SKILL_CATEGORY_PATTERN = /^category:\s*(.+)$/m;
const PLATFORM_PLACEHOLDER = /\$\{[^}]+\}/g;
const PLATFORM_LABEL = "Codi Platform";

function resolveSkillCategory(raw: string): string {
  // Template strings may contain interpolation tokens like ${PROJECT_NAME_DISPLAY}.
  // Treat any value containing a placeholder as the Codi Platform category.
  if (PLATFORM_PLACEHOLDER.test(raw)) return PLATFORM_LABEL;
  const trimmed = raw.trim();
  // Normalise known informal labels.
  if (trimmed === "brand") return "Brand";
  if (trimmed === "quality") return "Code Quality";
  if (trimmed === "productivity") return "Productivity";
  return trimmed;
}

export function buildSkillCategoryMap(
  templates: string[],
  loadFn: (name: string) => { ok: boolean; data?: string },
): Record<string, string[]> {
  const groups: Record<string, string[]> = {};

  for (const name of templates) {
    const result = loadFn(name);
    const content = result.ok ? (result.data ?? "") : "";
    const match = SKILL_CATEGORY_PATTERN.exec(content);
    const category = match ? resolveSkillCategory(match[1]!) : "Other";
    (groups[category] ??= []).push(name);
  }

  return groups;
}

// Generic grouped-options builder.
// Converts a flat list of template names into a Record<group, Option[]> for
// use with @clack/prompts groupMultiselect.
// Templates not listed in any category group are placed in "Other".

export function buildGroupedOptions<V>(
  categoryMap: Record<string, string[]>,
  allTemplates: string[],
  buildOption: (name: string) => { label: string; value: V; hint: string },
): Record<string, Array<{ label: string; value: V; hint: string }>> {
  const nameToGroup = new Map<string, string>();
  for (const [group, names] of Object.entries(categoryMap)) {
    for (const name of names) {
      nameToGroup.set(name, group);
    }
  }

  // Pre-create groups in declared order.
  const result: Record<string, Array<{ label: string; value: V; hint: string }>> = {};
  for (const group of Object.keys(categoryMap)) {
    result[group] = [];
  }

  for (const name of allTemplates) {
    const group = nameToGroup.get(name) ?? "Other";
    (result[group] ??= []).push(buildOption(name));
  }

  // Remove empty groups.
  for (const group of Object.keys(result)) {
    if (result[group]!.length === 0) {
      delete result[group];
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Wizard option utilities.
// These live here to keep init-wizard-paths.ts under the 700-line limit.
// ---------------------------------------------------------------------------

export function formatLabel(name: string): string {
  return name
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function extractTemplateHint(content: string): string {
  const multiLine = content.match(/^description:\s*\|\s*\n\s+(.+)/m);
  if (multiLine?.[1]) return multiLine[1].trim();
  const singleLine = content.match(/^description:\s*(.+)$/m);
  if (singleLine?.[1]) return singleLine[1].trim();
  return "";
}

export function formatStatusBadge(status: ArtifactUpgradeInfo["status"]): string {
  switch (status) {
    case "outdated":
      return " [update]";
    case "new":
      return " [new]";
    case "removed":
      return " [deprecated]";
    case "user-managed":
      return " [user]";
    case "up-to-date":
      return "";
  }
}

export type OptionLoader = (name: string) => { ok: boolean; data?: string };
export type GroupedOption = { label: string; value: string; hint: string };
export type InventoryGroupedOption = GroupedOption & {
  status: InstalledArtifactInventoryEntry["status"];
  installed: boolean;
};
const LOCAL_ONLY_GROUP = "Installed Custom";

export function buildGroupedUpgradeOptions(
  templates: string[],
  categoryMap: Record<string, string[]>,
  upgradeMap: Map<string, ArtifactUpgradeInfo>,
  loadFn: OptionLoader,
): Record<string, GroupedOption[]> {
  return buildGroupedOptions(categoryMap, templates, (name) => {
    const result = loadFn(name);
    const desc = result.ok && result.data ? extractTemplateHint(result.data) : "";
    const info = upgradeMap.get(name);
    if (!info) return { label: formatLabel(name), value: name, hint: desc };
    const badge = formatStatusBadge(info.status);
    let hint = desc;
    if (info.status === "removed") {
      hint = desc ? `deprecated | ${desc}` : "deprecated";
    } else if (info.status === "user-managed") {
      hint = desc ? `user-managed | ${desc}` : "user-managed";
    }
    return { label: `${formatLabel(name)}${badge}`, value: name, hint };
  });
}

export function buildGroupedBasicOptions(
  templates: string[],
  categoryMap: Record<string, string[]>,
  loadFn: OptionLoader,
): Record<string, GroupedOption[]> {
  return buildGroupedOptions(categoryMap, templates, (name) => {
    const result = loadFn(name);
    const hint = result.ok && result.data ? extractTemplateHint(result.data) : "";
    return { label: formatLabel(name), value: name, hint };
  });
}

export function formatInventoryStatusBadge(
  status: InstalledArtifactInventoryEntry["status"],
): string {
  switch (status) {
    case "builtin-original":
      return " [installed]";
    case "builtin-modified":
      return " [modified]";
    case "builtin-new":
      return " [new]";
    case "builtin-removed":
      return " [deprecated]";
    case "custom-user":
      return " [user]";
  }
}

function formatInventoryHint(entry: InstalledArtifactInventoryEntry): string {
  switch (entry.status) {
    case "builtin-original":
      return entry.hint;
    case "builtin-modified":
      return entry.hint ? `modified locally | ${entry.hint}` : "modified locally";
    case "builtin-new":
      return entry.hint;
    case "builtin-removed":
      return entry.hint
        ? `no longer shipped by this Codi version | ${entry.hint}`
        : "no longer shipped by this Codi version";
    case "custom-user":
      return entry.hint
        ? `user-managed local artifact | ${entry.hint}`
        : "user-managed local artifact";
  }
}

export function buildGroupedInventoryOptions(
  entries: InstalledArtifactInventoryEntry[],
  categoryMap: Record<string, string[]>,
): Record<string, InventoryGroupedOption[]> {
  const nameToGroup = new Map<string, string>();
  for (const [group, names] of Object.entries(categoryMap)) {
    for (const name of names) {
      nameToGroup.set(name, group);
    }
  }

  const result: Record<string, InventoryGroupedOption[]> = {};
  for (const group of Object.keys(categoryMap)) {
    result[group] = [];
  }

  for (const entry of entries) {
    const isBuiltinEntry = entry.status !== "builtin-removed" && entry.status !== "custom-user";
    const group = isBuiltinEntry ? (nameToGroup.get(entry.name) ?? "Other") : LOCAL_ONLY_GROUP;
    (result[group] ??= []).push({
      label: `${formatLabel(entry.name)}${formatInventoryStatusBadge(entry.status)}`,
      value: entry.name,
      hint: formatInventoryHint(entry),
      status: entry.status,
      installed: entry.installed,
    });
  }

  for (const group of Object.keys(result)) {
    if (result[group]!.length === 0) {
      delete result[group];
    }
  }

  return result;
}
