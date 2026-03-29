import {
  MAX_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_ARTIFACT_CHARS,
} from "../../constants.js";

export const template = `---
name: {{name}}
description: |
  Command creation workflow. Use when the user asks to create, write, or define
  a slash command. Also activate when the user wants to add a custom CLI action,
  shortcut, or automation triggered by a slash prefix.
category: Codi Platform
managed_by: codi
---

# Command Creator

## When to Activate

- User asks to create a new slash command
- User wants to add a custom CLI action or shortcut
- User asks about command frontmatter or command structure
- User wants to automate a repeated workflow as a one-line trigger
- User mentions slash commands, custom commands, or command templates

## The 6-Step Lifecycle

### Step 1 — Capture Intent

**[CODING AGENT]** Interview the user:

1. **What should this command do?** — Get a clear one-sentence purpose. Example: "Run all linters and fix issues automatically."
2. **What triggers it?** — The slash command name the user will type (e.g., \\\`/lint-fix\\\`).
3. **Does it need input?** — Will the user provide arguments or is it self-contained?
4. **What output does it produce?** — Terminal output? File changes? A report?

Do NOT proceed until questions 1-2 have clear answers.

### Step 2 — Write Frontmatter

**[CODING AGENT]** Scaffold the command:

\\\`\\\`\\\`bash
codi add command <name>
\\\`\\\`\\\`

This creates \\\`.codi/commands/<name>.md\\\` with a blank skeleton.

Fill in the YAML frontmatter:

\\\`\\\`\\\`yaml
---
name: <kebab-case, max ${MAX_NAME_LENGTH} chars>
description: <max ${MAX_DESCRIPTION_LENGTH} chars, what the command does>
managed_by: user
---
\\\`\\\`\\\`

**Description tips:**
- Start with a verb: "Runs...", "Generates...", "Checks..."
- Include the key action and output
- Keep it concise — commands are simple by nature

### Step 3 — Write Instruction Body

**[CODING AGENT]** Write the command body as a clear action sequence:

\\\`\\\`\\\`markdown
# Command Name

## Action

1. [First step — what to do]
2. [Second step — what to do]
3. [Third step — what to do]

## Constraints

- [What the command should NOT do]
- [Boundary conditions]
\\\`\\\`\\\`

#### Writing rules:
- Use **imperative mood**: "Run the linter" not "The linter should be run"
- Keep steps **sequential and numbered**
- Each step must be **self-contained** — no ambiguity about what to execute
- Include **exact commands** where applicable:

\\\`\\\`\\\`markdown
## Action

1. Run the linter with auto-fix enabled:
   \\\\\\\`\\\\\\\`\\\\\\\`bash
   npm run lint -- --fix
   \\\\\\\`\\\\\\\`\\\\\\\`
2. Run the formatter:
   \\\\\\\`\\\\\\\`\\\\\\\`bash
   npx prettier --write "src/**/*.ts"
   \\\\\\\`\\\\\\\`\\\\\\\`
3. Report the number of remaining issues to the user.
\\\`\\\`\\\`

### Step 4 — Define Output Format

**[CODING AGENT]** Specify what the user sees after the command runs:

- **Terminal output** — Status messages, counts, pass/fail
- **File changes** — What files are created or modified
- **Summary** — Brief report of what happened

Example:

\\\`\\\`\\\`markdown
## Output

Report to the user:
- Number of files processed
- Number of issues fixed automatically
- Number of remaining issues (if any)
- List of files that still have errors
\\\`\\\`\\\`

### Step 5 — Validate

**[CODING AGENT]** Before registering, verify ALL of the following:

- [ ] Content is under ${MAX_ARTIFACT_CHARS.toLocaleString()} characters
- [ ] Body stays under 50 lines (commands must be concise)
- [ ] Uses imperative mood throughout
- [ ] Steps are numbered and sequential
- [ ] Exact bash commands are included where applicable
- [ ] \\\`name\\\` in frontmatter matches the filename
- [ ] Description starts with a verb
- [ ] No overlap with existing commands in \\\`.codi/commands/\\\`
- [ ] Note: commands are currently Claude Code only

### Step 6 — Register

**[CODING AGENT]** After validation passes:

\\\`\\\`\\\`bash
codi generate
codi doctor
\\\`\\\`\\\`

1. \\\`codi generate\\\` distributes the command to agent configuration
2. \\\`codi doctor\\\` checks for remaining issues

## Available Command Templates

Run \\\`codi add command --all\\\` to list all templates. Categories include:

| Category | Templates |
|----------|-----------|
| Git | commit |
| Quality | review, refactor |
| Testing | test-run, test-coverage |
| Security | security-scan |
| Docs | docs-lookup, onboard |
| Workflow | session-handoff, open-day, close-day, roadmap |
| Exploration | codebase-explore, check |
| Graph | index-graph, update-graph |

## Constraints

- Do NOT create commands that duplicate existing ones — check \\\`.codi/commands/\\\` first
- Do NOT exceed 50 lines in the body — commands are meant to be short
- Do NOT create commands without exact bash commands for executable steps
- Do NOT include complex branching logic — split into separate commands instead
- Commands are currently **Claude Code only** — note this in the description if relevant
`;
