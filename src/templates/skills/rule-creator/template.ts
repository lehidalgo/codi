import {
  MAX_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_ARTIFACT_CHARS,
  PROJECT_CLI,
  PROJECT_DIR,
  PROJECT_NAME,
  devArtifactName,
  PLATFORM_CATEGORY,
  SUPPORTED_PLATFORMS_YAML,
} from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Rule creation workflow. Use when the user asks to create, write, define,
  scaffold, or add a coding rule, standard, or convention. Also activate
  for phrases like "add a rule", "new coding standard", "team coding
  standard", "enforce pattern", "project convention", "scaffold rule",
  "framework rule", "rule for TypeScript/Python/React". Produces a
  validated rule with frontmatter + BAD/GOOD examples + measurable
  criteria. Do NOT activate for creating a skill (use
  ${PROJECT_NAME}-skill-creator), creating an agent (use
  ${PROJECT_NAME}-agent-creator), reviewing existing rule feedback (use
  ${PROJECT_NAME}-refine-rules), or enforcing what a linter/formatter
  already covers.
category: ${PLATFORM_CATEGORY}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 11
---

# {{name}} — Rule Creator

## What Is a Rule?

A rule is a **constraint** that every coding agent follows — not a workflow, not a task. Rules are always-loaded instructions that sit in the agent's context and shape every response. Examples: "use Zod for input validation", "files stay under 700 lines", "no \`any\` in TypeScript", "commit messages follow Conventional Commits".

**Rules vs. skills vs. agents:**

| You want... | Use |
|-------------|-----|
| A constraint on how code is written | **Rule** (this flow) |
| A workflow the agent runs end-to-end | **Skill** (\`${PROJECT_NAME}-skill-creator\`) |
| A specialist that produces a structured report | **Agent** (\`${PROJECT_NAME}-agent-creator\`) |

### Do you actually need a new rule?

Codi ships 28 built-in rule templates covering security, architecture, testing, TypeScript, Python, Go, Rust, React, Next.js, Django, Spring Boot, and more. **Check them first:**

\\\`\\\`\\\`bash
${PROJECT_CLI} add rule --all   # lists every built-in template
\\\`\\\`\\\`

Pick an existing template if it matches — rule duplication creates conflicting guidance. Create a custom rule only when:

- The constraint is specific to your project, team, or stack and not covered by a built-in
- The behavior is **always-true** — not "sometimes, if X" (those become skills)
- A linter or formatter cannot enforce it (if it can, configure the tool instead)
- You have evidence it matters — ideally 2+ times someone in the codebase has gotten it wrong

---

## When to Activate

- User asks to create a new rule or coding standard
- User wants to enforce a specific behavior or convention
- User needs to define constraints for a language or framework
- User asks about rule frontmatter or rule structure
- User wants to add a project-specific coding guideline

## Skip When

- User wants to create a skill — use ${PROJECT_NAME}-skill-creator
- User wants to create an agent — use ${PROJECT_NAME}-agent-creator
- User wants to refine existing rules from collected feedback — use ${PROJECT_NAME}-refine-rules
- The rule duplicates what an existing linter/formatter already enforces — configure the tool instead
- User wants to bundle multiple rules into a preset — use ${PROJECT_NAME}-preset-creator

## Step 1 — Capture Intent

**[CODING AGENT]** Before writing anything, interview the user. If they are unsure, offer concrete examples and let them pick.

**Required (agent blocks until answered):**

1. **What behavior to enforce?** — State the constraint as a single imperative sentence.
   - Good: *"All API endpoints must validate request bodies with Zod schemas."*
   - Good: *"Never use \`any\` in TypeScript — use \`unknown\` and narrow with type guards."*
   - Bad: *"Better validation" / "Be more careful with types"* (too vague)
   - **Not sure?** Start with a BAD example from the codebase: "This broke because X happened. The rule should prevent X."

2. **For what language/framework?** — Pick one:
   - (a) Universal — applies to all files, all languages
   - (b) Language-specific — TypeScript / Python / Go / Rust / Swift / Kotlin / etc.
   - (c) Framework-specific — React / Next.js / Django / Spring Boot / etc.
   - (d) Path-scoped — only for \`src/api/**\` or similar

**Optional (helpful but not blocking):**

3. **Why this rule?** — What problem does it prevent? This becomes the rationale that the agent cites when applying the rule.
   - Good: *"Prevents injection attacks and data corruption in public endpoints."*
   - **Not sure?** If you cannot articulate the problem, the rule probably is not needed. Close the flow and revisit when you hit the problem.

4. **Evidence** — How many times has this gotten wrong in the codebase? 0 = speculative, skip. 1 = one-off, maybe a code review comment instead. 2+ = real pattern, rule justified.

### "Not sure?" escape hatches

- **"I don't know if this should be a rule, skill, or agent."** Re-read the comparison table above. Rules = always-true constraints. Skills = triggered workflows. Agents = dispatched specialists.
- **"A linter could catch this."** Configure the linter instead. Rules are for what linters cannot enforce (architectural decisions, naming conventions with rationale, cross-cutting patterns).
- **"I can't phrase the constraint cleanly."** That is a signal the rule is not clear yet. Walk through 2-3 concrete examples; the rule should read cleanly from them.

**Block rule:** Do NOT proceed to Step 2 until Questions 1 and 2 have clear answers.

## Step 2 — Choose Scope

**[CODING AGENT]** Determine the rule's reach:

- **Universal** — Applies to all files: set \\\`alwaysApply: true\\\` in frontmatter.
- **Language-specific** — Only for one language: set \\\`language: typescript\\\` (or python, go, etc.).
- **File-scoped** — Only for certain paths: set \\\`scope: [src/api/**, src/routes/**]\\\`.

If unsure, start with a narrow scope. It is easier to widen later than to narrow.

## Step 3 — Select Template or Start Blank

**[CODING AGENT]** Check available templates:

\\\`\\\`\\\`bash
${PROJECT_CLI} add rule --all
\\\`\\\`\\\`

This lists all built-in rule templates. To use one as a starting point:

\\\`\\\`\\\`bash
${PROJECT_CLI} add rule <template-name>
\\\`\\\`\\\`

To start blank:

\\\`\\\`\\\`bash
${PROJECT_CLI} add rule <name>
\\\`\\\`\\\`

This creates \\\`${PROJECT_DIR}/rules/<name>.md\\\` with a blank skeleton.

## Step 4 — Write Frontmatter

**[CODING AGENT]** Fill in the YAML frontmatter:

\\\`\\\`\\\`yaml
---
name: <kebab-case, max ${MAX_NAME_LENGTH} chars>
description: <max ${MAX_DESCRIPTION_LENGTH} chars, specific about when the rule applies>
version: 1
priority: high | medium | low
alwaysApply: true | false
managed_by: user
user-invocable: true
language: typescript        # optional — omit for universal rules
scope: [src/api/**]         # optional — omit for universal rules
---
\\\`\\\`\\\`

**Priority guide:**
- **high** — Security, data integrity, production safety rules
- **medium** — Code style, architecture patterns, testing standards
- **low** — Preferences, naming conventions, optional best practices

## Step 5 — Write Content

**[CODING AGENT]** Write the rule body following these strict guidelines:

### Style
- Use **imperative mood**: "Validate input" not "Input should be validated"
- Add **rationale** after each rule: "— prevents injection attacks"
- Keep language direct and unambiguous

### Structure
- Group related rules under **h2 section headings**
- Use bullet points for individual rules
- Include **BAD/GOOD code examples** for the 2-3 most important rules:

\\\`\\\`\\\`markdown
## Input Validation

- Validate all request bodies at the controller level — prevents malformed data from reaching services

**BAD:**
\\\\\\\`\\\\\\\`\\\\\\\`typescript
app.post('/users', (req, res) => {
  db.insert(req.body); // No validation
});
\\\\\\\`\\\\\\\`\\\\\\\`

**GOOD:**
\\\\\\\`\\\\\\\`\\\\\\\`typescript
app.post('/users', (req, res) => {
  const parsed = UserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);
  db.insert(parsed.data);
});
\\\\\\\`\\\\\\\`\\\\\\\`
\\\`\\\`\\\`

### Measurable criteria
- Include thresholds where possible: "Max 30 lines per function", "Max 3 parameters"
- Include counts: "At least 2 test cases per public method"
- Include patterns: "All environment variables must use the \\\`CONFIG.\\\` prefix"

## Step 6 — Validate

**[CODING AGENT]** Before registering, verify ALL of the following:

- [ ] Content is under ${MAX_ARTIFACT_CHARS.toLocaleString()} characters (MAX_ARTIFACT_CHARS)
- [ ] No vague adjectives ("appropriate", "proper", "good", "clean", "nice")
- [ ] Every rule has a rationale annotation (text after " — ")
- [ ] At least one BAD/GOOD code example pair
- [ ] Description is specific about when the rule applies (not generic)
- [ ] \\\`name\\\` in frontmatter matches the filename
- [ ] Uses imperative mood throughout
- [ ] Does NOT duplicate linter/formatter rules (ESLint, Prettier, etc.)
- [ ] Rules are grouped under clear h2 headings
- [ ] File stays under 50 lines of body content (excluding frontmatter)

Run \\\`${PROJECT_CLI} validate\\\` to check Zod schema compliance (name pattern, description length, version, managed_by). Fix any errors before registering.

## Step 7 — Register

**[CODING AGENT]** After validation passes:

\\\`\\\`\\\`bash
${PROJECT_CLI} validate
${PROJECT_CLI} generate
${PROJECT_CLI} doctor
\\\`\\\`\\\`

1. \\\`${PROJECT_CLI} generate\\\` distributes the rule to all configured agents
2. \\\`${PROJECT_CLI} doctor\\\` checks for remaining issues (size warnings, missing docs)

If doctor reports warnings, address them before finishing.

## Quality Checklist

- [ ] Rule prevents a real, specific problem (not theoretical)
- [ ] Rationale explains the "why" for every constraint
- [ ] BAD/GOOD examples are realistic, not contrived
- [ ] No overlap with existing rules in \\\`${PROJECT_DIR}/rules/\\\`
- [ ] Measurable criteria where applicable (numbers, thresholds, patterns)
- [ ] Scope is as narrow as possible while covering the intent

## Available Rule Templates

Run \\\`${PROJECT_CLI} add rule --all\\\` to list all templates. Major categories include:

| Category | Templates |
|----------|-----------|
| Practice | security, code-style, testing, architecture, error-handling, api-design, performance, documentation, git-workflow, production-mindset, simplicity-first |
| Language | typescript, python, golang, java, kotlin, rust, swift, csharp |
| Framework | react, nextjs, django, spring-boot |
| Meta | workflow, agent-usage, ${devArtifactName("improvement")} |

## Constraints

- Do NOT create rules that duplicate linter/formatter configuration
- Do NOT use vague language — every word must be actionable
- Do NOT exceed the ${MAX_ARTIFACT_CHARS.toLocaleString()} char limit — split into multiple rules if needed
- Do NOT skip rationale annotations — rules without reasons get ignored
- Do NOT create overly broad rules — narrow scope is better than wide scope

## Related Skills

- **${PROJECT_NAME}-rule-feedback** — Get feedback on an existing rule's quality and trigger precision
- **${PROJECT_NAME}-refine-rules** — Batch-refine multiple rules for consistency and clarity
`;
