import { PROJECT_NAME, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: MCP-powered diagnosis for escalated errors. Use when standard debugging has not resolved the issue, or when structured MCP analysis is needed. Not the first-line debugging tool — start with codi-debugging.
category: Developer Tools
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
version: 1
---

# {{name}}

## When to Activate

- User hits an error and needs structured diagnosis
- User asks to debug or investigate a problem
- User needs root cause analysis before attempting a fix

## Workflow

### Step 1: Gather Context Using MCP Servers

**[SYSTEM]** Search multiple sources before reasoning:

**Documentation** — search the indexed knowledge base for known issues, best practices, and similar error patterns.

**Codebase Analysis** — query the code graph to understand the call chain leading to the error, find related functions, and trace dependencies.

**Web Search (last resort)** — only if indexed sources return no relevant results. Search for specific error messages and recent issues.

### Step 2: Structured Problem Solving

**[CODING AGENT]** Use sequential thinking for complex problems — break the analysis into numbered steps, evaluate each systematically.

### Step 3: Reasoning-Confirmation-Execution Loop

**[CODING AGENT]** For every action, no matter how small:
1. **Think deeply** about the implications
2. **Reason** through the decision using gathered context
3. **Explain** your thinking with references to findings
4. **Ask for confirmation** before taking any step
5. **Only proceed once explicitly confirmed**

### Step 4: Solution Validation

**[CODING AGENT]** Before implementing any fix:
- Verify it aligns with documented best practices
- Check for potential side effects on callers and dependents
- Ensure no security or performance compromises
`;
