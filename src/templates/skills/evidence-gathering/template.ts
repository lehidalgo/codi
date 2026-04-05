import { PROJECT_NAME, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Structured investigation before proposing changes. Use when you need to gather
  concrete evidence about actual vs intended behavior before suggesting a fix,
  evaluating an audit item, or validating a step. Called by guided-execution and
  audit-fix, but also usable standalone for any "investigate X before we change it" task.
category: Developer Workflow
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
version: 4
---

# {{name}}

## When to Activate

- Before proposing any fix, change, or solution
- When asked to investigate a problem, behavior, or codebase area
- When another skill (${PROJECT_NAME}-audit-fix, ${PROJECT_NAME}-guided-execution) requires investigation
- When you are uncertain about actual behavior — not assumed behavior
- Standalone: "Investigate X before we change it"

Do NOT activate when you already have direct, fresh evidence from this session.

## The Iron Law

> **No conclusions without evidence. No evidence without tool usage. No tool usage without a question to answer.**

No assumptions. No memory. No "this should work because...". Tool output only.

## The Investigation Protocol

Follow these 5 steps in order. Do not skip steps.

### Step 1: FRAME

Write down explicitly:
- What are you investigating?
- What specific question are you trying to answer?
- What would a definitive answer look like?

If you cannot state the question clearly, do not proceed. Clarify with the user first.

### Step 2: SEARCH

Use tools in this priority order. Stop when you have sufficient evidence — do not over-search.

1. **graph-code MCP** (if available) — understand structure, relationships, dependencies, call graphs
2. **Grep / Glob** — find specific patterns, file locations, symbol usages across the codebase
3. **Read** — examine actual content of identified files, functions, configs
4. **Tests** — run existing tests to observe actual behavior; read test assertions as specifications
5. **Web research** — only for external dependencies, third-party APIs, or published standards

For each tool use, state the question it answers before running it.

### Step 3: COLLECT

Build an evidence table from your findings:

| Finding | Source (tool + command) | Location (file:line) | Confidence |
|---------|------------------------|---------------------|------------|
| Describe what you found | Which tool, exact query | File path and line number | High / Medium / Low |

Add one row per distinct finding. If a finding cannot be sourced to a tool output, it does not belong in the table.

### Step 4: ANALYZE

Review the evidence table and separate:

- **Confirmed facts** — directly proven by tool output (High confidence)
- **Inferences** — reasonable deductions from confirmed facts (Medium confidence, label clearly)
- **Assumptions** — not yet verified, requires more evidence (Low confidence, flag these)

Compare actual behavior (what you found) vs intended behavior (what the code should do). State the gap explicitly.

If assumptions remain after reasonable investigation, surface them rather than guessing.

### Step 5: REPORT

Present your findings in this structure:

**Question investigated:** [The question from Step 1]

**Evidence collected:** [The table from Step 3]

**Analysis:**
- Confirmed: [list facts]
- Inferred: [list deductions, labeled as inferences]
- Unverified: [list remaining assumptions]

**Conclusion:** [Answer to the question, with confidence level]

**Open questions:** [What couldn't be determined and what tool/action would resolve it]

## What Counts as Evidence

**Valid evidence:**
- Tool output from this session (grep results, file content, test output, MCP responses)
- Test results showing actual pass/fail behavior
- File content confirming actual implementation
- Git history showing when/why something changed
- Documentation confirming intended behavior

**Not valid evidence:**
- Memory from previous sessions or conversations
- "I assume it works because..."
- Code that looks correct without running it
- Positive claims from earlier in this session without re-verification

## Red Flags

These thoughts mean STOP — you are about to skip evidence gathering:

| Thought | Reality |
|---------|---------|
| "I remember this area, it works like..." | Memory is not evidence. Run the tools. |
| "The code looks correct, so..." | Looking ≠ running. Execute to verify. |
| "This is probably caused by..." | Inference before investigation. Frame first. |
| "I can see what the issue is" | State it as a hypothesis. Then prove it. |
| "Let me just propose the fix" | No fix proposal without Step 5 complete. |

## Integration

- Use in \`${PROJECT_NAME}-audit-fix\` Phase 2 before evaluating each item.
- Use in \`${PROJECT_NAME}-guided-execution\` Step 4 before validating each step.
- Feeds into \`${PROJECT_NAME}-verification\` — evidence gathered here is the input to the verification gate.
- Use in \`${PROJECT_NAME}-debugging\` Phase 1 (Observe) for structured evidence collection.
`;
