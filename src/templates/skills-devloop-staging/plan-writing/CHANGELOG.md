# Changelog — plan-writing skill

## [0.1.0] — 2026-05-01

### Added

- Initial consolidated skill replacing what would have been three parallel skills.
- Three modes cover the planning artifact spectrum:
  - `plan` — detailed plan markdown with atomic 2-5min tasks, complete code blocks, no placeholders. Default for phase plan.
  - `prd` — synthesis-only (no interview), high-level PRD with user stories and implementation decisions. For pre-workflow standalone use.
  - `issues` — tracer-bullet vertical slices with HITL/AFK marking and blocked-by graph. Published to issue tracker during phase decompose.
- Universal principles unified across modes: synthesize-do-not-interview (use discover for that), use domain glossary, respect ADRs, look for deep modules, no placeholders, self-review before claiming done.
- File naming aligned to devloop convention (`docs/YYYYMMDD_HHMMSS_[PLAN]_<slug>.md`) regardless of mode.
- Self-review checklist captures spec coverage, placeholder scan, type consistency, internal contradictions, scope check, ambiguity check.
- Termination logic per calling context (phase plan, phase decompose, standalone).

### Integration

- feature-workflow phase plan → `plan-writing` (mode `plan`) MANDATORY, after `discover` resolved decisions
- bug-fix-workflow phase plan → `plan-writing` (mode `plan`) MANDATORY
- refactor-workflow phase plan → `plan-writing` (mode `plan`) MANDATORY
- migration-workflow phase plan → `plan-writing` (mode `plan`) MANDATORY
- feature-workflow phase decompose → `plan-writing` (mode `issues`) opt-in when `.devloop/config.yaml` declares an issue tracker
- Standalone via `/devloop:plan-writing` (mode `prd`) for pre-workflow PRD generation

### Boundaries with adjacent skills

- `discover` runs the dialogue; `plan-writing` writes the artifact. No overlap.
- `plan-writing` mode `plan` does NOT auto-trigger phase transition. The user reviews the plan and explicitly transitions.
- `plan-writing` mode `issues` requires the user to approve the slice breakdown before publishing.
