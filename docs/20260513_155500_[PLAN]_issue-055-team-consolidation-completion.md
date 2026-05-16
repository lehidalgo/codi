# ISSUE-055 — Team Consolidation Completion Plan

- Date: 2026-05-13 15:55 UTC
- Document: 20260513*155500*[PLAN]\_issue-055-team-consolidation-completion.md
- Category: PLAN

## Intent (clarified 2026-05-13)

ISSUE-055 is NOT a Postgres aggregation pipeline. It is the completion of the
agent-driven team-consolidation flow: a designated lead collects each dev's
`brain.db`, runs a workflow, and the coding agent uses skills to analyze the
corpus, propose improvements to rules / skills / practices, run advanced
analytics, and surface a report for human review.

## Foundation that already exists

| Artifact           | Path                                                                            | Status                                                 |
| ------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Workflow           | `src/templates/workflows/team-consolidation.yaml`                               | 4 phases wired (intent, collect, analyze, consolidate) |
| Skill              | `src/templates/skills/dev-team-consolidation-workflow/`                         | template + 4 phase references + schema-reference       |
| Skill              | `src/templates/skills/dev-team-charter/`                                        | scope and conventions of the team                      |
| Downstream         | `dev-refine-rules`, `dev-artifact-contributor`, `rule-creator`, `skill-creator` | consume the report                                     |
| Gate checkers      | `src/runtime/workflow/gates/team-consolidation/`                                | 7 deterministic checkers (closed by ISSUE-035)         |
| Foundation columns | `actor_id` on corrections, `team_id` on sessions/captures/workflow_runs         | shipped via ISSUE-052/053                              |

## Gaps to close

### Gap 1 — empty `chains:` in workflow yaml (already tracked: ISSUE-085)

Every phase declares `chains: []`. Without chains the agent has no documented
skill list per phase. The phase references already name the right skills inline,
but `chains:` is the canonical declaration the workflow runner reads.

Action: leave to ISSUE-085. Out of scope for ISSUE-055.

### Gap 2 — missing `evals.json` for the skill (already tracked: ISSUE-086)

Without `evals/evals.json` the skill's trigger reliability is unmeasured. The
contribution-discipline rule (`codi-contribution-discipline.md`) requires
`evals/evals.json` for every new skill.

Action: leave to ISSUE-086. Out of scope for ISSUE-055.

### Gap 3 — no collection shortcut for the lead

Today each dev must manually copy their `~/.codi/brain.db` into the shared
directory the lead uses. Two friction points:

- The lead has no command to validate the directory layout before running the
  workflow (the `dev_layout_validated` gate fails late).
- Devs have no command that bundles their brain into a `<dev_id>/<project>.db`
  shape ready to drop into the shared directory.

Action: add two thin CLI shortcuts in `src/cli/brain.ts`:

| Command                                  | Purpose                                                       | Implementation note                     |
| ---------------------------------------- | ------------------------------------------------------------- | --------------------------------------- |
| `codi brain export-for-team --to <path>` | Copy current brain to `<path>/<actor_id>/<project>.db`        | reuse `resolveActorId()` from ISSUE-052 |
| `codi brain team-check <path>`           | Run the same validation `phase-collect` does, but stand-alone | reuse the schema-version probe          |

Both are ≤ 50 LOC each. No new dependencies. No schema change.

### Gap 4 — analyze phase lacks aggregate analytics queries

`phase-analyze.md` walks each brain in isolation. The cross-brain aggregation
happens in `phase-consolidate.md` but the queries there are described as agent
prose ("count how many devs reported it"). The schema-reference does not list
the canonical aggregate queries.

Action: append a section to `references/schema-reference.md` titled
"Aggregate query catalog" listing 5-7 prewritten SQL snippets the agent can
copy verbatim. Concrete queries:

| Query name                    | Purpose                                                                       |
| ----------------------------- | ----------------------------------------------------------------------------- |
| `top_corrections_by_artifact` | Which artifact accrues the most user CORRECTIONs across the team              |
| `skill_error_rate_ranking`    | `artifacts_used` grouped by `artifact_name` with `errors / total` ratio       |
| `recurring_capture_themes`    | `captures` grouped by `(type, normalized_content_hash)` with `vote_count > 1` |
| `stuck_phase_p95`             | `workflow_runs` phase durations p95 by phase name                             |
| `actor_correction_load`       | `corrections` grouped by `actor_id` (who corrects most often)                 |
| `team_active_window`          | `MIN(started_at) / MAX(started_at)` per `team_id` across all brains           |

This is a doc-only change. No code. The queries become the canonical
analytical surface the agent uses in `phase-analyze` parallel mode.

### Gap 5 — no link from workflow output to a review UI

The report lives at `docs/.../[REPORT]_team-consolidation.md`. The team reviews
async in PR / Slack / live meeting. A small enhancement: a brain-ui page that
lists the most recent team-consolidation reports with status counts (how many
APPROVED / REJECTED / DEFERRED).

Action: defer. This is not on the audit critical path. Open as
ISSUE-055-followup if a real lead asks for it. Reviewing markdown in a PR is
fine for the 3-50 dev scale.

## Minimum viable scope for ISSUE-055

1. Add `codi brain export-for-team --to <path>` and `codi brain team-check <path>` (Gap 3).
2. Append "Aggregate query catalog" to `references/schema-reference.md` (Gap 4).
3. Close ISSUE-055.

Estimated work: ≤ 100 LOC code, ≤ 60 LOC doc. One commit. Tests for the two CLI
commands using the existing brain-handler test harness.

## Out of scope

- Postgres aggregation. ADR-005 keeps this for v3-lite/standard/full, not v3-zero.
- Conflict resolution between brains. The workflow is read-only over the corpus.
- Privacy scrubbing. The dev controls their brain.db before contributing
  (per the workflow's stated anti-pattern).
- Automatic mutation of artifacts. Workflow stops at the report.

## Decision needed from the user

- Approve the scope (Gap 3 + Gap 4) and proceed to implementation, OR
- Narrow further (e.g. only Gap 4, doc-only)
