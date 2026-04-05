/**
 * Code-driven documentation generator.
 * Reads source-of-truth code structures and injects rendered Markdown
 * into doc files between <!-- GENERATED:START/END --> markers.
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import fg from "fast-glob";
import { ok, err } from "#src/types/result.js";
import type { Result } from "#src/types/result.js";

import { FLAG_CATALOG } from "../flags/flag-catalog.js";
import { AVAILABLE_TEMPLATES } from "../scaffolder/template-loader.js";
import {
  AVAILABLE_SKILL_TEMPLATES,
  loadSkillTemplateContent,
} from "../scaffolder/skill-template-loader.js";
import { AVAILABLE_AGENT_TEMPLATES } from "../scaffolder/agent-template-loader.js";
import { BUILTIN_PRESETS } from "#src/templates/presets/index.js";
import { BUILTIN_MCP_SERVERS } from "#src/templates/mcp-servers/index.js";
import { ERROR_CATALOG } from "../output/error-catalog.js";
import { ALL_ADAPTERS } from "#src/adapters/index.js";
import { NORMAL_MENU, ADVANCED_MENU } from "#src/cli/hub.js";
import { PROJECT_CLI } from "#src/constants.js";

import {
  // Flags
  renderFlagsTable,
  renderFlagModes,
  renderFlagInstructions,
  renderFlagHooks,
  // Presets
  renderPresetTable,
  renderPresetFlagComparison,
  // Templates
  renderTemplateCounts,
  renderTemplateCountsCompact,
  renderRuleTemplateList,
  renderSkillTemplatesByCategory,
  extractSkillCategory,
  renderAgentTemplateList,
  // Infrastructure
  renderAdapterTable,
  renderSupportedAgents,
  renderErrorCatalog,
  renderHubActions,
  renderMcpServers,
  renderLayerOrder,
  // Schemas
  renderRuleFields,
  renderSkillFields,
  renderAgentFields,
  renderManifestFields,
  // Coverage
  renderTestCoverage,
} from "./section-renderers.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InjectionReport {
  updated: string[];
  unchanged: string[];
  missing: string[];
}

export interface ValidationReport {
  inSync: boolean;
  staleFiles: string[];
  staleSections: { file: string; section: string }[];
}

// ---------------------------------------------------------------------------
// Section registry: maps marker names to rendered content
// ---------------------------------------------------------------------------

function generateAllSections(projectRoot: string): Record<string, string> {
  const counts = {
    rules: AVAILABLE_TEMPLATES.length,
    ruleNames: [...AVAILABLE_TEMPLATES].sort(),
    skills: AVAILABLE_SKILL_TEMPLATES.length,
    skillNames: [...AVAILABLE_SKILL_TEMPLATES].sort(),
    agents: AVAILABLE_AGENT_TEMPLATES.length,
    agentNames: [...AVAILABLE_AGENT_TEMPLATES].sort(),
  };

  return {
    // --- Flags (4) ---
    flags_table: renderFlagsTable(FLAG_CATALOG),
    flag_modes: renderFlagModes(),
    flag_instructions: renderFlagInstructions(),
    flag_hooks: renderFlagHooks(FLAG_CATALOG),

    // --- Templates (6) ---
    template_counts: renderTemplateCounts(counts),
    template_counts_compact: renderTemplateCountsCompact(counts),
    rule_templates: renderRuleTemplateList(AVAILABLE_TEMPLATES),
    skill_templates: renderSkillTemplatesByCategory(buildSkillCategoryMap()),
    agent_templates: renderAgentTemplateList(AVAILABLE_AGENT_TEMPLATES),

    // --- Presets (2) ---
    preset_table: renderPresetTable(BUILTIN_PRESETS),
    preset_flag_comparison: renderPresetFlagComparison(BUILTIN_PRESETS, FLAG_CATALOG),

    // --- Infrastructure (5) ---
    adapter_table: renderAdapterTable(ALL_ADAPTERS),
    supported_agents: renderSupportedAgents(ALL_ADAPTERS),
    layer_order: renderLayerOrder(),
    error_catalog: renderErrorCatalog(
      ERROR_CATALOG as Record<string, { exitCode: number; severity: string; hintTemplate: string }>,
    ),
    hub_actions: renderHubActions(NORMAL_MENU, ADVANCED_MENU),
    mcp_servers: renderMcpServers(BUILTIN_MCP_SERVERS),

    // --- Schema fields (6) ---
    rule_fields: renderRuleFields(),
    skill_fields: renderSkillFields(),
    agent_fields: renderAgentFields(),
    manifest_fields: renderManifestFields(),

    // --- Testing (1) ---
    test_coverage: renderTestCoverage(projectRoot),
  };
}

/**
 * Build a map of skill category → skill names by parsing template frontmatter.
 */
function buildSkillCategoryMap(): Record<string, string[]> {
  const categoryMap: Record<string, string[]> = {};

  for (const name of AVAILABLE_SKILL_TEMPLATES) {
    const result = loadSkillTemplateContent(name);
    if (!result.ok) continue;
    const category = extractSkillCategory(result.data);
    if (!categoryMap[category]) {
      categoryMap[category] = [];
    }
    categoryMap[category].push(name);
  }

  return categoryMap;
}

// ---------------------------------------------------------------------------
// Marker regex
// ---------------------------------------------------------------------------

const MARKER_RE = /<!-- GENERATED:START:(\w+) -->\n[\s\S]*?<!-- GENERATED:END:\1 -->/g;

function injectIntoContent(
  content: string,
  sections: Record<string, string>,
): { result: string; injected: string[]; missing: string[] } {
  const injected: string[] = [];
  const missing: string[] = [];

  const result = content.replace(MARKER_RE, (match, sectionName: string) => {
    const rendered = sections[sectionName];
    if (rendered === undefined) {
      missing.push(sectionName);
      return match; // preserve original if no renderer exists
    }
    injected.push(sectionName);
    return `<!-- GENERATED:START:${sectionName} -->\n${rendered}\n<!-- GENERATED:END:${sectionName} -->`;
  });

  return { result, injected, missing };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Inject all code-driven sections into doc files.
 * Replaces content between markers; preserves everything else.
 */
export async function injectSections(projectRoot: string): Promise<Result<InjectionReport>> {
  try {
    const sections = generateAllSections(projectRoot);
    const docFiles = await findDocFiles(projectRoot);
    const report: InjectionReport = {
      updated: [],
      unchanged: [],
      missing: [],
    };

    for (const file of docFiles) {
      const absPath = join(projectRoot, file);
      const content = await readFile(absPath, "utf-8");

      if (!MARKER_RE.test(content)) {
        report.unchanged.push(file);
        continue;
      }

      // Reset regex lastIndex (it's stateful with /g flag)
      MARKER_RE.lastIndex = 0;

      const { result, injected, missing } = injectIntoContent(content, sections);

      report.missing.push(...missing.map((s) => `${file}:${s}`));

      if (result !== content) {
        await writeFile(absPath, result, "utf-8");
        report.updated.push(file);
      } else if (injected.length > 0) {
        report.unchanged.push(file);
      }
    }

    return ok(report);
  } catch (e) {
    return err([
      {
        code: "E_DOCS_GENERATION",
        message: `Documentation generation failed: ${String(e)}`,
        hint: "Check that doc files exist and are readable.",
        severity: "error" as const,
        context: {},
      },
    ]);
  }
}

/**
 * Validate that all code-driven sections are in sync.
 * Returns ok if everything matches, err if any section is stale.
 */
export async function validateSections(projectRoot: string): Promise<Result<ValidationReport>> {
  try {
    const sections = generateAllSections(projectRoot);
    const docFiles = await findDocFiles(projectRoot);
    const report: ValidationReport = {
      inSync: true,
      staleFiles: [],
      staleSections: [],
    };

    for (const file of docFiles) {
      const absPath = join(projectRoot, file);
      const content = await readFile(absPath, "utf-8");

      if (!MARKER_RE.test(content)) continue;
      MARKER_RE.lastIndex = 0;

      const { result } = injectIntoContent(content, sections);

      if (result !== content) {
        report.inSync = false;
        report.staleFiles.push(file);

        // Find which sections differ
        MARKER_RE.lastIndex = 0;
        let currentMatch;
        while ((currentMatch = MARKER_RE.exec(content)) !== null) {
          const sectionName = currentMatch[1] as string;
          const rendered = sections[sectionName];
          if (rendered !== undefined) {
            const expected = `<!-- GENERATED:START:${sectionName} -->\n${rendered}\n<!-- GENERATED:END:${sectionName} -->`;
            if (currentMatch[0] !== expected) {
              report.staleSections.push({ file, section: sectionName });
            }
          }
        }
      }
    }

    if (!report.inSync) {
      return err([
        {
          code: "W_DOCS_STALE",
          message: `Documentation is out of sync: ${report.staleSections.map((s) => `${s.file}:${s.section}`).join(", ")}`,
          hint: `Run \`${PROJECT_CLI} docs --generate\` to update.`,
          severity: "warn" as const,
          context: {},
        },
      ]);
    }

    return ok(report);
  } catch (e) {
    return err([
      {
        code: "E_DOCS_VALIDATION",
        message: `Documentation validation failed: ${String(e)}`,
        hint: "Check that doc files exist and are readable.",
        severity: "error" as const,
        context: {},
      },
    ]);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function findDocFiles(projectRoot: string): Promise<string[]> {
  const files = await fg(["docs/**/*.md", "README.md"], {
    cwd: projectRoot,
    onlyFiles: true,
  });
  return files.sort();
}
