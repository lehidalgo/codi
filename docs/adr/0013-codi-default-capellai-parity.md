# ADR-013: codi-default replaces all presets — content = capellai parity (placement-only scope)

- **Date**: 2026-05-17
- **Category**: ARCHITECTURE / DISTRIBUTION
- **Status**: Proposed
- **Session origin**: Grilling session 2026-05-17 (this session). Parallel/independent to ADR-012 (capellai-parity-import), which was authored separately and reached convergent conclusions on the broader decision.
- **Distinct contribution vs ADR-012**: this ADR refines the **scope of the executor's PR to artifact placement only** (drop content under `src/templates/` following existing codi conventions; do NOT design new generation/degradation infrastructure as part of this PR). It also drops `v1-sprint-gates` from the parity set as project-specific to an unrelated sprint.
- **Relationship to other ADRs**: ADR-006 catalog is partly superseded as per ADR-012; ADR-011 (skill dependency declaration) is honored unchanged.

## Context

`codi init` currently exposes six built-in presets (`minimal`, `balanced`, `strict`, `fullstack`, `development`, `power-user`). `DEFAULT_PRESET = codi-balanced` (`src/constants.ts:142`). `CONTEXT.md` already documents the intended end state as a **single canonical "Default install"**, replacing the choose-a-preset UX, but the codebase still ships the six-preset world.

In parallel, the operator's reference deployment (`capellai-ai-crm/.claude/`) has converged on a concrete, battle-tested set of artifacts: 40 skills, 26 rules, 2 agents, 5 slash commands, two Claude Code lifecycle hooks, nine `scripts/hooks/*.sh` guards referenced by `.claude/settings.json`, plus `_index.md` and `CLAUDE.md`. That set is what the operator wants every new `codi init` to install. Today there is no preset that produces it: codi's current `balanced` is a strict subset.

A non-trivial part of the overlap with capellai is the Obsidian/wiki subset (skills `wiki, wiki-ingest, wiki-query, wiki-lint, wiki-fold, save, autoresearch, canvas, obsidian-bases, obsidian-markdown`; agents `wiki-ingest, wiki-lint`; commands `wiki, wiki-query, save, autoresearch, canvas`). The same skill family lives, in a more general-purpose form, in the public `AgriciDaniel/claude-obsidian` repository, which capellai's setup likely drew from.

codi is pre-release; no production `.codi/` installs need to be migrated.

## Decision

1. **One registered preset.** Delete the registrations of `minimal`, `balanced`, `strict`, `fullstack`, `development`, `power-user` from `src/templates/presets/index.ts` and remove their `.ts` files. Register a single preset, `codi-default`. `DEFAULT_PRESET = prefixedName("default")`.

2. **Preset machinery stays intact.** The resolver, flag system, wizard, and `--preset <name>` CLI flag are NOT modified. The registry simply shrinks to one entry. The wizard's "which preset?" branch becomes degenerate (single choice) but the code path stays — this minimises blast radius and keeps the abstraction available for future presets.

3. **`codi-default` content = capellai parity.** Every artifact rendered into `.claude/` (or the equivalent target directory of the selected agent) after `codi init --preset codi-default` matches the corresponding artifact in `capellai-ai-crm/.claude/` semantically. "Semantically" because frontmatter form (category, compatibility, managed_by, version, maintainers, placeholders) follows codi's templating discipline; body/intent follows capellai's rendered version.

4. **Best-of-both merges.** For artifacts that exist in more than one upstream source:
   - 14 skills exist in both codi/src/templates and capellai/.claude — merge produces a "pro" version: capellai wins semantics, codi wins form, claude-obsidian contributes design improvements where applicable.
   - 7 skills exist in both claude-obsidian and capellai — claude-obsidian is cloned to a tmp dir for the duration of the merge work; codi's template synthesises the best of both. claude-obsidian is NOT a runtime dependency; nothing references it after the merge lands.
   - 19 skills only exist in capellai — direct port (re-templated to codi's form).
   - Same rule applies for rules, agents, commands, and lifecycle hooks where multiple sources exist.

5. **Scope of this PR = artifact placement.** This ADR's executor job is to drop the parity content into `src/templates/` following codi's existing conventions. The expected output of `codi init --preset codi-default` is the full stack below — generation pipelines and multi-agent degradation are codi's existing responsibility, not this PR's design surface:
   - 40 skills under `src/templates/skills/<name>/`
   - 25 rules under `src/templates/rules/<name>.ts` (Capellai's set of 26 minus `v1-sprint-gates`, which is dropped as project-specific to an unrelated sprint)
   - 2 agents under `src/templates/agents/<name>.ts`
   - 5 commands (location follows existing codi convention if one exists, else flagged as a discovery item during execution)
   - 2 Claude Code lifecycle hooks (location follows existing convention)
   - 9 `scripts/hooks/*.sh` (location follows existing convention)
   - `_index.md`, `CLAUDE.md`, extended `settings.json` content — same rule: place the content, trust codi's renderers

   If during execution any of those surfaces lacks a corresponding renderer in codi, it gets surfaced as a gap for a separate decision — this PR does NOT design new generation infrastructure.

6. **Multi-agent: codi's existing degradation pipeline.** Priority surfaces remain **Claude Code** and **Codex**. For other selected agents, codi already handles per-agent rendering and graceful degradation when a feature has no equivalent. This PR does not add new degradation logic.

7. **No legacy migration.** A `.codi/preset.json` that names a removed preset (`codi-balanced` etc.) is treated as fresh ground on the next `codi init`: codi assumes pre-release status with no preserved installs.

## Considered alternatives

- **Replace `codi-balanced` content in place.** Less code deleted, but the name now lies (no "balanced vs strict" dichotomy exists anymore). Rejected.
- **Keep the other presets opt-in.** Maintain `minimal`/`strict`/etc. as choosable but hide them from the default wizard. Rejected for surface-area cost; the operator confirmed deletion.
- **Reference `claude-obsidian` as a live plugin/dep.** Considered for the Obsidian subset. Rejected: codi doesn't yet have plugin infra; mission is parity, not perpetual sync. claude-obsidian is consulted at merge time only.
- **Force parity-level rendering on Cursor/Windsurf/Cline/Copilot.** Rejected: lifecycle hook equivalents are not technically achievable without per-agent research work that explodes the scope.

## Consequences

- **codi becomes opinionated.** Anyone who runs `codi init` gets a substantial workflow stack including Obsidian/wiki tooling. The product framing must reflect that — codi is no longer "a flexible preset framework", it's "the installer for this canonical stack".
- **`src/templates` grows.** ~26 new skill templates, 3 new rule templates, 2 new agent templates, plus the 5 commands / 2 lifecycle hooks / 9 scripts as content drops. Test surface grows in step.
- **Tests for removed presets must die.** `tests/unit/presets/balanced.test.ts` and siblings.
- **Discovery items may surface during execution.** If codi lacks a renderer for `commands/`, `scripts/hooks/`, lifecycle hooks, `_index.md`, or the extended `settings.json`, the gap is flagged for a separate PR — this PR keeps its scope to artifact placement.
- **Backward compatibility note in CHANGELOG / release notes is required** even though no legacy installs are preserved — anyone consuming `codi-balanced` programmatically (CI, scripts) will break loudly.
- **A single atomic PR delivers all of this**, stacked on top of `feature/codi-v3-harness` (not main).

## References

- `CONTEXT.md` line 67-68 — definition of "Default install"
- ADR-006 — catalog 77 artifacts (origin of the `codi-default` term)
- `capellai-ai-crm/.claude/` — source of parity content
- `github.com/AgriciDaniel/claude-obsidian` — secondary source for Obsidian/wiki subset merges
