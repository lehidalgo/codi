# Phase: plan

Generate **3–5 ranked hypotheses** before testing any. Single-hypothesis generation anchors on the first plausible idea.

## Falsifiable hypothesis format

Each hypothesis MUST be falsifiable. State the prediction it makes:

> Format: "If `<X>` is the cause, then `<changing Y>` will make the bug disappear / `<changing Z>` will make it worse."

Show the ranked list to the human. They often re-rank instantly with domain knowledge.

## Plan markdown shape

Same template as `feature-workflow` plus a `## Hypothesis` section before `## Files to be modified`.

```markdown
## Hypothesis (chosen)

<rank-1 hypothesis from the list>

Falsifiable prediction:

- If <X> is the cause, then <Y> will make the bug disappear.
- Validation: <command or test that proves it>.

## Files to be modified

- ...

## Regression test plan

- ...
```

## Phase chain

1. **`devloop:plan-writing`** (mode `plan`) writes the plan markdown with hypothesis, fix steps, regression test, exact files. No placeholders.
2. **`devloop:discover`** (mode `sharpen`) when ≥2 hypotheses compete or the user is unsure — walks the decision tree branch by branch. ONE question at a time with a recommended answer.
3. Propose transition to `execute` only after the plan exists and any hypothesis ambiguity is resolved.

## 3-strikes rule

If three hypotheses tested and none reproduced/fixed the bug, STOP. Reconsider whether the architecture itself is the problem. Invoke `devloop:architecture-review` to surface deepening candidates. Do NOT keep firing more hypotheses — that is rationalization, not debugging.
