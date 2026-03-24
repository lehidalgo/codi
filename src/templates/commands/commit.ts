export const template = `---
name: {{name}}
description: Create a well-structured git commit with conventional message format
managed_by: codi
---

Use the commit skill to create a well-structured git commit.

1. Review staged changes — verify no sensitive files, no debug code
2. Stage specific files (not git add -A)
3. Pre-commit hooks run automatically — fix any failures
4. Write a conventional commit message: type(scope): description
5. Do NOT use --no-verify — fix hook failures instead
`;
