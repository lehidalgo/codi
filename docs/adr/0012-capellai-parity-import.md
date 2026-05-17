# ADR-0012: Capellai parity import + sole `codi-default` preset

- **Date**: 2026-05-17
- **Category**: ARCHITECTURE
- **Status**: Accepted
- **Source decisions**: User direction 2026-05-17 (after grilling Q1-Q9 of ADR-0011)
- **Supersedes content of**: ADR-0006 catalog (49 skills + 21 rules + 4 agents + 3 presets)
- **Related ADRs**: ADR-0006 (catalog mechanism), ADR-0011 (skill dependency declaration system)

## Context

ADR-0006 defined CODI's first catalog cut: 77 artifacts split across 3 presets (`codi-default`, `codi-extended`, `codi-minimal`). The intent was a curated baseline derived from the codi v2 + DevLoop + new v3 features inventory.

Two years later (2026-05-17 audit), two facts changed the picture:

1. **The audit's reference deployment is `capellai-ai-crm/.claude/`** — the operator's real-world working setup. It contains **26 rules + 40 skills + 2 agents + 5 commands + lifecycle hooks + `scripts/hooks/*.sh` + `settings.json` + `_index.md` + project-rendered `CLAUDE.md`**. This is the empirical answer to "what does a serious team actually use?" — it is the proven baseline, not a designed one.
2. **The user's direction** (post-grilling): kill the multi-preset choose-your-own-adventure UX. `codi init` must install a single canonical set with zero up-front decision; the user only customizes after install.

The implication: `codi-default` should ship the **capellai-parity set** as its content, not the ADR-0006 invented catalog. And `codi-default` should be the **only** registered preset — `codi-minimal`, `codi-balanced`, `codi-strict`, `codi-fullstack`, `codi-extended`, `codi-power-user`, `codi-development` all retire.

A third complication: capellai's Obsidian/wiki subset (knowledge management, vault discipline, autoresearch, canvas, etc.) was originally derived from `AgriciDaniel/claude-obsidian` — a public, well-maintained upstream. For those artifacts (~7 skills + 2 agents + 4 commands) we have THREE inputs to reconcile: capellai's rendered version, claude-obsidian's pristine version, and any pre-existing codi/src/templates version. Picking one source loses signal; merging gets us the best of all three.

## Decision

### D1 — `codi-default` is the only registered preset

Retire `codi-minimal`, `codi-balanced`, `codi-strict`, `codi-fullstack`, `codi-extended`, `codi-power-user`, `codi-development` from the user-facing preset selection. The preset abstraction (resolver, flag system, wizard, `--preset <name>` CLI flag) is **retained internally** — `codi-default` remains a preset technically, so existing machinery keeps working unchanged. But it is the **sole** entry in the registered preset catalog.

`codi init` skips the "choose a preset" wizard step and auto-applies `codi-default`. The customization wizard (`codi init --customize`) still runs the artifact selection step but starts with every `codi-default` artifact pre-checked. Deselection follows the cascade rule (ADR-0011 §Q6).

The retired preset files are deleted from `src/templates/presets/`; only `codi-default.ts` survives.

### D2 — `codi-default` content = Capellai parity set

The content of `codi-default` is the artifact set that, when rendered into a fresh project via `codi init --preset codi-default`, produces a `.claude/` whose contents semantically match `capellai-ai-crm/.claude/` today.

"Semantic match" means:
- **Frontmatter form** follows codi templating discipline: placeholders (`{{name}}`, `${PROJECT_NAME}`, `${SKILL_CATEGORY.*}`), no project-specific names, no hardcoded paths. (This is the codi side of the merge.)
- **Body / intent** follows capellai's rendered version where capellai has improved on the codi/src/templates baseline. (This is the capellai side.)
- The result satisfies the ADR-0011 dependency hook (every body ref is in `depends_on`, every entry is referenced).

The parity set is:

| Artifact kind | Count | Source distribution |
|---|---|---|
| Skills | 40 | ~33 from codi/src/templates (with capellai improvements merged in) + 7 from the Obsidian/wiki subset (3-way merge incl. claude-obsidian) |
| Rules | 26 | ~22 from codi/src/templates + 4 capellai-specific (`agent-capability-discovery`, `dev-vault-discipline`, `output-tone-policy`, `v1-sprint-gates`) |
| Agents | 2 | Both from the Obsidian/wiki subset (`wiki-ingest`, `wiki-lint`) — 3-way merge incl. claude-obsidian |
| Commands | 5 | Capellai-specific (`wiki`, `wiki-query`, `autoresearch`, `canvas`, `save`) — 3-way merge incl. claude-obsidian where applicable |
| Lifecycle hooks | (current set + 3 additions) | Add PreToolUse Bash guard, PreToolUse Edit guard, PostToolUse auto-format from capellai |
| `scripts/hooks/*.sh` | per-skill where capellai has them | Capellai literal |
| `settings.json` template | 1 | Capellai literal, parameterised by codi placeholders |
| `_index.md` | 1 | Capellai literal, parameterised |

### D3 — Best-of-both merge process

For every artifact in the parity set, the maintainer applies the merge pattern:

1. **List inputs.** Up to three: `(a)` codi/src/templates if a same-named artifact exists, `(b)` capellai/.claude rendered version, `(c)` `AgriciDaniel/claude-obsidian` if the artifact is in the Obsidian/wiki subset.
2. **Choose frontmatter source.** Always (a) if present (codi's templating discipline). If (a) absent, derive frontmatter from (b) by replacing project-specific values with `{{name}}` / `${PROJECT_NAME}` placeholders.
3. **Choose body source.** (b) is the default — capellai has rendered + battle-tested it. Pick (a) only if capellai's body has regressed (lost a section, simplified incorrectly). Pick (c) only for the Obsidian/wiki subset where claude-obsidian has design improvements capellai hasn't picked up.
4. **Reconcile dependencies.** Apply ADR-0011 §Q1-Q9 from scratch: declare `depends_on` for every cross-artifact reference in the chosen body. The merge does not preserve any pre-existing `depends_on` from inputs (which mostly don't have one anyway).
5. **Verify.** Run the ADR-0011 dependency hook against the merged artifact. Fix any violations before moving on.

The merge is a **one-shot exercise** during the parity import PR. `AgriciDaniel/claude-obsidian` is cloned to a tmp dir at the start of the PR, consulted as a reference, and discarded. It is **not** a runtime dependency, not bundled, not vendored.

### D4 — Default install excludes nothing the user might want; everything else is `codi add ...`

The capellai-parity set IS the curated "everything useful for a serious dev team" baseline. There are no opt-in "add-ons" or "extension packs" in this iteration — those were entertained in the V4 PROPOSAL doc but rejected in favor of capellai parity simplicity.

Users who want artifacts outside the parity set use the existing `codi add skill <name>` / `codi add rule <name>` / `codi add agent <name>` flow against the deferred catalog in `src/templates/skills/_deferred/` (per ADR-0006). Per ADR-0011, every added artifact must declare `depends_on` and pass the hook.

## Consequences

### Positive

- **Zero install-time decision** matches user direction (`codi init` ships a working baseline immediately).
- **Capellai parity** uses an empirically-validated baseline instead of a designed-from-scratch one — lower risk of "we shipped the wrong defaults".
- **Best-of-both merge** salvages the lessons learned in both capellai (production usage) and claude-obsidian (design polish for the Obsidian subset) without losing either.
- **Single preset** dramatically simplifies the wizard, the docs, the docs site catalog page, and the user mental model. No more "which preset should I pick?".
- **No backwards-compat exposure** since the retired presets were unreleased internal categories from ADR-0006 — no users in the wild depend on `codi-extended` or `codi-balanced` by name.
- **Preset abstraction retained internally** means the dep-resolver, flag-overlay, wizard, and `--preset` CLI flag continue working — no refactor of those subsystems.

### Negative

- **One-shot import PR is large.** ~40 skill imports + ~26 rule imports + ~2 agent imports + ~5 command imports + lifecycle hooks + scripts/settings/index. Estimated ~2,000-4,000 LOC of (mostly imported) template content plus the dep-hook migration on top. Mitigation: structure as a sequence of smaller commits within one PR (one per artifact kind), each independently reviewable.
- **Capellai naming is fixed once imported.** If capellai later renames or restructures an artifact, codi's parity set drifts. Mitigation: document the parity baseline date (2026-05-17 capellai snapshot) in the PR description; future re-syncs are explicit decisions.
- **AgriciDaniel/claude-obsidian as a one-shot input** means future improvements upstream require manual re-merge. Mitigation: same as above — only re-sync intentionally.
- **The "5 retired presets" reduction** removes a piece of marketing surface ("codi has 6 presets!"). Mitigation: the simpler story ("codi ships the curated baseline; customize after") is easier to explain.
- **The Obsidian/wiki subset is opinionated** (knowledge-graph-style workflow, not universal). Some teams won't use it. Mitigation: it's part of the parity set; teams that don't want it use `codi remove skill wiki-*` after init.

## Alternatives considered

### Alt A — Keep the 6 presets, add `codi-default` as a 7th "everything"

Pros: backwards-compat with ADR-0006.
Cons: contradicts the user goal ("kill the choose-your-own-adventure UX"). Six presets that look similar dilute the user mental model.

### Alt B — Compute `codi-default` content from capellai dynamically at install time

Pros: no source-tree import; capellai changes pick up automatically.
Cons: capellai is the operator's private project — not a public source we should ship a dependency on. We also can't validate dep-hook on content we don't own.

### Alt C — Best-of-three including the V4 proposal's "industry baseline 12" set

Pros: explicit alignment with ThoughtWorks Tech Radar / DORA / Anthropic guidance.
Cons: the V4 baseline was a designed set; capellai already encodes most of those practices empirically. Adding a 4th merge input multiplies decision fatigue per artifact.

### Alt D — Drop the Obsidian/wiki subset entirely; keep parity to the non-wiki capellai

Pros: smaller import, less opinionated default.
Cons: capellai's wiki workflow IS part of why it works — it's the knowledge persistence layer. Removing it ships a partial-and-less-coherent baseline.

## Implementation

See `docs/20260517_170500_PLAN_capellai-parity-import.md` for the file-by-file execution plan.

Sprint outline (~3-5 days focal, on top of ADR-0011's hook implementation):

1. **Clone reference inputs.** Snapshot capellai/.claude and AgriciDaniel/claude-obsidian to tmp dirs. Record commit hashes.
2. **Inventory mapping.** Build a 73-row spreadsheet: every parity-set artifact, its three potential inputs (codi/capellai/obsidian), its target location, and the merge decision per artifact.
3. **Per-artifact merge.** For each row, apply the best-of-both procedure (D3). Commit per artifact-kind batch (skills batch, rules batch, agents batch, commands batch, hooks batch, settings batch).
4. **Reduce preset registry.** Delete the 6 retired preset files. Update `presets/index.ts` to export only `codi-default`. Update tests that reference the old presets.
5. **Run ADR-0011 dep-hook.** Validate the merged catalog passes the bidirectional rule, has no cycles, no phantom refs. Fix violations.
6. **Update wizard.** Skip preset-selection step in `codi init`; `--customize` runs artifact-selection with `codi-default` pre-checked.
7. **Tests + docs.** E2E that `codi init` (no flags) produces a `.claude/` semantically equal to capellai's snapshot.

This work and ADR-0011's hook work CAN proceed in parallel on separate branches, but must converge before either ships — the hook validates the parity content, the content fills the hook.

## Migration impact on `[[Default install]]` definition

The `Default install` term in `CONTEXT.md` is updated to reference this ADR for content and ADR-0011 for the dependency mechanism. The prior text citing ADR-0006's catalog cut (49 + 21 + 4) is historical context only — superseded by the parity set.
