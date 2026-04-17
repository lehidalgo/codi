import {
  MAX_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_ARTIFACT_CHARS,
  PROJECT_CLI,
  PROJECT_DIR,
  PROJECT_NAME,
  PLATFORM_CATEGORY,
  SUPPORTED_PLATFORMS_YAML,
} from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Agent creation workflow. Use when the user asks to create, build, scaffold,
  or define a new agent, subagent, specialist worker, or autonomous reviewer.
  Also activate for phrases like "add an agent", "new agent for", "code reviewer
  agent", "security analyzer", "test generator", "worker role", "assistant role",
  or when the user configures agent frontmatter, tools, model, confidence
  filtering, or severity matrices. Do NOT activate for editing an existing agent
  without the user asking to create — redirect to direct file edits instead.
category: ${PLATFORM_CATEGORY}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 10
---

# {{name}} — Agent Creator

## When to Activate

- User asks to create, build, scaffold, or define a new agent or subagent
- User wants an autonomous reviewer, analyzer, generator, or specialist worker
- User says "add a code reviewer", "new security analyzer", "test generator agent"
- User asks about agent frontmatter, tools, model, or description rules
- User mentions confidence filtering, severity matrices, or approval criteria for agents

## Skip When

- User asks to edit or retune an existing agent (no "create" intent) — edit the file directly
- User asks about skill creation — route to \${PROJECT_NAME}-skill-creator instead
- User asks to invoke or call an existing agent — use the agent, do not re-scaffold it

## The 9-Step Lifecycle

### Step 1 — Capture Intent

**[CODING AGENT]** Interview the user before writing anything:

1. **What role should this agent fill?** — One-sentence purpose.
2. **What triggers it?** — 3-5 specific scenarios.
3. **What does it produce?** — Structured report, inline comments, or file edits?
4. **What tools does it need?** — Read, Write, Edit, Bash, Glob, Grep, or MCP tools?
5. **What model should it use?** — \\\`inherit\\\`, \\\`sonnet\\\`, or \\\`opus\\\`?

Do NOT proceed until questions 1-3 have clear answers.

### Step 2 — Scaffold & Frontmatter

**[CODING AGENT]** Scaffold the agent:

\\\`\\\`\\\`bash
${PROJECT_CLI} add agent <name>
\\\`\\\`\\\`

This creates \\\`${PROJECT_DIR}/agents/<name>.md\\\` with a blank skeleton.

**Frontmatter fields:** \\\`name\\\` (kebab-case, max ${MAX_NAME_LENGTH} chars),
\\\`description\\\` (max ${MAX_DESCRIPTION_LENGTH} chars — pushy, third-person,
keyword-rich), \\\`version\\\`, \\\`tools\\\` (minimal), \\\`model\\\`,
\\\`managed_by: user\\\`, \\\`user-invocable: true\\\`.

See \\\`\${CLAUDE_SKILL_DIR}[[/references/agent-authoring.md]]\\\` for description
rules, BAD/GOOD examples, and the full frontmatter block.

### Step 3 — Write Process

**[CODING AGENT]** Define numbered steps. Each step must start with
\\\`**[CODING AGENT]**\\\` and have a clear completion condition. Keep to 5-8
steps; more means the scope is too broad — split into multiple agents.

### Step 4 — Add Confidence Filtering

**[CODING AGENT]** Define how the agent filters its own output quality. Use
the HIGH/MEDIUM/LOW template in
\\\`\${CLAUDE_SKILL_DIR}[[/references/agent-authoring.md]]\\\` and adapt the
evidence thresholds to the agent's domain.

### Step 5 — Define Severity Matrix

**[CODING AGENT]** Create a severity classification for findings. Start from
the CRITICAL/HIGH/MEDIUM/LOW matrix template in
\\\`\${CLAUDE_SKILL_DIR}[[/references/agent-authoring.md]]\\\` and adapt the
criteria and actions to the domain.

### Step 6 — Specify Output Format

**[CODING AGENT]** Define the exact structure of the agent's output. Use the
Summary + Findings block in
\\\`\${CLAUDE_SKILL_DIR}[[/references/agent-authoring.md]]\\\` as the starting
template.

### Step 7 — Add Approval Criteria

**[CODING AGENT]** Define when analysis results in PASS, PASS WITH WARNINGS,
or FAIL. See the thresholds in
\\\`\${CLAUDE_SKILL_DIR}[[/references/agent-authoring.md]]\\\`.

### Step 8 — Validate

**[CODING AGENT]** Before registering, verify ALL of the following:

- [ ] Content is under ${MAX_ARTIFACT_CHARS.toLocaleString()} characters
- [ ] Description includes specific trigger keywords and is pushy
- [ ] Tools list only includes tools the agent actually uses
- [ ] Process has 5-8 numbered steps maximum
- [ ] Each step starts with \\\`[CODING AGENT]\\\` prefix
- [ ] Confidence filtering is defined
- [ ] Severity matrix has clear, measurable criteria
- [ ] Output format is structured and consistent
- [ ] Approval criteria have concrete thresholds
- [ ] \\\`name\\\` in frontmatter matches the filename

Run \\\`${PROJECT_CLI} validate\\\` to check Zod schema compliance. Fix any
errors before registering.

### Step 9 — Register

**[CODING AGENT]** After validation passes:

\\\`\\\`\\\`bash
${PROJECT_CLI} validate
${PROJECT_CLI} generate
${PROJECT_CLI} doctor
\\\`\\\`\\\`

1. \\\`${PROJECT_CLI} generate\\\` distributes the agent to all configured platforms
2. \\\`${PROJECT_CLI} doctor\\\` checks for remaining issues

## Available Agent Templates

Run \\\`${PROJECT_CLI} add agent --all\\\` to list all templates. Major categories:

| Category | Templates |
|----------|-----------|
| Quality | code-reviewer, refactorer, test-generator |
| Security | security-analyzer |
| Architecture | api-designer, performance-auditor |
| Docs | docs-lookup, codebase-explorer |
| Domain | ai-engineering-expert, data-analytics-bi-expert, data-engineering-expert, data-intensive-architect, data-science-specialist, legal-compliance-eu, marketing-seo-specialist, mlops-engineer, nextjs-researcher, openai-agents-specialist, payload-cms-auditor, python-expert, scalability-expert |

## Constraints

- Do NOT create agents with overlapping responsibilities — check \\\`${PROJECT_DIR}/agents/\\\` first
- Do NOT include tools the agent does not actually need — minimal tool surface
- Do NOT exceed ${MAX_ARTIFACT_CHARS.toLocaleString()} chars — move complex logic to skill scripts
- Do NOT create agents without confidence filtering — unfiltered output is noisy
- Do NOT skip severity definitions — findings without severity are not actionable
- Keep agent body under 100 lines (excluding frontmatter)

## Related Skills

- **${PROJECT_NAME}-skill-creator** — Create a skill that coordinates multiple agents in a workflow
- **${PROJECT_NAME}-dev-operations** — Run \\\`${PROJECT_CLI} validate\\\`, \\\`generate\\\`, and \\\`doctor\\\` after scaffolding
- **${PROJECT_NAME}-agent-usage** (rule) — Guidance on when to invoke specialized agents vs. direct tools
`;
