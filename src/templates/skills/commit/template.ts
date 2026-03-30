import {
  GIT_COMMIT_FIRST_LINE_LIMIT,
  PROJECT_CLI,
  PROJECT_NAME,
} from "#src/constants.js";

export const template = `---
name: {{name}}
description: Git commit workflow with conventional commits, pre-commit checks, and staged change review. Use when committing code changes.
category: Developer Tools
compatibility: [claude-code, cursor, codex]
managed_by: ${PROJECT_NAME}
---

# {{name}}

## When to Use

Use when asked to commit, or after completing a feature/fix/refactor.

## When to Activate

- User asks to commit staged or unstaged changes to git
- User has completed a feature, bug fix, or refactor and needs to commit
- User needs help writing a conventional commit message
- Pre-commit hooks fail and the user needs troubleshooting guidance

## Commit Workflow

### Step 1: Review Changes

**[CODING AGENT]** Run \\\`git status\\\` and \\\`git diff --staged\\\` to review what will be committed.

Check for:
- No sensitive files staged (.env, credentials, keys, tokens)
- No generated files committed without their source changes
- No unrelated changes mixed in (keep commits atomic — one logical change per commit)
- No debug code (console.log, print statements, debugger)

If nothing is staged, stage the relevant files:
\\\`\\\`\\\`bash
git add <specific-files>
\\\`\\\`\\\`
Prefer adding specific files over \\\`git add -A\\\` to avoid accidentally staging unwanted files.

### Step 2: Pre-Commit Checks

**[SYSTEM]** The pre-commit hooks run automatically on commit. They include:
- **Formatting**: prettier, ruff, gofmt, etc. (auto-fixes staged files)
- **Linting**: eslint, clippy, phpstan, etc. (catches code issues)
- **Type checking**: tsc, pyright, mypy (catches type errors)
- **Secret scanning**: detects hardcoded API keys, tokens, passwords
- **File size**: ensures files don't exceed the configured line limit
- **Tests**: runs test suite if \\\`test_before_commit\\\` is enabled

If any check fails: fix the issue, re-stage, and commit again. Do NOT use \\\`--no-verify\\\`.

### Step 3: Write Commit Message

**[CODING AGENT]** Use conventional commits format:

**Types:**
| Type | When to Use |
|------|-------------|
| \\\`feat\\\` | New feature or functionality |
| \\\`fix\\\` | Bug fix |
| \\\`docs\\\` | Documentation only |
| \\\`refactor\\\` | Code restructuring (no behavior change) |
| \\\`test\\\` | Adding or updating tests |
| \\\`chore\\\` | Maintenance, deps, config |
| \\\`perf\\\` | Performance improvement |
| \\\`ci\\\` | CI/CD pipeline changes |

**Format:**
\\\`\\\`\\\`
type(scope): short description in imperative mood

Optional body explaining WHY (not what — the diff shows what).
Wrap at ${GIT_COMMIT_FIRST_LINE_LIMIT} characters per line.

Footer: Fixes #123, Closes #456
\\\`\\\`\\\`

**Rules:**
- First line ≤${GIT_COMMIT_FIRST_LINE_LIMIT} characters
- Imperative mood: "add feature" not "added feature"
- Scope is optional but helpful: \\\`feat(auth):\\\`, \\\`fix(api):\\\`
- Body explains motivation and context, not implementation details
- Reference issues in footer when applicable

### Step 4: Commit

**[SYSTEM]**
\\\`\\\`\\\`bash
git commit -m "type(scope): description"
\\\`\\\`\\\`

- Do NOT use \\\`--no-verify\\\` — hooks exist to protect code quality
- If hooks fail, fix the issues and retry
- Do NOT use workarounds to bypass failing checks

### Step 5: Verify

**[SYSTEM]** \\\`git log --oneline -1\\\` to confirm the commit was created.

If the commit message doesn't follow conventional format, the commit-msg hook will reject it. Fix the message and retry.

## Troubleshooting

### Hook tool not found
If pre-commit fails with "command not found":

**[SYSTEM]** Run \\\`${PROJECT_CLI} doctor\\\` to check hook status.

**[SYSTEM]** Install missing tools for your language:
- TypeScript/JS: \\\`npm install -D eslint prettier typescript\\\`
- Python: \\\`pip install ruff pyright\\\`
- Go: \\\`go install github.com/golangci-lint/golangci-lint/cmd/golangci-lint@latest\\\`
- Rust: \\\`rustup component add clippy rustfmt\\\`
- Java: \\\`brew install google-java-format checkstyle\\\`
- Kotlin: \\\`brew install ktfmt detekt\\\`
- Swift: \\\`brew install swiftformat swiftlint\\\`

### Hooks not installed
If no pre-commit hooks run at all:

**[SYSTEM]** Reinstall hooks: \\\`${PROJECT_CLI} generate\\\`

This re-detects the hook runner (Husky, pre-commit framework, or standalone) and installs hooks for the project's detected languages.

### Commit message rejected
If the commit-msg hook rejects your message:
- Verify format: \\\`type(scope): description\\\`
- Valid types: feat, fix, docs, refactor, test, chore, perf, ci
- First line must be ≤${GIT_COMMIT_FIRST_LINE_LIMIT} characters
- Use imperative mood: "add" not "added"

## Available Agents

For pre-commit review, delegate to these agents (see \\\`agents/\\\` directory):
- **codi-code-reviewer** — Review staged changes before committing

## Related Skills

- **codi-code-review** — Full code review workflow for complex changes
- **codi-test-coverage** — Verify test coverage before committing
`;
