import {
  MAX_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_ARTIFACT_CHARS,
  PROJECT_CLI,
  PROJECT_DIR,
  PROJECT_NAME,
  PROJECT_NAME_DISPLAY,
} from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Agent creation workflow. Use when the user asks to create, build, or define
  a specialized agent. Also activate when the user wants to add a code reviewer,
  security analyzer, test generator, or any autonomous worker role.
category: ${PROJECT_NAME_DISPLAY} Platform
managed_by: ${PROJECT_NAME}
intentHints:
  taskType: Agent Creation
  examples:
    - "Create a new agent"
    - "Build a specialized subagent"
    - "Add a code reviewer agent"
---

# Agent Creator

## When to Activate

- User asks to create a new agent or specialized worker
- User wants to define an autonomous reviewer, analyzer, or generator
- User asks about agent frontmatter, tools, or model configuration
- User needs a role-based worker with specific expertise
- User mentions agent descriptions, confidence filtering, or severity matrices

## The 9-Step Lifecycle

### Step 1 — Capture Intent

**[CODING AGENT]** Interview the user to gather requirements:

1. **What role should this agent fill?** — Get a clear one-sentence purpose. Example: "Reviews pull requests for security vulnerabilities."
2. **What triggers it?** — Ask for 3-5 specific scenarios when the agent should activate.
3. **What does it produce?** — Structured report? Inline comments? File modifications?
4. **What tools does it need?** — Read, Write, Edit, Bash, Glob, Grep, or external MCP tools?
5. **What model should it use?** — \\\`inherit\\\` (use project default), \\\`sonnet\\\`, or \\\`opus\\\`?

Do NOT proceed until questions 1-3 have clear answers.

### Step 2 — Define Identity

**[CODING AGENT]** Scaffold the agent:

\\\`\\\`\\\`bash
${PROJECT_CLI} add agent <name>
\\\`\\\`\\\`

This creates \\\`${PROJECT_DIR}/agents/<name>.md\\\` with a blank skeleton.

#### Write Frontmatter

\\\`\\\`\\\`yaml
---
name: <kebab-case, max ${MAX_NAME_LENGTH} chars>
description: <max ${MAX_DESCRIPTION_LENGTH} chars — see description rules below>
tools: [Read, Grep, Glob, Bash]  # only include tools the agent needs
model: inherit                    # or sonnet, opus
managed_by: user
---
\\\`\\\`\\\`

#### Description Writing Rules

The description determines when the agent triggers. Follow these strictly:

**Rule 1: Be pushy.** Actively claim territory with "Use when", "Also activate when", "Handles all cases of".

**Rule 2: Include trigger keywords.** Think about what the user will type.

**Rule 3: Stay under ${MAX_DESCRIPTION_LENGTH} characters.**

**BAD descriptions:**
- "An agent for security" — Too vague, no trigger keywords
- "This helps review code" — No specific scenarios, not pushy
- "Security checker" — No verbs, no context

**GOOD descriptions:**
- "Analyzes code for security vulnerabilities including injection, auth bypass, and data exposure. Use when reviewing PRs, auditing sensitive code, or checking compliance. Also activate for threat modeling and security architecture review."
- "Generates comprehensive test suites for any codebase. Use when adding test coverage, writing regression tests, or implementing TDD workflows. Handles unit, integration, and e2e test creation."

### Step 3 — Write Process

**[CODING AGENT]** Define the numbered steps the agent follows. Each step must:

- Start with \\\`**[CODING AGENT]**\\\` prefix
- Be self-contained and actionable
- Have a clear completion condition

Example structure:

\\\`\\\`\\\`markdown
## Process

### Step 1 — Gather Context
**[CODING AGENT]** Read the relevant source files and understand the current state.

### Step 2 — Analyze
**[CODING AGENT]** Apply the analysis criteria to each file. Record findings.

### Step 3 — Report
**[CODING AGENT]** Format findings into the output template.
\\\`\\\`\\\`

Keep to 5-8 steps maximum. If the process needs more, the agent scope is too broad — split into multiple agents.

### Step 4 — Add Confidence Filtering

**[CODING AGENT]** Define how the agent filters its own output quality:

\\\`\\\`\\\`markdown
## Confidence Filtering

For each finding, assign a confidence level:
- **HIGH** — Definite issue with clear evidence (code reference, failing test)
- **MEDIUM** — Likely issue but needs human verification
- **LOW** — Possible concern, may be intentional

Only report HIGH and MEDIUM findings by default. Include LOW findings only if the user requests verbose output.
\\\`\\\`\\\`

### Step 5 — Define Severity Matrix

**[CODING AGENT]** Create a severity classification for findings:

\\\`\\\`\\\`markdown
## Severity Matrix

| Severity | Criteria | Action |
|----------|----------|--------|
| CRITICAL | Security vulnerability, data loss risk | Block — must fix before merge |
| HIGH | Bug, logic error, missing validation | Fix recommended before merge |
| MEDIUM | Code smell, maintainability concern | Fix in follow-up PR |
| LOW | Style preference, minor optimization | Optional improvement |
\\\`\\\`\\\`

Adapt the severity levels and criteria to match the agent's domain.

### Step 6 — Specify Output Format

**[CODING AGENT]** Define the exact structure of the agent's output:

\\\`\\\`\\\`markdown
## Output Format

### Summary
- Total findings: <count>
- By severity: CRITICAL: <n>, HIGH: <n>, MEDIUM: <n>, LOW: <n>

### Findings

#### [SEVERITY] Finding Title
- **File**: \\\`path/to/file.ts:42\\\`
- **Issue**: Description of the problem
- **Evidence**: Code snippet or reference
- **Fix**: Suggested remediation
\\\`\\\`\\\`

### Step 7 — Add Approval Criteria

**[CODING AGENT]** Define when the agent's analysis results in a pass or fail:

\\\`\\\`\\\`markdown
## Approval Criteria

- **PASS** — No CRITICAL or HIGH findings
- **PASS WITH WARNINGS** — No CRITICAL findings, 1-3 HIGH findings
- **FAIL** — Any CRITICAL finding, or more than 3 HIGH findings
\\\`\\\`\\\`

### Step 8 — Validate

**[CODING AGENT]** Before registering, verify ALL of the following:

- [ ] Content is under ${MAX_ARTIFACT_CHARS.toLocaleString()} characters
- [ ] Description includes specific trigger keywords
- [ ] Tools list only includes tools the agent actually uses
- [ ] Process has 5-8 numbered steps maximum
- [ ] Each step starts with \\\`[CODING AGENT]\\\` prefix
- [ ] Confidence filtering is defined
- [ ] Severity matrix has clear, measurable criteria
- [ ] Output format is structured and consistent
- [ ] Approval criteria have concrete thresholds
- [ ] \\\`name\\\` in frontmatter matches the filename

### Step 9 — Register

**[CODING AGENT]** After validation passes:

\\\`\\\`\\\`bash
${PROJECT_CLI} generate
${PROJECT_CLI} doctor
\\\`\\\`\\\`

1. \\\`${PROJECT_CLI} generate\\\` distributes the agent to all configured platforms
2. \\\`${PROJECT_CLI} doctor\\\` checks for remaining issues

## Available Agent Templates

Run \\\`${PROJECT_CLI} add agent --all\\\` to list all templates. Major categories include:

| Category | Templates |
|----------|-----------|
| Quality | code-reviewer, refactorer, test-generator |
| Security | security-analyzer |
| Architecture | api-designer, performance-auditor |
| Docs | onboarding-guide, docs-lookup, codebase-explorer |
| Domain | ai-engineering-expert, data-analytics-bi-expert, data-engineering-expert, data-intensive-architect, data-science-specialist, legal-compliance-eu, marketing-seo-specialist, mlops-engineer, nextjs-researcher, openai-agents-specialist, payload-cms-auditor, python-expert, scalability-expert |

## Constraints

- Do NOT create agents with overlapping responsibilities — check \\\`${PROJECT_DIR}/agents/\\\` first
- Do NOT include tools the agent does not actually need — minimal tool surface
- Do NOT exceed ${MAX_ARTIFACT_CHARS.toLocaleString()} chars — move complex logic to skill scripts
- Do NOT create agents without confidence filtering — unfiltered output is noisy
- Do NOT skip severity definitions — findings without severity are not actionable
- Keep agent body under 100 lines (excluding frontmatter)

## Related Skills

- **codi-skill-creator** — Create a skill that coordinates multiple agents in a workflow
`;
