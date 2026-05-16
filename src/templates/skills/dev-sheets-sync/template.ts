import { PROJECT_NAME, SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Use when manifest events need to project into the project Google Sheet —
  invoked programmatically by any ${PROJECT_NAME} workflow that mutates
  project state. Reads Sheet config from .${PROJECT_NAME}/project.json and
  authenticates via the configured service account. Honors a column-zone
  discipline — planning columns are human-owned, execution columns are
  ${PROJECT_NAME}-owned. Appends an Audit row on every write; queues events
  when the Sheet is unreachable. Manifest is the source of truth; the Sheet
  is a live mirror. Body documents the zone rules, the event-to-column
  mapping, and the elicitation rule for missing config.

  NOTE: implementation conforms to the canonical ExternalSyncer
  interface (ADR-005). Current behavior: Google Sheets adapter; xlsx
  push and full pull wiring are still pending.
category: ${SKILL_CATEGORY.DEVELOPER_WORKFLOW}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: false
disable-model-invocation: false
version: 3
maintainers: ["@lehidalgo"]
---

# {{name}}

The Google Sheet is a projection of the manifest. The Sheet can lag, fail, or be hand-edited; the manifest stays correct. Every Sheet write maps deterministically from a manifest event.

## The Iron Law

> THE MANIFEST IS THE SOURCE OF TRUTH. THE SHEET IS A LIVE MIRROR.

If the Sheet is unreachable, the workflow does not stop — events queue in the manifest and a daemon flushes them later. If the Sheet diverges, \\\`${PROJECT_NAME} sheets reconcile\\\` rebuilds it from the manifest.

## When to use

Programmatic invocation only. Callers:

- \\\`project-workflow.sync\\\` — bootstrap; writes Goals, Requirements, Stories (planning + execution columns).
- \\\`feature-workflow\\\`, \\\`bug-fix-workflow\\\`, \\\`refactor-workflow\\\`, \\\`migration-workflow\\\` — at every phase transition, writes execution columns to the Story row.
- \\\`${PROJECT_NAME} sheets daemon\\\` — tails the manifest, pushes queued events on Sheet recovery.
- \\\`${PROJECT_NAME} sheets reconcile\\\` — manual recovery; rebuilds from manifest.

## The two column zones

| Zone      | Owner            | Columns                                                                                                                                                                                      |
| --------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Planning  | Human (Sheet UI) | \\\`as_a\\\`, \\\`i_want\\\`, \\\`so_that\\\`, \\\`acceptance_criteria\\\`, \\\`priority\\\`, \\\`assigned_to\\\`, \\\`parent_story\\\`, \\\`elaborated_from\\\`, \\\`title\\\`, \\\`outcome\\\`, \\\`metric\\\`, \\\`type\\\`, \\\`behavior_or_threshold\\\`, \\\`satisfies\\\` |
| Execution | ${PROJECT_NAME}          | \\\`workflow_type\\\`, \\\`branch\\\`, \\\`commit_shas\\\`, \\\`design_doc_path\\\`, \\\`pr_url\\\`, \\\`pr_state\\\`, \\\`merged_sha\\\`, \\\`merged_at\\\`, \\\`started_at\\\`, \\\`completed_at\\\`, \\\`status\\\`                                         |

**Outside \\\`project-workflow.sync\\\`, sheets-sync refuses planning-column writes.** No exceptions. If the agent thinks a planning column needs to change, the answer is "edit the Sheet directly" or "re-run project-workflow with \\\`--update\\\`."

## Process

| Action                | Summary                                                                                                   |
| --------------------- | --------------------------------------------------------------------------------------------------------- |
| \\\`upsert(entity, row)\\\` | Validate, zone-check, diff, atomic batch (row + Audit), emit event. On API failure → \\\`sheet_sync_queued\\\`. |
| \\\`read(entity, id)\\\`    | Fetch + schema-validate + return.                                                                         |
| \\\`reconcile()\\\`         | Replay manifest into execution columns; never touch planning columns.                                     |

Full step-by-step for each in \\\`references/operations.md\\\`.

**Elicitation rule.** Missing config = ASK. If \\\`.${PROJECT_NAME}/project.json\\\` lacks \\\`sheet_id\\\`, surface the choice to the user. Never invent.

## Anti-patterns

- Writing planning columns from a non-bootstrap caller — silently overwrites human edits.
- Hard-failing the workflow when the Sheet is unreachable — manifest is the truth; the Sheet catches up.
- Skipping the Audit row — every Sheet write must record its actor.
- Reconciling FROM the Sheet — a manual edit becomes ground truth and the manifest gets ignored.
- Polling the Sheet for human edits — out of scope in v0.1; deferred to v0.2 reactive sync.

## References

- \\\`references/google-sheets-setup.md\\\` — one-time Google setup; surface to first-time devs.
- \\\`references/sheet-template.md\\\` — canonical Sheet template.
- \\\`references/event-mapping.md\\\` — full event-to-column table.
- \\\`references/operations.md\\\` — upsert / read / reconcile steps.

## Termination

- Write succeeded → \\\`sheet_row_upserted\\\` emitted; Audit row appended.
- Write failed → \\\`sheet_sync_queued\\\` emitted; daemon retries.
- Reconcile succeeded → \\\`sheet_reconciled\\\` emitted with affected row count.

## Boundaries

- Projects manifest events into Sheet rows. Does NOT define the conceptual model (\\\`project-workflow\\\` does).
- Does NOT do raw material conversion (\\\`ingest-material\\\` does).
- Does NOT do stakeholder elicitation (\\\`project-workflow.intent\\\` does).
- v0.1 is write-and-read-on-demand only — no realtime watching of human edits.
`;
