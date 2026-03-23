# Migration

Adopt codi in projects that already use AI agents with manual config files.

## Steps

```bash
# 1. Initialize — codi auto-detects existing agent config files
codi init

# 2. Move your existing rules into .codi/rules/custom/ as Markdown files
# Each rule needs YAML frontmatter (name, description, priority)

# 3. Regenerate — now all agents get the same rules
codi generate

# 4. Verify the output matches your expectations
codi status
```

## Important Notes

Your existing `CLAUDE.md`, `.cursorrules`, etc. will be overwritten by codi's generated versions. **Back them up first** if needed.

### Rule Format

When moving existing rules into `.codi/rules/custom/`, each file must be a Markdown file with YAML frontmatter:

```markdown
---
name: my-rule
description: Brief description of what this rule covers
priority: high
alwaysApply: true
managed_by: user
---

# My Rule

- Your existing rule content goes here
- One rule per file
```

See [Writing Artifacts](writing-rules.md) for the complete frontmatter reference and authoring guide.

### What Happens During Init

- **Agent auto-detection**: codi checks for existing config files (`CLAUDE.md`, `.cursorrules`, etc.) in the project root
- **Stack auto-detection**: looks for `package.json` (Node), `pyproject.toml` (Python), `go.mod` (Go), `Cargo.toml` (Rust)
- **Interactive wizard**: walks you through selecting agents, rules, and a preset

### After Migration

Once migrated, use the standard daily workflow:

```bash
# Edit rules in .codi/rules/custom/
# Regenerate with: codi generate
# Check drift with: codi status
# Commit both .codi/ and generated files
```
