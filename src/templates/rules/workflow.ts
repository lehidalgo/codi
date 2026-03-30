import { PROJECT_NAME } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Human-in-the-loop workflow — baby steps, self-evaluation, MCP-first exploration, no unsolicited commits
priority: high
alwaysApply: true
managed_by: ${PROJECT_NAME}
---

# Workflow

## Human-in-the-Loop Execution
1. **Understand > Search > Propose > Execute**: Understand the user's intent, search the codebase, propose a solution, and execute ONLY after user confirmation
2. **Baby Steps**: Break down all tasks into atomic steps. Propose ONE step at a time and wait for feedback before continuing
3. **Never Assume**: Ask clarifying questions if anything is ambiguous
4. **Pause Before Executing**: Always pause for human feedback before executing any significant action
5. **No Commits Without Approval**: Never commit or deploy code without human approval and all errors fixed

## No AI Signatures
- Never sign commits with AI attribution
- Do NOT add Co-Authored-By lines or generated-by footers to commit messages

## Self-Evaluation Before Action
Before proceeding with any solution, self-evaluate for:
- **Security**: Does this introduce vulnerabilities?
- **Performance**: Will this cause bottlenecks or latency issues?
- **Scalability**: Will this work at 10x, 100x scale?
- **Cost**: Does this optimize for resource efficiency?

Only continue with solutions that do NOT compromise any of these factors.

## MCP Usage Strategy
When MCP servers are available, use them PROACTIVELY before making decisions.

### Mandatory Ordering
1. **Code Graph FIRST**: Before using ANY other exploration tool (Glob, Grep, Read, Bash), query the code graph to understand structure, callers, and dependencies
2. **Search Documentation**: Search indexed docs for best practices, known issues, and API patterns
3. **Sequential Thinking**: Use structured step-by-step reasoning for complex problems, debugging, and architectural decisions
4. **Memory**: Store important findings for persistence across sessions
5. **Other MCPs**: Use specialized tools as needed

### When to Query Code Graph
- To understand how functions/classes relate to each other
- To find all callers of a function before modifying it
- To trace dependencies and imports
- To understand impact before refactoring

### When to Search Documentation
- Before implementing any feature
- When encountering errors
- When unsure about API usage, patterns, or conventions
- Before proposing architectural decisions

## Decision-Making Checklist
Before any change, verify:
- Queried code graph? (if available)
- Searched documentation? (if available)
- Security reviewed?
- Performance checked?
- Scalability assessed?
- Cost evaluated?
- User approved?`;
