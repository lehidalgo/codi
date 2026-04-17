import {
  PROJECT_CLI,
  PROJECT_DIR,
  PROJECT_NAME,
  PROJECT_REPO,
  PLATFORM_CATEGORY,
  SUPPORTED_PLATFORMS_YAML,
} from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Contribute or share custom ${PROJECT_NAME} artifacts (rules, skills, agents,
  commands). Use when the user wants to open a PR to the ${PROJECT_NAME} repo,
  submit a PR to a team preset repository, share artifacts as a ZIP package,
  publish an agent or rule, push a preset to a custom repo, fork and PR, or
  set up GitHub CLI / GitHub MCP for contributions. Also activate for phrases
  like "share my skill", "contribute to ${PROJECT_NAME}", "open a PR with my
  rule", "publish my agent", "export preset", "send this to the ${PROJECT_NAME}
  repo". Do NOT activate for ordinary code commits, installing a preset
  (use ${PROJECT_NAME}-preset-creator or \\\`${PROJECT_CLI} preset install\\\` directly), or releasing a
  package to npm.
category: ${PLATFORM_CATEGORY}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 13
---

# {{name}} — Artifact Contributor

Help the user contribute their custom artifacts (rules, skills, agents,
commands) back to the official ${PROJECT_NAME} project or share them
privately with their team.

## When to Activate

- User wants to contribute a rule, skill, agent, or command to ${PROJECT_NAME} or any GitHub repo
- User asks how to share artifacts with the community or their team
- User wants to open a pull request, submit a PR, or fork-and-PR an artifact
- User wants to push a preset to a custom or team repository
- User asks to export artifacts as a ZIP for private sharing
- User needs help setting up GitHub CLI or the GitHub MCP server

## Skip When

- User wants to commit ordinary code (use the commit skill)
- User wants to **install** a preset, not contribute one (use \\\`${PROJECT_CLI} preset install <path>\\\`)
- User wants to publish an npm package or tag a release (not in scope)

## Step 1 — Prerequisites

**[CODING AGENT]** Check the GitHub CLI is installed and authenticated:

\\\`\\\`\\\`bash
gh auth status
\\\`\\\`\\\`

If not authenticated, guide the user:

\\\`\\\`\\\`bash
brew install gh         # macOS — substitute for other OSes
gh auth login           # GitHub.com → HTTPS → Login with browser
\\\`\\\`\\\`

If the user's agent supports MCP, the GitHub MCP server is an optional
enhancement — see \\\`\${CLAUDE_SKILL_DIR}[[/references/github-mcp.md]]\\\`
for setup and usage.

## Step 2 — Identify What to Contribute

**[CODING AGENT]** List the user's custom artifacts:

\\\`\\\`\\\`bash
ls ${PROJECT_DIR}/rules/ ${PROJECT_DIR}/skills/ ${PROJECT_DIR}/agents/ 2>/dev/null
\\\`\\\`\\\`

Help the user pick artifacts that:

- Were created or meaningfully improved by them
- Have \\\`managed_by: user\\\` (user-created) or \\\`managed_by: ${PROJECT_NAME}\\\` (improved built-in)
- Have been tested and proven useful in real workflows

## Step 3 — Choose Contribution Method

**[CODING AGENT]** Present these options and execute the chosen path.

### Option A — Interactive CLI (default)

\\\`\\\`\\\`bash
${PROJECT_CLI} contribute
\\\`\\\`\\\`

The wizard discovers all artifacts in \\\`${PROJECT_DIR}/\\\`, presents a
multi-select list, and offers two distribution methods:

- **Open PR to a GitHub repository** (requires GitHub CLI auth)
- **Export as ZIP** (creates a re-importable preset package)

For the PR method, the wizard asks which repo to target: the official
${PROJECT_NAME} repo (default), a repo detected from installed presets,
or any custom repository.

Skip the prompt with flags:

\\\`\\\`\\\`bash
${PROJECT_CLI} contribute --repo ${PROJECT_REPO} --branch develop
${PROJECT_CLI} contribute --repo myorg/shared-presets
${PROJECT_CLI} contribute --repo myorg/shared-presets --branch main
\\\`\\\`\\\`

### Option B — Manual PR (advanced)

See \\\`\${CLAUDE_SKILL_DIR}[[/references/manual-pr.md]]\\\` for the full
clone → branch → template conversion → push → \\\`gh pr create\\\` flow.

### Option C — Private Sharing (ZIP)

\\\`\\\`\\\`bash
${PROJECT_CLI} contribute      # Select artifacts → choose "Export as ZIP"
\\\`\\\`\\\`

Recipients install with:

\\\`\\\`\\\`bash
${PROJECT_CLI} preset install ./contribution.zip
\\\`\\\`\\\`

### Option D — GitHub MCP tools

See \\\`\${CLAUDE_SKILL_DIR}[[/references/github-mcp.md]]\\\` for the
\\\`mcp__github__*\\\` sequence (get_me → create_repository → create_branch
→ push_files → create_pull_request).

## Step 4 — Quality Checklist

**[CODING AGENT]** Before contributing, verify the artifact:

- [ ] Valid YAML frontmatter: \\\`name\\\`, \\\`description\\\`, \\\`managed_by\\\`
- [ ] Clear, actionable language with concrete examples
- [ ] Follows existing template patterns (cross-check a built-in template)
- [ ] Contains NO secrets, API keys, tokens, or company-specific information
- [ ] Tested in at least one AI agent (Claude Code, Cursor, Codex, etc.)
- [ ] Uses \\\`{{name}}\\\` placeholder where applicable (templates only)
- [ ] Skeleton directories (\\\`scripts/\\\`, \\\`references/\\\`, \\\`assets/\\\`, \\\`evals/\\\`) are present **only as needed** — empty dirs add noise

## Step 5 — Adapter-Specific Contributions

**[CODING AGENT]** When the contribution is a **new adapter** or **adapter
extension** (e.g., adding a new AI agent platform, extending an existing
adapter with missing formats), the work has extra requirements beyond a
standard rule/skill/agent contribution:

- Official platform specification must be validated before coding
- A capability matrix is required (platform formats vs. adapter coverage)
- Path sanitization and YAML injection prevention must be reviewed
- Test infrastructure must use real file I/O (tmpDir + beforeEach/afterEach)
- Documentation must stay in sync with implementation

Consult \\\`\${CLAUDE_SKILL_DIR}[[/references/adapter-development.md]]\\\`
for the full adapter contribution checklist and lessons learned from prior
adapter remediations.

## Step 6 — Troubleshooting

**[CODING AGENT]** If the contribution stalls, consult
\\\`\${CLAUDE_SKILL_DIR}[[/references/troubleshooting.md]]\\\` for fixes
covering auth failures, push errors, PR merge conflicts, ZIP import
failures, and the source-layer \\\`${PROJECT_CLI} generate\\\` caveat.

## Related Skills

- **${PROJECT_NAME}-preset-creator** — Create and package a preset before contributing it
- **${PROJECT_NAME}-dev-operations** — Clean + reinstall + regenerate for source-layer edits
- **${PROJECT_NAME}-commit** — Commit the PR branch when contributing manually
`;
