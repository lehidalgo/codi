# Agent: codi-code-reviewer

> Expert code reviewer. Use when reviewing PRs, examining code changes, or auditing code quality and security.

## When to Delegate

- The workflow requires deep severity-ranked review with confidence filtering
- Multiple files need parallel review analysis
- The user asks for a formal code review beyond this skill's scope

## How to Use

Defined at `.codi/agents/codi-code-reviewer.md`. Invoke via the Agent tool with `subagent_type` set to `codi-code-reviewer`.

## Key Capabilities

- Confidence-based filtering (>80% threshold)
- Severity matrix: CRITICAL / HIGH / MEDIUM / LOW
- Approval criteria: approve / warning / block
