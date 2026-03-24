import {
  MAX_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_SKILL_DESCRIPTION_LENGTH,
  MAX_ARTIFACT_CHARS,
  MAX_TOTAL_ARTIFACT_CHARS,
} from '../../constants.js';

export const template = `---
name: {{name}}
description: Guided creation of codi artifacts (rules, skills, agents, commands). Use when the user asks to create, write, or add a new artifact with quality content.
compatibility: [claude-code, cursor, codex, windsurf, cline]
managed_by: codi
---

# {{name}}

Guide the user through creating a high-quality codi artifact. Follow these steps in order.

## Step 1: Identify

Ask the user:
1. **Type**: rule, skill, agent, or command?
2. **Name**: kebab-case, max ${MAX_NAME_LENGTH} chars (e.g., \`api-conventions\`, \`deploy-check\`)
3. **Purpose**: one sentence describing what it does

## Step 2: Create the File

Run the appropriate command:
\\\`\\\`\\\`bash
codi add <type> <name>
\\\`\\\`\\\`

This creates the file with a blank skeleton (\`managed_by: user\`).

## Step 3: Write Content

Open the created file and replace the placeholder content. Follow the type-specific guidelines below.

### Rules (constraints and policies)
- **Location**: \`.codi/rules/custom/<name>.md\`
- **Structure**: h2 section headings with bullet points
- **Style**: imperative mood ("Validate all inputs" not "You should validate")
- **Include**: rationale after each rule ("— prevents SQL injection")
- **Include**: measurable criteria (thresholds, numbers, patterns)
- **Avoid**: vague philosophy, linter-enforceable rules, framework docs
- **Max**: ~50 lines, ≤${MAX_ARTIFACT_CHARS.toLocaleString()} chars

### Skills (step-by-step workflows)
- **Location**: \`.codi/skills/<name>.md\`
- **Structure**: numbered steps with labeled actions ([SYSTEM], [HUMAN], [CODING AGENT])
- **Include**: expected outcomes for each step
- **Include**: references to docs for full details
- **Max**: ~150 lines, ≤${MAX_ARTIFACT_CHARS.toLocaleString()} chars

### Agents (specialized worker roles)
- **Location**: \`.codi/agents/<name>.md\`
- **Structure**: system prompt with focus areas, constraints, output format
- **Include**: tools list in frontmatter (\`tools: [Read, Grep, Glob, Bash]\`)
- **Include**: model preference if needed (\`model: sonnet\` or \`model: inherit\`)
- **Max**: ~100 lines, ≤${MAX_ARTIFACT_CHARS.toLocaleString()} chars

### Commands (slash command actions)
- **Location**: \`.codi/commands/<name>.md\`
- **Structure**: action sequence with clear steps
- **Note**: currently Claude Code only
- **Max**: ~50 lines, ≤${MAX_ARTIFACT_CHARS.toLocaleString()} chars

### Frontmatter Reference

**Rule**:
\\\`\\\`\\\`yaml
name: <name>
description: <max ${MAX_DESCRIPTION_LENGTH} chars>
priority: high | medium | low
alwaysApply: true | false
managed_by: user
scope: [src/api/**]        # optional glob patterns
language: typescript        # optional
\\\`\\\`\\\`

**Skill**:
\\\`\\\`\\\`yaml
name: <name>
description: <max ${MAX_SKILL_DESCRIPTION_LENGTH} chars>
compatibility: [claude-code, cursor]  # optional
tools: [Read, Grep]                   # optional
managed_by: user
\\\`\\\`\\\`

**Agent**:
\\\`\\\`\\\`yaml
name: <name>
description: <max ${MAX_DESCRIPTION_LENGTH} chars>
tools: [Read, Grep, Glob, Bash]  # optional
model: inherit                    # optional
managed_by: user
\\\`\\\`\\\`

**Command**:
\\\`\\\`\\\`yaml
name: <name>
description: <max ${MAX_DESCRIPTION_LENGTH} chars>
managed_by: user
\\\`\\\`\\\`

## Step 4: Generate

\\\`\\\`\\\`bash
codi generate
\\\`\\\`\\\`

This pushes the new artifact to all configured agent output files.

## Step 5: Validate

\\\`\\\`\\\`bash
codi doctor
\\\`\\\`\\\`

Check for:
- No errors
- Size warnings (any artifact >${Math.floor(MAX_ARTIFACT_CHARS / 1000)}K chars or total >${Math.floor(MAX_TOTAL_ARTIFACT_CHARS / 1000)}K chars)

If warnings appear, trim the artifact content.

## Quality Checklist

Before finishing, verify:
- [ ] Content is under ${MAX_ARTIFACT_CHARS.toLocaleString()} chars
- [ ] Uses imperative mood (commands, not suggestions)
- [ ] Includes rationale where non-obvious
- [ ] Has measurable criteria (numbers, thresholds)
- [ ] Does not duplicate linter/formatter config
- [ ] Groups items under clear headings
- [ ] Uses code examples for complex patterns
- [ ] Frontmatter \`name\` matches the filename

## Size Budgets

| Constraint | Limit |
|-----------|-------|
| Per artifact | ≤${MAX_ARTIFACT_CHARS.toLocaleString()} chars |
| Total combined (all artifacts) | ≤${MAX_TOTAL_ARTIFACT_CHARS.toLocaleString()} chars (Windsurf) |
| Name | ≤${MAX_NAME_LENGTH} chars, kebab-case |
| Description (rules) | ≤${MAX_DESCRIPTION_LENGTH} chars |
| Description (skills) | ≤${MAX_SKILL_DESCRIPTION_LENGTH.toLocaleString()} chars |

Full authoring guide: docs/writing-rules.md
`;
