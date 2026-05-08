# Changelog — zoom-out skill

## [0.1.0] — 2026-05-02

### Added

- Initial skill integrated into devloop's ecosystem.
- The trigger phrase — _"I do not know this area of code well. Go up a layer of abstraction. Give me a map of the relevant modules and callers, using the project's domain glossary vocabulary."_
- `disable-model-invocation: true` — this skill is a deliberate user trigger, never auto-fired.
- 5-step process — read CONTEXT.md → read relevant ADRs → spawn Explore subagent for the map → present using CONTEXT.md + architecture vocabulary → ask for next step.
- Defined output shape (modules / adjacent modules / open questions / relevant ADRs) so the map is consistent across invocations.

### Devloop conventions

- Explicit references to `docs/CONTEXT.md` (domain glossary) and `docs/adr/` (load-bearing decisions) — matches the `discover` mode `domain` and `architecture-review` conventions.
- Codebase walk delegated to Task tool with `subagent_type=Explore` to keep the orchestrator's context clean.
- Glossary discipline matches `architecture-review` — avoid "component", "service", "API", "boundary"; use module / interface / seam / adapter when describing structure.
- Named composition paths to other devloop skills:
  - Map reveals deepening opportunity → `devloop:architecture-review`
  - User picks a feature direction → `devloop:feature-workflow`
  - Bug surfaces during mapping → `devloop:bug-fix-workflow`
  - Map terms missing from glossary → propose `CONTEXT.md` additions (same discipline as `discover` mode `domain`)

### Boundaries

- Produces a map. Does NOT propose refactors (architecture-review's job), does NOT plan features (discover + plan-writing), does NOT debug (diagnose / bug-fix-workflow).
- Cannot auto-fire — `disable-model-invocation: true`. User must explicitly invoke via `/devloop:zoom-out` or paste the trigger phrase.
