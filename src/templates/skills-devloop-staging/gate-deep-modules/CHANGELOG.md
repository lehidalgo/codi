# Changelog — gate-deep-modules

## [0.1.0] — 2026-05-01

### Added

- Initial skill (M3-T05). Forked subagent that identifies shallow modules in the plan.
- Output strictly conforms to `schemas/gate-result.schema.json`.
- Advisory: `max_retries: 1` then escalates to human.
