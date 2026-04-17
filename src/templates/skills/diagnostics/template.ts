import { PROJECT_NAME, SUPPORTED_PLATFORMS_YAML, SKILL_CATEGORY } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  MCP-powered diagnosis for escalated errors. Use when standard debugging has
  not resolved the issue, when multiple fix attempts have failed, or when a
  structured MCP-based investigation is needed. Also activate for phrases like
  "stuck on this error", "multiple attempts failed", "deep diagnosis", "MCP
  investigation", "structured analysis", "sequential thinking", "escalate
  debugging", "call graph analysis before fix". Combines code-graph queries,
  documentation search, and sequential thinking with a strict
  reasoning-confirmation-execution loop. Do NOT activate as a first-line
  debugging tool — start with ${PROJECT_NAME}-debugging; only escalate to
  diagnostics when that workflow has not resolved the issue. Also skip for
  writing new code or planning features.
category: ${SKILL_CATEGORY.DEVELOPER_TOOLS}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 5
---

# {{name}} — Diagnostics

## When to Activate

- User hits an error and needs structured diagnosis after standard debugging failed
- User has tried 2+ fixes and the problem persists
- User needs root cause analysis via MCP-backed tools (code graph, docs, sequential thinking)
- User asks for a "deep diagnosis" or "structured investigation"

## Skip When

- First-line bug investigation — use ${PROJECT_NAME}-debugging (diagnostics is escalation only)
- Writing new code or features — use ${PROJECT_NAME}-plan-writer
- Planning architecture — use ${PROJECT_NAME}-brainstorming
- Running tests without a known failure to diagnose — use ${PROJECT_NAME}-test-run

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
