import { PROJECT_NAME } from "../../constants.js";

export const template = `---
name: {{name}}
description: Diagnose errors and problems using MCP servers and structured reasoning
managed_by: ${PROJECT_NAME}
---

Follow this workflow every time you hit an error or problem:

## 1. Gather Context Using MCP Servers

### Documentation
Search indexed knowledge base for known issues, best practices, and similar error patterns.

### Codebase Analysis
Query the code graph to understand the call chain leading to the error, find related functions, and trace dependencies.

### Web Search (last resort)
Only if indexed sources return no relevant results. Search for specific error messages and recent issues.

## 2. Structured Problem Solving
Use sequential thinking for complex problems — break the analysis into numbered steps, evaluate each systematically.

## 3. Reasoning-Confirmation-Execution Loop
For every action, no matter how small:
1. **Think deeply** about the implications
2. **Reason** through the decision using gathered context
3. **Explain** your thinking with references to findings
4. **Ask for confirmation** before taking any step
5. **Only proceed once explicitly confirmed**

## 4. Solution Validation
Before implementing any fix:
- Verify it aligns with documented best practices
- Check for potential side effects on callers and dependents
- Ensure no security or performance compromises
`;
