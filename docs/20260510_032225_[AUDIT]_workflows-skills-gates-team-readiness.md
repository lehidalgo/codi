# Workflows, Skills, Gates — Team Readiness Audit

- **Date**: 2026-05-10 03:22
- **Document**: 20260510*032225*[AUDIT]\_workflows-skills-gates-team-readiness.md
- **Category**: AUDIT
- **Scope**: workflow design quality + gate effectiveness + skill linkage + team standardisation
- **Goal**: ship to dev team tomorrow under "advisory under dev supervision" semantics
- **Methodology**: hands-on test in `/tmp/codi-audit-…/` scaffold + source-code reading + cross-reference with prior audits (`docs/20260509_014606_[AUDIT]_codi-v3-workflows-paradigm.md`, `docs/20260509_201518_[AUDIT]_codi-team-readiness-vs-plan.md`)

## Executive verdict

**Not ready for unsupervised team rollout. Ready for guided pilot under tight dev supervision** with the caveats below.

The workflow system is **architecturally sound but operationally inert**. Workflow YAMLs declare phases and gates; the gate-runner exists with deterministic checkers; transitions write events to the brain. But the three components are not connected. Transitions complete with `gate_passed: true` hardcoded, regardless of whether the gates would have passed. The advisory layer the user wants — "gate fires, agent reads it, dev supervises" — does not exist today.

The good news: the wiring needed is small. Three connecting edits move the system from "decorative" to "advisory under supervision".

| Bucket                            | Verdict                                             | Severity for tomorrow's rollout |
| --------------------------------- | --------------------------------------------------- | ------------------------------- |
| Workflow YAMLs                    | Designed cleanly, 5 archetypes cover the core cases | OK                              |
| Gate definitions                  | 6 deterministic checkers exist + work in isolation  | OK                              |
| Gate execution at transition time | **Never invoked. Hardcoded gate_passed: true**      | **CRITICAL**                    |
| Iron Laws 4–8 enforcer            | Wired into UserPromptSubmit / PreToolUse            | OK                              |
| Phase classifier (PreToolUse)     | Wired and effective                                 | OK                              |
| Skill ↔ workflow linkage          | Naming convention only, no contract                 | MEDIUM                          |
| Brain location                    | Per-user global at `~/.codi/brain.db`               | HIGH for team confusion         |
| Workflow-aware skills             | 8 skills exist; none enforce phase                  | MEDIUM                          |
| Documentation                     | Workflows mentioned in plan/ADR; not in user guide  | MEDIUM                          |

## 1. Workflow inventory

| File             | Phases                                                    | Gates declared                                                                                                                         | Use case                              |
| ---------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `bug-fix.yaml`   | intent → reproduce → plan → execute → verify → done       | task_described, scope_files_listed, plan_artifact_exists, validation_passes, no_unresolved_scope_proposals, all_planned_files_modified | Reproduce + fix a bug                 |
| `feature.yaml`   | intent → plan → decompose → execute → verify → done       | same set                                                                                                                               | New functionality                     |
| `migration.yaml` | intent → plan → execute → data-validation → verify → done | same set + flag rollback_required                                                                                                      | Schema/data migration                 |
| `project.yaml`   | intent → discover → decompose → sync → done               | task_described only                                                                                                                    | Bootstrap a new project               |
| `refactor.yaml`  | intent → baseline → plan → execute → verify → done        | same set + flag no_behavior_change                                                                                                     | Module deepening, no behaviour change |

5 workflows, 6 distinct gates declared. Phase counts are coherent across types — every workflow has `intent`, `done`, and `abandoned`. The shape is good.

## 2. Gates — what they say vs what they do

### 2.1 The deterministic checker set (`src/runtime/gate-runner.ts`)

| Gate id                         | Logic                                                               | Verdict source |
| ------------------------------- | ------------------------------------------------------------------- | -------------- |
| `task_described`                | `state.task.length > 0`                                             | reduced state  |
| `scope_files_listed`            | `state.scope.files_in_plan.length >= 1`                             | reduced state  |
| `plan_artifact_exists`          | scans `docs/` for `YYYYMMDD_HHMMSS_[PLAN]_*.md`                     | filesystem     |
| `no_unresolved_scope_proposals` | tally `scope_expansion_proposed` vs approved/rejected               | event log      |
| `validation_passes`             | most-recent `validation_run` event has `exit_code === 0`            | event log      |
| `all_planned_files_modified`    | `git status --porcelain -- <path>` non-empty for every file in plan | git            |

These checkers are well-designed. They produce structured `GateResult` objects with `verdict`, `summary`, and `suggested_action`. Each suggested-action points to the exact CLI command the dev would type to fix.

### 2.2 What actually happens at transition time

Hands-on test in `/tmp/codi-audit-…/` scaffold:

```
$ codi workflow run feature "Add dark mode toggle"
$ codi workflow transition --to plan      # proposed
$ codi workflow transition --approve      # approved → moved to plan
$ codi workflow transition --to decompose # proposed (skipping ALL plan-phase gates)
$ codi workflow transition --approve      # APPROVED with no gate run
... 4 more transitions ...
$ codi workflow status
"current_phase": "done"   # arrived at done with zero plan or verify gates evaluated
```

The reduced state shows `gate_passed: true` for every phase transition, even though no gate was ever invoked. Verified by code reading: `src/runtime/cli-handlers/transitions.ts:146` hardcodes `gate_passed: true` in the emitted `phase_completed` event. There is no path from `approveTransition()` to `gate-runner.ts`. The gate-runner module is only consumed by its own tests.

### 2.3 What "advisory under dev supervision" should look like

Per the user's preference, gates should not block. They should:

1. Run at `--approve` time (and again at `--to` proposal time, ideally).
2. Emit each `GateResult` to stderr / agent feedback channel.
3. Persist a `gate_check_failed` or `gate_check_passed` event so the brain UI shows the trail.
4. Approve the transition regardless — the dev decides whether to proceed.
5. Optional flag `--strict` to flip to hard-fail per project preference.

This is the same shape as the `security-reminder` runtime hook shipped earlier today.

## 3. Iron Laws 4–8 — wired and working

| Law                            | Hook                          | Behaviour                                                                         | Verdict                                    |
| ------------------------------ | ----------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------ |
| 4 — Hard gates need 'ok'       | UserPromptSubmit + PreToolUse | Surfaces "phase transition pending approval" advisory                             | ✅                                         |
| 5 — Pull before patch          | PreToolUse                    | "Brain state >60s old, run a recall"                                              | ✅                                         |
| 7 — No commit without approval | PreToolUse Bash               | Blocks `git commit/push/merge/tag/release` until approval token in recent prompts | ✅ (we hit this multiple times in session) |
| 8 — Output mode                | UserPromptSubmit              | Emits caveman reminder                                                            | ✅                                         |

The Iron Laws subsystem is the part of the system that actually behaves like an "advisory under supervision" layer. It is the model the gate system should follow.

## 4. Skills ↔ workflow linkage

| Skill                | Linkage          | Reality                                                                                            |
| -------------------- | ---------------- | -------------------------------------------------------------------------------------------------- |
| `feature-workflow`   | by name          | exists, references `feature.yaml` in body                                                          |
| `bug-fix-workflow`   | by name          | exists, references `bug-fix.yaml` in body                                                          |
| `refactor-workflow`  | by name          | exists                                                                                             |
| `migration-workflow` | by name          | exists                                                                                             |
| `project-workflow`   | by name          | exists                                                                                             |
| `quality-gates`      | category=testing | does not invoke `gate-runner`                                                                      |
| `gate-deep-modules`  | gate-namespaced  | dispatched by `gate-runner` (designed for plan→decompose) but the dispatcher never runs (see §2.2) |
| `gate-plan-coverage` | gate-namespaced  | same; dispatcher never runs                                                                        |

The skills are documentation artifacts that an agent reads. None of them enforce the workflow contract. There is no machinery that says "you are in phase plan, the skill `feature-workflow` says X, so do X". The agent has to read the skill and decide.

## 5. Brain location — team confusion risk

`~/.codi/brain.db` is a per-user, machine-global SQLite database. Every workflow run by a developer goes into the same DB regardless of which project the workflow is about. In the test we ran:

```
$ cd /tmp/codi-audit-… && codi workflow status
{ "active": true, "workflow_id": "feat-no-dup-…" }   # workflow from a DIFFERENT project
```

For a single dev this is "feature, not bug" — the brain is yours. For a team of N developers, every dev sees only their own brain. There is **no shared team brain** today. Pair programming and session handover are blocked.

This was already flagged in the prior team-readiness audit (`docs/20260509_201518_[AUDIT]_codi-team-readiness-vs-plan.md` finding 11). Calling it out again because it directly affects "are we ready for team tomorrow".

## 6. Documentation gaps

| Topic                                                    | Where it lives                                                           | Reachable by a new dev?                        |
| -------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------- |
| Workflow lifecycle (run / transition / scope / handover) | `docs/20260509_014606_[AUDIT]_codi-v3-workflows-paradigm.md` (audit doc) | No — buried in audit prose                     |
| Gate semantics and tools                                 | `docs/20260430_155234_[TECH]_quality-gates-policy.md`                    | Yes for the policy; no for the operational map |
| `codi workflow` CLI commands                             | `--help` only                                                            | No structured guide                            |
| When to use each workflow archetype                      | scattered across skills                                                  | No central decision tree                       |
| The "advisory under supervision" contract                | not written                                                              | does not exist as a documented contract        |
| `docs/CONTEXT.md` requirement                            | error message only                                                       | new devs hit it as a wall on first run         |

A team of three or more devs needs a single user-facing document: `docs/[GUIDE]_workflow-handbook.md` with the decision tree, CLI cheatsheet, gate semantics, brain visibility, and what supervision means. This is the largest documentation gap blocking tomorrow's rollout.

## 7. Hands-on test results — full transcript

```
$ git init && git commit --allow-empty -m initial
$ codi workflow run feature "Add dark mode toggle"
[FAIL] Knowledge base missing: docs/CONTEXT.md does not exist
   → init-knowledge-base agent instructions returned in stderr (good)

$ mkdir docs && echo "# context" > docs/CONTEXT.md
$ codi workflow run feature "Add dark mode toggle"
[FAIL] Another workflow is already active (from a different project — global brain)
   → user has to abandon, then retry

$ codi workflow abandon --reason "audit cleanup"
$ codi workflow run feature "Add dark mode toggle"
[OK] workflow id created, current_phase = intent

$ codi workflow transition --to plan
$ codi workflow transition --approve
[OK] moved to plan
   → no gate output, no advisory; status quo until next phase

$ codi workflow transition --to decompose
$ codi workflow transition --approve
[OK] moved to decompose — gates scope_files_listed and plan_artifact_exists DID NOT RUN

$ codi workflow transition --to execute && --approve
$ codi workflow transition --to verify && --approve
$ codi workflow transition --to done && --approve
[OK] arrived at done with zero gates run.
```

This run completed an entire feature workflow without writing a single planned file, without listing any scope, without producing a plan markdown, and without a validation_run event. The system records `gate_passed: true` for every phase. The dev gets no advisory output at all.

## 8. Findings — by severity

### CRITICAL

- **F-1. Gate-runner is dead code at transition time.** `approveTransition` hardcodes `gate_passed: true` and never calls `gate-runner.ts`. The 6 deterministic checkers exist but no production path invokes them. **Fix**: in `src/runtime/cli-handlers/transitions.ts:107` after the proposal lookup and before emitting `phase_completed`, call a new `runPhaseGates(workflowId, fromPhase, toPhase)` helper that loads the workflow YAML, resolves the gate list for `fromPhase`, runs each via `runDeterministicCheck`, emits a `gate_check_started` and `gate_check_passed` / `gate_check_failed` event per gate, prints the aggregated `GateRunResult` to stderr, and writes the real result into `phase_completed.payload.gate_passed`. Approve regardless (advisory semantics).

### HIGH

- **F-2. No advisory channel from gate failure to agent.** Even when gates fail in unit tests, there is no string or block that lands in the next agent turn. The PreToolUse `state-block` and `iron-laws-block` are the closest analogues. **Fix**: extend `buildPromptStateBlock` in `hook-logic.ts` to include `most_recent_gate_failures: GateResult[]` so the agent sees them in the next UserPromptSubmit. The dev sees them too because the same block is part of the prompt context.

- **F-3. Brain is per-user global.** Status command can return a workflow that belongs to a different project. **Fix (lite)**: filter `getActiveWorkflowId()` by `cwd` match against the workflow's first event payload. **Fix (proper)**: scope brain to project root via `.codi/state/brain.db` like the security-reminder state. Defer to follow-up; document the gotcha in the team handbook for tomorrow.

### MEDIUM

- **F-4. Skill ↔ workflow contract is naming convention only.** `feature-workflow` skill does not enforce that you are in `feature.yaml`'s `plan` phase before suggesting plan content. **Fix (long term)**: skills declare `phase_filter: ["plan"]` and the runtime suppresses irrelevant skills. **Fix (now)**: nothing required for tomorrow; the agent can pick the right skill.

- **F-5. `quality-gates` skill describes pre-commit gates, not workflow gates.** Naming clash — a new dev expects this skill to describe `validation_passes` etc. **Fix**: rename to `commit-quality-gates` or split into two skills.

- **F-6. No team handbook doc.** Workflow lifecycle, gate semantics, supervision model, and CLI cheatsheet are scattered. **Fix**: a single `docs/[GUIDE]_workflow-handbook.md` (~400 lines) before tomorrow.

### LOW

- **F-7. `docs/CONTEXT.md` requirement is invisible.** A new dev hits a wall on first `codi workflow run`. **Fix**: `codi init` should create a stub `docs/CONTEXT.md` with a "TODO: fill in domain glossary" comment.

- **F-8. Workflow.yaml `done` and `abandoned` declare empty gates.** Correct, but the YAML noise is identical across all 5 files. **Fix (cosmetic)**: extract a shared `terminal_phases:` block.

- **F-9. `codi update --hooks` flag is a stub.** Documented in commit `1dfc86f1` but only prints next-steps for now. **Fix**: future PR; not a blocker.

## 9. What ships tomorrow vs what waits

| What                                   | Tomorrow                            | Follow-up                     |
| -------------------------------------- | ----------------------------------- | ----------------------------- |
| Run feature/bug-fix/refactor workflows | yes (with caveat: gates won't fire) | wire gate-runner              |
| Use Iron Laws (4–8)                    | yes, fully wired                    | —                             |
| security-reminder hook                 | yes, validated                      | —                             |
| `codi hooks list/add/remove`           | yes                                 | onboarding wizard tweaks      |
| Brain visible per dev                  | yes (each dev sees their own)       | shared team brain (long-term) |
| Workflow handbook                      | **WRITE BEFORE ROLLOUT**            | —                             |
| Gate-runner advisory wiring            | **WRITE BEFORE ROLLOUT**            | strict mode flag              |
| `validation_run` event helper CLI      | nice to have                        | full coverage                 |

## 10. Concrete pre-rollout work, ordered

| #   | Task                                                                                            | Est    | Owner          |
| --- | ----------------------------------------------------------------------------------------------- | ------ | -------------- |
| 1   | Wire gate-runner into `approveTransition` (advisory)                                            | 30 min | implementation |
| 2   | Surface gate verdicts in PreToolUse / UserPromptSubmit prompt blocks                            | 30 min | implementation |
| 3   | Filter `workflow status` by current `cwd`                                                       | 15 min | implementation |
| 4   | Write `docs/[GUIDE]_workflow-handbook.md`                                                       | 90 min | docs           |
| 5   | Hands-on rerun the same scratch test, capture output to validate F-1 + F-2 fixed                | 30 min | QA             |
| 6   | Onboarding session with the team: live demo of the workflow + the gates appearing as advisories | 60 min | dev lead       |

Total ~4 hours. Doable before tomorrow morning.

## 11. What I deliberately did NOT do

- I did not patch the gate-runner wiring inline as part of this audit. The user asked for an audit, not a fix. The fix is task #1 in §10 — please approve the design (advisory, not block) before I implement.
- I did not re-test all 9 security-reminder patterns — that was validated in the previous QA session (26/26 in the hooks-as-artifacts session).
- I did not validate the Codex CLI side end-to-end. The codex adapter generates `.codex/hooks.json` correctly; the live integration with the codex CLI agent was tested in the previous session for security-reminder only and would benefit from the team trying the workflow flow on codex tomorrow.

## 12. Recommendation for tomorrow

Run the rollout as a **guided pilot for one or two devs** for the first day:

- Pair-mode: one dev drives, the other reviews each `transition --approve` and sees the (newly added) gate output.
- Treat every workflow phase transition as a checkpoint; even with the wiring fixed, dev supervision matters because the gates only summarise — they do not guarantee correctness.
- File a single QA report at end-of-day capturing: which gates fired, which fired noisy false positives, which never fired but should have, which advisories the agent ignored.
- Iterate the workflow handbook on day 2 based on actual confusion points.
- Open the rollout to the rest of the team at end of week 1.

This matches the same playbook used for the security-reminder hook today: ship advisory under supervision, watch usage, tune.
