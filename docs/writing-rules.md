# Writing & Customizing Artifacts

This guide covers everything about creating, modifying, and contributing rules in Codi.

## Rule Format

Rules are Markdown files stored in `.codi/rules/custom/`. Each rule has two parts:

1. **YAML frontmatter** — metadata that controls how the rule is applied
2. **Markdown body** — the actual instructions for AI agents

### Complete Example

```markdown
---
name: our-api-conventions
description: Team API design conventions for REST endpoints
priority: high
alwaysApply: true
managed_by: user
scope:
  - src/api/**
  - src/routes/**
language: typescript
---

# API Conventions

## Endpoint Naming
- Use plural nouns: /users, /orders (not /user, /getOrders)
- Use kebab-case for multi-word paths: /order-items
- Nest related resources: /users/:id/orders

## Response Format
All endpoints must return this structure:
- Success: `{ data: T, meta?: { page, total } }`
- Error: `{ error: { code: string, message: string, details?: unknown } }`

## Status Codes
- 200 for successful GET/PUT/PATCH
- 201 for successful POST (resource created)
- 204 for successful DELETE (no content)
- 400 for validation errors
- 401 for authentication required
- 403 for authorization denied
- 404 for resource not found
- 500 for unexpected server errors
```

### Frontmatter Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | Yes | — | Rule identifier. Use kebab-case: `my-rule-name` |
| `description` | string | Yes | — | One-line summary. Shown in `codi verify` output |
| `priority` | `high` / `medium` / `low` | No | `medium` | Importance level for ordering |
| `alwaysApply` | boolean | No | `false` | If true, always included in generated output |
| `managed_by` | `codi` / `user` | No | `user` | Who owns this rule (see [Rule Ownership](#rule-ownership)) |
| `scope` | string[] | No | — | Glob patterns to restrict where this rule applies |
| `language` | string | No | — | Language-specific rule (e.g., `typescript`, `python`) |

### File Naming

- Use **kebab-case**: `my-rule-name.md`
- The filename should match the `name` field in frontmatter
- No spaces, no uppercase, no special characters

## Writing a Custom Rule

### Step 1: Create the Rule

```bash
# Creates a blank skeleton in .codi/rules/custom/our-api-conventions.md
codi add rule our-api-conventions
```

This creates:

```markdown
---
name: our-api-conventions
description: Custom rule
priority: medium
alwaysApply: false
managed_by: user
---

# our-api-conventions

Add your rule content here.
```

### Step 2: Write the Content

Open `.codi/rules/custom/our-api-conventions.md` and replace the placeholder content with your team's specific guidelines.

**Tips for writing good rules:**

- **Be specific, not vague**: "Use 2-space indentation" not "Use consistent indentation"
- **Include measurable criteria**: "80% test coverage" not "Write enough tests"
- **Use imperative language**: "Validate all inputs" not "Inputs should be validated"
- **Group related items** under clear headings
- **Explain WHY** when the reason isn't obvious: "Use parameterized queries — prevents SQL injection"
- **Provide examples** of correct vs incorrect approaches when helpful

### Step 3: Generate

```bash
codi generate
```

This pushes your new rule to all configured agent output files.

### Step 4: Verify

```bash
# Check that the rule appears in generated output
codi verify

# Check for drift
codi status
```

## Modifying a Template Rule

Template rules (created with `--template`) are marked `managed_by: codi`. If you modify one:

```bash
# Edit the template rule
vim .codi/rules/custom/security.md

# Regenerate
codi generate
```

**Important**: If you run `codi update --rules` later, your modifications will be overwritten because `managed_by: codi` means codi owns this rule.

### Keeping Custom Modifications

If you want to customize a template rule AND keep your changes across updates, change the ownership:

```yaml
---
name: security
description: Our customized security rules
priority: high
alwaysApply: true
managed_by: user    # Changed from 'codi' to 'user'
---
```

Now `codi update --rules` will skip this file.

## Rule Ownership

The `managed_by` field controls how `codi update --rules` treats the rule:

| Value | Created by | Updated by `codi update --rules` | When to use |
|-------|-----------|--------------------------------|-------------|
| `codi` | `codi add rule --template X` | Yes — replaced with latest template | You want automatic updates from new codi versions |
| `user` | `codi add rule X` (no template) | No — never touched | You wrote custom content or customized a template |

### Workflow for Teams

```
codi ships templates (managed_by: codi)
     ↓
Team member proposes improvement → PR to lehidalgo/codi
     ↓
PR merged → new codi version released
     ↓
Everyone runs: npm update codi-cli && codi update --rules --regenerate
     ↓
All managed_by: codi rules get the latest content
User-custom rules (managed_by: user) are untouched
```

## Contributing Rule Improvements

Want to improve a built-in rule template? Here's how:

### Where Templates Live

Templates are individual TypeScript modules in `src/templates/rules/`, `src/templates/skills/`, and `src/templates/agents/`. Each template follows this structure:

```typescript
'template-name': `---
name: {{name}}
description: Template description
priority: high
alwaysApply: true
managed_by: codi
---

# Rule Title

## Section
- Guideline 1
- Guideline 2`,
```

### Contributing Process

1. **Fork** the [codi repository](https://github.com/lehidalgo/codi)
2. **Edit** the relevant template module in `src/templates/rules/`, `src/templates/skills/`, or `src/templates/agents/`
3. **Test** your changes:
   ```bash
   npm run build
   node dist/cli.js add rule test-rule --template your-template
   cat .codi/rules/custom/test-rule.md
   ```
4. **Run tests**: `npm test`
5. **Open a PR** with a clear description of what you changed and why

### Guidelines for Template Content

- Rules must be **language-agnostic** (work for any stack)
- Content must be **actionable** (specific instructions, not philosophy)
- Include **measurable criteria** where possible (numbers, thresholds)
- Group items under **clear section headings**
- Keep templates under **50 lines of content** (excluding frontmatter)
- Use `managed_by: codi` in all templates

## Using the Rule Management Skill

Codi includes a built-in skill that helps AI agents assist with rule creation:

```bash
codi add skill rule-management --template rule-management
```

This skill teaches your AI agent to:
- Help you write new rules following codi's format
- Guide you through modifying existing rules
- Run the right commands after changes
- Explain managed_by implications

Once added, ask your AI agent:
- "Help me write a codi rule for our database conventions"
- "Update our security rule to include API key rotation policy"
- "What rules does this project have?"

## Available Templates

| Template | Category | Lines | Focus |
|----------|----------|-------|-------|
| `security` | Safety | ~35 | Secrets, validation, auth, deps, OWASP |
| `code-style` | Quality | ~30 | Naming, functions, files, errors, comments |
| `testing` | Quality | ~35 | TDD, coverage, AAA, mocking, edge cases |
| `architecture` | Design | ~25 | Modules, deps, SOLID, avoid over-engineering |
| `git-workflow` | Process | ~25 | Commits, branches, safety |
| `error-handling` | Reliability | ~30 | Typed errors, logging, resilience, cleanup |
| `performance` | Efficiency | ~30 | N+1, async, caching, pagination |
| `documentation` | Docs | ~30 | API docs, README, ADRs, code comments |
| `api-design` | Design | ~30 | REST, versioning, errors, pagination, limits |

Add all at once:

```bash
codi add rule --all
```

## Writing & Customizing Skills

Same lifecycle as rules. Skills live in `.codi/skills/` as Markdown:

```markdown
---
name: my-skill
description: What this skill does
compatibility: [claude-code, cursor]
tools: []
managed_by: user
---

# Instructions...
```

- `managed_by: codi` — template-managed, updated by `codi update --skills`
- `managed_by: user` — custom, never overwritten
- Add from template: `codi add skill <name> --template <template>`
- Add all: `codi add skill --all`
- Available templates: mcp, code-review, documentation, rule-management

## Writing & Customizing Agents

Agents (subagents) are specialized worker roles. They live in `.codi/agents/`:

```markdown
---
name: my-agent
description: What this agent does
tools: [Read, Grep, Glob, Bash]
model: inherit
managed_by: user
---

# System prompt...
```

- `managed_by: codi` — template-managed, updated by `codi update --agents`
- `managed_by: user` — custom, never overwritten
- Add from template: `codi add agent <name> --template <template>`
- Add all: `codi add agent --all`
- Available templates: code-reviewer, test-generator, security-analyzer
- Generated formats: Claude Code (`.claude/agents/*.md`), Codex (`.codex/agents/*.toml`)

## Writing & Customizing Commands

Commands are slash commands for Claude Code. They live in `.codi/commands/`:

```markdown
---
name: my-command
description: What this command does
managed_by: user
---

[Command instructions...]
```

- `managed_by: codi` — template-managed, updated by `codi update --rules`
- `managed_by: user` — custom, never overwritten
- Add from template: `codi add command <name> --template <template>`
- Add all: `codi add command --all`
- Available templates: review, test-run
- Generated to: `.claude/commands/{name}.md` (Claude Code only)
