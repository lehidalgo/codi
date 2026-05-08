# Changelog — migration-workflow

## [0.2.0] — 2026-05-02

### Added

- `--from-story US-NNN` invocation mode for migrations scoped to an existing Requirement/Goal; spawns a child Story with `parent_story` link.
- Free-running mode auto-creates a system-perspective Story (`as_a="system"`).
- `phase-intent.md` documents Story handling at workflow entry.
- contract.json bumped 0.2.0; `events_emitted` adds `design_doc_authored`.

### Notes

P4 of the project-workflow + Google Sheets layer.

## [0.1.0] — 2026-05-01

### Added

- Initial skill (M6-T02)
- Phases: intent → plan → execute → verify → data-validation → done
- Mandatory data-validation phase: pre/post metrics, sample diff, downstream consumer health, rollback test
- Cannot reach done without explicit data integrity evidence
