import {
  PROJECT_CLI,
  PROJECT_NAME,
  PROJECT_NAME_DISPLAY,
  SUPPORTED_PLATFORMS_YAML,
} from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  ${PROJECT_NAME_DISPLAY} self-documentation skill. Use when the user asks to build, update,
  or check the ${PROJECT_NAME_DISPLAY} project documentation. Also activate when the user mentions
  docs freshness, stale documentation, building the docs site, or generating
  the skill catalog HTML page.
category: ${PROJECT_NAME_DISPLAY} Platform
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
intentHints:
  taskType: Docs Management
  examples:
    - "Update the docs"
    - "Sync documentation"
    - "Build the HTML docs site"
version: 1
---

# ${PROJECT_NAME_DISPLAY} Documentation Manager

Maintains ${PROJECT_NAME_DISPLAY}'s own documentation using a **marker-based code-driven generator**.
Data tables (flag lists, schema fields, template catalogs, preset comparisons) are
auto-generated from code. Prose (explanations, examples, directory structures) is
human-authored and preserved between markers.

## How the Generator Works

Doc files contain marker pairs:

\\\`\\\`\\\`markdown
<!-- GENERATED:START:flags_table -->
| Flag | Type | Default | ... |    <-- auto-generated from FLAG_CATALOG
<!-- GENERATED:END:flags_table -->
\\\`\\\`\\\`

The generator reads source-of-truth code structures (Zod schemas, template registries,
flag catalogs, adapter definitions) and injects rendered Markdown tables between markers.
Everything outside markers is preserved exactly as written.

**20 generated sections** across 4 doc files:
- **artifacts.md** (8): rule_fields, skill_fields, agent_fields, command_fields, rule_templates, skill_templates, agent_templates, command_templates
- **configuration.md** (4): flags_table, flag_modes, manifest_fields, flag_instructions
- **architecture.md** (3): adapter_table, layer_order, flag_hooks
- **presets.md** (2): preset_table, preset_flag_comparison
- **README.md** (3): template_counts_compact, preset_table, supported_agents

## When to Activate

- User asks to build or regenerate the documentation site
- User asks if documentation is up to date or stale
- User wants to see all available skills in a browsable format
- User asks to update docs after code changes
- User mentions pre-release documentation sweep
- User asks to validate documentation freshness

## Step 1: Validate Generated Sections

**[CODING AGENT]** Run validation to check if any generated sections are stale:

\\\`\\\`\\\`bash
npx ${PROJECT_CLI} docs --validate
\\\`\\\`\\\`

If stale sections are detected, regenerate them:

\\\`\\\`\\\`bash
npx ${PROJECT_CLI} docs --generate
\\\`\\\`\\\`

This automatically updates all 20 data tables from their source-of-truth code structures.
No manual editing is needed for generated sections.

Present the results to the user: which files were updated and which sections changed.

## Step 2: Review Prose Freshness

The generator handles data tables, but **prose around the tables** (explanations, examples,
YAML snippets, directory structures) must be reviewed manually when code changes affect them.

**[CODING AGENT]** Check recent code changes that might affect documentation:

\\\`\\\`\\\`bash
git log --since="2 weeks ago" --oneline -- src/schemas/ src/core/flags/ src/adapters/ src/templates/ src/core/scaffolder/
\\\`\\\`\\\`

For each significant change (new artifact type, renamed field, new adapter, removed feature):
1. Read the affected doc file(s)
2. Check if the prose still accurately describes the code
3. Propose specific edits — do NOT rewrite entire documents
4. Wait for user approval before applying changes

**What might need prose updates:**
- New artifact types → add a new section in artifacts.md with frontmatter example
- New flags → add explanation in configuration.md
- New adapters → add description in architecture.md
- Changed directory structure → update directory trees in relevant docs

## Step 3: Build HTML Documentation Site

**[CODING AGENT]** Generate the skill catalog and HTML site:

\\\`\\\`\\\`bash
# Build the HTML skill catalog site
npx ${PROJECT_CLI} docs --html

# Optionally export JSON for machine consumption
npx ${PROJECT_CLI} docs --json
\\\`\\\`\\\`

This produces \\\`docs/_site/index.html\\\` — a self-contained HTML file with:
- Skill catalog grouped by category with descriptions
- Client-side search across all skills
- Dark/light mode support
- Print-friendly CSS for PDF export

## Step 4: Final Validation

**[CODING AGENT]** Confirm everything is in sync:

\\\`\\\`\\\`bash
npx ${PROJECT_CLI} docs --validate
\\\`\\\`\\\`

Also check for broken relative links:

\\\`\\\`\\\`bash
# Scan all doc files for broken relative links
for f in docs/*.md README.md; do
  grep -oP '\\[.*?\\]\\((?!http)(.*?)\\)' "$f" | while read -r link; do
    target=$(echo "$link" | grep -oP '\\((.*)\\)' | tr -d '()')
    dir=$(dirname "$f")
    if [ ! -e "$dir/$target" ]; then
      echo "BROKEN: $f -> $target"
    fi
  done
done
\\\`\\\`\\\`

## Documentation Structure

\\\`\\\`\\\`
docs/
  README.md              # Index linking to all docs
  architecture.md        # Config resolution, adapters, hooks, flags (3 generated sections)
  artifacts.md           # Rules, skills, agents, commands, brands (9 generated sections)
  configuration.md       # Manifest, flags, modes, layers, MCP (4 generated sections)
  presets.md             # Built-in presets, create/install/export (2 generated sections)
  workflows.md           # Daily usage, CI/CD (manual)
  migration.md           # Adopting ${PROJECT_NAME_DISPLAY} in existing projects (manual)
  troubleshooting.md     # Common issues and fixes (manual)
  deprecated/            # Archive of old docs (spec, QA, roadmaps, research)
\\\`\\\`\\\`

## Boundaries

This skill does NOT:
- Replace the \\\`documentation\\\` skill (which handles user project docs, READMEs, ADRs)
- Replace the \\\`doc-engine\\\` skill (which produces branded reports and proposals)
- Modify source code — it only reads code to check doc freshness
- Auto-commit changes — all edits require user approval

## Related Skills

- **codi-documentation** — Document user project code, READMEs, and ADRs
- **codi-doc-engine** — Generate branded reports and proposals
`;
