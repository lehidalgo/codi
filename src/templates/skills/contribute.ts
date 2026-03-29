export const template = `---
name: {{name}}
description: Guide the user through contributing artifacts back to the codi project. Covers GitHub CLI setup, GitHub MCP configuration, PR creation, ZIP export, and manual workflows.
category: Codi Platform
compatibility: [claude-code, cursor, codex, windsurf, cline]
managed_by: codi
---

# {{name}}

Help the user contribute their custom artifacts (rules, skills, agents, commands) back to the official codi project or share them privately with their team.

## When to Activate

- User wants to contribute a rule, skill, agent, or command back to the codi project
- User asks how to share artifacts with the community or their team
- User wants to open a pull request to the codi repository
- User asks to export artifacts as a ZIP for private sharing
- User needs help setting up GitHub CLI or GitHub MCP for contributions

## Step 1: Prerequisites

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

List the user's custom artifacts:

\\\`\\\`\\\`bash
ls .codi/rules/ .codi/skills/ .codi/agents/ .codi/commands/ 2>/dev/null
\\\`\\\`\\\`

Help the user identify:
- Custom rules, skills, agents, or commands they created or improved
- Artifacts with \\\`managed_by: user\\\` (user-created) or \\\`managed_by: codi\\\` (improved built-in)
- Artifacts that have been tested and proven useful in real workflows

## Step 3: Choose Contribution Method

### Option A: Interactive CLI (Recommended)

\\\`\\\`\\\`bash
codi contribute
\\\`\\\`\\\`

The wizard will:
1. Discover all artifacts in \\\`.codi/\\\`
2. Present a multi-select list for choosing which to contribute
3. Offer two distribution methods:
   - **Open PR to codi repository** — requires GitHub CLI auth, targets the \\\`develop\\\` branch
   - **Export as ZIP** — creates a re-importable preset package

For the PR method, the wizard:
- Clones the official codi repository
- Creates a repo on the user's GitHub account (if needed)
- Converts artifacts to TypeScript templates in \\\`src/templates/\\\`
- Pushes a branch and opens a PR to \\\`develop\\\`

### Option B: Manual PR (Advanced Users)

1. Clone the official codi repository:
   \\\`\\\`\\\`bash
   git clone https://github.com/lehidalgo/codi.git /tmp/codi-contrib
   cd /tmp/codi-contrib
   \\\`\\\`\\\`

2. Create a contribution branch:
   \\\`\\\`\\\`bash
   git checkout -b contrib/add-my-artifact
   \\\`\\\`\\\`

3. Convert your artifact to a TypeScript template:
   - Rules go in \\\`src/templates/rules/{name}.ts\\\`
   - Skills go in \\\`src/templates/skills/{name}.ts\\\`
   - Agents go in \\\`src/templates/agents/{name}.ts\\\`
   - Commands go in \\\`src/templates/commands/{name}.ts\\\`

4. Export as a template string:
   \\\`\\\`\\\`typescript
   export const template = \\\\\\\`---
   name: {{name}}
   description: Your artifact description
   managed_by: codi
   ---

   # {{name}}

   Your artifact content here...
   \\\\\\\`;
   \\\`\\\`\\\`

5. Register in the corresponding \\\`index.ts\\\` file

6. Push to your GitHub account and open a PR:
   \\\`\\\`\\\`bash
   git remote add user https://github.com/YOUR_USERNAME/codi.git
   git push user contrib/add-my-artifact
   gh pr create --repo lehidalgo/codi --base develop \\\\
     --title "feat: add my-artifact template" \\\\
     --body "Description of the contribution"
   \\\`\\\`\\\`

### Option C: Private Sharing (ZIP)

\\\`\\\`\\\`bash
codi contribute
# Select artifacts → choose "Export as ZIP"
\\\`\\\`\\\`

The ZIP contains a complete preset package with \\\`preset.yaml\\\` manifest. Recipients install with:

\\\`\\\`\\\`bash
codi preset install ./contribution.zip
\\\`\\\`\\\`

### Option D: Using GitHub MCP Tools

If the GitHub MCP server is configured, you can assist the contribution directly:

1. Check authentication: \\\`mcp__github__get_me\\\`
2. Create a fork or repo: \\\`mcp__github__create_repository\\\`
3. Create a branch: \\\`mcp__github__create_branch\\\`
4. Push files: \\\`mcp__github__push_files\\\`
5. Open PR: \\\`mcp__github__create_pull_request\\\` with base \\\`develop\\\`

## Step 4: Quality Checklist

Before contributing, verify the artifact:

- [ ] Has valid YAML frontmatter: \\\`name\\\`, \\\`description\\\`, \\\`managed_by\\\`
- [ ] Uses clear, actionable language with concrete examples
- [ ] Follows existing template patterns (check built-in templates for reference)
- [ ] Does NOT contain secrets, API keys, or company-specific information
- [ ] Has been tested in at least one AI agent (Claude Code, Cursor, etc.)
- [ ] Uses \\\`{{name}}\\\` placeholder for the artifact name (templates only)
- [ ] Skills include all skeleton directories: scripts/, references/, assets/, evals/

## Step 5: Troubleshooting

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
cd /tmp/codi-contrib
git fetch origin develop
git rebase origin/develop
# Resolve conflicts, then:
git push user contrib/my-branch --force-with-lease
\\\`\\\`\\\`

### ZIP import fails
Ensure the ZIP was created by \\\`codi contribute\\\` — it must contain a \\\`preset.yaml\\\` manifest at the root or one level deep.
`;
