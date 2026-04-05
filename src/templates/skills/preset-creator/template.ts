import {
  MAX_NAME_LENGTH,
  PROJECT_CLI,
  PROJECT_DIR,
  PROJECT_NAME,
  PROJECT_NAME_DISPLAY,
  PLATFORM_CATEGORY,
  SUPPORTED_PLATFORMS_YAML,
} from "#src/constants.js";

export const template = `---
name: {{name}}
description: Guided creation of ${PROJECT_NAME_DISPLAY} presets. Use when the user wants to create, package, or scaffold a new preset for sharing rules, skills, and configurations.
category: ${PLATFORM_CATEGORY}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 5
---

# {{name}}

Guide the user through creating a ${PROJECT_NAME_DISPLAY} preset — a reusable bundle of rules, skills, agents, commands, flags, and MCP configs.

## When to Activate

- User asks to create, package, or scaffold a new ${PROJECT_NAME} preset
- User wants to bundle existing rules, skills, and agents into a reusable configuration
- User needs to export a preset as a ZIP or publish it to a GitHub repository
- User asks how to customize or fork a built-in preset

## Step 1: Define Identity

**[CODING AGENT]** Ask the user:
1. **Name**: kebab-case, max ${MAX_NAME_LENGTH} chars (e.g., \`fullstack\`, \`org-security\`)
2. **Description**: one sentence describing the preset's purpose
3. **Version**: semver format (default: \`1.0.0\`)
4. **Tags**: comma-separated tags for discoverability
5. **Reference preset**: use an existing preset as a starting point to copy from? (e.g., \`balanced\`, \`strict\`, or start blank)

## Step 2: Select Artifacts

**[CODING AGENT]** List available artifacts from the current project and built-in templates.

Ask the user which to include in the preset:
- **Rules**: list rules from \`${PROJECT_DIR}/rules/\` and built-in templates
- **Skills**: list skills from \`${PROJECT_DIR}/skills/\` and built-in templates
- **Agents**: list agents from \`${PROJECT_DIR}/agents/\`

## Step 3: Configure Flags

**[CODING AGENT]** Show the current flag configuration. Ask the user:
- Which flags should the preset override?
- What values and modes? (enabled, enforced, disabled)
- Should any flags be locked? (prevents downstream overrides)

## Step 4: MCP Configuration

**[CODING AGENT]** Ask if any MCP server configurations should be included:
- List current MCP servers from \`mcp.yaml\`
- User selects which to include

## Step 5: Create the Scaffold

**[CODING AGENT]** Run:
\\\`\\\`\\\`bash
${PROJECT_CLI} preset create <name>
\\\`\\\`\\\`

Then populate the generated directory:
1. Update \`preset.yaml\` with the metadata from Step 1
2. Copy selected rules to \`rules/\`
3. Copy selected skills to \`skills/\`
4. Copy selected agents to \`agents/\`
5. Write \`flags.yaml\` with the configured overrides
6. Write \`mcp.yaml\` if MCP servers were selected

## Step 6: Choose Output Format

**[CODING AGENT]** Ask the user how they want to distribute the preset:

### Option A: Local directory (default)
The preset stays in \`${PROJECT_DIR}/presets/<name>/\`. Reference it in \`${PROJECT_NAME}.yaml\`:
\\\`\\\`\\\`yaml
presets:
  - <name>
\\\`\\\`\\\`

### Option B: ZIP package
Export the preset as a portable ZIP file:
\\\`\\\`\\\`bash
${PROJECT_CLI} preset export <name> --format zip --output ./<name>.zip
\\\`\\\`\\\`
The ZIP can be shared privately and installed with:
\\\`\\\`\\\`bash
${PROJECT_CLI} preset install ./<name>.zip
\\\`\\\`\\\`

### Option C: GitHub repository
Create a repository scaffold for version-controlled distribution:
1. Create a new directory outside the project
2. Copy the preset contents there
3. Add a README.md with usage instructions
4. Add a .gitignore
5. Initialize git and push to a GitHub repository

Others can install with:
\\\`\\\`\\\`bash
${PROJECT_CLI} preset install github:org/repo-name
\\\`\\\`\\\`

## Step 7: Validate

**[CODING AGENT]** Run validation to ensure the preset is well-formed:
\\\`\\\`\\\`bash
${PROJECT_CLI} preset validate <name>
\\\`\\\`\\\`

Report any errors or warnings to the user.

## Important Notes

- Presets are private by default — ZIP files stay local, GitHub repos use the org's access controls
- Presets are flat and self-contained — no inheritance. To customize a built-in preset, copy its artifacts into a new preset and modify them directly
- The preset manifest (\`preset.yaml\`) must include at minimum: \`name\`, \`description\`, \`version\`
- All \`.md\` files in artifact directories must have valid YAML frontmatter

## Related Skills

- **${PROJECT_NAME}-compare-preset** — Compare two presets or audit the active preset configuration
`;
