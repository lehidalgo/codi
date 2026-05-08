# Phase: execute

Apply the refactor in small commits.

## Discipline

1. Each commit leaves the codebase compiling and all baseline tests passing.
2. Move code in stages: first add the new shape (without removing the old), then update callers, then remove the old shape.
3. Never change behavior in this phase. If a baseline test fails, **stop and investigate** — either you accidentally changed behavior (revert), or the test was implementation-coupled (document; fix separately).

## Multi-step refactors

If the refactor plan has ≥3 discrete steps (e.g., extract module A, update callers, deprecate old shape), invoke `devloop:subagent-orchestration` mode `sequential`:

- Each step gets a fresh implementer with the deepening rationale as context.
- Two-stage review loop (spec compliance → code quality) catches accidental behavior changes.
- Commits land on the worktree branch (per phase baseline).

Refactors are an excellent fit for sequential subagents because the steps are usually well-bounded and the review loop catches drift.

## Stages within each step

| Stage   | Action                                                   |
| ------- | -------------------------------------------------------- |
| Add     | New module / interface exists alongside the old          |
| Migrate | Callers updated to use the new shape                     |
| Remove  | Old shape deleted; tests confirm no remaining references |

Each stage is its own commit. Tests pass at every commit.
