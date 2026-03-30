# Agent: codi-security-analyzer

> Security vulnerability analyzer for auth, payments, data handling, and audit scenarios.

## When to Delegate

- Code review reveals potential security concerns requiring deep OWASP analysis
- Changes touch authentication, authorization, or data access layers
- The user asks for dedicated security analysis during review

## How to Use

Defined at `.codi/agents/codi-security-analyzer.md`. Invoke via the Agent tool with `subagent_type` set to `codi-security-analyzer`.

## Key Capabilities

- Injection, auth, data exposure, and cryptography vulnerability detection
- Trust boundary mapping and attack surface analysis
- Structured findings with >80% confidence filtering
