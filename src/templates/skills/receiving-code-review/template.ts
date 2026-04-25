import { PROJECT_NAME, SUPPORTED_PLATFORMS_YAML, SKILL_CATEGORY } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Receiving feedback on YOUR OWN work. Use when a reviewer, teammate, the
  user, or an automated tool returns feedback on a diff, PR, commit, or
  code you wrote. Trigger phrases: "the reviewer said", "review feedback
  came back", "my PR got comments", "they suggested I change", "responding
  to PR comments", "addressing reviewer concerns", "should I apply this
  suggestion". Iron law — external feedback is suggestions to evaluate,
  not orders to follow. Forbids performative agreement ("you're absolutely
  right!", "good catch!", blind implementation). Requires verifying every
  claim against the code, distinguishing reviewer error from real issues,
  and pushing back with evidence when wrong. Do NOT activate for PRODUCING
  a review on an uncommitted diff (use ${PROJECT_NAME}-code-review), for
  PRODUCING a full PR review (use ${PROJECT_NAME}-pr-review), or for the
  initial completeness check on your own work before review (use
  ${PROJECT_NAME}-verification).
category: ${SKILL_CATEGORY.CODE_QUALITY}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 2
---

# {{name}} — Receiving a Code Review

## When to Activate

Use whenever feedback ARRIVES on work you authored:

- A reviewer left comments on your PR
- A teammate sent inline notes on a diff or commit
- The user is sharing review output from another tool (Coderabbit, Sourcery, GitHub Copilot review, etc.)
- A linter or static-analysis report just landed
- A subagent (e.g. ${PROJECT_NAME}-pr-reviewer or ${PROJECT_NAME}-code-reviewer) returned findings on YOUR code
- The user pastes a comment and asks "should I do this?", "is this right?", or "how should I respond?"

The defining signal: someone else is making a claim about code YOU wrote. The decision is whether to apply, push back, or ask for clarification — not how to write the review.

## Skip When

- Producing a review on someone else's uncommitted diff — use **${PROJECT_NAME}-code-review**
- Producing a full PR review with severity-ranked findings + gh post — use **${PROJECT_NAME}-pr-review**
- Initial completeness check on your own work BEFORE any reviewer sees it — use **${PROJECT_NAME}-verification**
- Fixing a bug the user identifies (no review involved) — use **${PROJECT_NAME}-debugging**
- Multi-file refactor in response to feedback — apply the discipline here, then use **${PROJECT_NAME}-plan-writer** for the change

## The Iron Law

**EXTERNAL FEEDBACK IS SUGGESTIONS TO EVALUATE, NOT ORDERS TO FOLLOW.**

Every reviewer claim must be verified against the actual code before any change is made. The test is technical correctness for THIS codebase, not whether the reviewer sounds authoritative. The reviewer can be wrong; the linter can flag false positives; an automated tool can miss intent. Verifying first is not disrespectful — it is the job.

A reviewer who is right will appreciate the verification trail. A reviewer who is wrong needs evidence-based pushback, not silent acceptance.

## Forbidden Phrases

These phrases short-circuit verification and signal performative agreement. Never use them:

- "You're absolutely right!" — performative; means nothing without verification
- "Great point!" / "Good catch!" — sycophantic; skips the verify step
- "I'll fix that right away!" — premature commitment before checking the fix is correct
- "Got it, fixing now" — same problem, terser
- "Sorry, my mistake" — apology before verification; you may not have actually been wrong

The corrected code (or evidence-based pushback) demonstrates understanding. Padding does not.

## The 4-Step Workflow

You MUST complete each step in order, per finding.

### Step 1 — READ the finding completely

- Read the full comment, including any code blocks the reviewer attached
- Identify the SPECIFIC claim: a bug? a style preference? a missing case? an architectural concern?
- If the comment is unclear, ask for specifics before doing anything: "Can you clarify which edge case you mean? I see X but not Y at line 42."

Do NOT proceed to Step 2 with an interpretation — proceed with the literal claim.

### Step 2 — VERIFY against the actual code

For every technical claim, open the file at the cited line and check.

The four possible verdicts:

1. **Reviewer is correct.** The bug exists / the missing case is real / the suggested fix is better.
2. **Reviewer is partially correct.** The issue exists but the suggested fix is wrong, OR the suggested fix is right but the framing is off.
3. **Reviewer is wrong.** The claim does not match the code, or the suggestion would break something.
4. **Insufficient information.** Cannot tell from the comment alone — need clarification.

State the verdict explicitly in your response. Never skip this step under time pressure.

### Step 3 — DECIDE the response

| Verdict | Action |
|---------|--------|
| Correct | Apply the fix, write a regression test if missing, then say "Fixed at file:line" tersely |
| Partially correct | Apply the corrected version, explain the divergence: "The issue at line 42 is real; using approach Y instead of suggested Z because Z would break X" |
| Wrong | Push back with evidence: "Verified the function at line 42 — the early return on line 38 already handles this case (test at file:line). Keeping current code." |
| Insufficient info | Ask one specific clarifying question, do NOT change code yet |

### Step 4 — RESPOND tersely

- Reply per finding, not in one bulk message — context stays attached
- No padding, no apology, no "great catch"
- For accepted fixes: "Fixed at <file:line>" — corrected code speaks for itself
- For pushback: state what you verified, cite the evidence, then the decision
- For clarification: one question, no preamble

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "The reviewer is senior, they're probably right" | Authority is not evidence. Verify the claim against the code anyway. |
| "It's a small change, just apply it" | Wrong small changes break tests later. Verify even one-line suggestions. |
| "If I push back, I'll seem defensive" | Evidence-based pushback is the discipline. Silent acceptance is the failure. |
| "I'll fix it now and verify after" | Order matters: verify, decide, then fix. The other order leaks bad fixes into the codebase. |
| "The linter said it, must be a bug" | Linters have false positives. Verify. |
| "Reviewer asked for X, but I think Y is better — I'll just do X to avoid friction" | Apply Y with the rationale. Mismatched changes that pass review are tech debt the reviewer never agreed to. |
| "I'll just rewrite the whole thing to make all the comments go away" | Scope creep. Apply each finding individually; never bundle a refactor into a review response. |
| "The user pasted reviewer comments AT me, so they want me to apply them" | Read the user's intent. Often they want evaluation, not implementation. Confirm before changing. |

## Red Flags

If you catch yourself doing any of the following, STOP and return to Step 2:

- Replying "You're absolutely right!" before opening the file
- Applying multiple findings in a single commit without per-finding verification
- Rewriting code beyond what the finding asked for
- Saying "I'll address all comments" instead of per-finding decisions
- Apologizing before verifying
- Treating linter output the same as a human reviewer's claim (linters get wrong more often)
- Treating a subagent's review output as authoritative without checking
- Skipping verification because "the reviewer included a code snippet" (their snippet may be wrong)

## Quick Reference

| Situation | Step | Action |
|-----------|------|--------|
| Comment arrives | 1. READ | Read fully, identify the literal claim |
| Comment is unclear | 1. READ | Ask one clarifying question, no code change |
| Claim is technical | 2. VERIFY | Open the file, check the line, judge correct / partial / wrong / unclear |
| Verdict reached | 3. DECIDE | Pick the matching action from the verdict table |
| Replying | 4. RESPOND | Terse per-finding reply; no padding |
| Multiple findings | All steps | Repeat per finding; never bulk-apply |

## Special Cases

### When the reviewer is the user
The user's authority over their own codebase is higher than a third party's, but the verification step still runs. If the user says "make this change" and the change would break a test, surface that BEFORE applying it: "If I make this change, the test at file:line breaks because — proceed anyway?"

### When the feedback is from a subagent / automated tool
Treat as a technical claim with no extra weight. Subagents over-call findings. Linters flag patterns that may be intentional. Verify the same way; reject false positives with the same rigor as a human's wrong claim.

### When the feedback is on architecture, not code
Verification means checking against the design spec or architectural decision record (ADR), not just the file at the cited line. If no ADR exists, surface that as the question to resolve before applying the suggested architectural change.

## Integration

- **${PROJECT_NAME}-code-review** — the producing-side counterpart for an uncommitted diff. Always points HERE for the consuming case.
- **${PROJECT_NAME}-pr-review** — the producing-side counterpart for a full GitHub PR. Always points HERE for the consuming case.
- **${PROJECT_NAME}-verification** — upstream gate. Use this to verify your OWN work BEFORE any reviewer sees it. Distinct from this skill, which fires AFTER feedback arrives.
- **${PROJECT_NAME}-debugging** — when verification reveals the reviewer was right about a real bug, hand off to debugging Phase 4 to fix the root cause and write a regression test.
- **${PROJECT_NAME}-plan-writer** — when accepted feedback requires multi-file changes, write a plan first; do not apply changes ad-hoc.
- **${PROJECT_NAME}-tdd** — when accepted feedback exposes a missing test, write the failing test FIRST per RED-GREEN-REFACTOR.
`;
