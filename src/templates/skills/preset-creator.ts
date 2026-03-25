import { MAX_NAME_LENGTH } from '../../constants.js';

export const template = `---
name: {{name}}
description: Guided creation of CODI presets. Use when the user wants to create, package, or scaffold a new preset for sharing rules, skills, and configurations.
compatibility: [claude-code, cursor, codex, windsurf, cline]
managed_by: codi
---

# {{name}}

Guide the user through creating a CODI preset — a reusable bundle of rules, skills, agents, commands, flags, and MCP configs.

## Step 1: Define Identity

Ask the user:
1. **Name**: kebab-case, max ${MAX_NAME_LENGTH} chars (e.g., \`python-web\`, \`org-security\`)
2. **Description**: one sentence describing the preset's purpose
3. **Version**: semver format (default: \`1.0.0\`)
4. **Tags**: comma-separated tags for discoverability
5. **Base preset**: extend an existing preset? (e.g., \`balanced\`, \`strict\`, or none)

## Step 2: Select Artifacts

List available artifacts from the current project and built-in templates.

Ask the user which to include in the preset:
- **Rules**: list rules from \`.codi/rules/\` and built-in templates
- **Skills**: list skills from \`.codi/skills/\` and built-in templates
- **Agents**: list agents from \`.codi/agents/\`
- **Commands**: list commands from \`.codi/commands/\`

## Step 3: Configure Flags

Show the current flag configuration. Ask the user:
- Which flags should the preset override?
- What values and modes? (enabled, enforced, disabled)
- Should any flags be locked? (prevents downstream overrides)

## Step 4: MCP Configuration

Ask if any MCP server configurations should be included:
- List current MCP servers from \`mcp.yaml\`
- User selects which to include

## Step 5: Create the Scaffold

Run:
\\\`\\\`\\\`bash
codi preset create <name>
\\\`\\\`\\\`

Then populate the generated directory:
1. Update \`preset.yaml\` with the metadata from Step 1
2. Copy selected rules to \`rules/\`
3. Copy selected skills to \`skills/\`
4. Copy selected agents to \`agents/\`
5. Copy selected commands to \`commands/\`
6. Write \`flags.yaml\` with the configured overrides
7. Write \`mcp.yaml\` if MCP servers were selected

## Step 6: Choose Output Format

Ask the user how they want to distribute the preset:

### Option A: Local directory (default)
The preset stays in \`.codi/presets/<name>/\`. Reference it in \`codi.yaml\`:
\\\`\\\`\\\`yaml
presets:
  - <name>
\\\`\\\`\\\`

### Option B: ZIP package
Export the preset as a portable ZIP file:
\\\`\\\`\\\`bash
codi preset export <name> --format zip --output ./<name>.zip
\\\`\\\`\\\`
The ZIP can be shared privately and installed with:
\\\`\\\`\\\`bash
codi preset install ./<name>.zip
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
codi preset install github:org/repo-name
\\\`\\\`\\\`

## Step 7: Validate

Run validation to ensure the preset is well-formed:
\\\`\\\`\\\`bash
codi preset validate <name>
\\\`\\\`\\\`

Report any errors or warnings to the user.

## Important Notes

- Presets are private by default — ZIP files stay local, GitHub repos use the org's access controls
- Built-in presets (\`minimal\`, \`balanced\`, \`strict\`, \`python-web\`, \`typescript-fullstack\`, \`security-hardened\`) can be extended via the \`extends\` field
- The preset manifest (\`preset.yaml\`) must include at minimum: \`name\`, \`description\`, \`version\`
- All \`.md\` files in artifact directories must have valid YAML frontmatter
`;
