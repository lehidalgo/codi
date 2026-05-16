# Mode: domain

`mode-sharpen` plus domain awareness. Challenge the plan against the project's vocabulary (`docs/CONTEXT.md`) and approved decisions (`docs/adr/`). Update the knowledge base inline as terms resolve.

## Pre-conditions

- A plan or design exists (same as `mode-sharpen`).
- `docs/CONTEXT.md` exists with ≥1 term, OR `docs/adr/` has ≥1 approved ADR.

If neither knowledge base file exists, this mode adds nothing over `mode-sharpen`. Use `sharpen` instead, or run `init-knowledge-base` first.

## Order of operations

Follow `mode-sharpen` AND interleave the following throughout the session:

### 1. Read the knowledge base before grilling

- `docs/CONTEXT.md` — every term, every relationship, every flagged ambiguity.
- `docs/adr/` — every approved ADR, especially in areas the plan touches.
- If `docs/CONTEXT-MAP.md` exists, the repo has multiple bounded contexts. Identify which contexts the plan affects and read each context's `CONTEXT.md`.

### 2. Challenge user terms against the glossary

When the user uses a term, check it against `CONTEXT.md`. If there is a mismatch, surface immediately:

> "Glossary defines '<term>' as <definition>. You seem to mean <other meaning>. Which is it?"

Do not let the conversation proceed with two definitions of the same word.

### 3. Sharpen fuzzy or overloaded terms

When the user says "account", "user", "order", "session", or any word that could mean two things, propose the precise canonical term:

> "You said 'account'. Glossary distinguishes Customer (the human) and User (the auth principal). Which one?"

ONE clarification per turn.

### 4. Cross-reference with code

When the user states how something works, verify against the actual code. If you find a contradiction:

> "You said the system X. The code at <file>:<line> does Y. Which is the source of truth — the plan, or the code?"

This is the most valuable check in `mode-domain`. Plans drift from code; surface the drift immediately.

### 5. Update CONTEXT.md inline (the moment a term resolves)

When a term gets resolved during the session, update `docs/CONTEXT.md` in the same turn. Do not batch updates; do not promise to update later.

Format:

```markdown
**<Term>**:
<Definition (1-3 sentences in plain language)>
_Avoid_: <terms to avoid using interchangeably>
```

Only include terms meaningful to domain experts. Do not couple `CONTEXT.md` to implementation details.

### 6. Offer ADRs sparingly — triple test

Only offer to create an ADR when ALL THREE are true:

1. **Hard to reverse** — the cost of changing your mind later is meaningful (data shape changes, public API contracts, security boundaries).
2. **Surprising without context** — a future reader will wonder "why did they do it this way?".
3. **Result of a real trade-off** — there were genuine alternatives and you picked one for specific reasons.

If any of the three is missing, skip the ADR. Most decisions do not pass the triple test.

When an ADR passes, propose:

> "This decision passes the triple test. Recommend writing ADR-<NNNN> '<title>'. Approve?"

On approval, write to `docs/adr/<NNNN>-<kebab-title>.md` with: context, decision, consequences, alternatives considered.

### 7. Lazy creation

- If `docs/CONTEXT.md` does not exist, create it the moment the first term is resolved (not before).
- If `docs/adr/` does not exist, create it the moment the first ADR is approved.

## Termination

Same as `mode-sharpen` plus:

- Note in the session summary which CONTEXT.md terms were added or modified.
- Note which ADRs were proposed and which were approved.
- Inside workflow phase plan: emit `context_term_added` / `context_term_updated` events for each glossary change, and `adr_proposed` / `adr_approved` events for each ADR.

## What you do NOT do in this mode

- Update CONTEXT.md or write ADRs without explicit user approval.
- Update CONTEXT.md with terms that do not surface in the conversation.
- Write an ADR for a decision that does not pass the triple test.
- Skip the cross-reference with code. Plans drift; the code does not lie.
