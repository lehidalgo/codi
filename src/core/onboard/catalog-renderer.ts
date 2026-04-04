import { AVAILABLE_TEMPLATES, loadTemplate } from "../scaffolder/template-loader.js";
import {
  AVAILABLE_SKILL_TEMPLATES,
  loadSkillTemplateContent,
} from "../scaffolder/skill-template-loader.js";
import {
  AVAILABLE_AGENT_TEMPLATES,
  loadAgentTemplate,
} from "../scaffolder/agent-template-loader.js";
import {
  RULE_CATEGORIES,
  AGENT_CATEGORIES,
  buildSkillCategoryMap,
  extractTemplateHint,
} from "#src/cli/artifact-categories.js";
import { BUILTIN_PRESETS, getBuiltinPresetNames } from "#src/templates/presets/index.js";
import { PROJECT_NAME, PROJECT_NAME_DISPLAY } from "#src/constants.js";

// ---------------------------------------------------------------------------
// Section 1: Artifact Catalog
// ---------------------------------------------------------------------------

function renderArtifactTable(items: Array<{ name: string; description: string }>): string {
  if (items.length === 0) return "_None available._\n";
  const lines = ["| Artifact | Description |", "|----------|-------------|"];
  for (const { name, description } of items) {
    const desc = description.replace(/\|/g, "\\|");
    lines.push(`| ${name} | ${desc} |`);
  }
  return lines.join("\n") + "\n";
}

function loadItems(
  names: string[],
  loadFn: (name: string) => { ok: boolean; data?: string },
): Array<{ name: string; description: string }> {
  return names.map((name) => {
    const result = loadFn(name);
    const content = result.ok && result.data ? result.data : "";
    const raw = extractTemplateHint(content);
    // Strip quoted wrappers and template interpolation tokens for clean display
    const description =
      raw
        .replace(/^["']|["']$/g, "")
        .replace(/\$\{[^}]+\}/g, PROJECT_NAME_DISPLAY)
        .split("\n")[0]
        ?.trim() ?? "";
    return { name, description };
  });
}

function groupByCategory(
  names: string[],
  categoryMap: Record<string, string[]>,
): Record<string, string[]> {
  const nameToGroup = new Map<string, string>();
  for (const [group, members] of Object.entries(categoryMap)) {
    for (const member of members) nameToGroup.set(member, group);
  }
  const groups: Record<string, string[]> = {};
  for (const name of names) {
    const group = nameToGroup.get(name) ?? "Other";
    (groups[group] ??= []).push(name);
  }
  return groups;
}

function renderCatalogSection(
  title: string,
  names: string[],
  loadFn: (name: string) => { ok: boolean; data?: string },
  categoryMap: Record<string, string[]>,
): string {
  const lines: string[] = [`### ${title} (${names.length} available)\n`];
  const grouped = groupByCategory(names, categoryMap);
  for (const [group, members] of Object.entries(grouped)) {
    lines.push(`#### ${group}\n`);
    const items = loadItems(members, loadFn);
    lines.push(renderArtifactTable(items));
  }
  return lines.join("\n");
}

function renderRulesCatalog(): string {
  return renderCatalogSection(
    "Rules",
    AVAILABLE_TEMPLATES,
    (name) => loadTemplate(name),
    RULE_CATEGORIES,
  );
}

function renderSkillsCatalog(): string {
  const skillCategoryMap = buildSkillCategoryMap(AVAILABLE_SKILL_TEMPLATES, (name) =>
    loadSkillTemplateContent(name),
  );
  return renderCatalogSection(
    "Skills",
    AVAILABLE_SKILL_TEMPLATES,
    (name) => loadSkillTemplateContent(name),
    skillCategoryMap,
  );
}

function renderAgentsCatalog(): string {
  return renderCatalogSection(
    "Agents",
    AVAILABLE_AGENT_TEMPLATES,
    (name) => loadAgentTemplate(name),
    AGENT_CATEGORIES,
  );
}

function renderCatalog(): string {
  return [
    "## ARTIFACT CATALOG\n",
    renderRulesCatalog(),
    renderSkillsCatalog(),
    renderAgentsCatalog(),
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Section 2: Built-in Presets Reference
// ---------------------------------------------------------------------------

function renderFlagsSummary(flags: Record<string, { mode: string; value?: unknown }>): string {
  const entries = Object.entries(flags)
    .filter(([, def]) => def.mode === "enabled")
    .map(([key, def]) => `${key}=${JSON.stringify(def.value)}`);
  return entries.length > 0 ? entries.join(", ") : "defaults";
}

function renderPresets(): string {
  const lines = ["## BUILT-IN PRESETS\n"];
  const names = getBuiltinPresetNames();
  for (const name of names) {
    const preset = BUILTIN_PRESETS[name];
    if (!preset) continue;
    lines.push(`### ${name}`);
    lines.push(`**Description:** ${preset.description}`);
    lines.push(`**Tags:** ${preset.tags.join(", ")}`);
    lines.push(
      `**Rules (${preset.rules.length}):** ${preset.rules.length > 0 ? preset.rules.join(", ") : "none"}`,
    );
    lines.push(
      `**Skills (${preset.skills.length}):** ${preset.skills.length > 0 ? preset.skills.join(", ") : "none"}`,
    );
    lines.push(
      `**Agents (${preset.agents.length}):** ${preset.agents.length > 0 ? preset.agents.join(", ") : "none"}`,
    );
    lines.push(`**Flags:** ${renderFlagsSummary(preset.flags)}`);
    lines.push("");
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Section 3: Agent Playbook
// ---------------------------------------------------------------------------

function renderPlaybook(): string {
  return `## AGENT PLAYBOOK

Follow these steps in order. You are the guide — the user makes the decisions.

### Step 1: Deep Codebase Analysis

Explore the project thoroughly before making any recommendation:

- Read the package manifest (package.json, pyproject.toml, go.mod, Cargo.toml, etc.)
- Read the project README if it exists
- Scan the source directory structure (src/, lib/, app/, etc.)
- Check for test infrastructure (test configs, test directories, __tests__/)
- Check for CI/CD configuration (.github/workflows/, .gitlab-ci.yml, etc.)
- Check for linting/formatting config (eslint, prettier, biome, ruff, etc.)
- Check for Docker/containerization (Dockerfile, docker-compose.yml)
- Check for API definitions (openapi.*, routes/, controllers/)
- Check for database usage (migrations/, prisma/, drizzle/, models/)
- Check for existing coding agent configs (.claude/, .cursor/, .codex/)
- Understand the project's architecture, patterns, and conventions

Take your time. Read files. Understand the project before recommending.

### Step 2: Formulate Your Recommendation

Based on your analysis, decide:

1. **Does a built-in preset fit?** Compare what you found against each preset's
   description and artifact list (see BUILT-IN PRESETS above). If one fits well,
   recommend it. If none fits, recommend a custom selection.

2. **Which additional artifacts should be added or removed?** The preset is a
   starting point. Add artifacts that match technologies you detected.
   Remove artifacts that don't apply.

3. **For each recommended artifact, write a one-line reason** tied to something
   specific you found in the codebase. Not generic — specific.

   GOOD: "${PROJECT_NAME}-typescript — tsconfig.json found with strict: true, project uses path aliases"
   BAD:  "${PROJECT_NAME}-typescript — useful for TypeScript projects"

### Step 3: Present Proposal to User

Present your recommendation in this exact format:

\`\`\`
## ${PROJECT_NAME_DISPLAY} Setup Proposal

**Base preset:** [name] — [why it fits]

### Rules I recommend (N):
- [rule-name] — [specific reason from codebase analysis]
- ...

### Skills I recommend (N):
- [skill-name] — [specific reason]
- ...

### Agents I recommend (N):
- [agent-name] — [specific reason]
- ...

### Agent platforms detected:
- [list platforms found: claude-code, cursor, codex, windsurf, cline]

### Notable artifacts I did NOT recommend (and why):
- [artifact] — [why it doesn't fit this project]
\`\`\`

Then ask: **"Does this selection look right? You can add, remove, or change
any artifact before I install."**

### Step 4: Iterate Until Approved

The user may:
- Approve as-is → proceed to Step 5
- Add artifacts → add them with the user's stated reason
- Remove artifacts → remove them, note the reason for the summary
- Change the base preset → adjust the full selection accordingly
- Ask questions → explain what an artifact does using the catalog above

Continue until the user explicitly approves.

### Step 5: Execute Installation

Run these commands in order:

\`\`\`bash
# Initialize with the approved preset and detected agent platforms
${PROJECT_NAME} init --agents [detected-agents] --preset [preset-name] --json

# Add each additional artifact not already included in the preset
${PROJECT_NAME} add rule [name] --template [name] --json
${PROJECT_NAME} add skill [name] --template [name] --json
${PROJECT_NAME} add agent [name] --template [name] --json

# Generate agent config files for all platforms
${PROJECT_NAME} generate --json
\`\`\`

Report progress to the user as each command completes.

### Step 6: Generate Summary Documentation

Create a file: \`docs/YYYYMMDD_HHMMSS_[PLAN]_codi-init.md\`

Use this structure:

\`\`\`markdown
# ${PROJECT_NAME_DISPLAY} Initialization Summary
**Date**: YYYY-MM-DD HH:MM:SS
**Document**: YYYYMMDD_HHMMSS_[PLAN]_codi-init.md
**Category**: PLAN

## Project Analysis
[Brief description of what was found in the codebase]

## Installed Configuration

### Base Preset: [name]
[Why this preset was chosen]

### Rules Installed (N)
| Rule | Reason |
|------|--------|
| ... | ... |

### Skills Installed (N)
| Skill | Reason |
|-------|--------|
| ... | ... |

### Agents Installed (N)
| Agent | Reason |
|-------|--------|
| ... | ... |

## Artifacts Not Installed
| Artifact | Type | Reason Not Selected |
|----------|------|---------------------|
| ... | ... | ... |

## Next Steps
- Edit rules in \`.${PROJECT_NAME}/rules/[name].md\` to customize for this project
- Add more artifacts: \`${PROJECT_NAME} add skill [name] --template [name]\`
- Change preset: \`${PROJECT_NAME} update --preset [name]\`
- Compare with upstream: \`${PROJECT_NAME} compare-preset\` (if installed)
- Check installation health: \`${PROJECT_NAME} doctor\`
\`\`\`

### Step 7: Present Summary

Show the user the generated documentation file path and a brief summary of
what was installed. Ask if they have any questions.
`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render a self-contained onboarding guide to be printed to stdout.
 * The guide contains: artifact catalog, preset reference, agent playbook.
 * The coding agent reads this output and follows the playbook instructions.
 */
export function renderOnboardingGuide(): string {
  const header = [
    `# ${PROJECT_NAME_DISPLAY.toUpperCase()} ONBOARDING GUIDE`,
    "",
    `You are guiding a user through setting up ${PROJECT_NAME_DISPLAY} for their project.`,
    `Follow the steps in the AGENT PLAYBOOK section exactly.`,
    `The catalog and preset reference below are your reference material.`,
    "",
  ].join("\n");

  return [header, renderCatalog(), renderPresets(), renderPlaybook()].join("\n");
}
