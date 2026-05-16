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
| team_id             | TEXT    | nullable team slug (v15)   |

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
| raw_marker  | TEXT    | full original `\|TYPE: "..."\|` string                                                                               |
| file_paths  | TEXT    | JSON array of relative paths                                                                                         |
| workflow_id | TEXT    | nullable                                                                                                             |
| phase       | TEXT    | nullable                                                                                                             |
| deleted_at  | INTEGER | soft delete; query with `deleted_at IS NULL`                                                                         |
| team_id     | TEXT    | nullable team slug (v15)                                                                                             |

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

| column           | type    | notes                                                    |
| ---------------- | ------- | -------------------------------------------------------- |
| correction_id    | INTEGER | primary key                                              |
| session_id       | TEXT    | FK sessions                                              |
| ts               | INTEGER |                                                          |
| file_path        | TEXT    |                                                          |
| diff_summary     | TEXT    |                                                          |
| source_turn_id   | INTEGER | nullable                                                 |
| detected_via     | TEXT    | how this correction was detected                         |
| linked_artifacts | TEXT    | JSON string[] of artifact names active in the turn (v12) |
| actor_id         | TEXT    | `<type>:<id>` e.g. `human:user@x.com` (v14)              |

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

| column        | type    | notes                                                                           |
| ------------- | ------- | ------------------------------------------------------------------------------- |
| workflow_id   | TEXT    | primary key                                                                     |
| project_id    | TEXT    | FK projects                                                                     |
| type          | TEXT    | feature / bug-fix / refactor / migration / project / quick / team-consolidation |
| current_phase | TEXT    |                                                                                 |
| status        | TEXT    |                                                                                 |
| started_at    | INTEGER |                                                                                 |
| ended_at      | INTEGER | nullable                                                                        |
| metadata      | TEXT    | JSON: scope_files, gates_passed, flags                                          |
| team_id       | TEXT    | nullable team slug (v15)                                                        |

### `workflow_events`

| column      | type    | notes                         |
| ----------- | ------- | ----------------------------- |
| event_id    | INTEGER | primary key                   |
| workflow_id | TEXT    | FK workflow_runs              |
| event_type  | TEXT    | gate_passed, transition, etc. |
| ts          | INTEGER |                               |
| payload     | TEXT    | JSON                          |

### `eval_runs`

| column         | type    | notes                           |
| -------------- | ------- | ------------------------------- |
| run_id         | INTEGER | primary key autoincrement (v13) |
| ts             | INTEGER |                                 |
| project_id     | TEXT    |                                 |
| session_id     | TEXT    | nullable                        |
| skill_name     | TEXT    |                                 |
| skill_version  | TEXT    | nullable                        |
| case_id        | TEXT    |                                 |
| passed         | INTEGER | 0/1                             |
| trigger_rate   | REAL    | nullable                        |
| runs           | INTEGER | default 1                       |
| triggers       | INTEGER | nullable                        |
| model          | TEXT    | nullable                        |
| duration_ms    | INTEGER | nullable                        |
| error          | TEXT    | nullable                        |
| trigger_source | TEXT    | which harness reported it       |
| metadata       | TEXT    | JSON, forward-compat extras     |

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

## Aggregate query catalog (cross-brain analytics)

Copy these verbatim during analyze / consolidate phases. Each query is
designed to run against ONE brain.db at a time; the consolidate phase
unions the per-brain results to produce cross-team rankings.

### `top_corrections_by_artifact`

Which artifact accrues the most user CORRECTIONs? Reads `corrections.linked_artifacts`
(JSON string[] populated since v12) and counts occurrences. Empty list rows are
counted as `__unattributed__`.

```sql
WITH expanded AS (
  SELECT
    correction_id,
    ts,
    CASE
      WHEN linked_artifacts IS NULL OR linked_artifacts = '' OR linked_artifacts = '[]'
        THEN '__unattributed__'
      ELSE json_each.value
    END AS artifact
  FROM corrections
  LEFT JOIN json_each(linked_artifacts)
)
SELECT artifact, COUNT(*) AS corrections
FROM expanded
GROUP BY artifact
ORDER BY corrections DESC;
```

### `skill_error_rate_ranking`

`artifacts_used` grouped by `artifact_name` with `errors / total` ratio.
Filters to skills only.

```sql
SELECT
  artifact_name,
  COUNT(*)                                          AS total_uses,
  SUM(CASE WHEN outcome = 'error' THEN 1 ELSE 0 END) AS errors,
  ROUND(
    1.0 * SUM(CASE WHEN outcome = 'error' THEN 1 ELSE 0 END) / COUNT(*),
    3
  ) AS error_rate,
  AVG(duration_ms) AS avg_duration_ms
FROM artifacts_used
WHERE artifact_type = 'skill'
GROUP BY artifact_name
HAVING total_uses >= 3
ORDER BY error_rate DESC, total_uses DESC;
```

### `recurring_capture_themes`

`captures` grouped by `(type, normalized_content_hash)`. Uses substr to bucket
near-identical captures without LLM embeddings — coarse but cheap. Reports
themes with `vote_count > 1` so singletons stay out of the cross-team report.

```sql
SELECT
  type,
  substr(lower(content), 1, 80) AS theme_prefix,
  COUNT(*) AS vote_count,
  GROUP_CONCAT(DISTINCT session_id) AS sessions
FROM captures
WHERE deleted_at IS NULL
GROUP BY type, theme_prefix
HAVING vote_count > 1
ORDER BY vote_count DESC, type ASC;
```

### `stuck_phase_p95`

`workflow_runs` phase durations p95 by phase name. SQLite has no built-in
percentile_cont; this uses an `ntile`-style window approximation.

```sql
WITH phase_durations AS (
  SELECT
    current_phase,
    (COALESCE(ended_at, unixepoch() * 1000) - started_at) AS duration_ms
  FROM workflow_runs
  WHERE current_phase IS NOT NULL
),
ranked AS (
  SELECT
    current_phase,
    duration_ms,
    NTILE(20) OVER (PARTITION BY current_phase ORDER BY duration_ms) AS bucket
  FROM phase_durations
)
SELECT current_phase, MAX(duration_ms) AS p95_ms
FROM ranked
WHERE bucket = 19
GROUP BY current_phase
ORDER BY p95_ms DESC;
```

### `actor_correction_load`

`corrections` grouped by `actor_id` — who corrects most often. Requires
v14+ data (older rows have NULL actor_id).

```sql
SELECT
  COALESCE(actor_id, '__pre_v14__') AS actor,
  COUNT(*) AS corrections,
  MIN(ts) AS first_ts,
  MAX(ts) AS last_ts
FROM corrections
GROUP BY actor
ORDER BY corrections DESC;
```

### `team_active_window`

When was each team active? Reads the `team_id` slug added in v15.

```sql
SELECT
  COALESCE(team_id, '__solo__') AS team,
  COUNT(DISTINCT session_id) AS sessions,
  MIN(started_at) AS first_session_ts,
  MAX(started_at) AS last_session_ts
FROM sessions
GROUP BY team
ORDER BY sessions DESC;
```

### `eval_pass_rate_per_skill`

Recent eval-runs pass rate per skill — surfaces skills with degrading
trigger reliability (added in v13 via ISSUE-050).

```sql
SELECT
  skill_name,
  COUNT(*)                                  AS runs,
  SUM(passed)                                AS passes,
  ROUND(1.0 * SUM(passed) / COUNT(*), 3)     AS pass_rate,
  AVG(trigger_rate)                          AS avg_trigger_rate,
  MAX(ts)                                    AS last_run_ts
FROM eval_runs
GROUP BY skill_name
ORDER BY pass_rate ASC, runs DESC;
```
