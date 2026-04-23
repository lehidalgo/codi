# PR Review Document Template

Copy this skeleton when producing the review document in Phase 4. Replace every placeholder in `{{braces}}` with real content or delete the line.

---

```markdown
# PR #{{N}} Review — {{PR title}}

**Date**: YYYY-MM-DD HH:MM
**Document**: YYYYMMDD_HHMMSS_[PR_REVIEW]_pr-{{N}}-{{slug}}.md
**Category**: PR_REVIEW
**PR**: {{PR URL}}
**Branch**: `{{head-branch}}` → `{{base-branch}}`
**Author**: {{author}}
**Scope**: {{M}} files, +{{adds}} / -{{dels}}
**Reviewer**: {{reviewer or agent name}}

---

## Recommendation: **{{APPROVE | REQUEST CHANGES | COMMENT}}**

{{One short paragraph. What's the overall posture? What are the 1-3 issues that drove the verdict? Name them concretely.}}

---

## Severity Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | {{n}} | block / n/a |
| HIGH     | {{n}} | block / n/a |
| MEDIUM   | {{n}} | info |
| LOW      | {{n}} | note |

---

## CRITICAL

### C1. {{Short title}}

**File**: `{{path}}:{{lines}}`

{{One paragraph. What is wrong, why it matters, what the exploitation path or failure mode looks like.}}

**Fix**: {{Minimal change. Code snippet if clearer than prose.}}

### C2. {{Short title}}

…

---

## HIGH

### H1. {{Short title}}

**File**: `{{path}}:{{lines}}`

{{Body}}

**Fix**: {{…}}

### H2. {{Short title}}

…

---

## MEDIUM

### M1. {{Short title}}
**File**: `{{path}}:{{lines}}`
{{One or two lines; MEDIUM findings don't need the full structure unless load-bearing.}}

### M2. {{Short title}}

…

---

## LOW

- **{{path}}:{{lines}}** — {{one-line description}}
- **{{path}}:{{lines}}** — {{one-line description}}

---

## Claims vs. reality

This table documents Phase 3 Pass 1 — every author claim checked against the diff.

| PR claim | Reality | Action |
|---|---|---|
| "{{verbatim claim from PR description}}" | {{what the diff actually shows}} | Fix or retract |
| "{{…}}" | {{…}} | {{…}} |

---

## Minimum fixes before merge

1. {{Actionable: what to change, where, how}}
2. {{…}}
3. {{…}}

## Follow-up (HIGH, separate PR acceptable if tracked)

- {{Work that's worth doing but can land in a follow-up PR if there's a ticket}}
- {{…}}

## Ship-worthy once blockers are addressed

{{Explicit callout of the solid parts. This matters — a review that's all criticism breeds resentment. Name what went well.}}
```

---

## Style rules for the document

- Lead with the verdict. Readers decide in 5 seconds.
- One paragraph per finding, maximum. If it needs more, it's probably two findings.
- Every CRITICAL/HIGH finding has a file:line citation. No exceptions.
- Write in imperative, active voice. "Add `CurrentUser` to every route" not "routes should have auth added to them."
- No em-dashes, no smart quotes, no sycophancy. Output must be copy-paste safe.
- Spanish projects: write the review in the same language as the PR description; keep filenames and technical terms in English.

## When to deviate from the template

- **Tiny PRs (< 100 LOC)**: drop the MEDIUM / LOW sections if there's nothing there. Do not manufacture findings to fill the template.
- **Documentation-only PRs**: the severity rubric shifts — a factual error in docs is HIGH, not MEDIUM.
- **Refactor PRs** with no behavior change: add a "Behavior preservation check" section listing what you verified.
- **Security-focused PRs**: move Claims vs. reality to the top, before severity summary — it's load-bearing.
