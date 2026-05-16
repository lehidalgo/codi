# Codi v3 zero — End-to-end test plan

- **Date**: 2026-05-09 17:28
- **Document**: 20260509*172807*[TESTING]\_codi-v3-zero-e2e-plan.md
- **Category**: TESTING

## Scope

Validate every F1–F11 deliverable against the **built** binary (`dist/cli.js`) and the **runtime modules** as a consumer would invoke them. Unit tests (3395 green) prove the units; this plan proves the wiring.

## Coverage matrix

| Step  | Surface                | Scenario                                                                                                                         | Type               | Owner      |
| ----- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ---------- |
| F1    | brain schema v2        | `applyMigrations` creates `workflow_definitions` table; idempotent re-apply                                                      | runtime            | autonomous |
| F2    | seeder                 | 5 built-in YAMLs land as rows; `managed_by='user'` rows preserved on re-seed                                                     | runtime            | autonomous |
| F3    | BrainEventLog          | `phase_started`/`phase_completed`/`workflow_completed`/`paused_for_child` flip `workflow_runs.{current_phase, status, ended_at}` | runtime            | autonomous |
| F4    | phase graph            | `proposeTransition` rejects illegal moves; degrades gracefully on unseeded brain                                                 | CLI + runtime      | autonomous |
| F5    | brain-only persistence | No `.workflow/archives/` filesystem; every handler reads brain                                                                   | runtime            | autonomous |
| F6    | capture pipeline       | UserPromptSubmit → Stop full cycle: prompts row + turn + captures + tool_calls                                                   | hook orchestrators | autonomous |
| F7    | Iron Laws live         | L4 status flip + banner; L7 git blocked w/o approval; L8 caveman directive                                                       | hook orchestrators | autonomous |
| F8    | real gate checks       | `no_unresolved_scope_proposals` / `validation_passes` / `all_planned_files_modified`                                             | runtime            | autonomous |
| F9    | `codi workflow` CLI    | Every subcommand against a real brain via `dist/cli.js`                                                                          | CLI                | autonomous |
| F10   | P9 detector            | OBSERVATION captures → consolidate → proposals row                                                                               | runtime            | autonomous |
| F11   | brain-backed compactor | Compact → summary stashed in `metadata.compacted` + events deleted                                                               | runtime            | autonomous |
| Cross | full user flow         | run feature → scope propose+approve → phase transitions → captures → done                                                        | CLI + hooks        | autonomous |
| Cross | crash recovery         | abandon halfway → `recover` resurrects pointer                                                                                   | CLI                | autonomous |
| Cross | dist asset bundling    | `dist/schemas/`, `dist/templates/{skills,workflows,consolidation}/` ship                                                         | build              | autonomous |
| Cross | hook scripts under tsx | `scripts/runtime/hook-*.ts` parse stdin payload + write brain                                                                    | hook entrypoints   | autonomous |

## Test design

### S1 — Schema migration round-trip

```
1. open brain at empty path
2. applyMigrations
3. assert workflow_definitions exists, schema_version = 2
4. applyMigrations again
5. assert no error, schema_version still 2
```

### S2 — Seeder idempotency

```
1. fresh brain → seedWorkflowDefinitions with built-in YAMLs
2. assert 5 rows, all managed_by='codi'
3. UPDATE one row to managed_by='user' + custom phases
4. re-seed
5. assert that row preserved (managed_by='user' wins)
```

### S3 — Phase graph enforcement (F4)

```
1. new feature workflow
2. proposeTransition({to: 'verify'})  // illegal: intent → verify is not adjacent
3. assert throws IllegalPhaseTransitionError
4. proposeTransition({to: 'plan'})
5. assert succeeds, status flips to pending_approval
```

### S4 — Stop hook end-to-end (F6)

```
1. seed session + prompt + turn
2. write fake transcript JSONL with assistant block containing 3 markers
3. processStopHook(handle, {sessionId, transcriptPath})
4. assert 3 captures persisted
5. assert turn.agent_text + duration_ms set
6. assert sessions.total_capture_count = 3
7. processStopHook again with same input
8. assert 0 new captures (idempotent)
```

### S5 — Iron Law 7 git blocking (F7)

```
1. seed prompt with no commit/push token
2. processPostToolUse({toolName: 'Bash', toolInput: {command: 'git commit -m "x"'}})
3. invoke pre-tool-use orchestrator → assert exit code 2 + reason mentions Iron Law 7
4. seed new prompt containing 'commit'
5. invoke same → assert exit code 0
```

### S6 — Real gate check evidence (F8)

```
no_unresolved_scope_proposals:
  1. propose 2 scope expansions
  2. approve 1, reject 0
  3. run check → fail listing the unresolved file
  4. reject the second
  5. run check → pass

validation_passes:
  1. no validation_run events → fail
  2. append validation_run with exit_code=1 → fail
  3. append validation_run with exit_code=0 → pass

all_planned_files_modified:
  1. propose+approve scope file 'src/x.ts' (uncommitted)
  2. run check (in non-git dir) → fail with "git status failed"
  3. git init + commit baseline + modify → run check → pass
```

### S7 — `codi workflow` CLI surface (F9)

For each command, in an isolated tmp project with brain DB env set:

```
- codi workflow run feature "task" → exit 0, stdout JSON.success=true
- codi workflow status → JSON shows phase=intent
- codi workflow scope propose --file ... --reason "..." → success
- codi workflow scope approve → success
- codi workflow transition --to plan → success, status=pending_approval
- codi workflow transition --approve → success, status=active, phase=plan
- codi workflow transition --to verify → fails with "unknown phase"... wait, --to expects valid phase
- codi workflow elevate refactor --trigger ... --reason ... → success
- codi workflow handover --to alice@codi.local --reason "vacation" → success
- codi workflow stats → JSON shows workflowCount ≥ 1
- codi workflow abandon --reason "test" → success, then status returns active=false
- codi workflow recover (after manual pointer clear) → recovers
```

Negative cases:

```
- codi workflow run UNKNOWN "task" → exit 1, message mentions valid types
- codi workflow transition (no flags) → exit 1, message says supply one
- codi workflow scope propose without --file → commander error
```

### S8 — P9 detector end-to-end (F10)

```
1. seed 3 OBSERVATION captures naming codi-commit (skill)
2. seed 1 OBSERVATION naming codi-testing (rule)
3. runConsolidation with installedSkills=[codi-commit], installedRules=[codi-testing]
4. assert 1 proposal for codi-commit (P9, OPTIMIZE_EXISTING_ARTIFACT, 3 evidence)
5. assert 0 proposals for codi-testing (below minEvidence default 3)
```

### S9 — Brain-backed compactor (F11)

```
1. run feature → abandon
2. compactWorkflows({thresholdDays: 0, now: future})
3. assert summarized=true, preservedCount > 0
4. assert events table empty for that workflow_id
5. readCompactedSummary → returns blob
6. compact again → "Already compacted." skip path
```

### S10 — Hook script entrypoints under tsx

For each `scripts/runtime/hook-*.ts`:

```
1. compose realistic Claude Code stdin payload
2. spawn `tsx scripts/runtime/hook-X.ts < payload`
3. assert exit code, stderr/stdout shape, brain side-effects
```

### S11 — Cross-feature full user flow

```
1. fresh tmp dir + isolated brain
2. node dist/cli.js workflow run feature "Build dark mode toggle"
3. node dist/cli.js workflow scope propose --file src/theme.ts --reason "main switch"
4. node dist/cli.js workflow scope approve
5. node dist/cli.js workflow transition --to plan
6. node dist/cli.js workflow transition --approve
7. simulate prompt+stop+capture cycle directly
8. node dist/cli.js workflow stats → expect counts
9. node dist/cli.js workflow status → expect phase=plan
```

### S12 — Dist asset packaging

```
1. fresh build
2. assert dist/schemas/runtime/manifest-event.schema.json exists
3. assert dist/templates/workflows/feature.yaml exists
4. assert dist/templates/consolidation/p9-artifact-observation.md.tmpl exists
5. assert dist/templates/skills/<sample>/SKILL.md exists
```

## Acceptance criteria

- All S1–S12 scenarios pass autonomously.
- Defects discovered get a documented repro + fix or a recorded waiver with rationale.
- Final report lists: `<scenario, status, evidence_pointer, defects_found>` for each.
- Test runtime under 60s aggregate (excluding the one-time `pnpm build`).

## Execution

Two new test files:

- `tests/e2e/v3-zero-runtime.test.ts` — S1–S6, S8, S9, S10 (in-process, fast)
- `tests/e2e/v3-zero-cli.test.ts` — S7, S11, S12 (spawn `node dist/cli.js`, slower)

Both use `CODI_BRAIN_DB` env-var isolation per scenario.
