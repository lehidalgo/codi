# Agent: codi-code-reviewer

> Expert code reviewer for pre-commit review of staged changes.

## When to Delegate

- Staged changes need quality review before committing
- The user wants a quick review of what is about to be committed
- Complex changes across multiple files need structured review

## How to Use

Defined at `.codi/agents/codi-code-reviewer.md`. Invoke via the Agent tool with `subagent_type` set to `codi-code-reviewer`.

## Key Capabilities

- Confidence-based filtering (>80% threshold)
- Security, quality, performance, accessibility checklists
- Approval criteria: approve / warning / block
