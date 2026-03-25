export const template = `---
name: {{name}}
description: Error handling and resilience patterns
priority: high
alwaysApply: true
managed_by: codi
---

# Error Handling

## Core Principles
- Never silently swallow errors — every error must be handled or propagated

BAD: \`catch (e) { /* ignore */ }\`
GOOD: \`catch (e) { logger.error("payment failed", { orderId, error: e }); throw; }\`

- Use typed errors with error codes for programmatic handling — callers can branch on error type
- Return Result types for recoverable operations
- Throw/raise only for programmer errors (bugs), not expected failures — expected failures are control flow, not exceptions

## Error Messages
- Write actionable error messages: what happened, why, and how to fix it

BAD: \`"Error occurred"\`
GOOD: \`"Failed to connect to database at localhost:5432 — check DB_HOST and ensure PostgreSQL is running"\`

- Include relevant context: operation, input, expected vs actual
- Never expose internal details (stack traces, SQL) to end users — attackers use these to find vulnerabilities
- Log full details server-side, return sanitized messages to clients

## Logging
- Log errors with structured context (who, what, where, when) — enables filtering and alerting in log aggregation tools
- Use appropriate severity levels: debug, info, warn, error, fatal
- Include correlation IDs for request tracing — essential for debugging in distributed systems
- Do not log sensitive data (passwords, tokens, PII)

## Resilience
- Implement timeouts for all external calls — prevents a single slow service from blocking the entire system
- Use retries with exponential backoff for transient failures
- Provide fallback behavior where appropriate
- Fail fast on configuration errors at startup, not at runtime — surfaces problems before they reach users

## Cleanup
- Always release resources in finally blocks or equivalent
- Close database connections, file handles, and network sockets — leaked connections exhaust pools and cause outages
- Roll back partial operations on failure
- Leave the system in a consistent state after errors`;
