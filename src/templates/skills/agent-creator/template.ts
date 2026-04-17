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
version: 12
---

# {{name}} — Agent Creator

## What Is an Agent (vs. a Skill)?

An **agent** is a dispatchable specialist that the primary coding agent calls for deep, focused analysis. It runs in its own context (does not see the main conversation), produces a structured report with severity-ranked findings, and returns. Think of it as a consultant you hire for one task: code review, security audit, performance analysis.

A **skill** is a workflow the primary agent follows inline; an **agent** is a worker the primary agent dispatches.

| Dimension | Skill | Agent |
|-----------|-------|-------|
| Who runs it | Primary agent, inline in your chat | Dispatched — runs in its own context |
| Output | Conversational + maybe a file | Structured report with severity ranking |
| Scope | Full workflow (many steps) | One focused analysis |
| Example | "Run the tests and triage failures" | "Review this diff for security issues" |
| Invoked by | User slash command or model auto-trigger | Another agent (via the \`Agent\` tool) |

**Rule of thumb:** create an agent when you want a second opinion with isolated context. Create a skill when you want a repeatable process in the main conversation.

### Do you actually need a new agent?

Run \`codi list agents\` first — built-in agents include: \`code-reviewer\`, \`security-analyzer\`, \`performance-auditor\`, \`test-generator\`, \`refactorer\`, \`codebase-explorer\`, \`ai-engineering-expert\`, and domain specialists (data, mobile, MLOps, Next.js, etc.). If one of them fits, use it directly — skip this creator.

Create a custom agent only when: you need a specialist role not covered by built-ins, the role is reused across many sessions (one-offs are usually skills), and the output is a structured report rather than a free-form answer.

---

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

**[CODING AGENT]** Interview the user before writing anything. Offer concrete examples for every question; if the user is unsure, propose 2-3 options and let them pick.

**Required (agent blocks until answered):**

1. **What role should this agent fill?** — One-sentence purpose that fits the pattern "<agent> analyzes X and reports Y".
   - Good: *"Reviews migration SQL files for unsafe patterns and reports severity-ranked findings."*
   - Bad: *"Helps with databases."*
   - **Not sure?** Describe the specialist you wish you could hire for an hour. That is the agent.

2. **What triggers it?** — 3-5 specific scenarios where the primary agent should dispatch this one.
   - Good: *"When a .sql file is committed", "when the user says 'review this migration'", "after codi-plan-execution finishes a database task"*.
   - Bad: *"When working on the database."*

3. **What does it produce?** — Pick one:
   - (a) Severity-ranked findings report (CRITICAL / HIGH / MEDIUM / LOW) — most common; use for reviewers and auditors
   - (b) Generated artifact (code, tests, docs) — use for generators
   - (c) Verbal analysis with evidence citations — use for exploratory specialists
   - **Not sure?** Default to (a). It forces structure and matches the reviewer/analyzer archetype.

**Optional (helpful but not blocking):**

4. **What tools does it need?** — Keep minimal; agents should request the fewest tools possible.
   - (a) Read-only (\`Read\`, \`Grep\`, \`Glob\`) — reviewers, analyzers
   - (b) Writes files (\`Write\`, \`Edit\`) — generators
   - (c) Runs commands (\`Bash\`) — only when needed
   - (d) MCP tools (code-graph, docs search) — deep specialists
   - **Not sure?** Start with (a) read-only. Add writes/bash only when the role requires them.

5. **What model should it use?**
   - \\\`inherit\\\` — use whatever the primary agent is using (default, cheapest)
   - \\\`sonnet\\\` — standard capability
   - \\\`opus\\\` — complex reasoning, architecture reviews, multi-file analysis
   - **Not sure?** Leave as \\\`inherit\\\`. Bump to \\\`opus\\\` only if the agent's analyses show shallow reasoning in practice.

### "Not sure?" escape hatches

- **"I don't know what makes an agent different from a skill."** Re-read the comparison table at the top. If you want a workflow the main agent runs, make a skill. If you want a specialist with fresh context, make an agent.
- **"My idea overlaps with a built-in agent."** Extend the built-in by creating a variant skill that calls it with project-specific context, rather than a new agent.
- **"The scope keeps growing."** Cap agents at 5-8 numbered process steps. Beyond that, split into multiple narrower agents.

**Block rule:** Do NOT proceed to Step 2 until Questions 1-3 have clear answers.

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
