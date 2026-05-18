# ADR-0011: Skill dependency declaration system (`depends_on` + bidirectional hook)

- **Date**: 2026-05-17
- **Category**: ARCHITECTURE
- **Status**: Accepted
- **Source decisions**: Grilling session Q1-Q9 + Q4.1, Q5.1, Q6.1, Q7.1, Q9.1, 2026-05-17
- **Supersedes**: none
- **Related ADRs**: ADR-0004 (workflows as artifacts), ADR-0006 (catalog 77 artifacts)

## Context

Skills in CODI reference other artifacts (other skills, agents, rules) during their execution — chains, escalations, prerequisites, fallbacks, orchestrations. Today these references live exclusively in prose body text using the convention `${PROJECT_NAME}-<name>` (49 of 73 source skills, ~268 cross-references inventoried in audit 2026-05-17).

Three problems arise:

1. **No formal declaration.** The dependency graph is implicit in prose; machines cannot reliably extract it. Tooling (wizard, validator, code review) has nothing to query.
2. **No drift detection.** Body prose can mention skills that don't exist (16 candidate phantom refs reported by audit), or omit deps the skill actually invokes. Both go unnoticed.
3. **Wizard cannot warn on deselect.** During `codi init` (or any selection wizard), the user can deselect a skill whose absence will break dependents. With no graph, the wizard cannot surface the impact.

The user goal (2026-05-17 brief): "the default install ships everything and the wizard only asks for confirmation; when the user deselects an artifact that is a dependency of another, the wizard must warn intelligently — no hardcoded mapping."

A formal, machine-readable dependency declaration is the prerequisite for that goal.

## Decision

CODI introduces a `depends_on` field on Skill frontmatter, validated by a new pre-commit hook `skill-dependency-check` that runs in both source (`src/templates/skills/`) and user (`.codi/skills/`) contexts.

### Q1 — Dependency scope

A Skill MAY declare dependencies on other artifacts of kind `skill`, `rule`, or `agent`. Rules and Agents do NOT declare outbound dependencies in this iteration — only Skills do.

### Q2 — Declaration shape (frontmatter)

Flat list of entries, each with explicit `kind` discriminator:

```yaml
depends_on:
  - kind: skill | rule | agent
    name: <bare-source-name>           # e.g. "tdd" (not "codi-tdd")
    role: prerequisite | required | optional | fallback | orchestration
    when: <text>                       # optional human-readable condition
    hint: <text>                       # optional human-readable hint
iterative: false                       # default; set true for legitimate self-loops
```

Naming uses the bare source-tree name. The validator resolves the `codi-` prefix per install context.

### Q3 — Required field, no backwards-compat

`depends_on` is a **required field** in the Zod schema. Every Skill (source and user-installed) MUST declare it, even if empty (`depends_on: []`). Hook blocks commits and `codi validate` fails on schema violation. No deprecation window, no opt-in mode.

### Q4 — Bidirectional consistency + escape syntax

Two reference patterns in skill body have distinct semantics:

- `${PROJECT_NAME}-X` (template-literal in source, literal `codi-X` in user installs) — **dependency reference**. MUST appear in `depends_on`.
- `` `X` `` (single-backtick inline code) — **informational mention** ("see also", alternative, comparison). IGNORED by the hook.

Content inside **fenced code blocks** (`` ```...``` ``) is excluded regardless of inner syntax (allows worked examples without false positives).

The hook enforces bidirectional consistency: every body reference must be in `depends_on`, AND every `depends_on` entry must appear at least once as a body reference. Dead declarations fail the hook. Both violations BLOCK the commit.

### Q5 — Workflow effective dependencies

Workflows (Skills with `mode: workflow`) have two dependency sources:

- `chains:` (workflow YAML field, per ADR-0004): the ordered orchestration of skills per phase. Single source of truth for orchestration.
- `depends_on:` (standard skill field): additional non-chain dependencies (rules, agents, other workflows the chain skills don't cover).

The hook computes the workflow's **effective dependency set** as `derive_from_chains(chains) ∪ depends_on` and applies bidirectional consistency against this union. Workflows do not redundantly list chain skills in `depends_on`.

### Q6 — Wizard cascade deselect

When the user deselects an artifact in any selection wizard, the wizard computes the reverse-dependency closure and presents a **single recursive cascade prompt**:

- Required dependents (and workflows that chain the artifact) are cascade-removed alongside the original.
- Optional/fallback dependents are kept but the user is informed they lose that capability.
- The user confirms once (y/N) or cancels the deselect entirely.

### Q7 — Bi-level body syntax

Source files (`src/templates/skills/*/template.ts`) use TypeScript template literals where references appear as `${PROJECT_NAME}-tdd` (interpolated at build time). User installs (`.codi/skills/*/SKILL.md`) use plain markdown where references appear as literal `codi-tdd`. The hook auto-detects context and applies the matching regex; the project prefix is read dynamically (from `constants.ts` in source, `.codi/codi.yaml` in user) to support forks.

### Q8 — Cycle policy

The hook builds a directed graph using only `role ∈ {required, prerequisite}` edges and runs Tarjan SCC detection. Any SCC with more than one node is a cycle and BLOCKS the commit.

- `required` cycles → infinite recursion (ERROR).
- `prerequisite` cycles → deadlock (ERROR).
- `fallback`, `optional`, `orchestration` edges → IGNORED (mutual escalations are legitimate).
- Self-loops require `iterative: true`.

### Q9 — Bundled subagents

A Skill MAY bundle private subagents at `<skill>/agents/<name>.md` (14 of 73 source skills follow this pattern today). Body references to `${PROJECT_NAME}-X` are **exempt from `depends_on` validation when `<this-skill>/agents/X.md` exists** — the reference is an intra-bundle resource pointer, equivalent semantically to a `[[/agents/X.md]]` marker. The hook auto-detects bundled subagents by filesystem check; no extra frontmatter field is needed.

## Consequences

### Positive

- **Machine-readable graph** unlocks the wizard cascade UX (the user's primary requirement) and enables future features (impact analysis, install-time selection assistance, contribution review).
- **Bidirectional rule** prevents two failure modes simultaneously: dead declarations (in frontmatter but unused) and undeclared coupling (used in prose without declaration).
- **No backwards-compat** keeps the schema simple and the migration sharp — clean cutover instead of indefinite mixed-mode complexity.
- **Bundled subagent auto-detect** preserves the existing 14-skill bundling pattern without requiring schema additions.
- **Cycle policy per role** is precise: blocks the genuine bugs (infinite recursion, deadlocks) while permitting legitimate mutual escalation/orchestration.
- **Bi-level hook reuses existing infrastructure** (`skill-resource-check` already handles dual contexts and is installed at user-init time).
- **Fenced-block and backtick exemptions** allow rich prose without false positives — devs can show examples, alternatives, and counter-patterns.

### Negative

- **One-time migration cost.** All 73 source skills must declare `depends_on` before the hook is enabled. Estimated 4-5 hours mostly mechanical (audit identifies 5 cross-artifact deps to declare, ~50 skills need empty `depends_on: []`).
- **Validation overhead per commit.** Hook scans all staged skill files. Mitigation: O(n) where n = lines staged; cached catalogue lookup; runs only when skill files in staging.
- **Stricter author burden.** Every new skill must explicitly enumerate its deps and use the right syntax. Mitigation: `dev-skill-creator` metaskill scaffolds `depends_on: []` and prompts the author for entries.
- **Schema field collision risk** if a future Anthropic Skills spec adds its own `depends_on` field with different semantics. Mitigation: CODI-prefixed schema is private; downstream agents only consume rendered prompts, not raw frontmatter.
- **Workflow `chains:` and `depends_on:` are two fields with overlapping intent.** Mitigation: docs make clear that chains is orchestration (per-phase ordered) and depends_on is auxiliary (rules + agents). The hook merges them at validation time.

## Alternatives considered

### Per Q1 — scope of dependency

- **A. Skill→Skill only.** Simpler, but misses skill→agent (real and common) and skill→rule (occasional but real). Wizard wouldn't warn when a required agent is deselected.
- **C. Full bidirectional (rules and agents also declare).** Massive schema surface for marginal value — rules are mostly self-contained directives; agent → skill direction is already covered by skill → agent.

### Per Q3 — backwards-compat

- **A. Optional forever.** Lowest friction but the wizard graph remains partial (only declared skills get warnings). Drift detection inapplicable for skills without declaration. Contradicts the "clean baseline" goal of the v3 default-install redesign.
- **C. Deprecation window.** Adds calendar complexity and risk of slipping deadlines on a living codebase. The user explicitly chose no backwards-compat to keep the design sharp.

### Per Q4 — drift policy

- **B. Warn only.** Allows incoherent skills to ship; misaligned with the "clean / no backward compat" decision. Worse, drift accumulates silently.
- **D. Frontmatter `see_also` field.** Adds schema surface for a problem already solved by the existing backtick convention. Two fields means devs must classify every mention; backticks let them write naturally.

### Per Q5 — workflow integration

- **B. Duplicate chains in depends_on.** Devs would write the same skill list twice. Single source of truth (chains) avoids drift between the two fields.
- **C. Replace depends_on with chains for workflows.** Asymmetric schema (workflows have one field, other skills have another) complicates validation and tooling. Better: workflows are skills + extra field.

### Per Q6 — wizard UX

- **A. Just warn + continue.** Permits installs where a workflow's required chain skill is missing → wizard succeeds, runtime fails. Worse UX than catching at install time.
- **B. Block required dependents entirely.** Frustrating when the user genuinely intends to remove the upstream artifact; the cascade prompt offers the same safety without the dead end.

### Per Q9 — phantom ref handling

- **C. Auto-fix everything with role=required default.** Risky — many "phantom refs" are actually informational mentions or fenced-block false positives. Manual review per case (the chosen path) eliminated the perceived 16-ref problem down to 5 real actions.

## Implementation

See `docs/20260517_170000_PLAN_skill-dependency-implementation.md` for the file-by-file execution plan.

Sprint outline (~3-4 days focal):

1. **Schema** — add `depends_on` + `iterative` to `src/schemas/skill.ts` (Zod discriminated union per `kind`).
2. **Hook** — implement `skill-dependency-check` in `src/core/hooks/hook-templates.ts` (mirrors `skill-resource-check` structure).
3. **Wire** — install hook in CODI's own `.husky/pre-commit` (source context) and into user `.git/hooks/` via existing `codi generate` flow.
4. **Migrate** — populate `depends_on: []` in 73 source skills + add 3 real deps in plan-execution / brainstorming + convert 2 informational mentions to backticks.
5. **Metaskill update** — `dev-skill-creator` scaffold includes `depends_on: []` and prompts author for entries.
6. **Wizard integration** — `codi init` cascade-deselect UX consumes the graph.
7. **Tests + docs** — bi-level hook tests, CONTRIBUTING.md addition for skill-with-deps authoring.
