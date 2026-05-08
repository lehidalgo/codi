---
name: project-workflow
description: Use when starting a new project, bootstrapping the project Sheet, or absorbing new stakeholder material into an existing project. Triggers on "start a project", "bootstrap project", "set up project Sheet", "absorb interviews", "add requirements", "new project from these notes". Re-runnable — incremental runs with --update only process new sources. The skill elicits required config one question per turn (project name, Sheet attachment, credentials), reads docs/sources/*.md, structures the content into BusinessGoal / Requirement / UserStory rows in a Google Sheet, and gates the strategic and decomposition layers with the human. Body documents the elicitation discipline, the HARD GATES, and the chain into ingest-material, discover, plan-writing, and sheets-sync.
---

# project-workflow

Bootstraps the project Sheet, seeds the stakeholder layer (Goals + Requirements + Stories). Sheet is the spine; other devloop workflows write execution state back.

## When to use

User said "start a project", "bootstrap Sheet", "absorb interviews", or wants new requirements in an existing project. Start:

```bash
devloop run project "<one-line project description>"
devloop run project "..." --update           # incremental absorption of new sources
```

If `.devloop/project.json` is missing, the agent ELICITS — never invents.

## When to skip

- Building a single feature in an existing project → `feature-workflow`.
- Bug fix → `bug-fix-workflow`.
- Refactor with no behavior change → `refactor-workflow`.

## The Iron Law

> PROPOSE, DON'T INTERROGATE. ONE Q/TURN. SHEET IS THE CANVAS. USE EXISTING REFERENCES.

- **Propose defaults.** Confirm OR redirect, never menu.
- **One question per turn.** Stop. Wait. Next.
- **Sheet is the canvas.** Once `project.json` is bound, ALL spec content (Goals/Reqs/Stories) goes DIRECTLY to the Sheet via `devloop sheets upsert`. No chat-table dumps. Agent writes; user reviews IN Sheet; approves in chat in one word.
- **Use existing references.** Missing creds → `Read` `devloop:sheets-sync references/google-sheets-setup.md`. NEVER author a new `[GUIDE]_*.md`.

## Phase order

| Phase       | Purpose                                            | GATE                |
| ----------- | -------------------------------------------------- | ------------------- |
| `intent`    | Elicit name + Sheet + creds                        | Yes                 |
| `discover`  | Extract Goals + draft Stories from sources         | Yes (strategic)     |
| `decompose` | PR-sized Stories with acceptance criteria          | Yes (eng-readiness) |
| `sync`      | Push to Sheet via `sheets-sync` (caller=bootstrap) | —                   |
| `done`      | Project Sheet is live                              | terminal            |

Per-phase detail in `references/phase-*.md`.

## Core principle

Stakeholder language before engineering. Stories elaborate from Requirements. `--update` proposes deltas only — never overwrites planning columns.

## Google setup discipline

Missing creds → STOP → `Read` `devloop:sheets-sync references/google-sheets-setup.md` → detect `gcloud` → offer **A** (path-only), **B** (Step 1 inline), or **C** (automated via `scripts/gcloud-setup.sh`, only if gcloud detected) → recommend C when available, else B → wait → resume. NEVER author a new guide.

## Anti-patterns

- Inventing a Sheet ID / project name to skip elicitation.
- Asking 2+ questions in one turn.
- **Dumping proposed rows in chat as a markdown table.** Write to Sheet via `sync-draft`; one summary line in chat.
- **Per-row `devloop sheets upsert` for batches.** Use `devloop sheets sync-draft <path>` — one Write + one Bash vs 13+ calls.
- **Authoring a new `[GUIDE]_*.md` for Google setup** — canonical guide already ships.
- Folding both HARD GATES into one "looks good" hand-wave.
- Running `discover` on empty `docs/sources/`.
- Auto-approving a transition because "the user said go ahead."

## References

- `references/phase-intent.md` / `phase-discover.md` / `phase-decompose.md` / `phase-sync.md` — per-phase flow.
- `references/elicitation-questions.md` — canonical question set for `intent`.

## Termination

- `done`: project.json committed; Sheet seeded; `workflow_completed`.
- Abandoned via `devloop abandon --reason "<text>"`.

## Boundaries

- Bootstraps the upstream layer. Not feature/bug-fix/refactor/migration.
- No design docs (`feature-workflow.plan`).
- No raw-material conversion (`ingest-material`).
- No planning-column writes outside `caller=bootstrap`.
