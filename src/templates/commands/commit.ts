export const template = `---
name: {{name}}
description: Create a well-structured git commit with conventional message format
managed_by: codi
---

Use the commit skill to create a well-structured git commit.

1. Review staged changes — verify no sensitive files, no debug code
2. Stage specific files (not git add -A)
3. Pre-commit hooks run automatically — fix any failures using proper solutions
4. Write a conventional commit message: type(scope): description
5. Do NOT use --no-verify — fix hook failures instead of bypassing them

## Documentation Updates
- For feat/fix commits: update CHANGELOG.md using Keep a Changelog format (Added, Changed, Fixed, Deprecated, Removed, Security)
- For features affecting user docs: update README.md (new CLI options, config changes, API changes)
- Do NOT add AI attribution or Co-Authored-By signatures to commits

## Pre-commit Hook Failures
- Use MCP servers and web search to find proper fixes
- Never use workarounds or performance/security-compromising solutions
- All hooks must pass successfully before committing
`;
