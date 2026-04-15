# Artifacts

Artifacts are the building blocks of Codi configuration. There are 4 types: **rules**, **skills**, **agents**, and **brands**. All are Markdown files with YAML frontmatter stored in `.codi/`.

## Overview

| Artifact | Purpose | Location | Detection |
|----------|---------|----------|-----------|
| **Rule** | Instructions agents follow | `.codi/rules/*.md` | `*.md` files |
| **Skill** | Reusable workflows agents invoke | `.codi/skills/{name}/SKILL.md` | `**/SKILL.md` glob |
| **Agent** | Subagent definitions | `.codi/agents/*.md` | `*.md` files |
| **Brand** | Visual identity assets | `.codi/brands/{name}/BRAND.md` | `**/BRAND.md` glob |

---

## Artifact Lifecycle

Artifacts have a two-stage lifecycle:

1. **Creation time** — Commands like `codi init` and `codi add` can start from built-in templates in `src/templates/...` and scaffold concrete files into `.codi/`.
2. **Runtime generation** — `codi generate` reads the files already present in `.codi/` and produces agent-specific outputs such as `CLAUDE.md`, `.claude/skills/...`, `.agents/skills/...`, and `.codex/config.toml`.

This means `src/templates/...` is an install-time input, while `.codi/` is the runtime source of truth. Changing a built-in template does not affect an existing project until the artifact is reinstalled, added, or updated into `.codi/`.

---

## Rules

Rules are instructions that AI agents follow during development. Examples: "never expose secrets", "use TypeScript strict mode", "follow conventional commits".

### Frontmatter

```yaml
---
name: security
description: Security best practices for all code
type: rule
language: typescript          # optional — language scope
priority: high                # high | medium (default) | low
scope: ["src/**/*.ts"]        # optional — file patterns
alwaysApply: true             # default: true
managed_by: codi              # codi (template) | user (custom)
---
```

### Fields

<!-- GENERATED:START:rule_fields -->
| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | Yes | — | Rule name (alphanumeric + hyphens) |
| `description` | string | Yes | — | One-line description |
| `version` | number | Yes | `1` |  |
| `type` | `"rule"` | Yes | `rule` | Always `rule` |
| `language` | string | No | — | Language this rule applies to |
| `priority` | `high` \| `medium` \| `low` | Yes | `medium` | Resolution priority |
| `scope` | string[] | No | — | File pattern restriction |
| `alwaysApply` | boolean | Yes | `true` | Whether rule is always active |
| `managed_by` | `codi` \| `user` | Yes | `user` | Who manages this artifact |
<!-- GENERATED:END:rule_fields -->

> **Scoped rules in Claude Code**: Rules with a `scope` field emit a `paths:` frontmatter block in the generated `.claude/rules/*.md` file. Claude Code reads this to load the rule only when matching files are active in the conversation.

### Built-in Rule Templates

Create from templates: `codi add rule security --template security`

<!-- GENERATED:START:rule_templates -->
`codi-agent-usage`, `codi-api-design`, `codi-architecture`, `codi-code-style`, `codi-csharp`, `codi-django`, `codi-documentation`, `codi-error-handling`, `codi-git-workflow`, `codi-golang`, `codi-improvement-dev`, `codi-java`, `codi-kotlin`, `codi-nextjs`, `codi-output-discipline`, `codi-performance`, `codi-production-mindset`, `codi-python`, `codi-react`, `codi-rust`, `codi-security`, `codi-simplicity-first`, `codi-spanish-orthography`, `codi-spring-boot`, `codi-swift`, `codi-testing`, `codi-typescript`, `codi-workflow`
<!-- GENERATED:END:rule_templates -->

---

## Skills

Skills are reusable workflows that agents can invoke. Examples: "code review checklist", "generate PDF report", "security scan".

### Directory Structure

Each skill lives in its own directory with a standard layout:

```
.codi/skills/{name}/
  SKILL.md              # Skill definition (required)
  scripts/              # Executable scripts
  references/           # Reference documents
  assets/               # Static assets
  evals/                # Evaluation criteria
  agents/               # Skill-specific subagents
```

All subdirectories are always created (even if empty) to maintain a consistent structure. Tier 1 skill templates include pre-written `evals/evals.json` with 5-7 eval cases each — these override the empty stub during `codi init`.

### Frontmatter

```yaml
---
name: code-review
description: Comprehensive code review workflow
type: skill
category: Code Quality
compatibility: [claude-code, cursor]
user-invocable: true
managed_by: codi
---
```

### Fields

<!-- GENERATED:START:skill_fields -->
| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | Yes | — | Skill name (alphanumeric + hyphens) |
| `description` | string | Yes | — | One-line description |
| `version` | number | Yes | `1` |  |
| `type` | `"skill"` | Yes | `skill` | Always `skill` |
| `compatibility` | `claude-code` \| `cursor` \| `codex` \| `windsurf` \| `cline`[] | No | — | Compatible agent IDs |
| `tools` | string[] | No | — | Required MCP tools |
| `model` | string | No | — | Preferred AI model |
| `managed_by` | `codi` \| `user` | Yes | `user` | Who manages this artifact |
| `disableModelInvocation` | boolean | No | — | Prevent model from auto-invoking |
| `argumentHint` | string | No | — | Hint shown when invoking |
| `allowedTools` | string[] | No | — | Tools this skill can use |
| `category` | `Brand Identity` \| `Code Quality` \| `Content Creation` \| `Content Refinement` \| `Creative and Design` \| `Developer Tools` \| `Developer Workflow` \| `Document Generation` \| `File Format Tools` \| `Planning` \| `Productivity` \| `Testing` \| `Workflow` \| `Codi Platform` | No | — | Skill category for grouping |
| `license` | string | No | — | License identifier |
| `metadata` | Record<string, string> | No | — | Arbitrary key-value metadata |
| `effort` | `low` \| `medium` \| `high` \| `max` | No | — | Claude Code effort level |
| `context` | `"fork"` | No | — | Run in forked context |
| `agent` | string | No | — | Delegate to specific agent |
| `user-invocable` | boolean | No | — | Can be invoked via slash command |
| `paths` | string[] \| string | No | — | File paths the skill operates on |
| `shell` | `bash` \| `powershell` | No | — | Shell environment |
| `hooks` | Record<string, string> | No | — |  |
<!-- GENERATED:END:skill_fields -->

### Built-in Skill Templates

<!-- GENERATED:START:skill_templates -->
| Category | Skills |
|----------|--------|
| **Brand Identity** | codi-brand-creator, codi-codi-brand |
| **Code Quality** | codi-code-review, codi-dev-e2e-testing, codi-guided-qa-testing, codi-project-quality-guard, codi-refactoring, codi-security-scan, codi-session-recovery, codi-test-coverage, codi-webapp-testing |
| **Codi Platform** | codi-agent-creator, codi-artifact-contributor, codi-compare-preset, codi-dev-docs-manager, codi-dev-operations, codi-preset-creator, codi-refine-rules, codi-rule-creator, codi-rule-feedback, codi-skill-creator, codi-skill-feedback-reporter |
| **Content Creation** | codi-content-factory |
| **Content Refinement** | codi-humanizer |
| **Creative and Design** | codi-algorithmic-art, codi-canvas-design, codi-claude-artifacts-builder, codi-frontend-design, codi-slack-gif-creator, codi-theme-factory |
| **Developer Tools** | codi-box-validator, codi-claude-api, codi-codebase-explore, codi-codebase-onboarding, codi-commit, codi-diagnostics, codi-graph-sync, codi-html-live-inspect, codi-internal-comms, codi-mcp-ops, codi-mobile-development, codi-project-documentation |
| **Developer Workflow** | codi-audit-fix, codi-brainstorming, codi-branch-finish, codi-debugging, codi-evidence-gathering, codi-guided-execution, codi-plan-executor, codi-plan-writer, codi-step-documenter, codi-subagent-dev, codi-tdd, codi-verification, codi-worktrees |
| **Document Generation** | codi-doc-engine |
| **File Format Tools** | codi-docx, codi-pdf, codi-pptx, codi-xlsx |
| **Planning** | codi-roadmap |
| **Productivity** | codi-audio-transcriber, codi-notebooklm |
| **Testing** | codi-test-run |
| **Workflow** | codi-daily-log, codi-session-handoff |
<!-- GENERATED:END:skill_templates -->

### Progressive Loading — Agent-Native, Not Codi-Managed

Unlike other configuration tools that implement their own progressive loading (generating metadata stubs, lazy-fetching content, or tiered caching), **Codi does not manage progressive loading**. Instead, Codi generates **full-content skill files** and relies on each agent's own native loading mechanism.

**How it works:**

1. **Codi generates full SKILL.md files** in every agent's skill directory (`.claude/skills/`, `.cursor/skills/`, etc.) — always complete, never stubs
2. **The agent handles lazy loading at runtime** — Claude Code reads frontmatter (name + description) at session start and loads full skill content only when activated. Cursor follows the same ACS (Anthropic Claude Skills) pattern. This is the agent's built-in behavior, not something Codi controls.
3. **Codi's only role is to produce correct files** in the right format and location — the agent decides when and how to load them

This means progressive loading quality depends on the agent, not Codi. As agents improve their loading strategies, Codi skills automatically benefit without any configuration changes.

### Skill Inlining (`progressive_loading` flag)

The `progressive_loading` flag controls a separate concern: whether **single-file agents** (Windsurf, Cline) inline skill content directly in their main config file, or show a compact catalog table instead:

- **off** — Inline full skill content in `.windsurfrules` / `.clinerules` (larger file, all skills immediately visible)
- **metadata** — Show a skill catalog table in the main file; full content lives in separate skill files (smaller main file)

This flag has **no effect** on agents that use separate skill files (Claude Code, Cursor, Codex) — those always get full-content SKILL.md files regardless.

---

## Agents

Agents are subagent definitions that AI coding assistants can delegate to.

### Frontmatter

```yaml
---
name: code-reviewer
description: Expert code reviewer for PRs and changes
tools: [Read, Grep, Glob, Bash]
model: claude-sonnet-4-5-20250514
managed_by: codi
---
```

### Fields

<!-- GENERATED:START:agent_fields -->
| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | Yes | — | Agent name (strict alphanumeric + hyphens) |
| `description` | string | Yes | `` | Agent description |
| `version` | number | Yes | `1` |  |
| `tools` | string[] | No | — | Tools this agent can use |
| `disallowedTools` | string[] | No | — |  |
| `model` | string | No | — | AI model for this agent |
| `maxTurns` | number | No | — |  |
| `effort` | `low` \| `medium` \| `high` \| `max` | No | — |  |
| `managed_by` | `codi` \| `user` | Yes | `user` | Who manages this artifact |
| `permissionMode` | `unrestricted` \| `readonly` \| `limited` | No | — |  |
| `mcpServers` | string[] | No | — |  |
| `skills` | string[] | No | — |  |
| `memory` | `user` \| `project` \| `none` | No | — |  |
| `background` | boolean | No | — |  |
| `isolation` | string | No | — |  |
| `color` | string | No | — |  |
<!-- GENERATED:END:agent_fields -->

### Built-in Agent Templates

<!-- GENERATED:START:agent_templates -->
`codi-ai-engineering-expert`, `codi-api-designer`, `codi-code-reviewer`, `codi-codebase-explorer`, `codi-data-analytics-bi-expert`, `codi-data-engineering-expert`, `codi-data-intensive-architect`, `codi-data-science-specialist`, `codi-docs-lookup`, `codi-legal-compliance-eu`, `codi-marketing-seo-specialist`, `codi-mlops-engineer`, `codi-nextjs-researcher`, `codi-onboarding-guide`, `codi-openai-agents-specialist`, `codi-payload-cms-auditor`, `codi-performance-auditor`, `codi-python-expert`, `codi-refactorer`, `codi-scalability-expert`, `codi-security-analyzer`, `codi-test-generator`
<!-- GENERATED:END:agent_templates -->

---

## Brands

Brands define visual identity for generated outputs (presentations, documents, etc.).

### Fields

<!-- GENERATED:START:brand_fields -->
| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | Yes | — | Brand name (strict alphanumeric + hyphens) |
| `description` | string | Yes | `` | Brand description |
| `managed_by` | `codi` \| `user` | Yes | `user` | Who manages this artifact |
<!-- GENERATED:END:brand_fields -->

### Structure

```
.codi/brands/{name}/
  BRAND.md              # Brand definition
  assets/               # Logos, fonts, colors
```

---

## Ownership Model

All artifacts use a `managed_by` field that controls update behavior:

| Value | Meaning | `codi update` Behavior |
|-------|---------|----------------------|
| `managed_by: codi` | Created from a template | Updated to latest template version |
| `managed_by: user` | Custom content | Never overwritten |

### How ownership is set

- `codi add rule security --template security` creates with `managed_by: codi`
- `codi add rule my-custom-rule` (no template) creates with `managed_by: user`
- `codi update --rules` refreshes only `managed_by: codi` artifacts

---

## Creating Artifacts

### From a template

```bash
# Single template
codi add rule security --template security
codi add skill code-review --template code-review

# All templates at once
codi add rule --all
codi add skill --all
```

### Custom (no template)

```bash
codi add rule my-rule
codi add skill my-workflow
codi add agent my-agent
```

### Via the Command Center

Run `codi` (no subcommand) and select "Add artifact" for an interactive wizard.

---

## Template System

Built-in templates are defined as TypeScript modules in `src/templates/`. Each template exports a string containing the Markdown content with YAML frontmatter.

Templates are registered in `TEMPLATE_MAP` objects:
- Rules: `src/core/scaffolder/template-loader.ts`
- Skills: `src/core/scaffolder/skill-template-loader.ts`
- Agents: `src/core/scaffolder/agent-template-loader.ts`

The `{{name}}` placeholder in templates is replaced with the artifact name at creation time.
