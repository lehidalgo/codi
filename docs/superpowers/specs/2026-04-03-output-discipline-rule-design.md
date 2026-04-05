# Output Discipline Rule + Workflow Hallucination Guardrails
**Date**: 2026-04-03 20:45
**Document**: 2026-04-03-output-discipline-rule-design.md
**Category**: PLAN

## Summary

Incorporate token-efficient response patterns (inspired by [drona23/claude-token-efficient](https://github.com/drona23/claude-token-efficient)) into codi as:

1. A new builtin rule: `codi-output-discipline`
2. A hallucination guardrails section added to the existing `codi-workflow` rule

## Problem

Codi rules cover code quality, architecture, testing, security, and workflow — but none address **how the AI communicates**. Without output discipline rules, AI agents:

- Pad responses with sycophantic openers/closers ("Sure!", "I hope this helps!")
- Restate the question before answering
- Add unsolicited suggestions beyond the requested scope
- Use em dashes, smart quotes, and decorative Unicode that break parsers
- Invent file paths, function names, or API endpoints instead of verifying them
- Present guesses as facts without distinguishing inference from evidence

These patterns waste tokens, reduce signal-to-noise ratio, and can cause downstream errors in automation pipelines.

## Design

### New Rule: `codi-output-discipline`

**File**: `src/templates/rules/output-discipline.ts`
**Installed as**: `.codi/rules/codi-output-discipline.md`
**Priority**: high
**Always apply**: true

#### Content Sections

**Response Structure**
- Lead with the answer, code, or finding — context and reasoning after, only if non-obvious
- No sycophantic openers ("Sure!", "Great question!", "Absolutely!")
- No closing fluff ("I hope this helps!", "Let me know if you need anything!")
- No restating or paraphrasing the question before answering
- One-pass answers — do not circle back to rephrase what was already said

**Scope Discipline**
- Answer exactly what was asked — no unsolicited suggestions, improvements, or "you might also want..."
- No docstrings, comments, or type annotations on code that is not being changed
- No error handling for scenarios that cannot happen in the current context
- No boilerplate unless explicitly requested

**Code-First Output**
- Return code first when the task is a code change — explanation after, only if the logic is non-obvious
- Bug reports: state the bug, show the fix, stop
- Code review: state the finding, show the correction, stop

**Formatting Safety**
- Use plain hyphens (-) not em dashes
- Use straight quotes (" ') not smart/curly quotes
- No decorative Unicode symbols in technical output
- Natural language characters (accented letters, CJK, etc.) are allowed when the content requires them
- All output must be copy-paste safe into terminals, editors, and CI logs

BAD: "The function's parameter --- which isn't validated --- causes an issue"
GOOD: "The function parameter - which is not validated - causes an issue"

### Workflow Enrichment: Hallucination Guardrails

**File**: `src/templates/rules/workflow.ts` (existing)
**Section**: New section "Accuracy Guardrails" added after "Self-Evaluation Before Action"

#### Content

**Accuracy Guardrails**
- Never invent file paths, function names, API endpoints, or field names — verify they exist before referencing them
- When information is unavailable or uncertain, say so explicitly — never fabricate data, statistics, or citations
- Distinguish between what the code or data shows and what is inferred — label inferences explicitly
- If a claim cannot be grounded in provided context or code, do not make it
- Prefer "I don't know" or "I need to check" over a confident wrong answer

BAD: "The function `processPayment()` in `src/billing/handler.ts` handles this" (never verified)
GOOD: "Let me check where payment processing is handled" (then reads the code)

### Preset Inclusion

| Preset | Includes `output-discipline` | Rationale |
|--------|-----|-----------|
| `development` | Yes | Full dev workflow, terse output reduces noise |
| `power-user` | Yes | Power users prioritize efficiency |
| `strict` | Yes | Strict = disciplined across all dimensions |
| `fullstack` | Yes | Same benefits as development |
| `balanced` | No | Keep lightweight |
| `minimal` | No | No rules |

### Files to Create/Modify

| File | Action |
|------|--------|
| `src/templates/rules/output-discipline.ts` | Create — new rule template |
| `src/templates/rules/index.ts` | Modify — add export |
| `src/templates/rules/workflow.ts` | Modify — add "Accuracy Guardrails" section |
| `src/templates/presets/development.ts` | Modify — add rule to list |
| `src/templates/presets/power-user.ts` | Modify — add rule to list |
| `src/templates/presets/strict.ts` | Modify — add rule to list |
| `src/templates/presets/fullstack.ts` | Modify — add rule to list |
| `tests/unit/templates/rules/output-discipline.test.ts` | Create — template tests |

### What Was Intentionally Excluded

- **Profile-based behavior modes** (coding, agents, analysis, benchmark) — codi presets already fill this role via artifact selection. Adding response-style profiles is a different axis of configuration and out of scope for this change.
- **Versioned config sets** (v5, v6, v8 tool budgets) — tool call limits are a runtime concern, not a rule concern.
- **"Read each file once" rule** — already handled by system prompt behavior.
- **"Prefer edits over rewrites" rule** — already in system prompt.
- **"Test before declaring done" rule** — already in `codi-testing`.
- **"Simple/direct solutions" rule** — already in `codi-simplicity-first`.

## Attribution

Patterns adapted from [drona23/claude-token-efficient](https://github.com/drona23/claude-token-efficient) (MIT license).

## Verification

1. Run `pnpm build` to verify template compiles
2. Run `pnpm test` to verify all tests pass
3. Run `pnpm dev init` on a test project — verify `output-discipline` appears in rule selection for applicable presets
4. Run `pnpm dev generate` — verify the rule file is scaffolded to `.codi/rules/codi-output-discipline.md`
5. Read the generated rule file and confirm all sections are present
