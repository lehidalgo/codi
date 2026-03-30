# Agent: codi-code-reviewer

> Expert code reviewer for verifying test quality after generation.

## When to Delegate

- Generated tests need quality review before committing
- Test assertions need verification for correctness and coverage
- The user wants to validate that tests cover the actual behavior change

## How to Use

Defined at `.codi/agents/codi-code-reviewer.md`. Invoke via the Agent tool with `subagent_type` set to `codi-code-reviewer`.

## Key Capabilities

- Test quality verification (meaningful assertions, not just existence)
- Code quality and best practices checking
- Structured severity-ranked findings
