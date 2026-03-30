import { PROJECT_DIR, PROJECT_NAME } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Structured code review workflow. Use when reviewing PRs, examining code changes, or auditing code quality. Analyzes changes against project rules and produces severity-ranked findings.
category: Code Quality
compatibility: [claude-code, cursor, codex]
managed_by: ${PROJECT_NAME}
intentHints:
  taskType: Code Review
  examples:
    - "Review my PR"
    - "Check code quality"
    - "Audit recent changes"
---

# {{name}}

## When to Use

Use when asked to review code, examine a PR, or audit code quality.

## When to Activate

- User asks to review a pull request or specific code changes
- User wants a code quality audit on a file, module, or entire codebase
- User asks to check code against project rules before merging
- User requests feedback on their implementation or architecture decisions

## Review Process

### Step 1: Identify Changes

**[CODING AGENT]** Run \\\`git diff\\\` (or \\\`git diff --staged\\\`) to identify all changed files. If reviewing a PR, use \\\`git diff main...HEAD\\\`.

List each changed file with the type of change (added, modified, deleted).

### Step 2: Read Context

**[CODING AGENT]** For each changed file:
- Read the full file (not just the diff) to understand context
- Read imported modules and interfaces referenced by the changes
- Check if tests exist for the changed code

### Step 3: Analyze Against Rules

**[CODING AGENT]** Check each change against the project's rules in \`${PROJECT_DIR}/rules/\`:
- **Security**: secrets exposure, input validation, injection risks
- **Error handling**: unhandled errors, missing cleanup, silent failures
- **Testing**: new code without tests, changed behavior without updated tests
- **Architecture**: circular dependencies, wrong abstraction level, file size
- **Performance**: N+1 queries, unnecessary re-renders, missing pagination
- **Code style**: naming, function length, commented-out code

### Step 4: Check Correctness

**[CODING AGENT]** Beyond rules, verify:
- Logic errors: off-by-one, null handling, edge cases
- API contract: does the implementation match the interface?
- Concurrency: race conditions, shared mutable state
- Backward compatibility: breaking changes to public APIs
- Test quality: do tests cover the actual behavior change, not just exist? Are assertions meaningful?
- Accessibility: do UI changes maintain keyboard navigation, ARIA labels, and semantic HTML?

### Step 5: Format Findings

**[CODING AGENT]** Organize findings by severity:

**Critical** — Must fix before merge:
- Security vulnerabilities
- Data loss or corruption risks
- Logic errors that cause incorrect behavior

**Warning** — Should fix, creates risk:
- Missing error handling
- Missing tests for new behavior
- Performance concerns under load

**Suggestion** — Optional improvement:
- Naming clarity
- Code structure or readability
- Simplification opportunities

For each finding include:
- File path and line number
- What the issue is
- Why it matters
- Suggested fix (code snippet when helpful)

### Step 6: Summary

**[CODING AGENT]** End with:
- Total findings count by severity
- Overall assessment: approve, request changes, or needs discussion
- Files that need the most attention

## Available Agents

For specialized analysis, delegate to these agents (see \\\`agents/\\\` directory):
- **codi-code-reviewer** — Severity-ranked review with confidence filtering
- **codi-security-analyzer** — Deep OWASP vulnerability analysis
- **codi-performance-auditor** — Performance anti-pattern detection

## Related Skills

- **codi-security-scan** — Dedicated security audits beyond code review scope
- **codi-test-coverage** — Verify test coverage for reviewed changes
`;
