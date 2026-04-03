import {
  PROJECT_CLI,
  PROJECT_DIR,
  PROJECT_NAME,
  PROJECT_NAME_DISPLAY,
  PROJECT_REPO,
  PROJECT_URL,
  SUPPORTED_PLATFORMS_YAML,
} from "#src/constants.js";

export const template = `---
name: {{name}}
description: Guide the user through contributing artifacts to GitHub repositories or sharing them as ZIP packages. Covers GitHub CLI setup, PR creation to any repo, ZIP export, and manual workflows.
category: ${PROJECT_NAME_DISPLAY} Platform
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
intentHints:
  taskType: Contributing
  examples:
    - "Contribute my skill to GitHub"
    - "Share my artifacts as ZIP"
    - "Open a PR with my rule"
version: 2
---

# {{name}}

Help the user contribute their custom artifacts (rules, skills, agents, commands) back to the official ${PROJECT_NAME} project or share them privately with their team.

## When to Activate

- User wants to contribute a rule, skill, agent, or command back to the ${PROJECT_NAME} project
- User asks how to share artifacts with the community or their team
- User wants to open a pull request to the ${PROJECT_NAME} repository or any other GitHub repo
- User wants to contribute presets to a custom or team GitHub repository
- User asks to export artifacts as a ZIP for private sharing
- User needs help setting up GitHub CLI or GitHub MCP for contributions

## Step 1: Prerequisites

**[CODING AGENT]** Check prerequisites before proceeding.

### GitHub CLI Authentication

Check if the GitHub CLI is installed and authenticated:

\\\`\\\`\\\`bash
gh auth status
\\\`\\\`\\\`

If not authenticated, guide the user:

\\\`\\\`\\\`bash
# Install GitHub CLI (macOS)
brew install gh

# Authenticate with GitHub
gh auth login
# Select: GitHub.com → HTTPS → Login with browser
\\\`\\\`\\\`

### GitHub MCP Server (Optional — enhances workflow)

If the user's AI agent supports MCP, suggest configuring the GitHub MCP server for richer integration:

\\\`\\\`\\\`json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "<token>"
      }
    }
  }
}
\\\`\\\`\\\`

The token needs \\\`repo\\\` and \\\`read:org\\\` scopes. Create at: https://github.com/settings/tokens

## Step 2: Identify What to Contribute

**[CODING AGENT]** List the user's custom artifacts:

\\\`\\\`\\\`bash
ls ${PROJECT_DIR}/rules/ ${PROJECT_DIR}/skills/ ${PROJECT_DIR}/agents/ 2>/dev/null
\\\`\\\`\\\`

Help the user identify:
- Custom rules, skills, or agents they created or improved
- Artifacts with \\\`managed_by: user\\\` (user-created) or \\\`managed_by: ${PROJECT_NAME}\\\` (improved built-in)
- Artifacts that have been tested and proven useful in real workflows

## Step 3: Choose Contribution Method

**[CODING AGENT]** Present options and execute the chosen method.

### Option A: Interactive CLI (Recommended)

\\\`\\\`\\\`bash
${PROJECT_CLI} contribute
\\\`\\\`\\\`

The wizard will:
1. Discover all artifacts in \\\`${PROJECT_DIR}/\\\`
2. Present a multi-select list for choosing which to contribute
3. Offer two distribution methods:
   - **Open PR to a GitHub repository** — requires GitHub CLI auth
   - **Export as ZIP** — creates a re-importable preset package

For the PR method, the wizard asks which repo to target:
- The official ${PROJECT_NAME} repository (default)
- Repos detected from installed presets (contribute back to source)
- Any custom repository via free text input

To skip the interactive prompt, pass flags directly:

\\\`\\\`\\\`bash
# Contribute to the official codi repo (default)
${PROJECT_CLI} contribute --repo ${PROJECT_REPO} --branch develop

# Contribute to a custom or team repository
${PROJECT_CLI} contribute --repo myorg/shared-presets

# Contribute to a specific branch
${PROJECT_CLI} contribute --repo myorg/shared-presets --branch main
\\\`\\\`\\\`

The PR method forks the target repo (if needed), pushes a branch, and opens a PR.

### Option B: Manual PR (Advanced Users)

1. Clone the official ${PROJECT_NAME} repository:
   \\\`\\\`\\\`bash
   git clone ${PROJECT_URL}.git /tmp/${PROJECT_NAME}-contrib
   cd /tmp/${PROJECT_NAME}-contrib
   \\\`\\\`\\\`

2. Create a contribution branch:
   \\\`\\\`\\\`bash
   git checkout -b contrib/add-my-artifact
   \\\`\\\`\\\`

3. Convert your artifact to a TypeScript template:
   - Rules go in \\\`src/templates/rules/{name}.ts\\\`
   - Skills go in \\\`src/templates/skills/{name}.ts\\\`
   - Agents go in \\\`src/templates/agents/{name}.ts\\\`

4. Export as a template string:
   \\\`\\\`\\\`typescript
   export const template = \\\\\\\`---
   name: {{name}}
   description: Your artifact description
   managed_by: ${PROJECT_NAME}
   ---

   # {{name}}

   Your artifact content here...
   \\\\\\\`;
   \\\`\\\`\\\`

5. Register in the corresponding \\\`index.ts\\\` file

6. Push to your GitHub account and open a PR:
   \\\`\\\`\\\`bash
   git remote add user https://github.com/YOUR_USERNAME/${PROJECT_NAME}.git
   git push user contrib/add-my-artifact
   gh pr create --repo ${PROJECT_REPO} --base develop \\\\
     --title "feat: add my-artifact template" \\\\
     --body "Description of the contribution"
   \\\`\\\`\\\`

### Option C: Private Sharing (ZIP)

\\\`\\\`\\\`bash
${PROJECT_CLI} contribute
# Select artifacts → choose "Export as ZIP"
\\\`\\\`\\\`

The ZIP contains a complete preset package with \\\`preset.yaml\\\` manifest. Recipients install with:

\\\`\\\`\\\`bash
${PROJECT_CLI} preset install ./contribution.zip
\\\`\\\`\\\`

### Option D: Using GitHub MCP Tools

If the GitHub MCP server is configured, you can assist the contribution directly:

1. Check authentication: \\\`mcp__github__get_me\\\`
2. Create a fork or repo: \\\`mcp__github__create_repository\\\`
3. Create a branch: \\\`mcp__github__create_branch\\\`
4. Push files: \\\`mcp__github__push_files\\\`
5. Open PR: \\\`mcp__github__create_pull_request\\\` with base \\\`develop\\\`

## Step 4: Quality Checklist

**[CODING AGENT]** Before contributing, verify the artifact:

- [ ] Has valid YAML frontmatter: \\\`name\\\`, \\\`description\\\`, \\\`managed_by\\\`
- [ ] Uses clear, actionable language with concrete examples
- [ ] Follows existing template patterns (check built-in templates for reference)
- [ ] Does NOT contain secrets, API keys, or company-specific information
- [ ] Has been tested in at least one AI agent (Claude Code, Cursor, etc.)
- [ ] Uses \\\`{{name}}\\\` placeholder for the artifact name (templates only)
- [ ] Skills include all skeleton directories: scripts/, references/, assets/, evals/

## Step 5: Troubleshooting

**[CODING AGENT]** Diagnose and fix based on the symptom below.

### GitHub CLI not authenticated
\\\`\\\`\\\`bash
gh auth login
gh auth status  # Verify
\\\`\\\`\\\`

### Cannot push to remote
The CLI creates a repo on your GitHub account to push the branch. Ensure:
- You have GitHub CLI authenticated (\\\`gh auth status\\\`)
- Your account can create public repositories

### PR has merge conflicts
\\\`\\\`\\\`bash
cd /tmp/${PROJECT_NAME}-contrib
git fetch origin develop
git rebase origin/develop
# Resolve conflicts, then:
git push user contrib/my-branch --force-with-lease
\\\`\\\`\\\`

### ZIP import fails
Ensure the ZIP was created by \\\`${PROJECT_CLI} contribute\\\` — it must contain a \\\`preset.yaml\\\` manifest at the root or one level deep.

## Related Skills

- **codi-preset-creator** — Create and package a preset before contributing it
`;
