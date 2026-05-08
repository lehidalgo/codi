# Changelog — refactor-workflow

## [0.2.0] — 2026-05-02

### Added

- `--from-story US-NNN` invocation mode for refactors that trace back to a prior delivery; spawns a child Story with `parent_story` link.
- Free-running mode auto-creates a developer-perspective Story (`as_a="developer"`).
- `phase-baseline.md` documents Story handling at workflow entry.
- contract.json bumped 0.2.0; `events_emitted` adds `design_doc_authored`.

### Notes

P4 of the project-workflow + Google Sheets layer.

## [0.1.0] — 2026-05-01

### Added

- Initial skill (M4-T04)
- Phases: intent → baseline → plan → execute → verify → done
- Mandatory `baseline` phase: capture current behavior with tests before any change
- Plan template extends feature-workflow with behavior preservation, module depth analysis, seams introduced/removed
- Execute discipline: small commits, baseline tests stay green
