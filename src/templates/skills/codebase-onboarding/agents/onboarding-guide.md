# Agent: codi-onboarding-guide

> Codebase onboarding agent that produces concise guides for new developers joining a project.

## When to Delegate

- The onboarding workflow needs a deep-dive analysis of an unfamiliar codebase
- The user wants a comprehensive onboarding guide generated autonomously
- Multiple codebases need parallel onboarding analysis

## How to Use

Defined at `.codi/agents/codi-onboarding-guide.md`. Invoke via the Agent tool with `subagent_type` set to `codi-onboarding-guide`.

## Key Capabilities

- Systematic project analysis (manifest, entry points, architecture)
- Convention detection from existing code patterns
- Concise guide output (under 100 lines)
