# PLAN — Capellai parity import for `codi-default`

- **Date:** 2026-05-17
- **Category:** PLAN
- **Branch base:** `feature/codi-v3-harness`
- **Authoritative decisions:** ADR-0012 (parity import), ADR-0011 (dependency mechanism), ADR-0006 (catalog mechanism)
- **Status:** Ready to execute (sequenced after / alongside ADR-0011 implementation)

## Goal

Replace the content of `codi-default` with the **Capellai parity set** (40 skills + 26 rules + 2 agents + 5 commands + lifecycle hooks + scripts + settings), using the **best-of-three merge** between codi/src/templates, capellai/.claude, and AgriciDaniel/claude-obsidian (Obsidian subset only). Retire the other 6 presets. End result: `codi init` (no flags) installs the entire parity set with zero user decision.

## Phase overview

| # | Phase | Description | Effort |
|---|---|---|---|
| P0 | Snapshot inputs | Clone capellai + claude-obsidian to tmp; record commit hashes | 15 min |
| P1 | Inventory mapping | Build 73-row spreadsheet: every parity artifact × 3 potential sources × merge decision | 2-3h |
| P2 | Skills batch import | 40 skills (33 codi-merge, 7 Obsidian-3-way) | 1-2 days |
| P3 | Rules batch import | 26 rules (22 codi-merge, 4 capellai-only) | 4-6h |
| P4 | Agents batch import | 2 agents (Obsidian-3-way) | 2-3h |
| P5 | Commands batch import | 5 commands (Obsidian-3-way) | 3-4h |
| P6 | Lifecycle hooks + scripts + settings | PreToolUse / PostToolUse guards + capellai-specific scripts/hooks/*.sh + settings.json + _index.md | 3-4h |
| P7 | Preset registry reduction | Delete 6 retired presets; update `presets/index.ts` + tests | 1h |
| P8 | Wizard skip preset selection | `codi init` skips wizard preset step; `--customize` pre-checks codi-default | 2-3h |
| P9 | Dep-hook validation pass | Run ADR-0011 hook on the merged catalog; fix violations | 1-2h |
| P10 | Tests | E2E: `codi init` + diff resulting `.claude/` vs capellai snapshot semantically | 4-6h |
| P11 | Docs + ADR-006 supersession note | Update ADR-006 frontmatter to mark "content superseded by ADR-0012"; update README | 1h |
| **TOTAL** | | | **~4-5 days focal** |

This runs **alongside** ADR-0011's implementation plan (the dep-hook). The dep-hook validates this catalog at the end of the merge; this catalog is the first real consumer of the dep-hook. They must converge before either ships.

---

## P0 — Snapshot inputs

```bash
# In a tmp dir
TMP=/tmp/codi-parity-inputs-$(date +%s)
mkdir -p "$TMP"
cd "$TMP"

# Capellai snapshot (use real path, already on disk)
cp -r /home/lehidalgo/dev/rl3/capellai-ai-crm/.claude ./capellai-claude
cd /home/lehidalgo/dev/rl3/capellai-ai-crm && git rev-parse HEAD > "$TMP/capellai-commit.txt"

# claude-obsidian
cd "$TMP"
git clone --depth 1 https://github.com/AgriciDaniel/claude-obsidian.git
cd claude-obsidian && git rev-parse HEAD > "$TMP/claude-obsidian-commit.txt"
```

**Output:** `$TMP/capellai-commit.txt` and `$TMP/claude-obsidian-commit.txt` are referenced in the parity PR description.

---

## P1 — Inventory mapping

**Output:** `docs/internal/parity-inventory-2026-05-17.md` — a table with one row per artifact in the parity set:

| Target artifact | codi/src/templates source | capellai/.claude source | claude-obsidian source | Merge decision |
|---|---|---|---|---|
| `skills/tdd` | `src/templates/skills/tdd/` | `capellai/.claude/skills/codi-tdd.md` | (none) | (a)+(b): codi frontmatter + capellai body |
| `skills/wiki-ingest` | (none) | `capellai/.claude/skills/wiki-ingest.md` | `claude-obsidian/skills/wiki-ingest.md` | (b)+(c): capellai body merged with claude-obsidian improvements |
| `rules/agent-capability-discovery` | (none) | `capellai/.claude/rules/agent-capability-discovery.md` | (none) | (b) only: capellai-specific, no codi/obsidian counterpart |
| ... ~70 more rows ... | | | | |

This spreadsheet is the **load-bearing artifact** — every merge in P2-P6 references it.

---

## P2 — Skills batch import (40 skills)

**Sub-batches** (commit per sub-batch):

### P2.a — Core workflow skills (~10)
`tdd`, `code-review`, `debugging`, `commit`, `verify-evidence`, `plan-writing`, `plan-execution`, `brainstorming`, `branch-finish`, `worktrees`

Per skill:
1. Read codi version (frontmatter form, dep field, placeholders)
2. Read capellai version (body content, recent improvements)
3. Apply ADR-0012 §D3 merge procedure
4. Write merged file to `src/templates/skills/<name>/template.ts`
5. Run dep-hook locally to validate
6. Commit "feat(skills): import {name} from capellai-parity merge"

### P2.b — Quality skills (~6)
`security-scan`, `refactoring`, `test-suite`, `code-style`, `project-quality-guard`, `audit-fix`

### P2.c — Codebase exploration (~4)
`codebase-explore`, `codebase-onboarding`, `dispatching-parallel-agents`, `dev-session-recovery`

### P2.d — Dev tools / metaskills (~8)
`dev-skill-creator`, `dev-rule-creator`, `dev-agent-creator`, `dev-preset-creator`, `dev-artifact-contributor`, `dev-refine-rules`, `dev-rule-feedback`, `dev-compare-preset`

### P2.e — Obsidian/wiki subset (~7) — 3-way merge
`wiki-edit`, `wiki-query`, `autoresearch`, `canvas`, `defuddle`, `save`, `diagnose`

Each requires:
1. Read codi version (may not exist)
2. Read capellai version
3. Read claude-obsidian version (canonical source)
4. Apply 3-way merge: capellai's body + claude-obsidian design improvements + codi's templating form
5. Write + validate + commit

### P2.f — Misc (~5)
`session-log`, `roadmap`, `caveman`, `humanizer`, `humanize-tone` (or similar capellai-specifics)

**Acceptance per skill:** Zod schema validates; dep-hook passes; renders into `.claude/skills/<name>.md` semantically equivalent to capellai's version.

---

## P3 — Rules batch import (26 rules)

### P3.a — Universal rules (~22, codi-merge)
`workflow`, `git-workflow`, `security`, `testing`, `code-style`, `error-handling`, `output-discipline`, `documentation`, `improvement`, `iron-laws`, `simplicity-first`, `production-mindset`, `architecture`, `capture-everything`, `recommend-pattern`, `agent-usage`, `spanish-orthography`, `typescript`, `react`, `nextjs`, `python`, etc.

Same merge procedure as skills. Codi templating + capellai body refinements.

### P3.b — Capellai-specific rules (4, capellai-only)
`agent-capability-discovery`, `dev-vault-discipline`, `output-tone-policy`, `v1-sprint-gates`

These have no codi/src/templates counterpart. Import body verbatim; reform frontmatter with codi placeholders.

---

## P4 — Agents batch import (2 agents)

`wiki-ingest`, `wiki-lint` — both from the Obsidian subset.

3-way merge: capellai (rendered) + claude-obsidian (canonical) + codi templating form.

Note: per ADR-0006, agents go in `src/templates/agents/` (global), not bundled inside a skill. Confirm capellai uses them as global agents.

---

## P5 — Commands batch import (5 commands)

`wiki`, `wiki-query`, `autoresearch`, `canvas`, `save`

Commands are Claude Code slash-commands (`.claude/commands/<name>.md`). Per ADR-0006, codi may not have a `commands/` template directory today — verify and possibly create one (`src/templates/commands/`).

3-way merge for Obsidian subset (4 of 5: wiki, wiki-query, autoresearch, canvas). `save` may be capellai-only — verify.

---

## P6 — Lifecycle hooks + scripts + settings

### P6.a — PreToolUse / PostToolUse hooks (3 additions)

From capellai's `.claude/hooks/`:
- **PreToolUse Bash guard** (deny `git push main`, `git push --force`, `git config --global *`, etc.) → add to codi's hook template suite
- **PreToolUse Edit guard** (`.env` files require vault-cli or user-confirmation) → add to codi's hook template suite
- **PostToolUse auto-format** (Prettier/Black/etc.) → add to codi's hook template suite

These integrate into the existing `src/core/hooks/hook-templates.ts` registry; they get installed alongside the dependency hook (ADR-0011).

### P6.b — `scripts/hooks/*.sh` per skill

Capellai bundles a few `.sh` helpers under specific skill directories (e.g., `tdd/scripts/`). Import literal into the codi skill bundle structure.

### P6.c — `settings.json` template + `_index.md`

Capellai's `.claude/settings.json` and `_index.md` are project-rendered. Reform with codi placeholders, place in the codi-default preset's "always emit" list.

---

## P7 — Preset registry reduction

**Files:**
- `src/templates/presets/codi-default.ts` (rewrite as the parity set bundle)
- `src/templates/presets/codi-minimal.ts` → **DELETE**
- `src/templates/presets/codi-balanced.ts` → **DELETE**
- `src/templates/presets/codi-strict.ts` → **DELETE**
- `src/templates/presets/codi-fullstack.ts` → **DELETE**
- `src/templates/presets/codi-extended.ts` → **DELETE** (if exists)
- `src/templates/presets/codi-power-user.ts` → **DELETE**
- `src/templates/presets/codi-development.ts` → **DELETE** (or `codi-dev.ts`)
- `src/templates/presets/index.ts` → export only `codi-default`
- `src/templates/presets/core-platform.ts` → fold into `codi-default` or retain as the dep on all (since `codi-default` is now alone, "shared baseline" is just `codi-default` itself)
- Tests: update `tests/unit/flags/flag-presets.test.ts` to assert exactly 1 preset; remove tests referencing retired names

**Acceptance:** `codi preset list --builtin` shows exactly 1 preset (`codi-default`). All tests green.

---

## P8 — Wizard skip preset selection

**Files:**
- `src/cli/init.ts`
- `src/cli/init-wizard.ts`
- `src/cli/init-helpers.ts`

**Changes:**
1. Default flow (`codi init`, no flags, no TTY interactive): skip preset selection step; auto-apply `codi-default`.
2. `codi init --customize`: still runs interactive wizard, but preset step shows only `codi-default` (single option, just confirm). Artifact selection step shows all `codi-default` artifacts pre-checked; supports cascade deselect per ADR-0011 §Q6.
3. `codi init --preset codi-default` continues to work (idempotent with default).
4. `codi init --preset codi-strict` (or any retired name): clear ERROR message (`unknown preset; the only registered preset is codi-default — see ADR-0012`).

**Acceptance:** running `codi init` in a fresh sandbox produces the parity set with zero prompts.

---

## P9 — Dep-hook validation pass

After all imports complete, run the ADR-0011 dependency hook against the entire merged catalog:

```bash
node scripts/hooks/skill-dependency-check.mjs --mode=src --root src/templates --strict
```

Expected: zero errors. Any violations indicate merge mistakes — fix manually.

This phase is the **convergence point** between this plan and ADR-0011's plan. Both must pass before either ships.

---

## P10 — Tests

**New test files:**

1. `tests/unit/templates/parity-inventory.test.ts` — asserts the catalog size matches the parity set (40 skills, 26 rules, 2 agents, 5 commands).
2. `tests/integration/codi-init-parity.test.ts` — runs `codi init` in a sandbox, asserts the resulting `.claude/` contains every parity artifact with expected name + frontmatter.
3. `tests/e2e/parity-vs-capellai-snapshot.test.ts` — uses a snapshot of capellai's `.claude/` (committed under `tests/fixtures/capellai-snapshot-2026-05-17/`) and diff-checks the codi-init output semantically (frontmatter normalised, body byte-equal modulo placeholders).
4. `tests/unit/cli/preset-registry.test.ts` — asserts `getBuiltinPresetNames()` returns exactly `['codi-default']`.
5. Update existing tests: `tests/unit/flags/flag-presets.test.ts` (currently checks 3 presets per ADR-0006), `tests/integration/preset-workflow.test.ts`, `tests/e2e/preset-apply.test.ts`.

**Acceptance:** all tests pass; existing test suite stays green (modulo the preset count updates).

---

## P11 — Docs + ADR-006 supersession note

**Files:**
- `docs/adr/0006-catalog-77-artifacts.md` — add `**Content superseded by:** ADR-0012` to the frontmatter; leave the body intact as historical record
- `docs/adr/0012-capellai-parity-import.md` — already created
- `CONTEXT.md` — already updated to reference both ADRs
- `README.md` — update the "Presets" section to read "CODI ships a single curated baseline (`codi-default`). Customize with `codi add ...` after init."
- `CONTRIBUTING.md` — add section "Updating the parity baseline" explaining how to re-sync from capellai/claude-obsidian if needed in future

---

## Risks + mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Capellai-parity import PR is huge (~3000 LOC) | High | Sub-batch commits within one PR; each batch independently reviewable |
| Capellai snapshot drifts during PR review (capellai is a live project) | Medium | Record commit hash at P0; pin snapshot for the entire PR; re-sync is a follow-up decision |
| Merge decisions are subjective | Medium | The P1 inventory spreadsheet documents each merge choice; reviewer can challenge per row |
| Some retired-preset names appear in user docs or scripts | Low | grep audit + sed replace; the `codi init --preset codi-strict` case raises clear error |
| Existing tests reference the retired presets | Medium | P7 explicitly updates them; CI catches anything missed |
| Obsidian subset is opinionated; some teams won't want it | Low | Documented; `codi remove skill wiki-*` is a clear escape hatch |
| 3-way merge for Obsidian artifacts is hand-craft | Medium | One-time effort; reviewer can validate per-artifact |
| ADR-0011 dep-hook breaks on a merged artifact we didn't anticipate | Medium | P9 catches it; fix is manual but bounded (the catalog is finite) |
| Capellai uses features not yet in codi (e.g. brand new Anthropic skills SDK fields) | Low | Identify in P1 inventory; either implement in codi or drop those fields from the merge |

---

## Definition of done

- `src/templates/presets/` contains exactly one preset file: `codi-default.ts`.
- `src/templates/{skills,rules,agents,commands}/` collectively contain every parity-set artifact, with frontmatter in codi templating form.
- `codi init` (no flags) in a sandbox produces a `.claude/` semantically matching capellai's snapshot.
- ADR-0011's dep-hook passes against the entire catalog.
- `npm test`, `npm run lint`, `npm run build` green.
- ADR-0012 status: Accepted.
- ADR-0006 marked "content superseded by ADR-0012".
- README + CONTRIBUTING updated.

## Coordination with ADR-0011 plan

The two plans are siblings:

- **ADR-0011 plan** (`docs/20260517_170000_PLAN_skill-dependency-implementation.md`) — adds the hook mechanism.
- **This plan** (ADR-0012) — fills the catalog with content the hook will validate.

Order of execution:

1. ADR-0011 plan Phases A + B + C in parallel with this plan's Phases P0 + P1.
2. This plan's Phases P2-P6 (the imports) — at this point ADR-0011's hook exists but is not yet wired in `.husky/`.
3. Wire ADR-0011 hook (Phase C of that plan) only after the imports stabilise — otherwise commits during the import would fail the hook before the migrations are complete.
4. ADR-0011 Phase D (migrate source skills) is **subsumed by this plan's imports** — the imported skills come with `depends_on` declared via the merge procedure. The "migrate 73 skills" step in ADR-0011's plan applies only to skills outside the parity set.
5. ADR-0012 Phases P7-P11 close out the rollout.

A single PR can ship both, or they can ship as 2 PRs (hook PR first, content PR after). User decides.
