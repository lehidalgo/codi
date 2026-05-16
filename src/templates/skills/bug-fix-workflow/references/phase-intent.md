# Phase: intent

<!-- BEGIN auto-generated chain — DO NOT EDIT -->

## Chain skills

- Optionally, invoke `codi:discover` when ambiguous failure mode OR Q7=yes — wide/sharpen/domain mode.
- Optionally, invoke `codi:dev-step-documenter` when domain terms emerge inline.
- Alternatively, invoke `codi:architecture-review` if 3-strikes — fix is structural, restructure rather than patch.

<!-- END auto-generated chain -->

Goal: confirm the failure mode the user describes before any reproduction work.

For most bug reports the user states the failure clearly enough that no Q&A is needed — proceed directly to `reproduce`. When the report is ambiguous (multiple subsystems implicated, vague symptom, intermittent), invoke `codi:discover` mode `wide` to surface a single concrete failure mode before continuing.

The detail of this phase is short by design. Bug-fix workflows lean on `reproduce` (the next phase) for the heavy lifting — the loop-quality discipline is what catches misframed bugs, not extended interview at intent.

## What you produce

- A `decision_recorded` event capturing the confirmed failure mode (one sentence, observable).
- Optional `decision_recorded` capturing scope hints if multiple subsystems are visible.

## When to transition to `reproduce`

You are ready when:

- [ ] Failure mode restated in one sentence and confirmed by the user.
- [ ] No open ambiguity about which subsystem is implicated.

Then propose:

```bash
codi transition --to reproduce
```
