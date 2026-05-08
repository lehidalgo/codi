# Changelog — discover skill

## [0.1.0] — 2026-05-01

### Added

- Initial consolidated skill replacing the standalone `brainstorm`.
- Three modes covering the discovery → convergence → domain-grilling spectrum:
  - `wide` — discovery before any design exists. HARD-GATE on implementation, scope decomposition, 2-3 approaches with trade-offs, spec self-review, user review gate.
  - `sharpen` — convergence on an existing plan; branch-by-branch interrogation; recommended answer per question; explore-codebase-first.
  - `domain` — sharpen plus challenge against `docs/CONTEXT.md` and `docs/adr/`; fuzzy-term sharpening; cross-reference with code; inline glossary updates; ADR triple test; lazy creation.
- Universal principles unified across modes: ONE question per turn, ALWAYS provide a recommended answer, explore-codebase-first, multiple-choice-when-natural, token economy (questions ≤2 lines, no preamble), scope-first.
- Response format prescribes the shape of every turn during dialogue.
- Termination logic per calling context (workflow phase intent, workflow phase plan, standalone).
- Anti-pattern list explicit (too-simple-to-need-design, multi-question-bundling, asking-the-obvious, no-recommendation, long-restatements, sliding-into-implementation).

### Replaces

- `skills/brainstorm/` (removed) — was a single-mode skill that did not include the "recommended answer per question" or domain-awareness disciplines.

### Integration

- feature-workflow phase intent → `discover` (mode `wide`) MANDATORY
- feature-workflow phase plan → `discover` (mode `sharpen` or `domain`) after `plan-writing`
- bug-fix-workflow phase plan → `discover` (mode `sharpen`) when ≥2 hypotheses competing
- refactor-workflow phase intent → `discover` (mode `wide`)
- refactor-workflow phase plan → `discover` (mode `domain`) when touching ADRs
- migration-workflow phase intent → `discover` (mode `wide`)
- migration-workflow phase plan → `discover` (mode `domain`) when touching schema ADRs
- Standalone via `/devloop:discover` for ad-hoc structured Q&A
