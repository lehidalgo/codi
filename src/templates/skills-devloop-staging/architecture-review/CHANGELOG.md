# Changelog — architecture-review skill

## [0.1.0] — 2026-05-02

### Added

- Initial skill integrated into devloop's ecosystem.
- Architecture glossary (Module, Interface, Implementation, Depth, Seam, Adapter, Leverage, Locality) plus three load-bearing principles (deletion test, interface-as-test-surface, one-vs-two-adapter rule).
- 3-step process — Explore (read CONTEXT.md + ADRs, walk the codebase noting friction) → Present candidates (numbered, no interface proposals yet, ADR-conflict marking) → Grilling loop (walk the design tree on chosen candidate with inline CONTEXT.md updates and ADR-rejection offers).
- `references/language.md` — complete vocabulary, principles, rejected framings (lines-ratio depth, "interface" as TS keyword, "boundary").
- `references/deepening.md` — 4 dependency categories (in-process, local-substitutable, remote-but-owned, true-external) with test strategy per category, plus integration with refactor-workflow phases.
- `references/interface-design.md` — "Design It Twice" parallel-subagent pattern with 3-4 design constraints (minimize, maximize flexibility, optimize common case, ports-and-adapters).

### Integration with the rest of devloop

This skill produces candidates; it does NOT execute the refactor.

- Step 1 explore → Task tool subagent for codebase walk
- Step 3 alternative-interfaces → `devloop:subagent-orchestration` mode `parallel` for 3+ parallel interface designs
- Approved candidate → hands off to `devloop:refactor-workflow`:
  - `intent` phase already invokes `discover` mode `wide` — chosen candidate is the intent input
  - `plan` phase invokes `plan-writing` mode `plan` + `discover` mode `domain` (ADR/CONTEXT cross-check)
  - `execute` phase invokes `subagent-orchestration` mode `sequential` for multi-step deepenings
- CONTEXT.md update discipline — shared with `discover` mode `domain` (lazy-create, sharpen-in-place)
- ADR-creation offer — when user rejects with load-bearing reason; same triple-test as `discover` mode `domain`

### Boundaries

- Produces: deepening candidates, optional alternative interface designs, ADR offers for rejected candidates with load-bearing reasons.
- Does NOT produce: refactor implementation (that is `refactor-workflow`'s job).
- Does NOT handle: named bug/feature requests (use bug-fix-workflow / feature-workflow instead).
- Skip when user has a specific problem in mind; this skill is for surfacing latent friction.
