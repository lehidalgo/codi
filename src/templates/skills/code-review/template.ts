import {
  PROJECT_DIR,
  PROJECT_NAME,
  SUPPORTED_PLATFORMS_YAML,
  SKILL_CATEGORY,
} from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Structured code review workflow. Use when reviewing a pull request,
  examining code changes, auditing code quality, or producing severity-ranked
  findings against project rules. Also activate for phrases like "review my
  code", "review my PR", "PR review", "check my changes", "audit this file",
  "look at this diff", "feedback on implementation", "pre-merge review",
  "review before I merge". Produces findings with file path, line number,
  severity (Critical / Warning / Suggestion), and suggested fixes. Do NOT
  activate for fixing bugs the user identifies (use ${PROJECT_NAME}-debugging),
  writing new code (use a content/plan/subagent skill), running a full
  security scan (use ${PROJECT_NAME}-security-scan), or measuring test
  coverage (use ${PROJECT_NAME}-test-suite).
category: ${SKILL_CATEGORY.CODE_QUALITY}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 10
---

# {{name}} — Code Review

## When to Activate

- User asks to review a pull request or specific code changes
- User wants a code quality audit on a file, module, or entire codebase
- User asks to check code against project rules before merging
- User requests feedback on their implementation or architecture decisions
- User invokes the /codi-code-review slash command directly

## Skip When

- User wants the bug fixed, not reviewed — use ${PROJECT_NAME}-debugging
- User wants new code written — use ${PROJECT_NAME}-plan-writer or ${PROJECT_NAME}-plan-execution
- User needs a dedicated security audit — use ${PROJECT_NAME}-security-scan
- User needs coverage measurement — use ${PROJECT_NAME}-test-suite
- User wants refactoring suggestions without finding bugs — use ${PROJECT_NAME}-refactoring

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

For specialized analysis, delegate to these agents:
- **${PROJECT_NAME}-code-reviewer** — Severity-ranked review with confidence filtering. Prompt at \\\`\${CLAUDE_SKILL_DIR}[[/agents/code-reviewer.md]]\\\`
- **${PROJECT_NAME}-security-analyzer** — Deep OWASP vulnerability analysis. Prompt at \\\`\${CLAUDE_SKILL_DIR}[[/agents/security-analyzer.md]]\\\`
- **${PROJECT_NAME}-performance-auditor** — Performance anti-pattern detection. Prompt at \\\`\${CLAUDE_SKILL_DIR}[[/agents/performance-auditor.md]]\\\`

## Requesting a Review

Code reviews are not optional. Request a review after each implementation task completes (in ${PROJECT_NAME}-plan-execution workflow), after completing a major feature, and always before merging to main.

**When to request:**
- After ${PROJECT_NAME}-plan-execution completes all tasks — dispatch a full-changeset review
- After completing a significant feature or bug fix
- Before invoking ${PROJECT_NAME}-branch-finish

**What to provide to the reviewer:**
- Starting commit SHA: \\\`git log --oneline | tail -1 | awk '{print $1}'\\\`
- Current commit SHA: \\\`git rev-parse HEAD\\\`
- Implementation summary: what was built and why
- Reference to the design spec (docs/ path)
- Specific areas of concern if any

**Acting on feedback:**
- CRITICAL/HIGH: fix immediately, do not proceed to ${PROJECT_NAME}-branch-finish
- MEDIUM: fix before merge; document in PR if deferring
- LOW: note in PR description; fix if trivial

## Receiving a Code Review

**The one rule: verify before implementing.**

Read each piece of feedback and check it against the actual code before doing anything. Reviewers can be wrong. The test is technical correctness for this specific codebase, not whether the reviewer sounds authoritative.

**What not to say:**
- "You're absolutely right!" (performative, means nothing)
- "Great point!" (sycophantic, skips verification)
- "I'll fix that right away!" (before checking if the fix is actually correct)

**What to say instead:**
- State what you verified: "Checked — the function at line 42 does lack error handling. Fixed."
- Ask for specifics if unclear: "Can you clarify which edge case you mean? I see X but not Y."
- Push back with evidence when the reviewer is wrong: "This pattern is intentional — see the design spec section 3. Changing it would break [X]."

**When to push back:**
- The suggested change breaks existing functionality
- The reviewer lacks context about a deliberate design decision
- The change violates YAGNI (adds scope not in the spec)
- The suggestion contradicts the ${PROJECT_NAME}-architecture or ${PROJECT_NAME}-testing rules
- The reviewer is correct about a style preference but wrong about it being a bug

**Acknowledging valid feedback tersely:**
"Fixed" or "Good catch on [issue]. Fixed at [location]." Let the corrected code demonstrate understanding — no extended apology or praise needed.

## Related Skills

- **${PROJECT_NAME}-security-scan** — Dedicated security audits beyond code review scope
- **${PROJECT_NAME}-test-suite** — Verify test coverage for reviewed changes
- **${PROJECT_NAME}-brainstorming** — Design before the code being reviewed was written
- **${PROJECT_NAME}-plan-execution** — Requests reviews after each task via this skill
- **${PROJECT_NAME}-branch-finish** — Runs a final review before merge options
`;
