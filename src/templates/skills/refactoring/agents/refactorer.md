# Agent: codi-refactorer

> Code cleanup agent for removing dead code, consolidating duplicates, and simplifying without changing behavior.

## When to Delegate

- Detected dead code needs safe removal with test verification
- Duplicate functions or redundant abstractions need consolidation
- The user asks for deeper refactoring analysis

## How to Use

Defined at `.codi/agents/codi-refactorer.md`. Invoke via the Agent tool with `subagent_type` set to `codi-refactorer`.

## Key Capabilities

- Dead code detection across multiple languages
- Safe deletion with test verification after each change
- Duplicate consolidation and complexity reduction
