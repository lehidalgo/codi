# Plan: Team Consolidation Workflow + Legacy Consolidate Retire

| Field    | Value                                                        |
| -------- | ------------------------------------------------------------ |
| Status   | draft                                                        |
| Workflow | standalone (no codi run)                                     |
| Created  | 2026-05-10 18:08 UTC                                         |
| Author   | lehidalgo                                                    |
| Spec     | `docs/20260510_195829_[PLAN]_team-consolidation-workflow.md` |

## Context

This plan implements the design approved in the spec doc above. Two coordinated workstreams:

1. **Add `team-consolidation` workflow** — new YAML + companion skill + phase docs + 2 meta-skill extensions
2. **Retire legacy consolidate pipeline** — drop `runtime/consolidate/`, `runtime/llm/`, `proposals` table, `/proposals` UI page, `/api/v1/consolidation/*` endpoints, `brain export` cmd, and `templates/consolidation/` prompt templates

Net delta: ~1500 LoC new; ~3300 LoC removed; codebase shrinks by ~1800 LoC.

## Scope

### In scope

- New workflow YAML at `src/templates/workflows/team-consolidation.yaml`
- New companion skill `src/templates/skills/team-consolidation-workflow/` with template.ts, index.ts, 4 phase docs, schema reference doc
- Add `team-consolidation` to `WORKFLOW_TYPES` enum at `src/runtime/types.ts`
- Extend `refine-rules` SKILL.md with `Mode: REPORT-DRIVEN` section
- Extend `artifact-contributor` SKILL.md with `Mode: REPORT-DRIVEN` section
- Bump `version:` of both extended skills
- Drop `src/runtime/consolidate/` directory
- Drop `src/runtime/llm/` directory
- Drop `src/templates/consolidation/` directory
- Drop `proposals` table from `src/runtime/brain/schema.ts` and add migration to drop it
- Drop `src/runtime/brain-ui/pages/proposals.ts`
- Drop `/api/v1/consolidation/*` endpoints from `src/runtime/brain-ui/routes-api.ts`
- Drop `brainExportHandler` and `brain export` registration from `src/cli/brain.ts` (deprecation message stub for one release)
- Drop tests for the removed pieces
- CHANGELOG entry

### Out of scope

- Brain DB merge tooling (each DB read independently by agent)
- New CLI command for the workflow (workflow trigger is the skill itself)
- JSON sidecar for the report (free-form markdown only)
- Postgres / multi-tenant brain (orthogonal future work)
- Privacy scrubbing inside the workflow (agent reads any table; dev controls input)
- Auto-PR opening from approved domain proposals (only `artifact-contributor` opens upstream PRs)
- Modifying `rule-creator`, `skill-creator`, `agent-creator`, `compare-preset` skills (invoked manually for edge cases)

## Files to be modified

| File                                                                               | Action | Why                                                          |
| ---------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------ |
| `src/templates/workflows/team-consolidation.yaml`                                  | Create | New workflow definition (5 phases, no chain skills)          |
| `src/templates/skills/team-consolidation-workflow/template.ts`                     | Create | Companion skill template literal                             |
| `src/templates/skills/team-consolidation-workflow/index.ts`                        | Create | Skill module barrel (template + staticDir)                   |
| `src/templates/skills/team-consolidation-workflow/references/phase-intent.md`      | Create | Agent instructions for `intent` phase                        |
| `src/templates/skills/team-consolidation-workflow/references/phase-collect.md`     | Create | Agent instructions for `collect` phase                       |
| `src/templates/skills/team-consolidation-workflow/references/phase-analyze.md`     | Create | Agent instructions for `analyze` phase                       |
| `src/templates/skills/team-consolidation-workflow/references/phase-consolidate.md` | Create | Agent instructions for `consolidate` phase                   |
| `src/templates/skills/team-consolidation-workflow/references/schema-reference.md`  | Create | Brain DB schema reference for the agent to write SQL queries |
| `src/runtime/types.ts`                                                             | Modify | Add `"team-consolidation"` to `WORKFLOW_TYPES`               |
| `src/templates/skills/refine-rules/template.ts`                                    | Modify | Add `Mode: REPORT-DRIVEN` section, bump version              |
| `src/templates/skills/artifact-contributor/template.ts`                            | Modify | Add `Mode: REPORT-DRIVEN` section, bump version              |
| `src/runtime/brain/schema.ts`                                                      | Modify | Remove `proposals` table definition                          |
| `src/runtime/brain/migrate.ts`                                                     | Modify | Add migration step that drops `proposals` table              |
| `src/runtime/brain-ui/routes-api.ts`                                               | Modify | Remove `/api/v1/consolidation/*` endpoint blocks             |
| `src/runtime/brain-ui/pages.ts`                                                    | Modify | Remove `/proposals` route registration                       |
| `src/runtime/brain-ui/pages/proposals.ts`                                          | Delete | Page implementation removed                                  |
| `src/cli/brain.ts`                                                                 | Modify | Replace `brainExportHandler` with deprecation stub           |
| `src/runtime/consolidate/` (entire directory)                                      | Delete | Legacy auto-detection pipeline                               |
| `src/runtime/llm/` (entire directory)                                              | Delete | Orphan after consolidate goes (only consumer)                |
| `src/templates/consolidation/` (entire directory)                                  | Delete | LLM prompt templates for the runner                          |
| `tests/runtime/consolidate*.test.ts` and per-pattern tests                         | Delete | Suite of removed pipeline                                    |
| `tests/runtime/brain-ui-proposals.test.ts`                                         | Delete | UI page test for removed page                                |
| `tests/runtime/workflow-team-consolidation.test.ts`                                | Create | Workflow loading + phase transition tests                    |
| `CHANGELOG.md`                                                                     | Modify | Document the retire + add of team-consolidation              |

## Modules and contracts

### `team-consolidation` workflow (new)

- **Definition shape**: matches existing `WorkflowDefinitionShape` (id, name, description, version, phases, flags)
- **Phases**: `intent → collect → analyze → consolidate → done | abandoned`
- **Each phase**: `gates` list + `next` list + empty `chains`
- **Flags**: `agent_driven: true`, `produces_document: true`
- **Why this shape**: matches the universal brain loop (capture → analyze → document → consensus → mutate). Workflow stops at "report written" — never mutates artifacts itself
- **Deletion test**: removing this workflow leaves no path to consolidate brains across devs without resurrecting the legacy P1-P9 detector. Not deletable

### `team-consolidation-workflow` skill (new companion)

- **Export shape**: `template: string` (markdown body) + `staticDir: string` (path resolver)
- **Triggers**: phrases like "team consolidation", "consolidate brains", "team analysis", explicit `/codi-team-consolidation`
- **Mode of operation**: agent-driven through the 5 phases; reads schema-reference.md once during `analyze` to know what to query
- **Why this shape**: every Codi workflow has a 1:1 companion skill carrying phase docs; this matches the convention enforced by other workflows (feature, refactor, bug-fix, migration, project)
- **Deletion test**: removing the skill leaves the workflow YAML without instructions for the agent. Required pair

### `refine-rules` extended (existing, modified)

- **Existing modes**: REVIEW (read-only feedback summary), REFINE (interactive one-at-a-time approval that edits rule files)
- **New mode**: `REPORT-DRIVEN` — invoked when user passes a path to `[REPORT]_team-consolidation*.md` or asks to "apply approved rules from team consolidation report"
- **Behavior in REPORT-DRIVEN mode**:
  1. Read the .md file
  2. Find findings whose target meta-skill is `refine-rules` and whose consensus checkbox is `[x] APPROVED`
  3. For each, build internal feedback structure (same shape as `.codi/feedback/*.json`)
  4. Run existing REFINE pipeline (no behavior change to core logic)
  5. If any item is unclear, also query the brain DBs at the path in the report header
- **Why this shape**: reuses the proven REFINE approval loop; only changes input source. Follows the design principle "intelligence lives in agent, not in framework code"
- **Deletion test**: removing this mode forces the lead to manually translate report items into `.codi/feedback/*.json` files. Not deletable once team-consolidation ships

### `artifact-contributor` extended (existing, modified)

- **Existing**: opens upstream PRs from artifacts already edited locally
- **New mode**: `REPORT-DRIVEN` — invoked when passed a `[REPORT]_team-consolidation*.md` path
- **Behavior in REPORT-DRIVEN mode**:
  1. Read the .md
  2. Filter findings where consensus is APPROVED AND finding is flagged as upstream-candidate (meta-pipeline section)
  3. For each, prepare an upstream PR to `github.com/lehidalgo/codi` with the proposed change as evidence
  4. Use existing PR-opening logic
- **Why this shape**: keeps the PR-opening flow intact; adds only the intake adapter
- **Deletion test**: removing forces lead to manually craft upstream PRs from the .md. Not deletable

### Migration: drop `proposals` table (new)

- **Type**: schema migration step appended to existing migrate.ts pipeline
- **Operation**: `DROP TABLE IF EXISTS proposals` — idempotent
- **Why this shape**: removes legacy storage atomically with the code drop; idempotent so re-running migrations on already-migrated DBs is safe
- **Error modes**: if a constraint somehow blocks the drop (foreign key from another table), the migration aborts and surfaces which table holds the FK. No FKs reference `proposals` today (verified)

## Test strategy

- **Seam**: integration tests against an in-memory SQLite via `better-sqlite3` (existing `_brain-helper.ts` pattern in `tests/runtime/`)
- **Behaviors covered**:
  - Workflow YAML parses and seeds correctly via `seedWorkflowDefinitions`
  - All 5 phases load with correct gates and `next` lists
  - Phase transitions follow YAML spec
  - Migration drops `proposals` table cleanly on a DB that has it
  - Migration is idempotent on a DB that lacks it
  - `brain ui` does not crash when proposals page request arrives (returns 410)
  - `codi brain export` prints deprecation message and exits 0
- **Test runner**: `pnpm test`
- **Existing test changes**:
  - Tests in `tests/runtime/consolidate*.test.ts` deleted alongside the source
  - Tests in `tests/runtime/brain-ui-proposals.test.ts` deleted alongside the page
  - Schema migration test (if any) updated to expect `proposals` table absence

## Tasks

### Task 1: Add team-consolidation to WORKFLOW_TYPES enum

**Files:**

- Modify: `src/runtime/types.ts:103`

- [ ] **Step 1: Read current enum**

```bash
grep -n "WORKFLOW_TYPES" src/runtime/types.ts
```

Expected: line 103 shows `export const WORKFLOW_TYPES = ["feature", "bug-fix", "refactor", "migration", "project"] as const;`

- [ ] **Step 2: Modify enum to include team-consolidation**

Edit `src/runtime/types.ts` line 103 from:

```ts
export const WORKFLOW_TYPES = ["feature", "bug-fix", "refactor", "migration", "project"] as const;
```

to:

```ts
export const WORKFLOW_TYPES = [
  "feature",
  "bug-fix",
  "refactor",
  "migration",
  "project",
  "team-consolidation",
] as const;
```

- [ ] **Step 3: Run type-check to verify nothing breaks**

Run: `pnpm tsc --noEmit`
Expected: clean exit

- [ ] **Step 4: Commit**

```bash
git add src/runtime/types.ts
git commit -m "feat(workflow): register team-consolidation in WORKFLOW_TYPES enum"
```

---

### Task 2: Create team-consolidation workflow YAML

**Files:**

- Create: `src/templates/workflows/team-consolidation.yaml`

- [ ] **Step 1: Write the failing test**

```ts
// tests/runtime/workflow-team-consolidation.test.ts
import { describe, it, expect } from "vitest";
import { readBuiltinDefinitions } from "../../src/runtime/brain/seed-workflows.js";

describe("team-consolidation workflow YAML", () => {
  it("loads with id team-consolidation and 5 active phases", () => {
    const defs = readBuiltinDefinitions();
    const tc = defs.find((d) => d.id === "team-consolidation");
    expect(tc).toBeDefined();
    expect(tc!.version).toBe(1);
    expect(Object.keys(tc!.phases).sort()).toEqual([
      "abandoned",
      "analyze",
      "collect",
      "consolidate",
      "done",
      "intent",
    ]);
  });

  it("intent phase transitions to collect", () => {
    const defs = readBuiltinDefinitions();
    const tc = defs.find((d) => d.id === "team-consolidation")!;
    expect(tc.phases["intent"]!.next).toContain("collect");
  });

  it("consolidate phase transitions to done", () => {
    const defs = readBuiltinDefinitions();
    const tc = defs.find((d) => d.id === "team-consolidation")!;
    expect(tc.phases["consolidate"]!.next).toContain("done");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test tests/runtime/workflow-team-consolidation.test.ts`
Expected: FAIL — definition not found

- [ ] **Step 3: Write the YAML**

Create `src/templates/workflows/team-consolidation.yaml` with content:

```yaml
id: team-consolidation
name: Team Consolidation
description: Cross-dev brain analysis producing a consensus-candidate report for iterative artifact improvement
version: 1
phases:
  intent:
    gates: [scope_described, mode_chosen, brains_path_known]
    next: [collect, abandoned]
    chains: []
  collect:
    gates: [brains_listed, dev_layout_validated]
    next: [analyze, abandoned]
    chains: []
  analyze:
    gates: [per_dev_findings_done]
    next: [consolidate, abandoned]
    chains: []
  consolidate:
    gates: [report_written]
    next: [done, abandoned]
    chains: []
  done:
    gates: []
    next: []
  abandoned:
    gates: []
    next: []
flags:
  agent_driven: true
  produces_document: true
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test tests/runtime/workflow-team-consolidation.test.ts`
Expected: PASS — all three test cases green

- [ ] **Step 5: Commit**

```bash
git add src/templates/workflows/team-consolidation.yaml tests/runtime/workflow-team-consolidation.test.ts
git commit -m "feat(workflow): add team-consolidation workflow YAML with 5 active phases"
```

---

### Task 3: Create companion skill scaffold (template.ts + index.ts)

**Files:**

- Create: `src/templates/skills/team-consolidation-workflow/template.ts`
- Create: `src/templates/skills/team-consolidation-workflow/index.ts`

- [ ] **Step 1: Create the index.ts barrel**

Create `src/templates/skills/team-consolidation-workflow/index.ts` with content:

```ts
import { resolveStaticDir } from "../resolve-static-dir.js";

export { template } from "./template.js";

export const staticDir = resolveStaticDir("team-consolidation-workflow", import.meta.url);
```

- [ ] **Step 2: Create the template.ts**

Create `src/templates/skills/team-consolidation-workflow/template.ts` with content:

```ts
import { PROJECT_NAME, SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Team consolidation workflow — collect brain DBs from N devs, analyze cross-team patterns, and produce a consensus-candidate markdown report. Use when a team lead wants to extract collective knowledge from multiple devs' brain.db files and feed it back into artifact improvements. Activates on /${PROJECT_NAME}-team-consolidation, "team consolidation", "consolidate team brains", "cross-dev analysis", "team knowledge extraction". Manages 5 phases: intent (scope + mode + path), collect (list and validate brains), analyze (read each DB), consolidate (write report). Workflow stops at the report — does NOT mutate artifacts. Mutations happen via existing meta-skills (refine-rules, artifact-contributor) after team consensus on the report. Skip when working with a single dev brain (use existing meta-skills directly), when there is no cross-dev knowledge to consolidate, or when the lead just wants brain UI browsing.
category: \${SKILL_CATEGORY.DEVELOPER_WORKFLOW}
compatibility: \${SUPPORTED_PLATFORMS_YAML}
managed_by: \${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 1
---

# {{name}}

Cross-dev brain analysis. The team lead drops every dev's \\\`brain.db\\\` into a shared directory; the agent walks the corpus and writes a markdown report ready for team consensus review. After consensus, existing meta-skills consume the report and mutate artifacts.

## When to use

User wants to consolidate brain captures from multiple devs into one analysis. Typical phrasings:

- "Run team consolidation"
- "Consolidate the team's brain DBs"
- "Analyze what the team learned this sprint"
- /\${PROJECT_NAME}-team-consolidation

Start the workflow:

\\\`\\\`\\\`bash
\${PROJECT_NAME} run team-consolidation "<one-line description of the consolidation cycle>"
\\\`\\\`\\\`

## When to skip

- Single brain.db analysis → use brain UI directly (\\\`\${PROJECT_NAME} brain ui\\\`).
- Need to apply already-known artifact changes → use the relevant meta-skill directly (\\\`refine-rules\\\`, \\\`rule-creator\\\`, \\\`skill-creator\\\`).
- No prior captures collected → the brain DBs need work sessions first; this workflow has nothing to analyze.

## Phase order

| Phase         | Purpose                                                  | Detail                              |
| ------------- | -------------------------------------------------------- | ----------------------------------- |
| \\\`intent\\\`      | Confirm scope, mode (sequential/parallel), brains path   | \\\`references/phase-intent.md\\\`      |
| \\\`collect\\\`     | List brain.db files, validate each is a Codi brain       | \\\`references/phase-collect.md\\\`     |
| \\\`analyze\\\`     | Read each DB, produce per-dev findings                   | \\\`references/phase-analyze.md\\\`     |
| \\\`consolidate\\\` | Cross-reference findings, write the consensus-candidate report | \\\`references/phase-consolidate.md\\\` |
| \\\`done\\\`        | Workflow ends; lead receives next-step instructions      | terminal                            |

## Core principle

**Workflow produces information, not mutations.** The output is a free-form markdown report at \\\`docs/YYYYMMDD_HHMMSS_[REPORT]_team-consolidation.md\\\`. The team reaches consensus async (PR review, Slack, live meeting) by marking each finding APPROVED / REJECTED / DEFERRED in the report. Then the lead invokes existing meta-skills passing the report path:

- \\\`/\${PROJECT_NAME}-refine-rules <report-path>\\\` — for domain rule edits/creates
- \\\`/\${PROJECT_NAME}-artifact-contributor <report-path>\\\` — for upstream PR candidates
- Manual invocation of \\\`rule-creator\\\` / \\\`skill-creator\\\` / \\\`agent-creator\\\` for edge cases

## Schema reference

The agent reads \\\`references/schema-reference.md\\\` once during the \\\`analyze\\\` phase. It documents every brain DB table the agent may query (no allowlist, no privacy filtering — the dev controls what they contribute).

## Anti-patterns

- Mutating artifacts during the workflow. The workflow STOPS at "report written".
- Building dedup logic in framework code. The agent does dedup in its context using LLM cognition.
- Adding privacy scrubbing inside the workflow. The dev controls their brain.db before contributing.
- Auto-triggering the workflow. Always user-invoked.
- Writing JSON sidecar to disk. Markdown report is the only output.

## References

- \\\`references/phase-intent.md\\\`
- \\\`references/phase-collect.md\\\`
- \\\`references/phase-analyze.md\\\`
- \\\`references/phase-consolidate.md\\\`
- \\\`references/schema-reference.md\\\`
`;
```

- [ ] **Step 3: Type-check**

Run: `pnpm tsc --noEmit`
Expected: clean exit

- [ ] **Step 4: Commit**

```bash
git add src/templates/skills/team-consolidation-workflow/index.ts src/templates/skills/team-consolidation-workflow/template.ts
git commit -m "feat(skill): add team-consolidation-workflow companion skill scaffold"
```

---

### Task 4: Write phase-intent.md

**Files:**

- Create: `src/templates/skills/team-consolidation-workflow/references/phase-intent.md`

- [ ] **Step 1: Write the file**

Create the file with content:

```markdown
# Phase: intent

Confirm the analysis scope, choose execution mode, and locate the team-brains directory. HARD GATE — no DB reads until the user confirms all three.

## Process

Ask the user three questions, one at a time:

1. **Scope.** "Which sprint, time window, or topic should this consolidation cover? Any filters on dev names?"
2. **Mode.** "Sequential mode (one agent reads all brains in order) or parallel mode (one sub-agent per dev folder, results aggregated)? Sequential is simpler and uses one context. Parallel is faster for >5 devs but uses sub-agents."
3. **Brains path.** "Where is the team-brains directory? Provide an absolute path. The expected layout is `<path>/<dev-name>/<repo>.db` per dev."

Validate the path exists with `ls "<path>"` before transitioning.

## Exit criterion

- [ ] User stated scope (string).
- [ ] User chose mode (`sequential` or `parallel`).
- [ ] User provided absolute path to brains directory; path exists.

## Gates emitted

- `scope_described`
- `mode_chosen`
- `brains_path_known`

## Anti-patterns

- Defaulting to a convention path like `~/.codi/team-brains/`. Always require explicit path. Convention defaults cause silent bugs ("ups, analyzed empty folder").
- Choosing parallel mode for 1-2 devs. Overhead exceeds benefit; recommend sequential.
- Skipping path existence check. Empty or missing dir wastes downstream work.
```

- [ ] **Step 2: Commit**

```bash
git add src/templates/skills/team-consolidation-workflow/references/phase-intent.md
git commit -m "feat(skill): add team-consolidation phase-intent reference"
```

---

### Task 5: Write phase-collect.md

**Files:**

- Create: `src/templates/skills/team-consolidation-workflow/references/phase-collect.md`

- [ ] **Step 1: Write the file**

Create the file with content:

````markdown
# Phase: collect

List all candidate brain.db files in the team-brains directory and validate each is a real Codi brain. HARD GATE — invalid files MUST be skipped before transitioning.

## Process

1. **Enumerate candidates.** Run `find "<brains_path>" -name "*.db" -type f` to find all .db files. Group by parent directory (the dev_id).
2. **Validate each.** For each candidate path:

   ```bash
   sqlite3 "<path>" "SELECT version FROM _codi_schema_version ORDER BY version DESC LIMIT 1"
   ```
````

Expected: a positive integer. If the query fails (file is not SQLite, table missing, etc.), skip the file with a logged warning. 3. **Build inventory.** For each valid brain, record:

- `dev_id` — basename of the parent directory
- `db_path` — absolute path
- `project_count` — `sqlite3 "<path>" "SELECT COUNT(*) FROM projects"`
- `session_count` — `sqlite3 "<path>" "SELECT COUNT(*) FROM sessions"`

4. **Surface inventory to user.** Show the table:

   ```
   | dev_id | brain                  | projects | sessions |
   |--------|------------------------|----------|----------|
   | alice  | fintech-api.db         | 1        | 47       |
   | alice  | fintech-admin.db       | 1        | 12       |
   | bob    | fintech-frontend.db    | 1        | 33       |
   ```

   Confirm with user before proceeding.

## Exit criterion

- [ ] At least one valid brain found (zero brains → abandoned phase).
- [ ] Invalid files logged with reason and skipped.
- [ ] Inventory surfaced to user, user confirmed.

## Gates emitted

- `brains_listed`
- `dev_layout_validated`

## Anti-patterns

- Treating non-SQLite files as brains. The schema-version check is the contract.
- Failing the whole phase on one bad file. Log + skip + continue.
- Inferring dev_id from filename instead of dirname. Dirname is the convention.

````

- [ ] **Step 2: Commit**

```bash
git add src/templates/skills/team-consolidation-workflow/references/phase-collect.md
git commit -m "feat(skill): add team-consolidation phase-collect reference"
````

---

### Task 6: Write phase-analyze.md

**Files:**

- Create: `src/templates/skills/team-consolidation-workflow/references/phase-analyze.md`

- [ ] **Step 1: Write the file**

Create the file with content:

````markdown
# Phase: analyze

Read every valid brain in the inventory and produce per-dev findings. The agent uses `sqlite3` read-only queries; full schema is in `references/schema-reference.md`. No allowlist, no forbidden tables.

## Process — sequential mode

For each `(dev_id, db_path)` in the inventory:

1. Open read-only:
   ```bash
   sqlite3 -readonly "<db_path>"
   ```
````

2. Read the schema reference (`references/schema-reference.md`) once to know the available tables and columns.
3. Run targeted queries to extract:
   - Recurring capture themes by type (RULE, PROHIBITION, PREFERENCE, CORRECTION)
   - Skill / agent firing rates and outcomes from `artifacts_used`
   - Stuck workflow phases or anomalies from `workflow_runs`
   - Correction frequency from `corrections`
   - OBSERVATION captures naming Codi artifacts (meta signal) from `captures` where `type = 'OBSERVATION'`
4. Build a structured per-dev findings block in your context.

## Process — parallel mode

1. Group inventory by `dev_id`. One sub-agent per dev folder.
2. For each dev, dispatch a sub-agent via the `Agent` tool (foreground, parallel) with this brief:
   > "Read brain.db files at `<paths>` for dev `<dev_id>`. Use sqlite3 read-only. Produce a markdown summary with sections: Top capture themes, Skill firing stats, Workflow anomalies, Correction frequency, Meta-pipeline observations. Return as a single markdown block."
3. Each sub-agent uses the same schema reference. Returns a self-contained markdown summary.
4. Padre collects N summaries (one per dev) and proceeds to consolidate.

## Per-dev findings block format

Each block must follow this shape:

```markdown
## Dev: <dev_id>

### Brains analyzed

- <db_filename> (<project_id>, <session_count> sessions)
- ...

### Top capture themes

- (RULE) <theme summary> — <N captures>
  - Excerpt: "<verbatim from one capture>"
- (PROHIBITION) ...

### Skill firing stats

| skill | uses | errors | avg_duration_ms |
| ----- | ---- | ------ | --------------- |

### Workflow anomalies

- <anomaly description>

### Meta-pipeline observations

- <skill/rule/workflow name> — <gap observed>
```

## Exit criterion

- [ ] Every valid brain in the inventory was queried.
- [ ] One findings block per dev exists (in agent context for sequential mode; collected from sub-agents for parallel).
- [ ] Padre has the full set ready for consolidation.

## Gates emitted

- `per_dev_findings_done`

## Anti-patterns

- Reading raw `prompts.text` or `tool_calls.input_json` looking for sensitive data to redact. The dev already controls what they contribute. Read what helps the analysis.
- Generating findings without verbatim evidence excerpts. Excerpts are needed for team consensus review.
- Sub-agent summaries that are pure prose without the section headers. Padre needs structure to aggregate cleanly.
- Re-running queries the schema reference already documents. Use the reference; do not improvise.

````

- [ ] **Step 2: Commit**

```bash
git add src/templates/skills/team-consolidation-workflow/references/phase-analyze.md
git commit -m "feat(skill): add team-consolidation phase-analyze reference"
````

---

### Task 7: Write phase-consolidate.md

**Files:**

- Create: `src/templates/skills/team-consolidation-workflow/references/phase-consolidate.md`

- [ ] **Step 1: Write the file**

Create the file with content:

````markdown
# Phase: consolidate

Cross-reference per-dev findings, identify cross-team patterns, write the consensus-candidate report.

## Process

1. **Cross-reference.** For each capture theme / skill issue / workflow anomaly, count how many devs reported it (`vote_count = COUNT(DISTINCT dev_id)`).
2. **Rank.** Sort by `vote_count DESC`, then by total evidence count DESC. Items with `vote_count = 1` go to a separate "Singletons" section as informational.
3. **Separate domain vs meta.** Domain findings = knowledge about the team's product (rules to extract, conventions to codify). Meta-pipeline findings = gaps in Codi infrastructure observed during the analyzed sessions (skill triggers misfiring, rules not activating, workflow phase stuck).
4. **Write the report.** Path: `docs/YYYYMMDD_HHMMSS_[REPORT]_team-consolidation.md`. UTC timestamp. Free-form markdown — no formal contract. Include the sections shown in the example below.

## Report structure (example, not contract)

```markdown
# Team Consolidation Report

- Date: YYYY-MM-DD HH:MM UTC
- Devs analyzed: N (alice, bob, carol)
- Brains scanned: M (across X projects)
- Mode: sequential | parallel
- Brains directory: <absolute path>

## How to use this report

1. Team reviews this document async (PR / Slack / live meeting).
2. Mark each finding APPROVED / REJECTED / DEFERRED with `[x]`.
3. After consensus, invoke meta-skills with this report as input:
   - Domain rule edits/creates → `/codi-refine-rules <this-path>`
   - Upstream contributions → `/codi-artifact-contributor <this-path>`
   - Edge cases → manually invoke `rule-creator` / `skill-creator` / `agent-creator`

> Privacy notice: this report may include verbatim content from captures, prompts, and tool calls of the contributed brain.dbs. Pre-filter your brain.db before contributing if you want to omit something.

## Domain findings

### D-1 — <short title> (votes: <N>)

Pattern: <verbatim or paraphrased pattern observed>

Evidence:

- alice (capture <id>, <repo>): "<verbatim excerpt>"
- bob (capture <id>, <repo>): "<verbatim excerpt>"
- carol (capture <id>, <repo>): "<verbatim excerpt>"

Proposed action: <create rule X | edit skill Y | merge artifacts Z>
Target meta-skill: refine-rules

Consensus:

- [ ] APPROVED
- [ ] REJECTED
- [ ] DEFERRED

### D-2 ...

## Meta-pipeline findings

### M-1 — <short title> (votes: <N>)

Pattern: <observed gap in Codi infrastructure>

Evidence: <N occurrences across <K> devs (capture_ids ...)>

Proposed action: <upstream PR to codi changing X | local override at .codi/Y>
Target meta-skill: artifact-contributor (upstream candidate)

Consensus:

- [ ] APPROVED
- [ ] REJECTED
- [ ] DEFERRED

## Singletons (vote_count = 1, informational only)

- <list>

## Artifact usage stats (cross-team aggregate)

| artifact | total_uses | unique_devs | error_rate | avg_duration_ms |
| -------- | ---------- | ----------- | ---------- | --------------- |

## Decisions log (filled by team during review)

- [ ] D-1 — APPROVED by ... at ...
- [ ] M-1 — DEFERRED by ... — reason: ...
```
````

## Exit criterion

- [ ] Report file written at `docs/YYYYMMDD_HHMMSS_[REPORT]_team-consolidation.md`.
- [ ] Report includes Domain section, Meta-pipeline section, Singletons section, Artifact usage stats, Decisions log placeholder.
- [ ] Privacy notice present.
- [ ] User informed of the path and next steps.

## Gates emitted

- `report_written`

## Anti-patterns

- Mutating any artifact during this phase. The workflow STOPS here.
- Skipping vote_count=1 items entirely. They go in Singletons section as info.
- Mixing domain and meta items in the same section. Separation is required for downstream meta-skill routing.
- Echoing the entire report into chat. Write the file; surface the path with a 2-line summary.
- Inventing a JSON sidecar. Markdown only.

````

- [ ] **Step 2: Commit**

```bash
git add src/templates/skills/team-consolidation-workflow/references/phase-consolidate.md
git commit -m "feat(skill): add team-consolidation phase-consolidate reference"
````

---

### Task 8: Write schema-reference.md

**Files:**

- Create: `src/templates/skills/team-consolidation-workflow/references/schema-reference.md`

- [ ] **Step 1: Write the file**

Create the file with content:

````markdown
# Brain DB schema reference (read-only, for analyze phase)

Every Codi brain DB carries the same schema. The agent may query any of these tables freely; there is no allowlist or forbidden list. The dev controls what their brain.db contains before contributing it.

## Core tables

### `projects`

| column     | type    | notes                              |
| ---------- | ------- | ---------------------------------- |
| project_id | TEXT    | primary key                        |
| repo_path  | TEXT    | absolute path on the dev's machine |
| git_remote | TEXT    | nullable                           |
| name       | TEXT    | repo name or override              |
| first_seen | INTEGER | unix epoch ms                      |
| last_seen  | INTEGER | unix epoch ms                      |

### `sessions`

| column              | type    | notes                      |
| ------------------- | ------- | -------------------------- |
| session_id          | TEXT    | primary key                |
| project_id          | TEXT    | FK projects                |
| agent_type          | TEXT    | claude-code, codex, etc.   |
| agent_model         | TEXT    | optional                   |
| started_at          | INTEGER | unix epoch ms              |
| ended_at            | INTEGER | nullable                   |
| branch              | TEXT    | git branch at start        |
| commit_sha          | TEXT    | git commit at start        |
| working_dir         | TEXT    | absolute path              |
| transcript_path     | TEXT    | nullable                   |
| workflow_id         | TEXT    | nullable, FK workflow_runs |
| total_turns         | INTEGER | denormalized count         |
| total_capture_count | INTEGER | denormalized count         |

### `prompts`

| column     | type    | notes                     |
| ---------- | ------- | ------------------------- |
| prompt_id  | INTEGER | primary key autoincrement |
| session_id | TEXT    | FK sessions               |
| turn_no    | INTEGER | 1-indexed                 |
| ts         | INTEGER | unix epoch ms             |
| text       | TEXT    | literal user prompt       |
| char_count | INTEGER | denormalized              |

### `turns`

| column      | type    | notes                                |
| ----------- | ------- | ------------------------------------ |
| turn_id     | INTEGER | primary key autoincrement            |
| session_id  | TEXT    | FK sessions                          |
| turn_no     | INTEGER |                                      |
| ts          | INTEGER |                                      |
| agent_text  | TEXT    | populated only when trace_level=full |
| duration_ms | INTEGER |                                      |
| prompt_id   | INTEGER | FK prompts                           |

### `captures`

| column      | type    | notes                                                                                                                |
| ----------- | ------- | -------------------------------------------------------------------------------------------------------------------- |
| capture_id  | INTEGER | primary key                                                                                                          |
| session_id  | TEXT    | FK sessions                                                                                                          |
| prompt_id   | INTEGER | FK prompts                                                                                                           |
| turn_id     | INTEGER | FK turns                                                                                                             |
| ts          | INTEGER |                                                                                                                      |
| type        | TEXT    | one of RULE, PROHIBITION, PREFERENCE, FEEDBACK, INSIGHT, OBSERVATION, DECISION, QUESTION, PROMPT, CORRECTION, DEFECT |
| content     | TEXT    | verbatim distilled content                                                                                           |
| raw_marker  | TEXT    | full original `\\\|TYPE: "..."\\\|` string                                                                           |
| file_paths  | TEXT    | JSON array of relative paths                                                                                         |
| workflow_id | TEXT    | nullable                                                                                                             |
| phase       | TEXT    | nullable                                                                                                             |
| deleted_at  | INTEGER | soft delete; query with `deleted_at IS NULL`                                                                         |

### `tool_calls`

| column         | type    | notes                  |
| -------------- | ------- | ---------------------- |
| call_id        | INTEGER | primary key            |
| session_id     | TEXT    | FK sessions            |
| turn_id        | INTEGER | FK turns               |
| ts             | INTEGER |                        |
| tool_name      | TEXT    | Bash, Read, Edit, etc. |
| input_json     | TEXT    | JSON                   |
| output_summary | TEXT    | nullable               |
| duration_ms    | INTEGER |                        |
| status         | TEXT    | success / error        |
| error          | TEXT    | nullable               |

### `corrections`

| column         | type    | notes                            |
| -------------- | ------- | -------------------------------- |
| correction_id  | INTEGER | primary key                      |
| session_id     | TEXT    | FK sessions                      |
| ts             | INTEGER |                                  |
| file_path      | TEXT    |                                  |
| diff_summary   | TEXT    |                                  |
| source_turn_id | INTEGER | nullable                         |
| detected_via   | TEXT    | how this correction was detected |

### `artifacts_used`

| column        | type    | notes                                |
| ------------- | ------- | ------------------------------------ |
| usage_id      | INTEGER | primary key                          |
| session_id    | TEXT    | FK sessions                          |
| turn_id       | INTEGER | nullable                             |
| ts            | INTEGER |                                      |
| artifact_type | TEXT    | rule / skill / agent                 |
| artifact_name | TEXT    | the artifact's slug                  |
| event         | TEXT    | fired / triggered / completed / etc. |
| outcome       | TEXT    | success / error / skipped / nullable |
| duration_ms   | INTEGER | nullable                             |

### `workflow_runs`

| column        | type    | notes                                                                   |
| ------------- | ------- | ----------------------------------------------------------------------- |
| workflow_id   | TEXT    | primary key                                                             |
| project_id    | TEXT    | FK projects                                                             |
| type          | TEXT    | feature / bug-fix / refactor / migration / project / team-consolidation |
| current_phase | TEXT    |                                                                         |
| status        | TEXT    |                                                                         |
| started_at    | INTEGER |                                                                         |
| ended_at      | INTEGER | nullable                                                                |
| metadata      | TEXT    | JSON: scope_files, gates_passed, flags                                  |

### `workflow_events`

| column      | type    | notes                         |
| ----------- | ------- | ----------------------------- |
| event_id    | INTEGER | primary key                   |
| workflow_id | TEXT    | FK workflow_runs              |
| event_type  | TEXT    | gate_passed, transition, etc. |
| ts          | INTEGER |                               |
| payload     | TEXT    | JSON                          |

### `workflow_definitions`

| column      | type    | notes       |
| ----------- | ------- | ----------- |
| id          | TEXT    | primary key |
| name        | TEXT    |             |
| description | TEXT    |             |
| version     | INTEGER |             |
| managed_by  | TEXT    | codi / user |
| definition  | TEXT    | JSON blob   |
| created_at  | INTEGER |             |
| updated_at  | INTEGER |             |

### `_codi_schema_version`

| column     | type    | notes       |
| ---------- | ------- | ----------- |
| version    | INTEGER | primary key |
| applied_at | INTEGER |             |

## FTS5 virtual tables (full-text search)

- `captures_fts` — full-text index over `captures.content`
- `prompts_fts` — full-text index over `prompts.text`

Use as: `SELECT capture_id FROM captures_fts WHERE captures_fts MATCH 'money OR currency'`.

## Useful query templates

### Top capture themes per type

```sql
SELECT type, COUNT(*) AS n
FROM captures
WHERE deleted_at IS NULL
GROUP BY type
ORDER BY n DESC;
```
````

### Skill firing stats

```sql
SELECT artifact_name,
       COUNT(*) AS total_uses,
       SUM(CASE WHEN outcome = 'error' THEN 1 ELSE 0 END) AS errors,
       AVG(duration_ms) AS avg_duration
FROM artifacts_used
WHERE artifact_type = 'skill'
GROUP BY artifact_name
ORDER BY total_uses DESC;
```

### Stuck workflows

```sql
SELECT workflow_id, type, current_phase, status,
       (COALESCE(ended_at, unixepoch() * 1000) - started_at) / 1000 AS duration_seconds
FROM workflow_runs
WHERE status NOT IN ('done', 'abandoned')
ORDER BY duration_seconds DESC;
```

### OBSERVATION captures naming a Codi artifact

```sql
SELECT capture_id, content, raw_marker, ts
FROM captures
WHERE type = 'OBSERVATION'
  AND deleted_at IS NULL
  AND (content LIKE '%codi-%' OR content LIKE '%skill%' OR content LIKE '%rule%')
ORDER BY ts DESC;
```

### Correction frequency by file

```sql
SELECT file_path, COUNT(*) AS corrections
FROM corrections
GROUP BY file_path
ORDER BY corrections DESC;
```

````

- [ ] **Step 2: Commit**

```bash
git add src/templates/skills/team-consolidation-workflow/references/schema-reference.md
git commit -m "feat(skill): add team-consolidation schema reference for analyze phase"
````

---

### Task 9: Verify generate produces team-consolidation skill output

**Files:**

- No source changes; this is a verification task.

- [ ] **Step 1: Build the project**

Run: `pnpm build`
Expected: clean exit; new files compiled to `dist/`

- [ ] **Step 2: Reinstall the new skill into .codi**

```bash
codi add skill codi-team-consolidation-workflow --template team-consolidation-workflow
```

Expected: skill installed at `.codi/skills/codi-team-consolidation-workflow/`

- [ ] **Step 3: Generate per-agent output**

Run: `codi generate --force`
Expected: clean exit; `.claude/skills/codi-team-consolidation-workflow/SKILL.md` exists

- [ ] **Step 4: Smoke check the generated SKILL.md**

```bash
test -f .claude/skills/codi-team-consolidation-workflow/SKILL.md
grep -c "Phase:" .claude/skills/codi-team-consolidation-workflow/references/phase-*.md
```

Expected: 4 phase files exist; each has the "Phase:" header

- [ ] **Step 5: Commit any generated artifacts (if codi config tracks them)**

```bash
git add -A .codi/skills/codi-team-consolidation-workflow/ .claude/skills/codi-team-consolidation-workflow/
git commit -m "chore(generate): regenerate after adding team-consolidation-workflow skill"
```

---

### Task 10: Extend refine-rules with REPORT-DRIVEN mode

**Files:**

- Modify: `src/templates/skills/refine-rules/template.ts`

- [ ] **Step 1: Bump version in frontmatter**

Edit the `version: 7` line to `version: 8` near the top of the template literal.

- [ ] **Step 2: Add new mode section**

After the existing REFINE mode section, append a new section by editing the template literal to add:

```markdown
---

## Mode: REPORT-DRIVEN (consume team consolidation report)

**Trigger:** user invokes the skill with a path to a `[REPORT]_team-consolidation*.md` file, or the user asks to "apply the approved rules from the team consolidation report" / "process the team consolidation findings".

### REPORT-DRIVEN Steps

1. **Locate the report.** If the user provided a path, use it. Otherwise, list `docs/*[REPORT]_team-consolidation*.md` and ask which to process (default: most recent).
2. **Read the report.** Parse free-form markdown using your own intelligence — there is no formal schema. Find sections labeled `Domain findings`. For each finding (header `### D-N` or similar), look at the `Consensus:` section and identify items where `[x] APPROVED` is marked.
3. **Filter for refine-rules scope.** Within APPROVED items, look at the `Target meta-skill:` line. Only process items whose target is `refine-rules` (or unspecified — default to refine-rules for domain rule items).
4. **Build internal feedback structure.** For each filtered item, construct an in-memory feedback shape equivalent to a `.codi/feedback/*.json` entry: `{ artifactName, category, observation, severity, evidence, proposedChange }`. Use the report's evidence excerpts and proposed action.
5. **Run the existing REFINE pipeline** on the synthesized feedback structure. Use the same one-at-a-time approval flow: present each item, accept/skip/edit, edit `.codi/rules/<name>.md`, then move to the next.
6. **Optional clarity check.** If a finding lacks enough context to act on, query the brain DBs at the path in the report header (`Brains directory:` field) using `sqlite3 -readonly`. The schema reference in `team-consolidation-workflow/references/schema-reference.md` documents every table.
7. **After applying.** Run `codi generate` to propagate changes to per-agent dirs.

### Output Format

Same as REFINE mode. The report path is logged at the top of each session so the team can trace which report drove which changes.

### Skip When (REPORT-DRIVEN)

- No `[REPORT]_team-consolidation*.md` files exist in `docs/` and the user did not provide a path → fall back to existing REFINE mode using `.codi/feedback/`.
- The report has zero APPROVED items in the `refine-rules` scope → tell the user there is nothing to apply, suggest re-reviewing the report for consensus.
- The report itself was never reviewed (no `[x]` marks anywhere) → tell the user consensus is the prerequisite; do not apply unilaterally.
```

- [ ] **Step 3: Type-check**

Run: `pnpm tsc --noEmit`
Expected: clean exit

- [ ] **Step 4: Rebuild and reinstall**

```bash
pnpm build
rm -rf .codi/skills/codi-refine-rules
node -e "const fs=require('fs'); const p='.codi/artifact-manifest.json'; const m=JSON.parse(fs.readFileSync(p,'utf8')); if(m.artifacts) delete m.artifacts['codi-refine-rules']; fs.writeFileSync(p, JSON.stringify(m, null, 2)+'\n');"
codi add skill codi-refine-rules --template refine-rules
codi generate --force
```

Expected: clean exit; `.claude/skills/codi-refine-rules/SKILL.md` contains the new "Mode: REPORT-DRIVEN" section

- [ ] **Step 5: Smoke check**

```bash
grep -c "REPORT-DRIVEN" .claude/skills/codi-refine-rules/SKILL.md
```

Expected: at least 3 occurrences

- [ ] **Step 6: Commit**

```bash
git add src/templates/skills/refine-rules/template.ts .codi/skills/codi-refine-rules/ .claude/skills/codi-refine-rules/
git commit -m "feat(skill): refine-rules — add REPORT-DRIVEN mode (v8)"
```

---

### Task 11: Extend artifact-contributor with REPORT-DRIVEN mode

**Files:**

- Modify: `src/templates/skills/artifact-contributor/template.ts`

- [ ] **Step 1: Bump version in frontmatter**

Locate the existing `version:` line and increment by 1.

- [ ] **Step 2: Add new mode section**

Append to the template literal after the existing usage sections:

```markdown
---

## Mode: REPORT-DRIVEN (consume team consolidation report — meta-pipeline upstream)

**Trigger:** user invokes the skill with a path to a `[REPORT]_team-consolidation*.md` file and asks to open upstream PRs for approved meta-pipeline findings.

### REPORT-DRIVEN Steps

1. **Locate the report.** Use the path the user provided, or scan `docs/*[REPORT]_team-consolidation*.md` and pick the most recent.
2. **Read the report.** Parse free-form markdown. Find the `Meta-pipeline findings` section.
3. **Filter for upstream candidates.** For each finding under that section, look at the `Consensus:` block and identify items with `[x] APPROVED`. Within those, look at the `Target meta-skill:` line — items marked `artifact-contributor (upstream candidate)` are in scope. Items that say `local override` are out of scope (the lead applies those locally via `refine-rules` or manual edit).
4. **Group by target artifact.** A single finding usually targets one Codi upstream artifact (e.g., `codi-commit` skill, `codi-output-discipline` rule). Collect all approved findings per target.
5. **For each target artifact, prepare an upstream PR:**
   - Branch name: `team-consolidation/<artifact-name>-<date>`
   - Commit message: derived from the proposed action in the finding
   - Diff: the proposed change as shown in the finding (or paraphrased if not shown literally)
   - PR body: includes the verbatim evidence excerpts and a link/reference to the report file
6. **Use the existing PR-opening logic** (manual or GitHub MCP — see `references/manual-pr.md` and `references/github-mcp.md`). The intake step is the only new piece; PR creation itself is unchanged.
7. **After PR creation.** Update the report's Decisions log section with the PR URL for traceability.

### Skip When (REPORT-DRIVEN)

- The report's `Meta-pipeline findings` section is empty or has zero APPROVED upstream-candidate items.
- The lead is not authenticated to open PRs against `lehidalgo/codi`.
- A given finding's proposed action is ambiguous and would require discovery work — skip it, log a note.
```

- [ ] **Step 3: Type-check**

Run: `pnpm tsc --noEmit`
Expected: clean exit

- [ ] **Step 4: Rebuild and reinstall**

```bash
pnpm build
rm -rf .codi/skills/codi-artifact-contributor
node -e "const fs=require('fs'); const p='.codi/artifact-manifest.json'; const m=JSON.parse(fs.readFileSync(p,'utf8')); if(m.artifacts) delete m.artifacts['codi-artifact-contributor']; fs.writeFileSync(p, JSON.stringify(m, null, 2)+'\n');"
codi add skill codi-artifact-contributor --template artifact-contributor
codi generate --force
```

Expected: clean exit

- [ ] **Step 5: Smoke check**

```bash
grep -c "REPORT-DRIVEN" .claude/skills/codi-artifact-contributor/SKILL.md
```

Expected: at least 3 occurrences

- [ ] **Step 6: Commit**

```bash
git add src/templates/skills/artifact-contributor/template.ts .codi/skills/codi-artifact-contributor/ .claude/skills/codi-artifact-contributor/
git commit -m "feat(skill): artifact-contributor — add REPORT-DRIVEN mode for upstream meta-pipeline findings"
```

---

### Task 12: Drop /api/v1/consolidation/\* endpoints

**Files:**

- Modify: `src/runtime/brain-ui/routes-api.ts`

- [ ] **Step 1: Locate the endpoints**

```bash
grep -n "/api/v1/consolidation" src/runtime/brain-ui/routes-api.ts
```

Expected output: line numbers for `run-with-llm` and `run-with-agent` endpoints (around 270-580).

- [ ] **Step 2: Remove the endpoint blocks and their imports**

Delete:

- The `app.post("/api/v1/consolidation/run-with-llm", ...)` block
- The `app.post("/api/v1/consolidation/run-with-agent", ...)` block (if present)
- The import line: `import { getProvider, LlmConfigError } from "../llm/index.js";`
- Any other unused imports introduced solely for these endpoints

- [ ] **Step 3: Type-check to confirm no broken refs**

Run: `pnpm tsc --noEmit`
Expected: clean exit

- [ ] **Step 4: Run brain-ui tests to confirm rest of API works**

Run: `pnpm test tests/runtime/brain-ui-server.test.ts tests/runtime/brain-ui-pages.test.ts`
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add src/runtime/brain-ui/routes-api.ts
git commit -m "refactor(brain-ui): remove /api/v1/consolidation/* endpoints (legacy)"
```

---

### Task 13: Drop /proposals UI page and route registration

**Files:**

- Delete: `src/runtime/brain-ui/pages/proposals.ts`
- Modify: `src/runtime/brain-ui/pages.ts`

- [ ] **Step 1: Delete the page file**

```bash
git rm src/runtime/brain-ui/pages/proposals.ts
```

- [ ] **Step 2: Remove the route registration**

In `src/runtime/brain-ui/pages.ts`, find the import and the registration of the proposals page (likely lines like `import { registerProposalsPage } from "./pages/proposals.js"` and `registerProposalsPage(app, brain)`). Remove both.

Also remove any link or menu entry pointing to `/proposals` in any page header / nav component.

- [ ] **Step 3: Type-check**

Run: `pnpm tsc --noEmit`
Expected: clean exit

- [ ] **Step 4: Delete the page test**

```bash
git rm tests/runtime/brain-ui-proposals.test.ts
```

- [ ] **Step 5: Run remaining brain-ui tests**

Run: `pnpm test tests/runtime/brain-ui-`
Expected: all remaining UI tests pass

- [ ] **Step 6: Commit**

```bash
git add src/runtime/brain-ui/pages.ts
git commit -m "refactor(brain-ui): remove /proposals page (legacy consolidation UI)"
```

---

### Task 14: Replace brainExportHandler with deprecation stub

**Files:**

- Modify: `src/cli/brain.ts:186-217`

- [ ] **Step 1: Replace the handler implementation**

Replace the existing `brainExportHandler` function body with a deprecation stub:

```ts
export async function brainExportHandler(
  _flags: BrainExportFlags,
): Promise<CommandResult<BrainExportData>> {
  const log = Logger.getInstance();
  log.warn(
    "`codi brain export` is deprecated. The legacy consolidation pipeline has been removed. Use the team-consolidation workflow instead: `codi run team-consolidation`.",
  );
  return createCommandResult({
    success: true,
    command: "brain export",
    data: { path: "", proposalsExported: 0 },
    exitCode: EXIT_CODES.SUCCESS,
  });
}
```

- [ ] **Step 2: Remove now-unused imports**

Remove from the top of `src/cli/brain.ts`:

```ts
import { generatePackage, packageToJson } from "../runtime/consolidate/index.js";
```

- [ ] **Step 3: Type-check**

Run: `pnpm tsc --noEmit`
Expected: clean exit

- [ ] **Step 4: Run CLI tests**

Run: `pnpm test tests/cli/`
Expected: all pass (the export command still registers and exits cleanly)

- [ ] **Step 5: Commit**

```bash
git add src/cli/brain.ts
git commit -m "refactor(cli): brain export — deprecation stub, remove legacy package generator"
```

---

### Task 15: Drop src/runtime/consolidate/ directory

**Files:**

- Delete: `src/runtime/consolidate/runner.ts`
- Delete: `src/runtime/consolidate/patterns.ts`
- Delete: `src/runtime/consolidate/prompts.ts`
- Delete: `src/runtime/consolidate/repo.ts`
- Delete: `src/runtime/consolidate/package.ts`
- Delete: `src/runtime/consolidate/types.ts`
- Delete: `src/runtime/consolidate/index.ts`

- [ ] **Step 1: Verify no remaining importers**

```bash
grep -rln "from.*runtime/consolidate\|from.*consolidate/index\|from.*consolidate/runner\|from.*consolidate/repo" src/ tests/
```

Expected: empty (all references removed by tasks 12-14)

If any remain, address them before continuing.

- [ ] **Step 2: Delete the directory**

```bash
git rm -r src/runtime/consolidate/
```

- [ ] **Step 3: Delete the related tests**

```bash
git rm tests/runtime/consolidate*.test.ts 2>/dev/null || true
git rm -r tests/runtime/consolidate 2>/dev/null || true
```

- [ ] **Step 4: Type-check**

Run: `pnpm tsc --noEmit`
Expected: clean exit

- [ ] **Step 5: Full test suite**

Run: `pnpm test`
Expected: all remaining tests pass; no missing-module errors

- [ ] **Step 6: Commit**

```bash
git commit -m "refactor: remove src/runtime/consolidate/ (legacy P1-P9 detection pipeline)"
```

---

### Task 16: Drop src/runtime/llm/ directory

**Files:**

- Delete: `src/runtime/llm/gemini.ts`
- Delete: `src/runtime/llm/provider.ts`
- Delete: `src/runtime/llm/registry.ts`
- Delete: `src/runtime/llm/index.ts`

- [ ] **Step 1: Verify no remaining importers**

```bash
grep -rln "from.*runtime/llm\|from.*llm/index\|from.*llm/provider\|from.*llm/gemini\|from.*llm/registry" src/ tests/
```

Expected: empty (the only consumer was consolidate, removed in Task 15; the brain-ui usage was removed in Task 12)

- [ ] **Step 2: Delete the directory**

```bash
git rm -r src/runtime/llm/
```

- [ ] **Step 3: Delete the related tests**

```bash
git rm tests/runtime/llm*.test.ts 2>/dev/null || true
git rm -r tests/runtime/llm 2>/dev/null || true
```

- [ ] **Step 4: Type-check**

Run: `pnpm tsc --noEmit`
Expected: clean exit

- [ ] **Step 5: Full test suite**

Run: `pnpm test`
Expected: all remaining tests pass

- [ ] **Step 6: Commit**

```bash
git commit -m "refactor: remove src/runtime/llm/ (orphan after consolidate removal)"
```

---

### Task 17: Drop src/templates/consolidation/ directory

**Files:**

- Delete: `src/templates/consolidation/p1-repeated-correction.md.tmpl` through `p9-artifact-observation.md.tmpl`

- [ ] **Step 1: List the files**

```bash
ls src/templates/consolidation/
```

Expected: 9 .md.tmpl files

- [ ] **Step 2: Verify no consumers**

```bash
grep -rln "templates/consolidation\|consolidation/p[0-9]" src/ tests/
```

Expected: empty (consumers were `prompts.ts` in `runtime/consolidate/`, removed in Task 15)

- [ ] **Step 3: Delete the directory**

```bash
git rm -r src/templates/consolidation/
```

- [ ] **Step 4: Type-check + tests**

Run: `pnpm tsc --noEmit && pnpm test`
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git commit -m "refactor: remove src/templates/consolidation/ (legacy P1-P9 LLM prompt templates)"
```

---

### Task 18: Add migration to drop proposals table

**Files:**

- Modify: `src/runtime/brain/migrate.ts`
- Modify: `src/runtime/brain/schema.ts`

- [ ] **Step 1: Write the failing test**

Create or extend `tests/runtime/brain-migrate.test.ts` with:

```ts
import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { applyMigrations } from "../../src/runtime/brain/index.js";

describe("brain migration: drop proposals table", () => {
  it("removes proposals table when present", () => {
    const db = new Database(":memory:");
    db.exec("CREATE TABLE proposals (proposal_id INTEGER PRIMARY KEY, title TEXT)");
    applyMigrations(db);
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='proposals'")
      .get();
    expect(row).toBeUndefined();
  });

  it("is idempotent when proposals table absent", () => {
    const db = new Database(":memory:");
    expect(() => applyMigrations(db)).not.toThrow();
    expect(() => applyMigrations(db)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test tests/runtime/brain-migrate.test.ts`
Expected: FAIL — proposals table still present after migration

- [ ] **Step 3: Add the migration step**

In `src/runtime/brain/migrate.ts`, append a new migration step at the end of the migration sequence (it must be a new version number, one above the current max). Pattern matches existing steps:

```ts
// New migration vN: drop legacy proposals table
function migrateDropProposals(raw: Database.Database): void {
  raw.exec("DROP TABLE IF EXISTS proposals");
  raw.exec("DROP INDEX IF EXISTS idx_proposals_status");
  raw.exec("DROP INDEX IF EXISTS idx_proposals_pattern");
}
```

Wire it into the migration runner alongside existing steps. Increment the schema version constant accordingly.

- [ ] **Step 4: Remove proposals table from schema.ts**

In `src/runtime/brain/schema.ts`, find and remove the `export const proposals = sqliteTable("proposals", { ... })` block and any references to it elsewhere in the file.

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test tests/runtime/brain-migrate.test.ts`
Expected: PASS

- [ ] **Step 6: Run full test suite**

Run: `pnpm test`
Expected: all tests pass

- [ ] **Step 7: Commit**

```bash
git add src/runtime/brain/migrate.ts src/runtime/brain/schema.ts tests/runtime/brain-migrate.test.ts
git commit -m "refactor(brain): migration — drop legacy proposals table; remove from schema"
```

---

### Task 19: CHANGELOG entry

**Files:**

- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add a new entry under [Unreleased] / next version**

Edit `CHANGELOG.md` to add a new section above the most recent release:

```markdown
## [Unreleased]

### Added

- New workflow `team-consolidation` — agent-driven cross-dev brain analysis producing a consensus-candidate markdown report. Use `codi run team-consolidation` to start.
- `refine-rules` skill — new `REPORT-DRIVEN` mode that consumes team consolidation reports.
- `artifact-contributor` skill — new `REPORT-DRIVEN` mode for opening upstream PRs from approved meta-pipeline findings.

### Removed

- Legacy auto-detection consolidation pipeline (`src/runtime/consolidate/`).
- Pattern detectors P1 through P9.
- `proposals` table from the brain DB schema.
- `/proposals` page in the brain UI.
- `/api/v1/consolidation/*` endpoints from the brain UI server.
- `src/runtime/llm/` LLM provider abstraction (orphan after consolidate removal).
- `src/templates/consolidation/` prompt templates.

### Deprecated

- `codi brain export` command — now prints a deprecation message and exits cleanly. Will be removed in the next minor release.

### Migration notes

- Brain DBs are migrated automatically on first open: the `proposals` table is dropped via `applyMigrations`. Idempotent on DBs without the table.
- Teams that scripted `codi brain export` should switch to `codi run team-consolidation` and consume the generated `[REPORT]_team-consolidation.md`.
```

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): document team-consolidation workflow + consolidate retire"
```

---

### Task 20: End-to-end smoke test

**Files:**

- No source changes; this is a validation task.

- [ ] **Step 1: Build clean**

```bash
pnpm clean 2>/dev/null || true
pnpm build
```

Expected: clean build, no errors

- [ ] **Step 2: Run full test suite**

```bash
pnpm test
```

Expected: all tests pass; deleted suites cleanly absent; new workflow test passes

- [ ] **Step 3: Set up mock team-brains directory**

```bash
TEAM=$(mktemp -d)
mkdir -p "$TEAM/alice" "$TEAM/bob" "$TEAM/carol"
# Copy this project's brain.db three times to simulate a 3-dev team
cp .codi/state/brain.db "$TEAM/alice/repo-foo.db"
cp .codi/state/brain.db "$TEAM/bob/repo-bar.db"
cp .codi/state/brain.db "$TEAM/carol/repo-baz.db"
echo "Team brains at: $TEAM"
ls -la "$TEAM"/*/
```

Expected: 3 dev folders, each with one .db file

- [ ] **Step 4: Manual: invoke the workflow and walk through phases**

In a separate Codi session, type:

> Run team-consolidation workflow. The brains are at `<TEAM>`. Use sequential mode. Scope: smoke test.

Expected:

- Workflow starts at `intent` phase, agent confirms scope/mode/path
- Transitions to `collect`, lists 3 brains, validates each
- Transitions to `analyze`, reads each, produces 3 per-dev findings blocks
- Transitions to `consolidate`, writes `docs/[REPORT]_team-consolidation*.md` with both Domain and Meta-pipeline sections
- Transitions to `done`

- [ ] **Step 5: Verify the report exists and has expected sections**

```bash
ls docs/*[REPORT]_team-consolidation*.md
REPORT=$(ls -t docs/*[REPORT]_team-consolidation*.md | head -1)
grep -c "^## Domain findings" "$REPORT"
grep -c "^## Meta-pipeline findings" "$REPORT"
grep -c "^## Decisions log" "$REPORT"
grep -c "Privacy notice" "$REPORT"
```

Expected: each grep returns >= 1

- [ ] **Step 6: Cleanup**

```bash
rm -rf "$TEAM"
# Optionally delete the smoke test report:
# rm "$REPORT"
```

- [ ] **Step 7: Commit any docs/.codi changes from the smoke run**

```bash
git status
git add -A
git commit -m "chore: end-to-end smoke run of team-consolidation workflow"
```

(only commit if smoke run produced non-trivial artifact updates worth keeping)

## Success criteria

Copied from spec doc. Each criterion is testable.

- [ ] Workflow `team-consolidation` registered in `WORKFLOW_TYPES` enum (Task 1)
- [ ] YAML loads, phases transition cleanly through gates (Task 2 test)
- [ ] Companion skill template + 4 phase docs + schema reference exist (Tasks 3-8)
- [ ] Sequential and parallel modes both produce a valid `[REPORT]_team-consolidation.md` (Task 20 smoke)
- [ ] Refine-rules and artifact-contributor SKILL.md include `Mode: REPORT-DRIVEN` section (Tasks 10, 11)
- [ ] `consolidate/` dir, `runtime/llm/` dir, `consolidation/` templates dir deleted (Tasks 15, 16, 17)
- [ ] `proposals` table dropped via migration; idempotent (Task 18)
- [ ] `brain export` command shows deprecation notice (Task 14)
- [ ] `/proposals` UI route and `/api/v1/consolidation/*` endpoints removed (Tasks 12, 13)
- [ ] All previously passing tests still pass; deleted tests removed cleanly (Task 20)
- [ ] CHANGELOG entry merged (Task 19)
- [ ] End-to-end smoke test passes: 3 mock brain.dbs, workflow runs, .md emerges with expected sections (Task 20)

## Risks

| Risk                                                                              | Detection                              | Mitigation                                                                                                                     |
| --------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Sub-agents in parallel mode return inconsistent shape, padre cannot aggregate     | Padre validates structure on receipt   | Phase-analyze.md ships an explicit per-dev findings block format; sub-agent prompt repeats the format requirement              |
| Agent hallucinates schema columns when writing SQL queries                        | Test or manual run failure             | `schema-reference.md` ships the full DDL with examples; agent reads it once at start of `analyze` phase                        |
| Drop of `proposals` table fails on a populated production brain.db                | Migration test on populated DB         | Migration uses `DROP TABLE IF EXISTS`; idempotent; no FK from other tables references `proposals` (verified)                   |
| Existing `runtime/llm/` consumer surfaces during build that grep missed           | `pnpm tsc --noEmit` after Task 16      | Tasks 12 and 16 both verify with `grep -rln`; tsc catches any remaining import after delete                                    |
| User invokes legacy `codi brain export` and expects old behavior                  | Manual run                             | Deprecation message in stub; CHANGELOG migration note pointing to new workflow                                                 |
| Two devs have brain.db with overlapping `project_id` (same repo, different forks) | Manual or smoke test                   | Agent treats them as the same project for vote counting; documented behavior; acceptable                                       |
| User runs `team-consolidation` against an empty directory                         | Phase `collect` test                   | `collect` phase fails its gate `brains_listed`; workflow transitions to `abandoned` cleanly                                    |
| Refine-rules `REPORT-DRIVEN` mode collides with existing REVIEW/REFINE modes      | Skill eval                             | New mode triggered by explicit phrase or report path argument; otherwise existing modes unchanged; documented Skip-When clause |
| Bumping skill version causes `codi update` to overwrite user customizations       | Existing `managed_by: user` protection | `version:` bump only affects `managed_by: codi` artifacts; user-managed copies remain                                          |

## Open questions

None at gate time. All decisions resolved in spec doc (Q1-Q13). Implementer may resolve leaf items during execution:

- Exact wording of agent prompts in each phase doc — drafted in tasks 4-7; refine during execution if smoke test reveals gaps
- Whether `schema-reference.md` is auto-generated from `schema.ts` or hand-maintained — recommend hand-maintained for v1 (auto-gen orthogonal future work)

## Self-review

Run the self-review checklist (`references/self-review.md`) before claiming this plan is ready.

- ✅ Spec coverage: every spec section maps to at least one task
- ✅ Placeholder scan: zero TBD/TODO/FIXME; every code/markdown block has actual content
- ✅ Type consistency: function names, schema names, file paths consistent across tasks
- ✅ Internal contradictions: none found; modules section matches task descriptions
- ✅ Scope check: focused on team-consolidation workflow + consolidate retire (single coordinated work)
- ✅ Ambiguity check: each task has explicit files, commands, expected outputs
