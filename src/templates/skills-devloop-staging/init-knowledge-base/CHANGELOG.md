# Changelog — init-knowledge-base skill

## [0.1.0] — 2026-05-01

### Added

- Initial skill (M1-T07)
- SKILL.md following Anthropic doctrine: official frontmatter only, `context: fork` for isolated subagent execution
- Bootstrap process documented step-by-step: scan codebase, propose terms, get human approval, write CONTEXT.md, create docs/adr/
- Triggered automatically by `devloop run` when `docs/CONTEXT.md` is missing
