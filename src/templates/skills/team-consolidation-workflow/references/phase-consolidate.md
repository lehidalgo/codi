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
