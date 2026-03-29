/**
 * Template catalog documentation renderers.
 */

// ---------------------------------------------------------------------------
// Template counts
// ---------------------------------------------------------------------------

interface TemplateCounts {
  rules: number;
  ruleNames: string[];
  skills: number;
  skillNames: string[];
  agents: number;
  agentNames: string[];
  commands: number;
  commandNames: string[];
}

export function renderTemplateCounts(counts: TemplateCounts): string {
  return [
    "| Artifact | Count | Names |",
    "|:---------|:-----:|:------|",
    `| **Rules** | ${counts.rules} | ${counts.ruleNames.join(", ")} |`,
    `| **Skills** | ${counts.skills} | ${counts.skillNames.join(", ")} |`,
    `| **Agents** | ${counts.agents} | ${counts.agentNames.join(", ")} |`,
    `| **Commands** | ${counts.commands} | ${counts.commandNames.join(", ")} |`,
  ].join("\n");
}

export function renderTemplateCountsCompact(counts: TemplateCounts): string {
  return [
    "| Artifact | Count |",
    "|:---------|:-----:|",
    `| **Rules** | ${counts.rules} |`,
    `| **Skills** | ${counts.skills} |`,
    `| **Agents** | ${counts.agents} |`,
    `| **Commands** | ${counts.commands} |`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Rule template list
// ---------------------------------------------------------------------------

export function renderRuleTemplateList(names: string[]): string {
  const sorted = [...names].sort();
  return sorted.map((n) => `\`${n}\``).join(", ");
}

// ---------------------------------------------------------------------------
// Skill templates by category
// ---------------------------------------------------------------------------

export function renderSkillTemplatesByCategory(
  categoryMap: Record<string, string[]>,
): string {
  const rows = Object.entries(categoryMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, skills]) => {
      const sorted = [...skills].sort();
      return `| **${category}** | ${sorted.join(", ")} |`;
    });

  return ["| Category | Skills |", "|----------|--------|", ...rows].join("\n");
}

/**
 * Extract category from a skill template's YAML frontmatter string.
 */
export function extractSkillCategory(content: string): string {
  const match = content.match(/^category:\s*(.+)$/m);
  return match?.[1]?.trim() ?? "Uncategorized";
}

// ---------------------------------------------------------------------------
// Agent template list
// ---------------------------------------------------------------------------

export function renderAgentTemplateList(names: string[]): string {
  const sorted = [...names].sort();
  return sorted.map((n) => `\`${n}\``).join(", ");
}

// ---------------------------------------------------------------------------
// Command template list
// ---------------------------------------------------------------------------

export function renderCommandTemplateList(names: string[]): string {
  const sorted = [...names].sort();
  return sorted.map((n) => `\`${n}\``).join(", ");
}
