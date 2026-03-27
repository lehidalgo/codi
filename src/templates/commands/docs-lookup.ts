export const template = `---
name: {{name}}
description: Research documentation and references using multi-source search
managed_by: codi
---

Research documentation and references using a prioritized multi-source search strategy.

## Search Priority Order
1. **Documentation MCP (FIRST)**: Search indexed knowledge base for best practices, known issues, and patterns
2. **Code Graph MCP (FOR CODE CONTEXT)**: Query the codebase graph for function relationships, callers, and dependencies
3. **Web Search (LAST RESORT)**: Only when indexed sources are insufficient — search official docs, Stack Overflow, GitHub issues

## Search Strategy
- Start with the highest-priority source
- Iterate with refined queries if the first search is unsuccessful
- Combine findings from multiple sources before proposing solutions
- Verify current API signatures and check for deprecations
- Report findings with working code examples and links to documentation
`;
