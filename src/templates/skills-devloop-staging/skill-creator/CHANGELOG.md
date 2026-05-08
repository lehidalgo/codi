# Changelog — skill-creator skill

## [0.1.0] — 2026-05-02

### Added

- Initial skill consolidating the canonical devloop skill standard, RED-GREEN-REFACTOR discipline, and validator script.
- `references/standard.md` — full standard with rationale (frontmatter, body, directory layout, multi-mode, contract.json, CHANGELOG.md schema).
- `references/eval-format.md` — `evals/evals.json` schema with examples, pressure-scenario guidance for discipline skills, runner-tracking field rules.
- `references/red-green-refactor.md` — TDD-for-skills cycle, rationalization tables, red-flag list.
- `references/multi-mode-skills.md` — modes vs parallel skills, body structure for multi-mode, contract.json shape, discoverability check.
- `references/anti-patterns.md` — full enforced anti-pattern catalog (HIGH / MEDIUM / LOW severity) with examples.
- `scripts/validate-skills.py` — Python audit script. Runs all checks; supports `--skill <name>`, `--strict` (exit 1 on HIGH), `--json` output.
- `evals/evals.json` — pressure scenarios for the skill itself: scaffold-new-skill, audit-existing-skill, edit-existing-skill, refuse-parallel-skills.

### Supersedes

- `skills/write-a-skill/` (deprecated, to be removed in a follow-up). The standard documented here subsumes write-a-skill and adds the validator script and the explicit anti-pattern catalog.

### Standard sources synthesized

- Anthropic skill-authoring best practices (concise-is-key, frontmatter limits, gerund naming, third-person discipline, "Use when" prefix, workflow-summary anti-pattern documented case)
- codi/skill-creator (directory layout including evals/, schemas.md eval format, security-checklist conventions, grader/analyzer agent shapes)
- devloop/write-a-skill (RED-GREEN-REFACTOR discipline, Iron Law, rationalization-table pattern, pressure scenarios for discipline skills, CSO keyword guidance)

### Boundaries

- Defines the standard and runs the validator. Does NOT auto-rewrite skills (author decides what to fix).
- Does NOT replace the workflow skills.
- The standard is closed: deviations require updating `references/standard.md` and bumping skill-creator's version first.
