# 4. Artifacts

**Spec Version**: 1.0

## Overview

Codi manages four artifact types: **rules**, **skills**, **agents**, and **commands**. All artifacts are Markdown files with YAML frontmatter. Each follows the same ownership and lifecycle model.

## Artifact Types

| Type | Source Location | Purpose |
|------|----------------|---------|
| Rules | `.codi/rules/custom/*.md` | Instructions agents MUST follow (e.g., "never expose secrets") |
| Skills | `.codi/skills/*.md` | Reusable workflows agents can invoke (e.g., "code review checklist") |
| Agents | `.codi/agents/*.md` | Subagent definitions with specialized roles |
| Commands | `.codi/commands/*.md` | Slash commands (currently Claude Code only) |

## Frontmatter Format

### Rule

```yaml
---
name: security
description: Security best practices
managed_by: user          # "codi" or "user"
priority: high            # "high", "medium", "low"
alwaysApply: true         # Include in every generation
scope: []                 # Optional file pattern filters
language: typescript      # Optional language filter
---
[Rule content in Markdown]
```

### Skill

```yaml
---
name: code-review
description: Structured code review process
managed_by: user
compatibility: [claude-code, cursor]
tools: [Read, Grep, Bash]
---
[Skill content in Markdown]
```

### Agent

```yaml
---
name: security-analyzer
description: Analyzes code for security vulnerabilities
managed_by: user
tools: [Read, Grep, Bash]
model: claude-sonnet-4-20250514
---
[Agent instructions in Markdown]
```

### Command

```yaml
---
name: review
description: Review recent code changes
managed_by: user
---
[Command instructions in Markdown]
```

## Ownership Model

The `managed_by` field controls update behavior:

| Value | Created By | Updated By `codi update` | Overwritten? |
|-------|-----------|--------------------------|--------------|
| `codi` | `codi add --template <T>` | Yes | Yes, replaced with latest template |
| `user` | `codi add <name>` (no template) | No | Never |

## Output Mapping

Each adapter places artifacts differently:

| Artifact | Claude Code | Cursor | Codex | Windsurf | Cline |
|----------|-------------|--------|-------|----------|-------|
| Rules | `.claude/rules/*.md` | `.cursor/rules/*.mdc` | Inline in `AGENTS.md` | Inline in `.windsurfrules` | Inline in `.clinerules` |
| Skills | `.claude/skills/*/SKILL.md` | `.cursor/skills/*/SKILL.md` | `.agents/skills/*/SKILL.md` | `.windsurf/skills/*/SKILL.md` | `.cline/skills/*/SKILL.md` |
| Agents | `.claude/agents/*.md` | -- | `.codex/agents/*.toml` | -- | -- |
| Commands | `.claude/commands/*.md` | -- | -- | -- | -- |

## Size Constraints

Individual artifacts SHOULD stay under 6,000 characters. Total combined content MUST stay under 12,000 characters (Windsurf limit). Use `codi doctor` to validate.

## Related

- [Chapter 2: Layout](02-layout.md) for source file locations
- [Chapter 5: Generation](05-generation.md) for how artifacts are transformed
- [Chapter 3: Manifest](03-manifest.md) for `layers` that control artifact inclusion
