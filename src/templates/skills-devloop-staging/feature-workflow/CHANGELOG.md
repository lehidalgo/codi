# Changelog — feature-workflow skill

## [0.2.0] — 2026-05-02

### Added

- `--from-story US-NNN` invocation mode — `intent` reads the Story from the project Sheet and uses its acceptance criteria as the scope contract. Init payload carries `from_story_id` for traceability.
- Free-running mode (no `--from-story`) auto-creates a `UserStory` row at end of `intent` so ad-hoc work appears in the Sheet (Dashboard "Untraced work").
- `design_doc_authored` event emitted at the moment the plan markdown is written; payload carries `design_doc_path` and (if applicable) `story_id`.
- `phase-plan.md` documents the post-write Sheet sync of `design_doc_path` onto the Story row.
- contract.json adds `design_doc_authored` to `events_emitted`.

### Notes

P3 of the project-workflow + Google Sheets layer. `feature-workflow` is now Sheet-aware: it reads the Story on init and writes execution-column updates as phases progress. `bug-fix-workflow`, `refactor-workflow`, `migration-workflow` get the same treatment in P4.

## [0.1.0] — 2026-05-01

### Added

- Initial skill (M1-T05)
- SKILL.md with frontmatter following Anthropic doctrine (name, description with triggers, when_to_use, allowed-tools)
- contract.json declaring 6 phases (intent → plan → decompose → execute → verify → done), gate definitions with deterministic and agent checks (most marked for M3 implementation), full set of emitted events from the canonical vocabulary, and human-approval requirements
- 6 reference files for progressive disclosure: phase-intent, phase-plan, phase-decompose, phase-execute, phase-verify, tracer-bullets, gate-feedback-format

### Notes

This is the M1 baseline. The contract declares gates that are not yet enforced — most check `implementation_milestone: M3` indicating they activate when the gate runner ships in M3-T03. Until then, gates are advisory and the human approves transitions explicitly.
