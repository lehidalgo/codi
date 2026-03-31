# Agent: codi-security-analyzer

> Security vulnerability analyzer for auth, payments, data handling, and audit scenarios.

## When to Delegate

- A scan step requires deep vulnerability analysis beyond pattern matching
- The user needs detailed OWASP categorization of findings
- Complex trust boundary analysis is needed

## How to Use

Defined at `.codi/agents/codi-security-analyzer.md`. Invoke via the Agent tool with `subagent_type` set to `codi-security-analyzer`.

## Key Capabilities

- Injection, auth, data exposure, and cryptography vulnerability detection
- Trust boundary mapping and attack surface analysis
- Structured findings with >80% confidence filtering
