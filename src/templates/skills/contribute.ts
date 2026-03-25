export const template = `---
name: {{name}}
description: Guide the user through contributing artifacts or presets back to the codi community. Handles GitHub PR creation, ZIP export, and troubleshooting.
compatibility: [claude-code, cursor, codex, windsurf, cline]
managed_by: codi
---

# {{name}}

Help the user contribute their custom artifacts (rules, skills, agents, commands) or presets back to the codi project or share them with their team.

## Step 1: Identify What to Contribute

Ask the user what they want to share:
- A specific custom rule, skill, agent, or command they created
- A complete custom preset
- Improvements to an existing built-in template

List their custom artifacts:
\\\`\\\`\\\`bash
ls .codi/rules/custom/ .codi/skills/ .codi/agents/ .codi/commands/ 2>/dev/null
\\\`\\\`\\\`

## Step 2: Choose Contribution Method

### Option A: Interactive CLI (recommended)
\\\`\\\`\\\`bash
codi contribute
\\\`\\\`\\\`
This launches an interactive wizard that:
- Lists all artifacts with searchable selection
- Offers PR to codi repo or ZIP export
- Handles fork, branch, commit, and PR creation automatically

### Option B: Manual PR (advanced users)
1. Fork the codi repository on GitHub
2. Clone your fork locally
3. Copy your artifact to the correct template directory:
   - Rules: \\\`src/templates/rules/{name}.ts\\\`
   - Skills: \\\`src/templates/skills/{name}.ts\\\`
   - Agents: \\\`src/templates/agents/{name}.ts\\\`
   - Commands: \\\`src/templates/commands/{name}.ts\\\`
4. Export the content as a TypeScript template string
5. Register in the corresponding \\\`index.ts\\\`
6. Push and open a PR

### Option C: Private sharing (ZIP)
\\\`\\\`\\\`bash
codi contribute
# Select artifacts → choose "Export as ZIP"
\\\`\\\`\\\`
Share the ZIP with your team. They install with:
\\\`\\\`\\\`bash
codi preset install ./contribution.zip
\\\`\\\`\\\`

## Step 3: Troubleshooting

### GitHub CLI not authenticated
\\\`\\\`\\\`bash
gh auth login
# Follow the prompts to authenticate
gh auth status  # Verify authentication
\\\`\\\`\\\`

### Fork already exists
This is normal. The \\\`codi contribute\\\` command reuses your existing fork.

### PR conflicts
If the PR has merge conflicts:
1. Pull latest changes from upstream
2. Resolve conflicts in your branch
3. Push the updated branch

## Quality Guidelines for Contributions

Before contributing, ensure your artifact:
- Has valid YAML frontmatter with name, description, and managed_by fields
- Uses clear, actionable language
- Follows the existing template patterns (check built-in templates for reference)
- Does not contain secrets, API keys, or company-specific information
- Has been tested in at least one AI agent (Claude Code, Cursor, etc.)
`;
