# Phase: analyze

Read every valid brain in the inventory and produce per-dev findings. The agent uses `sqlite3` read-only queries; full schema is in `references/schema-reference.md`. No allowlist, no forbidden tables.

## Process — sequential mode

For each `(dev_id, db_path)` in the inventory:

1. Open read-only:
   ```bash
   sqlite3 -readonly "<db_path>"
   ```
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
