# Feedback patterns — concrete examples

Good vs bad responses for both modes. Reference when in doubt about how to phrase.

## Mode `receive` — performative vs technical

### Bad (performative)

```
Reviewer: "Remove the legacy code in src/auth/legacy.ts"

Agent: "You're absolutely right! Let me remove that immediately. Thanks for catching that!"
```

### Good (technical verification)

```
Reviewer: "Remove the legacy code in src/auth/legacy.ts"

Agent: "Checking. Build target is iOS 10.15+. The replacement API needs 13+. Need legacy
for backward compat. Current implementation has wrong bundle ID — fix that, or drop
pre-13 support? Awaiting your call."
```

### Good (just fix it)

```
Reviewer: "Typo in error message at src/payment/charge.ts:42 — should be 'declined' not 'declied'"

Agent: [fixes the typo]
       "Fixed. src/payment/charge.ts:42 now reads 'declined'."
```

(No "thanks", no "great catch", no preamble.)

## Mode `receive` — YAGNI

### Bad

```
Reviewer: "Implement proper metrics tracking with database storage, date range filters, and CSV export."

Agent: "Great suggestion! Let me build that out."
       [spends 4 hours building the feature]
```

### Good

```
Reviewer: "Implement proper metrics tracking with database storage, date range filters, and CSV export."

Agent: "Grepped codebase for usage of the metrics endpoint — nothing calls it. Recommend
removing the endpoint entirely (YAGNI). Or is there a use case I am missing?"
```

## Mode `receive` — handling unclear feedback

### Bad

```
User: "Fix items 1-6"
[Agent understands 1, 2, 3, 6 but is unsure about 4 and 5]

Agent: [implements 1, 2, 3, 6]
       "Done. Will look at 4 and 5 next."
```

### Good

```
User: "Fix items 1-6"
[Agent understands 1, 2, 3, 6 but is unsure about 4 and 5]

Agent: "Understand 1, 2, 3, 6. Need clarification on 4 and 5 before implementing —
they may affect how 1 and 6 are handled."
```

## Mode `receive` — pushback when wrong

### Bad

```
Reviewer: "Use Promise.all here for parallelism."

Agent: "Sure, will refactor to Promise.all."
       [refactors; tests fail because order matters]
```

### Good

```
Reviewer: "Use Promise.all here for parallelism."

Agent: "Promise.all would race the operations. Test at tests/order.test.ts:23 asserts
operation A completes before B because B depends on A's side effect. Sequential is
intentional. Proposing instead: parallelize the read phase but keep write sequential.
Confirm?"
```

## Mode `receive` — wrong pushback, gracefully corrected

### Bad (defensive)

```
[Agent pushed back saying X is fine; reviewer pointed at evidence X is broken]

Agent: "Well, I thought X was fine because [long explanation]. I see your point now,
but in my defense [more explanation]. Let me fix it."
```

### Good (factual)

```
[Agent pushed back saying X is fine; reviewer pointed at evidence X is broken]

Agent: "You were right — re-ran the failing scenario, confirmed the issue. Fixing
in src/x.ts:42."
```

## Mode `request` — context packaging

### Bad

```
[Main agent dispatches reviewer with the entire session conversation]
"Hi reviewer, here's everything we discussed today. The user wanted a contact form,
then we discussed Next.js vs Vite, then we picked..."
```

### Good

```
[Main agent dispatches reviewer with crisp context]
WHAT_WAS_IMPLEMENTED: Contact form component with name/email/message fields,
   localStorage persistence via existing storage helper.
PLAN_OR_REQUIREMENTS: docs/20260501_133000_[PLAN]_contact-form.md
BASE_SHA: a1b2c3d
HEAD_SHA: e4f5g6h
DESCRIPTION: Focus on regression test coverage and scope discipline
   (only src/components/ContactForm.tsx should have changed).
```

## Mode `request` — acting on feedback

### Bad

```
Reviewer returned: { verdict: "fail", issues: [
  { severity: "Critical", ... },
  { severity: "Minor", ... },
  { severity: "Important", ... }
]}

Agent: [fixes Minor first because it was easy]
       [continues to next phase before fixing Critical]
```

### Good

```
Reviewer returned: { verdict: "fail", issues: [
  { severity: "Critical", title: "Missing input validation", detail: "src/x.ts:23..." },
  { severity: "Minor", title: "Naming inconsistency", detail: "..." },
  { severity: "Important", title: "Tests don't cover error case", detail: "..." }
]}

Agent: [fixes Critical first; runs tests; commits]
       [fixes Important; runs tests; commits]
       [notes Minor as a TODO for follow-up]
       [proposes phase transition only after Critical and Important are gone]
```

## Mode `request` — pushback on hallucinated feedback

### Bad

```
Reviewer subagent says: "Critical: src/x.ts:42 has a SQL injection vulnerability."

Agent: [tries to fix something that doesn't exist; introduces a bug]
```

### Good

```
Reviewer subagent says: "Critical: src/x.ts:42 has a SQL injection vulnerability."

Agent: [reads src/x.ts:42 — it's a localStorage call, no SQL involved]
       "Reviewer hallucinated. src/x.ts:42 is a localStorage write, not SQL.
       Re-dispatching review with explicit note that this codebase has no SQL."
```

## Bottom line

In all examples: technical reasoning over performative agreement. Verify before acting. State the fix, not the gratitude.
