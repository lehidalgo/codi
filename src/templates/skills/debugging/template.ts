import { PROJECT_NAME, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: First-line debugging with root cause analysis. Use when investigating bugs, test failures, unexpected behavior, or build failures. Enforces root cause before any fix. Also activate on /${PROJECT_NAME}-check or when stuck on an error.
category: Developer Workflow
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 7
---

# {{name}}

## When to Activate

Use for ANY technical issue:
- Test failures
- Bugs in production or development
- Unexpected behavior
- Performance problems
- Build failures
- Integration issues

Use this ESPECIALLY when:
- Under time pressure (emergencies make guessing tempting)
- "One quick fix" seems obvious
- You have already tried multiple fixes
- The previous fix did not work
- You do not fully understand the issue

Do not skip when:
- Issue seems simple (simple bugs have root causes too)
- You are in a hurry (systematic debugging is faster than guess-and-check thrashing)
- There is pressure to fix NOW (systematic approach finds it faster)

## The Iron Law

**NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST. If Phase 1 is not complete, no fix may be proposed.**

Random fixes waste time and create new bugs. Quick patches mask underlying issues.

## The Four Phases

You MUST complete each phase before proceeding to the next.

### Phase 1: Root Cause Investigation

BEFORE attempting ANY fix:

1. **Read Error Messages Carefully**
   - Do not skip past errors or warnings
   - Error messages often contain the exact solution
   - Read stack traces completely
   - Note line numbers, file paths, error codes

2. **Reproduce Consistently**
   - Can you trigger it reliably?
   - What are the exact steps?
   - Does it happen every time?
   - If not reproducible: gather more data, do not guess

3. **Check Recent Changes**
   - What changed that could cause this?
   - Run \\\`git diff\\\` and review recent commits
   - Check new dependencies and config changes
   - Check for environmental differences

4. **Add Diagnostic Instrumentation in Multi-Component Systems**

   When the system has multiple components (CI → build → signing, API → service → database): add diagnostic output at each component boundary BEFORE proposing fixes.

   \\\`\\\`\\\`bash
   # Layer 1: Workflow
   echo "=== Secrets available in workflow: ==="
   echo "IDENTITY: \${IDENTITY:+SET}\${IDENTITY:-UNSET}"

   # Layer 2: Build script
   echo "=== Env vars in build script: ==="
   env | grep IDENTITY || echo "IDENTITY not in environment"

   # Layer 3: Signing script
   echo "=== Keychain state: ==="
   security list-keychains
   security find-identity -v

   # Layer 4: Actual signing
   codesign --sign "\$IDENTITY" --verbose=4 "\$APP"
   \\\`\\\`\\\`

   Run once to gather evidence showing WHERE it breaks. Then analyze to identify the failing component. Then investigate that specific component.

5. **Trace Data Flow**

   When the error is deep in the call stack:
   - Where does the bad value originate?
   - What called this function with the wrong value?
   - Keep tracing up until you find the source
   - Fix at the source, not at the symptom

   See \\\`\${CLAUDE_SKILL_DIR}[[/references/root-cause-tracing.md]]\\\` for the complete backward tracing technique.

   For test pollution issues (tests interfering with each other), use \\\`\${CLAUDE_SKILL_DIR}[[/scripts/find-polluter.sh]]\\\` to locate the polluting test.

### Phase 2: Pattern Analysis

Find the pattern before fixing:

1. **Find Working Examples** - Locate similar working code in the same codebase
2. **Read Reference Implementations Completely** - Do not skim, read every line, understand the pattern fully before applying
3. **Identify Differences** - List every difference between working and broken, however small
4. **Understand Dependencies** - What other components, config, or environment does this need? What assumptions does it make?

### Phase 3: Hypothesis and Testing

Apply the scientific method:

1. **Form ONE Specific Hypothesis** - State clearly: "I think X is the root cause because Y." Write it down. Be specific.
2. **Test with the Smallest Possible Change** - One variable at a time. Do not fix multiple things at once.
3. **Verify Before Continuing**
   - Did it work? Yes: proceed to Phase 4
   - Did not work? Form a NEW hypothesis. Do NOT stack fixes on top.
4. **When You Do Not Know** - Say so. Ask for help. Research more. Do not pretend to know.

### Phase 4: Implementation

Fix the root cause, not the symptom:

1. **Create a Failing Test** - Simplest possible reproduction. Automated test if possible. Use ${PROJECT_NAME}-tdd for writing proper failing tests. You MUST have a failing test before fixing.
2. **Implement a Single Fix** - Address the root cause identified in Phase 1. ONE change at a time. No "while I'm here" improvements. No bundled refactoring.
3. **Verify the Fix** - Use ${PROJECT_NAME}-verification before claiming the fix is complete. Does the test pass? Are other tests still passing? Is the issue actually resolved?
4. **If the Fix Does Not Work**
   - STOP
   - Count: how many fixes have you tried?
   - If fewer than 3: return to Phase 1 and re-analyze with the new information
   - If 3 or more: stop and question the architecture (see Escalation below)
   - Do NOT attempt Fix 4 without an architectural discussion

## Escalation: 3+ Failed Fixes

Pattern indicating an architectural problem:
- Each fix reveals new shared state, coupling, or a problem in a different place
- Fixes require massive refactoring to implement
- Each fix creates new symptoms elsewhere

When you see this pattern: STOP and question fundamentals. Ask:
- Is this pattern fundamentally sound?
- Are we sticking with it through inertia?
- Should we refactor the architecture rather than continue fixing symptoms?

Discuss with your human partner before attempting more fixes. This is not a failed hypothesis - it is a wrong architecture.

## Red Flags

If you catch yourself thinking any of the following, STOP and return to Phase 1:

- "Quick fix for now, investigate later"
- "Just try changing X and see if it works"
- "Add multiple changes, run tests"
- "Skip the test, I'll manually verify"
- "It's probably X, let me fix that"
- "I don't fully understand but this might work"
- "Pattern says X but I'll adapt it differently"
- "Here are the main problems: [lists fixes without investigation]"
- Proposing solutions before tracing data flow
- "One more fix attempt" (when already tried 2+)
- Each fix reveals a new problem in a different place

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Issue is simple, don't need process" | Simple issues have root causes too. Process is fast for simple bugs. |
| "Emergency, no time for process" | Systematic debugging is FASTER than guess-and-check thrashing. |
| "Just try this first, then investigate" | First fix sets the pattern. Do it right from the start. |
| "I'll write test after confirming fix works" | Untested fixes do not stick. Test first proves it. |
| "Multiple fixes at once saves time" | Cannot isolate what worked. Causes new bugs. |
| "Reference too long, I'll adapt the pattern" | Partial understanding causes bugs. Read it completely. |
| "I see the problem, let me fix it" | Seeing symptoms does not equal understanding root cause. |
| "One more fix attempt" (after 2+ failures) | 3+ failures mean architectural problem. Question pattern, do not fix again. |

## Quick Reference

| Phase | Key Activities | Success Criteria |
|-------|---------------|------------------|
| **1. Root Cause** | Read errors, reproduce, check changes, gather evidence | Understand WHAT and WHY |
| **2. Pattern** | Find working examples, compare | Identify differences |
| **3. Hypothesis** | Form theory, test minimally | Confirmed or new hypothesis |
| **4. Implementation** | Create test, fix, verify | Bug resolved, tests pass |

## User's Signals You're Doing It Wrong

Watch for these redirections from the user:
- "Is that not happening?" — you assumed without verifying
- "Will it show us...?" — you should have added evidence gathering first
- "Stop guessing" — you are proposing fixes without understanding root cause
- "We're stuck?" (frustrated) — your current approach is not working

When you see any of these: STOP and return to Phase 1.

## When Process Reveals "No Root Cause"

If systematic investigation reveals the issue is truly environmental, timing-dependent, or external:

1. You have completed the process correctly
2. Document what you investigated and what was ruled out
3. Implement appropriate handling (retry, timeout, informative error message)
4. Add monitoring or logging for future investigation

Note: 95% of "no root cause" cases are incomplete investigation. Exhaust all phases before concluding there is no root cause.

## Supporting Techniques

These techniques are in the \\\`references/\\\` directory:

- **\\\`\${CLAUDE_SKILL_DIR}[[/references/root-cause-tracing.md]]\\\`** - Trace bugs backward through the call stack to find the original trigger
- **\\\`\${CLAUDE_SKILL_DIR}[[/references/defense-in-depth.md]]\\\`** - Add validation at multiple layers after finding root cause
- **\\\`\${CLAUDE_SKILL_DIR}[[/references/condition-based-waiting.md]]\\\`** - Replace arbitrary timeouts with condition polling. See \\\`\${CLAUDE_SKILL_DIR}[[/references/condition-based-waiting-example.ts]]\\\` for a concrete TypeScript implementation.

## Integration

- Use **${PROJECT_NAME}-tdd** when Phase 4 requires writing a failing test
- Use **${PROJECT_NAME}-verification** before claiming the fix is complete
- Use the **${PROJECT_NAME}-codebase-explorer** agent to trace call graphs in Phase 1
`;
