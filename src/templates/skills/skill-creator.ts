export const template = `---
name: {{name}}
description: |
  Skill creation and improvement workflow. Use when the user asks to create,
  build, write, or improve a skill. Also activate when the user mentions
  evals, skill testing, description optimization, or skill packaging.
managed_by: codi
---

# Skill Creator

## When to Activate

- User asks to create a new skill
- User wants to improve an existing skill's quality or trigger precision
- User mentions skill evals, testing, or benchmarking
- User wants to optimize a skill's description for better triggering

## The 8-Step Lifecycle

### Step 1 — Capture Intent

**[CODING AGENT]** Before writing anything, interview the user to gather requirements. Ask these questions:

1. **What should this skill do?** — Get a clear one-sentence purpose.
2. **When should it trigger?** — Ask for 3-5 specific scenarios (not vague categories). Example: "When the user says 'review this PR'" not "when doing code stuff."
3. **What output should it produce?** — A file? Terminal output? A structured report?
4. **What tools does it need?** — Read, Write, Edit, Bash, Glob, Grep, or external MCP tools?
5. **Are there existing skills to reference?** — Check \\\`.codi/skills/\\\` for similar skills to learn from.

Do NOT proceed until you have clear answers for at least questions 1-3.

### Step 2 — Scaffold

**[CODING AGENT]** Run the scaffolding command:

\\\`\\\`\\\`bash
codi add skill <name>
\\\`\\\`\\\`

This creates the following structure:

\\\`\\\`\\\`
.codi/skills/<name>/
├── SKILL.md        # The skill instructions (what the agent reads)
├── evals/
│   └── evals.json  # Test cases to verify the skill works
├── scripts/        # Optional helper scripts referenced by SKILL.md
├── references/     # Optional reference materials and examples
└── assets/         # Optional images, diagrams, supporting media
\\\`\\\`\\\`

If the directory already exists, confirm with the user before overwriting.

### Step 3 — Write SKILL.md Draft

**[CODING AGENT]** Write the SKILL.md file following these rules:

#### Frontmatter (YAML header)

\\\`\\\`\\\`yaml
---
name: <skill-name>
description: <description following the rules below>
managed_by: codi
---
\\\`\\\`\\\`

#### Official Frontmatter Fields

| Field | Required | Description |
|-------|----------|-------------|
| \\\`name\\\` | Yes | Skill name (kebab-case, max 64 chars). Becomes the /slash-command |
| \\\`description\\\` | Yes | Trigger description — Claude uses this to decide when to load the skill |
| \\\`disable-model-invocation\\\` | No | \\\`true\\\` = only user can invoke via /name. Use for side-effect skills (deploy, commit) |
| \\\`user-invocable\\\` | No | \\\`false\\\` = hidden from / menu. Use for background knowledge |
| \\\`allowed-tools\\\` | No | Tools Claude can use without permission when skill is active |
| \\\`argument-hint\\\` | No | Hint shown during autocomplete (e.g., \\\`[issue-number]\\\`) |
| \\\`model\\\` | No | Override model for this skill |
| \\\`effort\\\` | No | Reasoning effort: \\\`low\\\`, \\\`medium\\\`, \\\`high\\\`, \\\`max\\\` |
| \\\`context\\\` | No | \\\`fork\\\` = run in isolated subagent context |
| \\\`agent\\\` | No | Subagent type when \\\`context: fork\\\` (\\\`Explore\\\`, \\\`Plan\\\`, or custom) |
| \\\`paths\\\` | No | Glob patterns limiting when skill auto-activates |
| \\\`shell\\\` | No | \\\`bash\\\` or \\\`powershell\\\` for inline shell commands |
| \\\`managed_by\\\` | No | Codi-internal: \\\`codi\\\` or \\\`user\\\` (stripped from agent output) |

#### Arguments and Substitutions

Skills can accept arguments via \\\`$ARGUMENTS\\\` placeholders:

\\\`\\\`\\\`yaml
---
name: fix-issue
description: Fix a GitHub issue by number
disable-model-invocation: true
---

Fix GitHub issue $ARGUMENTS following our coding standards.
\\\`\\\`\\\`

When the user runs \\\`/fix-issue 123\\\`, Claude receives "Fix GitHub issue 123...".

Use \\\`$ARGUMENTS[N]\\\` or \\\`$N\\\` for positional arguments:
- \\\`$0\\\` = first argument, \\\`$1\\\` = second, etc.

Other substitutions:
- \\\`\${CLAUDE_SKILL_DIR}\\\` = the directory containing SKILL.md
- \\\`\${CLAUDE_SESSION_ID}\\\` = current session ID

#### Dynamic Context Injection

Use \\\`!\\\\\\\`command\\\\\\\`\\\` to run shell commands before the skill content reaches Claude:

\\\`\\\`\\\`yaml
---
name: pr-summary
context: fork
agent: Explore
---

## PR Context
- Diff: !\\\\\\\`gh pr diff\\\\\\\`
- Comments: !\\\\\\\`gh pr view --comments\\\\\\\`

Summarize this pull request.
\\\`\\\`\\\`

The commands execute first, and their output replaces the placeholder. Claude only sees the result.

#### Subagent Execution

Add \\\`context: fork\\\` to run the skill in an isolated subagent:

\\\`\\\`\\\`yaml
---
name: deep-research
context: fork
agent: Explore
---

Research $ARGUMENTS thoroughly using Glob and Grep.
\\\`\\\`\\\`

The skill content becomes the subagent's task. Results are summarized back to the main conversation.

#### Description Writing Guide

The description is the MOST IMPORTANT part — it determines when the skill triggers. Follow these rules strictly:

**Rule 1: Be pushy.** The description should actively claim territory. Use phrases like "Use when", "Also activate when", "Handles all cases of".

**Rule 2: Include trigger keywords.** Think about what words the user will type and include them explicitly.

**Rule 3: Write in third person.** Describe what the skill does, not what "you" do.

**Rule 4: Stay under 1024 characters.** Longer descriptions get truncated.

**BAD description examples:**
- "A skill for testing" — Too vague, no trigger keywords
- "This helps you write tests" — Second person, no scenarios
- "Test generation" — No verbs, no context, not pushy

**GOOD description examples:**
- "Generates unit, integration, and e2e tests for any codebase. Use when the user asks to write tests, add test coverage, create test files, or verify untested code. Also activate when the user mentions TDD, test-driven development, or wants to know what is untested."
- "Structured code review workflow. Use when reviewing PRs, examining code changes, or auditing code quality. Analyzes changes against project rules and produces severity-ranked findings."

#### Body Structure

The SKILL.md body should follow this pattern:

1. **When to Activate** — Bullet list of specific trigger scenarios
2. **Process Steps** — Numbered steps the agent follows, each starting with \\\`[CODING AGENT]\\\`
3. **Output Format** — What the final output looks like
4. **Constraints** — What the skill should NOT do

#### Size Guidelines

- Keep SKILL.md body under 500 lines
- If the skill needs complex logic, move helpers to \\\`scripts/\\\` directory
- Each step should be self-contained and actionable
- Prefer concrete instructions over abstract principles

#### Context Budget Awareness

- Claude Code and Codex have 200k token budgets — full skill content loads fine
- Cursor and Windsurf have 32k token budgets — keep skills concise
- With \\\`progressive_loading: metadata\\\`, only name + description are loaded initially
- Large skills on low-budget agents should move detail to \\\`scripts/\\\` or \\\`references/\\\`

### Step 4 — Write Evals

**[CODING AGENT]** Create \\\`evals.json\\\` with test cases that verify the skill works correctly.

#### Evals Format

\\\`\\\`\\\`json
[
  {
    "id": "creates-test-file",
    "prompt": "Write unit tests for the UserService class",
    "expectations": [
      "Creates a file ending in .test.ts or .spec.ts",
      "File contains at least one describe block",
      "File imports UserService from the source module",
      "Each test has a descriptive name starting with should"
    ]
  },
  {
    "id": "negative-no-false-trigger",
    "prompt": "What is the weather today?",
    "expectations": [
      "Does NOT create any test files",
      "Does NOT invoke the skill"
    ]
  }
]
\\\`\\\`\\\`

#### Eval Writing Rules

1. **Each eval needs an id** — Use kebab-case, descriptive of what it tests.
2. **Prompts must be realistic** — Write exactly what a user would type.
3. **Expectations must be objectively verifiable** — An external grader must be able to check pass/fail without subjective judgment.
4. **Include both positive and negative cases** — Test that the skill triggers when it should AND does not trigger when it should not.
5. **Minimum 5 evals** — At least 3 positive (should trigger) and 2 negative (should not trigger).

**BAD expectation examples:**
- "Output is good" — Subjective, not verifiable
- "Works correctly" — No concrete check
- "Tests are comprehensive" — Ambiguous threshold

**GOOD expectation examples:**
- "Creates a file at src/__tests__/user-service.test.ts"
- "Output contains a severity summary table with columns: severity, count"
- "Does NOT modify any files outside the test directory"
- "Bash command includes the --coverage flag"

### Step 5 — Run Evals

**[CODING AGENT]** Execute each eval case manually to verify the skill works:

1. For each eval in \\\`evals.json\\\`:
   a. Present the prompt to the agent as if the user typed it
   b. Let the skill execute fully
   c. Record the output and any files created/modified
2. Compare actual results against each expectation
3. Mark each expectation as PASS or FAIL
4. Record the overall pass rate

If you cannot run evals automatically, walk through each case step by step and verify the expectations by inspection.

### Step 6 — Grade and Improve

**[CODING AGENT]** After running evals, assess the results:

#### Grading Criteria

- **Pass rate target: 80% or higher** — Below this, the skill needs revision.
- **All negative cases must pass** — False triggers are worse than missed triggers.
- **Critical expectations cannot fail** — If a core behavior fails, fix before anything else.

#### Improvement Cycle

1. Identify which expectations failed
2. Diagnose why: unclear instructions? Missing step? Wrong assumption?
3. Update SKILL.md to fix the failures
4. Re-run the failing evals
5. Repeat until pass rate exceeds 80%

Common fixes:
- **Agent skips a step** → Make the step more explicit, add "[CODING AGENT]" prefix
- **Agent produces wrong format** → Add an output example in the skill
- **Agent triggers on wrong prompts** → Tighten the description keywords
- **Agent misses valid prompts** → Add more trigger keywords to description

### Step 7 — Optimize Description

**[CODING AGENT]** Generate 20 test queries to verify the description triggers correctly:

#### Create Query List

Write 10 queries that SHOULD trigger the skill:
- 5 obvious matches (direct requests)
- 3 indirect matches (related tasks that should still trigger)
- 2 edge cases (unusual phrasing that should still work)

Write 10 queries that should NOT trigger the skill:
- 5 clearly unrelated queries
- 3 near-miss queries (related topic but different skill)
- 2 adversarial queries (sound similar but mean something different)

#### Evaluate Triggering

For each query, check if the description would cause the skill to activate. If the skill triggers on a should-not query, narrow the description. If it fails to trigger on a should query, add the missing keywords.

#### Near-Miss Negatives

Pay special attention to near-miss negatives. For example, if the skill is "test-generator":
- "Run the existing tests" → Should NOT trigger (that is test running, not generation)
- "What tests do we have?" → Should NOT trigger (that is exploration, not generation)
- "Write tests for this function" → SHOULD trigger

Update the description until all 20 queries classify correctly.

### Step 8 — Register

**[CODING AGENT]** After the skill passes evals and description optimization:

1. Run \\\`codi generate\\\` to distribute the skill to all configured agents
2. Verify the skill appears in the generated agent configuration
3. Confirm with the user that the skill is ready

\\\`\\\`\\\`bash
codi generate
\\\`\\\`\\\`

## When to Bundle Scripts

If while building or using a skill you notice the agent writes the same helper logic 3 or more times, extract it into a reusable script:

1. Create the script in \\\`.codi/skills/<name>/scripts/\\\`
2. Reference it from SKILL.md: "Run \\\`bash .codi/skills/<name>/scripts/helper.sh\\\`"
3. Keep scripts focused — one script per task
4. Include a comment header explaining what the script does

## Constraints

- Do NOT create skills that duplicate existing ones — check \\\`.codi/skills/\\\` first
- Do NOT create skills with vague descriptions — every word must earn its place
- Do NOT skip evals — untested skills are unreliable skills
- Do NOT exceed 500 lines in SKILL.md body — split into scripts if needed
- Do NOT use subjective language in expectations — keep everything objectively verifiable
`;
