# Agent: codi-performance-auditor

> Performance analysis agent for detecting bottlenecks, anti-patterns, and optimization opportunities.

## When to Delegate

- Code review reveals potential N+1 queries, unbounded results, or missing pagination
- Changes affect hot paths, database queries, or API response times
- The user asks for performance-focused analysis during review

## How to Use

Defined at `.codi/agents/codi-performance-auditor.md`. Invoke via the Agent tool with `subagent_type` set to `codi-performance-auditor`.

## Key Capabilities

- Database query analysis (N+1, missing indexes, unbounded queries)
- Bundle size and rendering performance checks
- Memory leak detection and resource cleanup verification
