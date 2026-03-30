# Agent: codi-code-reviewer

> Expert code reviewer for quality and security auditing.

## When to Delegate

- Security findings need broader code quality context
- The user wants a combined security + quality review
- Post-scan remediation needs code review verification

## How to Use

Defined at `.codi/agents/codi-code-reviewer.md`. Invoke via the Agent tool with `subagent_type` set to `codi-code-reviewer`.

## Key Capabilities

- Confidence-based filtering (>80% threshold)
- Security, quality, performance, accessibility checklists
- Structured output with severity levels
