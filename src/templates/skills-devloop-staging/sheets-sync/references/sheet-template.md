# Sheet template — canonical layout

The project Sheet is a copy of a canonical template. The team authors the template once; `project-workflow.intent` copies it via the Google Drive API when bootstrapping a new project.

## Tabs

6 tabs in this order:

1. `BusinessGoal`
2. `Requirement`
3. `UserStory`
4. `Release`
5. `Dashboard`
6. `Audit`

## `BusinessGoal` tab

| Column        | Type      | Validation                          | Zone      |
| ------------- | --------- | ----------------------------------- | --------- |
| `id`          | text      | regex `^BG-\d{3,}$`                 | execution |
| `title`       | text      | non-empty                           | planning  |
| `outcome`     | text      | —                                   | planning  |
| `metric`      | text      | —                                   | planning  |
| `priority`    | dropdown  | `P0` / `P1` / `P2`                  | planning  |
| `source_link` | text      | path under `docs/sources/`          | planning  |
| `status`      | dropdown  | `proposed` / `accepted` / `dropped` | planning  |
| `created_at`  | timestamp | ISO 8601                            | execution |

## `Requirement` tab

| Column                  | Type      | Validation                                     | Zone      |
| ----------------------- | --------- | ---------------------------------------------- | --------- |
| `id`                    | text      | regex `^REQ-\d{3,}$`                           | execution |
| `type`                  | dropdown  | `functional` / `non_functional` / `constraint` | planning  |
| `title`                 | text      | non-empty                                      | planning  |
| `behavior_or_threshold` | text      | —                                              | planning  |
| `satisfies`             | text      | regex `^BG-\d{3,}$`                            | planning  |
| `priority`              | dropdown  | `P0` / `P1` / `P2`                             | planning  |
| `status`                | dropdown  | `proposed` / `accepted` / `dropped`            | planning  |
| `created_at`            | timestamp | ISO 8601                                       | execution |

## `UserStory` tab

Planning zone (human-owned):

| Column                | Type                     | Validation                        |
| --------------------- | ------------------------ | --------------------------------- |
| `id`                  | text                     | regex `^US-\d{3,}$`               |
| `as_a`                | text                     | nullable for non-feature work     |
| `i_want`              | text                     | nullable for migration / refactor |
| `so_that`             | text                     | nullable                          |
| `acceptance_criteria` | text (multiline)         | non-empty for `feature` type      |
| `priority`            | dropdown                 | `P0` / `P1` / `P2`                |
| `assigned_to`         | text                     | git email or `unassigned`         |
| `parent_story`        | text                     | regex `^US-\d{3,}$`, nullable     |
| `elaborated_from`     | text                     | regex `^REQ-\d{3,}$`, nullable    |
| `status`              | dropdown (planning side) | `backlog` / `ready` / `blocked`   |

Execution zone (devloop-owned, **protected range**):

| Column            | Type                      | Validation                                                 |
| ----------------- | ------------------------- | ---------------------------------------------------------- |
| `workflow_type`   | dropdown                  | `feature` / `bug-fix` / `refactor` / `migration` / `chore` |
| `branch`          | text                      | git ref                                                    |
| `commit_shas`     | text                      | comma-separated short SHAs                                 |
| `design_doc_path` | text                      | path under `docs/`                                         |
| `pr_url`          | text                      | URL                                                        |
| `pr_state`        | dropdown                  | `open` / `merged` / `closed`                               |
| `merged_sha`      | text                      | full SHA                                                   |
| `merged_at`       | timestamp                 | ISO 8601                                                   |
| `started_at`      | timestamp                 | ISO 8601                                                   |
| `completed_at`    | timestamp                 | ISO 8601                                                   |
| `status`          | dropdown (execution side) | `in-progress` / `in-review` / `delivered` / `abandoned`    |

`status` carries values from both zones — humans set planning statuses, devloop sets execution statuses. The transition is one-way; once devloop sets `status=in-progress`, humans should not edit it.

## `Release` tab

| Column               | Type      | Validation               |
| -------------------- | --------- | ------------------------ |
| `id`                 | text      | regex `^REL-\d{3,}$`     |
| `version`            | text      | semver or tag            |
| `released_at`        | timestamp | ISO 8601                 |
| `story_ids`          | text      | comma-separated `US-NNN` |
| `commit_range`       | text      | `vX.Y.Z..vA.B.C`         |
| `release_notes_link` | text      | URL or path              |

## `Dashboard` tab

Pure formula tab. Canonical formulas:

- `% Stories delivered` — `COUNTIF(UserStory.status, "delivered") / COUNTA(UserStory.id)`
- `Open PRs` — `COUNTIF(UserStory.pr_state, "open")`
- `Stories without Requirement` — `COUNTBLANK(UserStory.elaborated_from)` minus bug-fix/refactor count
- `Goals without Stories` — `COUNTIF(BusinessGoal.id, NOT IN MAP(UserStory→Requirement→BusinessGoal))`
- `Untraced work` — `COUNTIF(UserStory.elaborated_from = "" AND UserStory.parent_story = "")`
- `Stale in-progress` — `COUNTIF(UserStory.status = "in-progress" AND UserStory.started_at < TODAY()-7)`

## `Audit` tab

Append-only mirror of `.devloop/manifest/events.jsonl`. Columns:

| Column         | Type                           |
| -------------- | ------------------------------ |
| `event_id`     | text                           |
| `event_type`   | text                           |
| `entity_id`    | text                           |
| `actor`        | text (`git config user.email`) |
| `timestamp`    | timestamp (ISO 8601)           |
| `payload_json` | text                           |

## Protected ranges

The template applies Google Sheets' native **protected range** to every execution-zone column on `UserStory` and to every column on `Audit`. Editing a protected range surfaces a warning banner to humans. This is not enforced cryptographically — it's a friendly fence.

## Versioning

Each Sheet records `sheet_template_version` in cell `A1` of a hidden `_meta` tab. v0.1 ships version `1`. Future schema changes ship a migration script that bumps the version and rewrites affected columns.
