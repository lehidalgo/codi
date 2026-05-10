# Phase: intent

<!-- BEGIN auto-generated chain — DO NOT EDIT -->

## Chain skills

- You **MUST** invoke `codi:discover` (wide or domain mode depending on knowledge base depth).
- Alternatively, invoke `codi:architecture-review` if user has not identified a structural target.

<!-- END auto-generated chain -->

Identify the structural friction and the deepening goal. HARD GATE — no implementation until the user approves the refactor scope and target.

## Process

Invoke `codi:discover` (mode `wide`) to identify the structural friction and agree on the deepening goal.

When the user has not yet identified a specific structural target — they say "this codebase is hard to navigate", "where are our refactor opportunities?", "what should we deepen?" — invoke `codi:architecture-review` first. It surveys the codebase, presents numbered deepening candidates with locality/leverage rationale, and on user selection feeds the chosen candidate back into this workflow's `intent` phase.

## Exit criterion

- [ ] User explicitly approved the refactor scope and target.
- [ ] Modules in scope are listed.
- [ ] Deepening rationale is documented (what callers gain, what locality concentrates).
