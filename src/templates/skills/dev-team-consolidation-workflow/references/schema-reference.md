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
| raw_marker  | TEXT    | full original `\|TYPE: "..."\|` string                                                                               |
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
