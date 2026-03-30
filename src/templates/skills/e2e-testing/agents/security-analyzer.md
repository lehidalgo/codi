# Agent: codi-security-analyzer

> Security analyzer for validating security aspects during e2e testing.

## When to Delegate

- E2E validation reveals potential security concerns
- Auth flows, payment paths, or data handling need security verification
- The user wants security-focused e2e validation

## How to Use

Defined at `.codi/agents/codi-security-analyzer.md`. Invoke via the Agent tool with `subagent_type` set to `codi-security-analyzer`.

## Key Capabilities

- OWASP vulnerability detection
- Auth and access control verification
- Structured security findings with severity levels
