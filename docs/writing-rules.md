# Writing & Customizing Artifacts

**Date**: 2026-03-24
**Document**: writing-rules.md

This guide covers creating, formatting, and optimizing rules, skills, agents, and commands in Codi. All four artifact types follow the same lifecycle: create, store, generate, update, clean.

## Size Budgets

AI agents have different context windows and per-file limits. Write artifacts within these constraints to ensure all agents can load your configuration.

### Per-Agent Limits

| Agent | Per-Rule Limit | Total Combined | Context Window |
|-------|---------------|----------------|----------------|
| Claude Code | 6,000 chars | ~40 KB | 200K tokens |
| Cursor | No hard limit | 32K tokens | 32K tokens |
| Codex | No hard limit | 32 KB default | 200K tokens |
| Windsurf | 6,000 chars | 12,000 chars | 32K tokens |
| Cline | No hard limit | No hard limit | 200K tokens |

### Recommended Size Limits

| Artifact | Max Content | Max Lines | Why |
|----------|------------|-----------|-----|
| Rule | 6,000 chars | ~50 lines | Windsurf/Claude Code per-file limit |
| Skill | 6,000 chars | ~150 lines | Skills are workflows, naturally longer, but still bounded |
| Agent | 6,000 chars | ~100 lines | System prompts should be focused |
| Command | 6,000 chars | ~50 lines | Commands are concise action sequences |

Codi warns (via `codi doctor`) when any artifact exceeds 6,000 chars or total combined content exceeds 12,000 chars.

### What Counts Toward the Budget

Only the **markdown body** counts — not frontmatter. Frontmatter is stripped during generation for most agents. The budget applies to the content that the AI agent actually reads.

## Writing Effective Rules

### Rule Format

Rules are Markdown files in `.codi/rules/custom/`. Each has YAML frontmatter + markdown body.

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

## Response Format
All endpoints must return:
- Success: `{ data: T, meta?: { page, total } }`
- Error: `{ error: { code: string, message: string } }`
```

### Frontmatter Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | Yes | — | Kebab-case identifier, max 64 chars. Must match `/^[a-z0-9-]+$/` |
| `description` | string | Yes | — | One-line summary, max 512 chars |
| `priority` | `high` / `medium` / `low` | No | `medium` | Controls ordering in generated output |
| `alwaysApply` | boolean | No | `true` | If true, always included in output |
| `managed_by` | `codi` / `user` | No | `user` | Who owns this artifact |
| `scope` | string[] | No | — | Glob patterns restricting where this rule applies |
| `language` | string | No | — | Language-specific rule (e.g., `typescript`) |

### Content Best Practices

**Be specific, not vague.**

| Ineffective | Effective |
|------------|-----------|
| "Use consistent indentation" | "Use 2-space indentation" |
| "Write enough tests" | "Maintain minimum 80% code coverage" |
| "Handle errors properly" | "Return Result types for recoverable operations" |
| "Follow best practices" | (Delete this — it says nothing) |

**Use imperative mood.** Write commands, not suggestions.

| Weak | Strong |
|------|--------|
| "You should validate inputs" | "Validate all inputs at system boundaries" |
| "Tests should be independent" | "Keep tests independent — no shared mutable state" |

**Include rationale.** Rules with "why" are followed more reliably by AI agents.

```markdown
- Use parameterized queries — prevents SQL injection
- Pin dependency versions in lock files — reproducible builds across environments
```

**Show, don't tell.** Include code examples in fenced blocks for complex patterns.

```markdown
## Error Response Format
Return typed errors with context:

\`\`\`typescript
return { error: { code: 'VALIDATION_FAILED', message: 'Email is required', field: 'email' } };
\`\`\`
```

**Group related items** under clear markdown headings (h2, h3). Avoid h4+ — if you need that level of nesting, split into a separate rule.

**One concern per rule.** Don't combine security, testing, and style in a single rule. Split them.

### Anti-Patterns

| Anti-Pattern | Why It's Bad | Fix |
|-------------|-------------|-----|
| Duplicating linter rules | AI can't enforce what a linter already catches. Wastes context budget. | Delete it. Use ESLint/Prettier instead. |
| Vague philosophy | "Write clean code" gives AI nothing actionable to follow. | Replace with specific, measurable criteria. |
| Giant monolith rule | Rules over 6K chars may be truncated by Windsurf/Claude Code. | Split into focused rules. |
| Repeating framework docs | AI already knows React/Express/etc. Don't teach it. | Only document YOUR conventions. |
| Including code style | Formatting, semicolons, quotes — these are linter concerns. | Use `.prettierrc` / `.eslintrc` instead. |

### Effective Rule Checklist

Before committing a rule, verify:

- [ ] Under 6,000 chars (run `codi doctor` to check)
- [ ] Uses imperative mood ("Validate X" not "X should be validated")
- [ ] Includes rationale where non-obvious
- [ ] Has measurable criteria (numbers, thresholds, patterns)
- [ ] Does not duplicate linter/formatter configuration
- [ ] Does not teach the AI things it already knows
- [ ] Groups items under clear headings
- [ ] Uses code examples for complex patterns

## Creating Rules

### From scratch

```bash
codi add rule our-api-conventions
```

Creates `.codi/rules/custom/our-api-conventions.md` with a blank skeleton (`managed_by: user`).

### From template

```bash
codi add rule security --template security
```

Creates from a built-in template (`managed_by: codi`).

### Batch create

```bash
codi add rule --all
```

Creates all 9 available templates.

### Available Rule Templates

| Template | Focus | Lines |
|----------|-------|-------|
| `security` | Secrets, validation, auth, deps, OWASP | ~35 |
| `code-style` | Naming, functions, files, errors, comments | ~30 |
| `testing` | TDD, coverage, AAA, mocking, edge cases | ~35 |
| `architecture` | Modules, deps, SOLID, avoid over-engineering | ~25 |
| `git-workflow` | Commits, branches, safety | ~25 |
| `error-handling` | Typed errors, logging, resilience, cleanup | ~30 |
| `performance` | N+1, async, caching, pagination | ~30 |
| `documentation` | API docs, README, ADRs, code comments | ~30 |
| `api-design` | REST, versioning, errors, pagination, limits | ~30 |
| `typescript` | Strict typing, immutability, async, named exports | ~40 |
| `react` | Components, hooks, state, performance, patterns | ~40 |
| `python` | Type hints, dataclasses, pytest, resource management | ~40 |
| `golang` | Error wrapping, interfaces, table-driven tests, goroutines | ~40 |
| `java` | Records, Streams, Optional, JUnit 5, constructor injection | ~35 |
| `kotlin` | Null safety, sealed classes, coroutines, Kotest/MockK | ~40 |
| `rust` | Ownership, Result/Option, traits, clippy, thiserror | ~40 |
| `swift` | Protocols, actors, Swift Testing, value types, Keychain | ~40 |
| `csharp` | Records, async/await, LINQ, nullable refs, xUnit | ~40 |
| `nextjs` | App Router, server components, ISR, middleware, metadata | ~40 |
| `django` | Fat models, QuerySet, DRF, migrations, pytest-django | ~40 |
| `spring-boot` | Constructor DI, JPA, Security, profiles, ControllerAdvice | ~40 |

## Writing Skills

Skills are reusable workflows that AI agents can invoke. They live in `.codi/skills/`.

### Skill Format

```markdown
---
name: code-review
description: Systematic code review checklist
compatibility: [claude-code, cursor]
tools: [Read, Grep, Glob]
managed_by: user
---

# Code Review

## Steps
1. Read the changed files
2. Check for security issues
3. Verify test coverage
4. Review naming and structure
```

### Skill Frontmatter

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | Yes | — | Kebab-case, max 64 chars |
| `description` | string | Yes | — | One-line summary, max 1024 chars |
| `compatibility` | string[] | No | — | Which agents support this skill |
| `tools` | string[] | No | — | Tools the skill needs access to |
| `managed_by` | `codi` / `user` | No | `user` | Who owns this skill |
| `disableModelInvocation` | boolean | No | — | Prevent model from auto-invoking |
| `argumentHint` | string | No | — | Hint text for skill arguments |
| `allowedTools` | string[] | No | — | Restrict which tools the skill can use |

### When to Use Skills vs Rules

| Use a Rule when... | Use a Skill when... |
|--------------------|---------------------|
| The instruction is always active | The workflow is invoked on demand |
| It's a constraint or policy | It's a step-by-step procedure |
| It applies broadly to all code | It applies to a specific task |
| Example: "Never expose secrets" | Example: "Code review checklist" |

### Creating Skills

```bash
codi add skill code-review                        # Blank skeleton
codi add skill code-review --template code-review  # From template
codi add skill --all                               # All templates
```

Available templates: `code-review`, `documentation`, `mcp`, `codi-operations`, `e2e-testing`, `artifact-creator`, `security-scan`, `test-coverage`, `refactoring`, `codebase-onboarding`, `presentation`, `mobile-development`.

## Writing Agents

Agents (subagents) are specialized worker roles. They live in `.codi/agents/`.

### Agent Format

```markdown
---
name: code-reviewer
description: Expert code reviewer for PRs and code quality
tools: [Read, Grep, Glob, Bash]
model: inherit
managed_by: user
---

# Code Reviewer

You are an expert code reviewer. When reviewing code:

## Focus Areas
- Security vulnerabilities
- Performance bottlenecks
- Test coverage gaps
- Naming and readability
```

### Agent Frontmatter

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | Yes | — | Kebab-case, max 64 chars. Must match `/^[a-z][a-z0-9-]*$/` |
| `description` | string | Yes | — | One-line summary, max 512 chars |
| `tools` | string[] | No | — | Tools available to the agent |
| `model` | string | No | — | Model override (e.g., `sonnet`, `inherit`) |
| `managed_by` | `codi` / `user` | No | `user` | Who owns this agent |

### Agent Output Formats

| Agent Platform | Output Format |
|----------------|---------------|
| Claude Code | `.claude/agents/*.md` with YAML frontmatter |
| Codex | `.codex/agents/*.toml` in TOML format |
| Cursor, Windsurf, Cline | Not supported |

### Creating Agents

```bash
codi add agent code-reviewer                          # Blank skeleton
codi add agent code-reviewer --template code-reviewer  # From template
codi add agent --all                                   # All templates
```

Available templates: `code-reviewer`, `test-generator`, `security-analyzer`, `docs-lookup`, `refactorer`, `onboarding-guide`, `performance-auditor`, `api-designer`.

## Writing Commands

Commands are slash commands for Claude Code. They live in `.codi/commands/`.

### Command Format

```markdown
---
name: deploy-check
description: Verify deployment readiness before pushing
managed_by: user
---

# Deploy Check

## Steps
1. Run the test suite
2. Check for uncommitted changes
3. Verify environment variables are set
4. Report deployment readiness
```

### Command Frontmatter

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | Yes | — | Kebab-case, max 64 chars |
| `description` | string | Yes | — | One-line summary, max 512 chars |
| `managed_by` | `codi` / `user` | No | `user` | Who owns this command |

### Creating Commands

```bash
codi add command deploy-check                    # Blank skeleton
codi add command deploy-check --template review  # From template
codi add command --all                           # All templates
```

Available templates: `review`, `test-run`, `security-scan`, `test-coverage`, `refactor`, `onboard`, `docs-lookup`. Commands are generated for Claude Code only (`.claude/commands/`).

## Artifact Ownership

The `managed_by` field controls how `codi update` treats the artifact:

| Value | Created by | Updated by `codi update` | When to use |
|-------|-----------|--------------------------|-------------|
| `codi` | Template (`--template`) | Yes — replaced with latest | You want automatic updates from new codi versions |
| `user` | Custom (`codi add`) | No — never touched | You wrote custom content or customized a template |

### Keeping Custom Modifications

If you customized a template rule and want to keep changes across updates, change the ownership:

```yaml
managed_by: user    # Changed from 'codi' to 'user'
```

Now `codi update --rules` will skip this file.

## Per-Agent Format Constraints

### How Artifacts Are Consumed

| Agent | Rules Format | Skills Format | Context Budget |
|-------|-------------|---------------|----------------|
| Claude Code | Separate `.md` files in `.claude/rules/` | `SKILL.md` in subdirectories | 200K tokens — generous |
| Cursor | `.mdc` files with frontmatter in `.cursor/rules/` | `SKILL.md` in subdirectories | 32K tokens — keep rules modular |
| Codex | Inline sections in `AGENTS.md` | `SKILL.md` in subdirectories | 32K default — watch total size |
| Windsurf | Inline in `.windsurfrules` | Inline + `SKILL.md` in subdirectories | 12K chars combined — most restrictive |
| Cline | Inline in `.clinerules` | Inline + `SKILL.md` in subdirectories | 200K tokens — generous |

### Implications

- **Windsurf users**: Keep total config under 12K chars. Fewer rules with higher quality beats many rules.
- **Cursor users**: Rules are auto-discovered from `.cursor/rules/` — modular is fine. Watch total budget.
- **Inline agents** (Codex, Windsurf, Cline): All rules concatenated into one file. Size compounds fast.

## File Naming

- Use **kebab-case**: `my-rule-name.md`
- The filename should match the `name` field in frontmatter
- No spaces, no uppercase, no special characters
- Max 64 characters

## Configuring MCP Servers

MCP servers are configured in `.codi/mcp.yaml` and distributed to all supporting agents.

### Server Format

```yaml
# .codi/mcp.yaml
servers:
  # Local stdio server
  github:
    command: npx
    args: ["-y", "@anthropic-ai/mcp-server-github"]
    env:
      GITHUB_TOKEN: "${GITHUB_TOKEN}"

  # Remote HTTP server
  openai-docs:
    type: http
    url: "https://developers.openai.com/mcp"
```

### Transport Types

| Transport | Fields | Use case |
|-----------|--------|----------|
| `stdio` | `command`, `args`, `env` | Local tools, database connectors |
| `http` | `type: http`, `url` | Cloud-hosted doc APIs, remote services |

### Distribution

MCP config is distributed during `codi generate`:
- Claude Code: `.claude/mcp.json`
- Cursor: `.cursor/mcp.json`
- Codex: `.codex/mcp.toml`
- Windsurf: `.windsurf/mcp.json`
- Cline: not supported

## Creating Custom Presets

Presets bundle flags + rules + skills + agents + commands + MCP config into reusable packages.

### Preset Structure

```
.codi/presets/my-preset/
  preset.yaml        # Manifest: name, description, version, extends, flags
  rules/             # Rule markdown files (optional)
  skills/            # Skill markdown files (optional)
  agents/            # Agent markdown files (optional)
  commands/          # Command markdown files (optional)
  mcp.yaml           # MCP servers (optional)
```

### preset.yaml

```yaml
name: react-typescript
description: React + TypeScript with strict frontend rules
version: "1.0.0"
extends: balanced
tags: [react, typescript, frontend]
flags:
  type_checking:
    mode: enforced
    value: strict
  allowed_languages:
    mode: enabled
    value: [typescript, javascript, css]
```

### Preset Composition

Multiple presets apply in order — later presets override earlier ones:

```yaml
# codi.yaml
presets:
  - balanced           # Base flags
  - my-react-setup     # React-specific rules + flags
  - strict-security    # Security rules (additive)
```

Use `extends:` to inherit from another preset.

## SKILL.md Compatibility

Codi's generated SKILL.md files are compatible with the [Agentic Collaboration Standard (ACS)](https://github.com/agentic-collaboration/standard) and [agentskills.io](https://agentskills.io) format:

- **Core frontmatter**: `name` and `description` fields match the ACS v1.0 spec
- **File location**: `.agents/skills/<name>/SKILL.md` matches the ACS layout
- **Body format**: Free-form markdown, compatible with any ACS-compliant tool

Codi adds extension fields (`compatibility`, `tools`, `managed_by`) in frontmatter. These are additive — ACS-compliant tools ignore unknown fields, so codi skills work in any ACS-compatible environment.

## Contributing Templates

### Where Templates Live

Templates are TypeScript modules in `src/templates/rules/`, `src/templates/skills/`, and `src/templates/agents/`.

### Guidelines for Template Content

- Must be **language-agnostic** (work for any stack)
- Must be **actionable** (specific instructions, not philosophy)
- Include **measurable criteria** where possible
- Group items under **clear section headings**
- Keep under **50 lines of content** (excluding frontmatter)
- Keep under **6,000 chars** of body content
- Use `managed_by: codi` in all templates

### Contributing Process

1. Fork the [codi repository](https://github.com/lehidalgo/codi)
2. Edit the template in `src/templates/`
3. Test: `npm run build && node dist/cli.js add rule test --template your-template`
4. Run tests: `npm test`
5. Open a PR with a clear description
