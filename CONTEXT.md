# CONTEXT.md — CODI domain glossary

Living glossary of domain terms used in CODI. Updated inline as terms are resolved during grilling sessions. **NOT a spec, scratchpad, or decision log** — only term definitions. Decisions live in `docs/adr/`. Plans live in `docs/`.

## Vocabulary

### Artifact

A unit of agent configuration emitted by CODI. Five concrete kinds exist today: **Skill**, **Rule**, **Agent**, **Workflow**, **Preset**. (Workflows are Skills with `mode: workflow`, per ADR-004; Gates are sub-units of Workflows.)

### Skill

A reusable agent capability declared as a Markdown file with YAML frontmatter, living in `src/templates/skills/<name>/` (source) or `.codi/skills/<name>/` (user install). Skills have a `mode` field with four values: `skill` (default), `gate`, `workflow`, `install`. Skills can have bundled resources (scripts, references, assets) addressed via `[[/path]]` markers.

### Rule

A directive that the agent must follow during all interactions, declared as a Markdown file with YAML frontmatter in `src/templates/rules/` or `.codi/rules/`. Rules are loaded unconditionally; they do NOT chain or escalate to other artifacts.

### Agent

A subagent definition with specialized tools/model/system-prompt, declared as a Markdown file with YAML frontmatter in `src/templates/agents/` or `.codi/agents/`. Agents are invoked via the `Task` tool from skills or other agents.

### Workflow

A Skill with `mode: workflow` whose body declares phases and skill chains. See ADR-004.

### Metaskill

A skill that creates, audits, or refines other artifacts. Lives in the "L bloque" per ADR-006: `dev-skill-creator`, `dev-rule-creator`, `dev-agent-creator`, `dev-preset-creator`, `workflow-creator`, `gate-creator`, `skill-audit`, `dev-artifact-contributor`.

### Skill dependency

A declared, machine-readable relationship from a **Skill** (the dependent) to another **Artifact** (the dependency) that the Skill invokes, escalates to, requires, or orchestrates during its execution. Dependency targets can be of kind `skill`, `rule`, or `agent` (decision Q1, 2026-05-17). Rules and Agents themselves do NOT declare outbound dependencies in this iteration — only Skills do.

Declared in the Skill's YAML frontmatter as a flat list with explicit `kind` + `name` + `role` (decision Q2, 2026-05-17):

```yaml
depends_on:
  - kind: skill        # skill | rule | agent
    name: <bare-name>  # source filename without codi- prefix
    role: <role>       # see "Dependency role" below
    when: <text>       # optional human-readable condition
    hint: <text>       # optional human-readable hint
```

The artifact `name` is the **bare source-tree name** (filename without `codi-` prefix). The validator resolves prefix at runtime per install context (`src/` vs `.codi/`).

### Dependency role

Enum that classifies the nature of a Skill→Artifact dependency. Five values:

- `prerequisite` — Y must complete BEFORE X starts (temporal ordering)
- `required` — X invokes Y DURING its own execution (compositional)
- `optional` — X MAY invoke Y depending on context (best-effort)
- `fallback` — Y is invoked if X exhausts retries or fails (escalation)
- `orchestration` — X delegates a sub-step to Y as part of a workflow (delegation)

### Iterative skill

A Skill that legitimately invokes itself in a loop (e.g., `plan-execution` re-entering for multi-step plans). Declared as a top-level frontmatter flag `iterative: true` (default `false`). Distinct from `depends_on` because the target is the skill itself; the flag disambiguates a real loop from a copy-paste bug.

### Install context (bi-level)

CODI's source code (`src/`) is the surface CODI maintainers edit. After `codi init`, a user gets `.codi/` in their project. Both levels host artifacts and BOTH must be validated by the dependency hook — `src/templates/skills/*/template.ts` for maintainers, `.codi/skills/*/SKILL.md` for users. Catalogue resolution differs by context but the validation algorithm is shared.

### Default install

The single canonical set of artifacts every user gets after `codi init` with zero configuration. Replaces the previous "choose a preset" UX. ADR-006 first defined `codi-default` as 49 skills + 15 rules + 4 agents; **ADR-011** locks the dependency-declaration mechanism (the `depends_on` field + bidirectional hook that validates this catalog) and **ADR-012** supersedes the content with the [[Capellai parity]] set (40 skills + 26 rules + 2 agents + 5 commands + lifecycle hooks + `scripts/hooks/*.sh` + `settings.json` + `_index.md` + `CLAUDE.md`). The preset abstraction is retained — `codi-default` is the **only registered preset** — so the resolver, flag system, wizard, and `--preset <name>` flag keep working unchanged.

### Capellai parity

The semantic alignment between `src/templates/*` (codi maintainer surface) and `capellai-ai-crm/.claude/*` (operator's reference deployment), such that `codi init --preset codi-default` rendered into a fresh project produces a `.claude/` whose contents match capellai's installed configuration. "Semantic" because frontmatter form follows codi's templating discipline (placeholders `{{name}}`, `${PROJECT_NAME}`, `${SKILL_CATEGORY.*}`) while body/intent follow capellai's rendered version. Defined by ADR-012 (capellai-parity-import) and refined by ADR-013 (placement-only scope) which drops `v1-sprint-gates` and bounds the executor's PR to artifact placement (no new generation/degradation infrastructure designed in that PR).

### Best-of-both merge

A synthesis pattern used during the [[Capellai parity]] import for artifacts that exist in more than one upstream source. Inputs are: (a) the codi/src/templates version (if present), (b) the capellai/.claude rendered version, and (c) the `AgriciDaniel/claude-obsidian` version (for the Obsidian/wiki subset only — 7 skills, 2 agents, 4 commands). Output is a single template that combines the best body/intent from capellai, the best frontmatter form and placeholder discipline from codi, and any design improvements from claude-obsidian. The merge is a one-shot exercise during the parity PR; claude-obsidian is cloned to a tmp dir for the merge and is NOT a runtime dependency afterward.

### Phantom reference

A textual mention of an artifact (e.g., `${PROJECT_NAME}-code-reviewer` in skill prose) that does not resolve to any actual artifact in the catalogue. Identified in audit 2026-05-17 as a real bug (16 instances). Phantom references typically result from skill/agent type confusion (a skill mentions an "agent" expecting it to also be a skill) or from designed-but-unimplemented artifacts.

### Schema requirement (required field)

`depends_on` is a **required** field in the Skill frontmatter schema (decision Q3, 2026-05-17). Every Skill in source and in user installs MUST declare it, even if empty (`depends_on: []` for autonomous skills). No backwards-compat with skills that omit the field — the hook blocks commits and `codi validate` fails on schema violation. This is consistent with the "clean baseline" philosophy of the v3 default-install redesign.

### Body reference syntax

Two distinct markdown patterns govern how skill bodies refer to other artifacts (decision Q4, 2026-05-17):

- **`${PROJECT_NAME}-<name>`** (template literal) — DEPENDENCY reference. The hook MUST find this name in `depends_on`. Used when one skill genuinely invokes, escalates to, requires, or orchestrates another.
- **`` `<name>` ``** (single-backtick inline code) — INFORMATIONAL mention. Used for "see also", alternatives, comparisons, examples. The hook IGNORES these.

Content inside **fenced code blocks** (`` ```...``` ``) is also ignored by the hook regardless of which syntax appears inside. This allows skills to show worked examples without triggering false positives.

### Bidirectional consistency rule

The hook enforces strict bidirectional consistency between frontmatter and body (decision Q4, 2026-05-17):

1. **Body → frontmatter:** every `${PROJECT_NAME}-X` reference in the body (outside backticks and fenced blocks) MUST appear as an entry in `depends_on`.
2. **Frontmatter → body:** every entry in `depends_on` MUST appear at least once as `${PROJECT_NAME}-X` in the body. A declared dep with no body usage is a dead declaration and fails the hook.

Both violations BLOCK the commit. There is no warn-only mode.

### Workflow effective dependencies

Workflows (Skills with `mode: workflow`) have **two complementary dependency sources** (decision Q5, 2026-05-17):

- **`chains:`** (workflow-specific YAML field, per ADR-004): the ordered orchestration of skills the workflow invokes per phase. Single source of truth for orchestration.
- **`depends_on:`** (standard skill field): optional additional dependencies that are NOT in chains — typically rules and agents the workflow requires (e.g., a workflow that depends on `codi-iron-laws` rule globally, or on `code-reviewer` agent invoked in a specific phase).

The hook computes the workflow's **effective dependency set** as the union: `effective_deps = derive_from_chains(chains) ∪ depends_on`. The bidirectional consistency rule applies against `effective_deps`. Workflows therefore do not declare chain skills in `depends_on` redundantly; the derivation is automatic.

### Cycle policy

Cycles in the dependency graph are validated per-role (decision Q8, 2026-05-17). The hook builds a sub-graph using only edges with role ∈ {`required`, `prerequisite`} and runs strongly-connected-component (SCC) detection (Tarjan). Any SCC with more than one node is a cycle and **blocks the commit**.

- `required` cycles cause infinite recursion at runtime → ERROR.
- `prerequisite` cycles are mathematically impossible (mutual "must run first" is a deadlock) → ERROR.
- `fallback`, `optional`, and `orchestration` edges are **ignored** by cycle detection. Mutual escalations (e.g., `code-review ↔ debugging` as `fallback`) are legitimate and remain allowed.
- Self-loops (single-node SCCs) are handled separately by the `iterative: true` flag.
- Rules and agents cannot participate in cycles (they don't declare outbound deps per Q1), so all cycles are skill ↔ skill by construction.

### Bundled subagent

A subagent (Markdown file with frontmatter) shipped INSIDE a Skill bundle at `<skill>/agents/<name>.md`. Discovered during grilling 2026-05-17: 14 of 73 source skills follow this pattern (e.g., `code-review/agents/code-reviewer.md`, `pr-review/agents/pr-reviewer.md`). Bundled subagents are private to the skill that bundles them and do NOT appear in the global `src/templates/agents/` catalogue.

When a Skill body references `${PROJECT_NAME}-X` and `<this-skill>/agents/X.md` exists, the reference is **intra-bundle** — semantically equivalent to a `[[/agents/X.md]]` resource pointer. The dependency hook MUST exempt these references from the bidirectional `depends_on` rule, because bundled subagents are filesystem-resident resources, not cross-artifact dependencies (decision sub-Q9.1, 2026-05-17). The hook auto-detects bundled subagents by checking `<this-skill>/agents/<name>.md` existence; no extra frontmatter field is needed.

### Body reference syntax by context

The same semantic reference uses different surface syntax in source vs user installs (decision Q7, 2026-05-17):

| Context | File | Reference syntax |
|---|---|---|
| Source (`src/templates/skills/<name>/template.ts`) | TypeScript template literal | `${PROJECT_NAME}-tdd` (interpolated at build time) |
| User install (`.codi/skills/<name>/SKILL.md`) | Plain markdown | `codi-tdd` (literal, post-interpolation) |

The hook auto-detects context and applies the appropriate regex. The detection of the user-level prefix is **dynamic** — read from `PROJECT_NAME` constant (source) or `.codi/codi.yaml` (user) — so forks or renames work without hard-coded "codi" strings anywhere.

### Cascade deselect (wizard semantics)

When the user deselects an artifact during `codi init` (or any selection wizard), the wizard computes its **dependents** (the reverse-lookup set of the dependency graph) and presents a **single cascade decision** (decision Q6, 2026-05-17):

- Dependents with role `required` (or workflows that include the deselected artifact in their `chains:`) are **cascade-removed** along with the original selection.
- Dependents with role `optional` or `fallback` are kept in the install but the user is informed that the dependent will lose that capability.
- The decision is **recursive transitively** — if cascade-removing artifact X surfaces NEW required dependents, they appear in the same prompt (single decision point, not chained prompts).
- The user confirms once (y/N) or cancels the entire deselect.

Cascade applies symmetrically across all dependency kinds (skill → skill, skill → rule, skill → agent). A skill that requires a rule and the rule is deselected → skill is cascade-removed. Same for agents.
