# Changelog — bug-fix-workflow

## [0.2.0] — 2026-05-02

### Added

- `--from-story US-NNN` invocation mode for bugs that follow a previously delivered Story; spawns a child Story with `parent_story` link, leaving the original untouched.
- Free-running mode auto-creates a standalone bug Story so ad-hoc bug fixes appear in the Sheet.
- `phase-reproduce.md` documents the Story handling at workflow entry.
- contract.json `events_emitted` adds `design_doc_authored` (emitted at end of `plan` phase).

### Notes

P4 of the project-workflow + Google Sheets layer. bug-fix-workflow is now Sheet-aware.

## [0.1.0] — 2026-05-01

### Added

- Initial skill (M4-T03)
- Phases: intent → reproduce → plan → execute → verify → done
- `reproduce` phase enforces "build feedback loop first" discipline before any planning
- Hypothesis-driven plan section (3–5 ranked falsifiable hypotheses)
- Regression test before fix; instrumentation cleanup before done
