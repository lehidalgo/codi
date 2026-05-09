# Phase: baseline

The safety net. Skip ONLY when comprehensive existing tests already exercise the area being refactored.

## Story handling at workflow entry (before baseline runs)

- **`--from-story US-NNN`** — read the parent Story; spawn a child Story with `parent_story=US-NNN`, `workflow_type=refactor`, `as_a="developer"`, `i_want=<refactor goal>`, `so_that=<motivation>`, `acceptance_criteria="behavior unchanged; <specific structural goal>"`, `status=in-progress`.
- **No `--from-story`** — standalone Story with `as_a="developer"`, `workflow_type=refactor`, similar shape. Surfaced under "Untraced work" on the Dashboard until linked to a Goal/Requirement post-hoc.

## Setup

Strongly recommended: invoke `codi:worktrees` at the start of this phase. The worktree captures the unrefactored baseline tests on a clean isolated branch and gives `subagent-orchestration` mode `sequential` (used at phase execute) a stable place to land per-step commits.

## Capture current behavior

For the modules being touched:

1. **Inventory existing tests.** Read each. Confirm they assert behavior (not implementation).
2. **Run them.** Confirm they pass against the current code.
3. **Identify gaps.** Where are observable behaviors not covered by tests?
4. **Add characterization tests.** For each uncovered behavior, write a test that asserts what the code currently does (whether or not that is "correct"). The point is to lock in current behavior so the refactor cannot silently change it.

## Exit criterion

- [ ] Every public interface in the refactor scope has at least one test that asserts its observable behavior.
- [ ] All baseline tests pass against the unrefactored code.
- [ ] Tests are committed before phase plan begins.

## When you cannot capture a baseline test

That itself is a finding — the architecture is preventing the test. Decide:

- **Abandon the refactor** if the area is too dangerous to change without behavior locks.
- **Do a smaller refactor that surfaces a seam first**, so the larger refactor becomes safe in a follow-up.

Do NOT proceed to phase plan with uncovered behaviors.
