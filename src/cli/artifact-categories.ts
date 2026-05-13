import type { ArtifactUpgradeInfo } from "../core/version/upgrade-detector.js";
import type { InstalledArtifactInventoryEntry } from "./installed-artifact-inventory.js";
import {
  extractTemplateHint,
  RULE_CATEGORIES,
  AGENT_CATEGORIES,
  MCP_SERVER_CATEGORIES,
  PLATFORM_RULE_DEFAULTS,
  getPlatformSkillDefaults,
  buildSkillCategoryMap,
} from "../core/onboard/artifact-categories.js";

// Re-export the core data tables and helpers for backwards-compatibility with
// existing CLI imports. cli/artifact-categories.ts is the CLI-side wrapper —
// it keeps the @clack-flavoured group builders that produce GroupedOption
// shapes, while the underlying data lives in core/.
export {
  RULE_CATEGORIES,
  AGENT_CATEGORIES,
  MCP_SERVER_CATEGORIES,
  PLATFORM_RULE_DEFAULTS,
  getPlatformSkillDefaults,
  buildSkillCategoryMap,
  extractTemplateHint,
};

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
// These live here to keep init-wizard-paths.ts under the 800-line limit.
// ---------------------------------------------------------------------------

export function formatLabel(name: string): string {
  return name
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
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
