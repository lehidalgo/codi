# Changelog — subagent-orchestration skill

## [0.1.0] — 2026-05-02

### Added

- Initial consolidated skill replacing the standalone `dispatch-parallel`. Two modes cover two complementary patterns:
  - `parallel` — fan out N subagents on N independent problems (different bugs, different test files, different subsystems). Hard rules: no shared state, no sequential dependency, no overlapping file edits.
  - `sequential` — execute a plan task-by-task. Per task: fresh implementer subagent → spec-compliance review → code-quality review → mark complete → next. Never parallel implementers on related code.
- Universal rules unified across both modes: subagents NEVER inherit session history, specific scope per dispatch, structured expected-output schema, status handling discipline (DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED), integrated verification after fan-in or final task.
- Model selection guidance — least powerful model that can handle the role, with cost ladder (mechanical → cheap; integration → standard; review/architecture → most capable).
- Prompt templates as references:
  - `implementer-prompt.md` — TDD discipline, self-review, escalation paths, 700-line file limit
  - `spec-reviewer-prompt.md` — strict JSON output, focus on missing/extra/wrong vs spec only
  - `code-quality-reviewer-prompt.md` — strict JSON, focus on naming/modules/tests/patterns
- Integration with `devloop:code-review` (mode `request`): stage-2 quality review in mode `sequential` may chain to code-review for consistency with phase verify reviews. Same JSON verdict schema.

### Replaces

- `skills/dispatch-parallel/` (removed) — single-mode skill covering only the fan-out case. The consolidated skill covers both fan-out and sequential plan execution.

### Integration

- feature-workflow phase execute → `subagent-orchestration` mode `sequential` when plan has ≥3 discrete tasks
- bug-fix-workflow phase reproduce → `subagent-orchestration` mode `parallel` when there are ≥2 unrelated failures to investigate
- refactor-workflow phase execute → `subagent-orchestration` mode `sequential` when refactor steps are well-defined and discrete
- migration-workflow phase execute → `subagent-orchestration` mode `sequential` for multi-step migration scripts
- Standalone via `/devloop:subagent-orchestration` for ad-hoc fan-out or plan execution outside the workflow phases

### Boundaries

- Does NOT replace `verify-evidence` — verify-evidence is phase-verify; this skill is phase-execute.
- Stage-2 review in mode `sequential` is mutually exclusive with `code-review` mode `request` for the same task — pick one path or the other.
- For solo investigations (no parallelism, no plan), use the Task tool directly without this skill.
