---
name: worktrees
description: Use when starting feature work that needs isolation from the current workspace, or before executing implementation plans. Triggers on "create worktree", "isolated workspace", "set up a new branch for this", "isolate this work". Also fires as a chained step before any long-running phase execute. Body documents directory selection, safety verification, and auto-detected project setup. Standalone via `/devloop:worktrees`.
---

# worktrees

Create isolated git worktrees so a workflow's branch does not contaminate the main working tree.

## When to use

- Workflow about to enter phase execute and the work spans ≥1 hour or ≥3 commits.
- About to invoke `subagent-orchestration` mode `sequential`.
- Migration with staging side-effects (clean rollback boundary).
- Long-running work that should not touch main.

## When to skip

- 1-commit fixes (overhead exceeds benefit).
- Workflows that explicitly require touching the main working tree.

## Process (5 steps)

1. **Directory selection** — `.worktrees/` (preferred, hidden) or `worktrees/`. Both exist → `.worktrees/` wins. Neither → check `CLAUDE.md` for a worktree directory preference. Otherwise ask the user once with `.worktrees/` recommended.
2. **Safety verification (project-local only)** — `git check-ignore` MUST pass. If not ignored, add to `.gitignore`, commit `chore: ignore worktrees directory`, then proceed.
3. **Branch naming + creation** — devloop convention `<github-user>/<workflow-type>/<workflow-id>-<slug>` where `<workflow-type>` is `feature`, `bugfix`, `refactor`, `migration`, `chore`, or `hotfix`. The `<github-user>` prefix is detected per `quality-gates references/branch-naming.md` (priority: `gh api user --jq .login` → saved `git config devloop.githubUser` → parsed from `git config user.email` → ask once and save). `git worktree add "$path" -b "$BRANCH_NAME"`.
4. **Project setup (auto-detect)** — see `references/setup-detection.md` for the detector table (pnpm > npm > yarn; uv > pip; cargo; go mod). Never mix JS package managers; warn on multiple lock files.
5. **Baseline test verification** — run the project's test suite. Pass → report ready. Fail → stop and ask. Do NOT proceed silently on a broken baseline.

## Report format

```
Worktree ready at <full-path>
Branch: <branch-name>
Setup command: <what was run>
Baseline tests: <N passed, M failed>
Ready to <next step>
```

## Composition with the rest of devloop

| Caller                                     | When                                        |
| ------------------------------------------ | ------------------------------------------- |
| `feature-workflow` phase execute           | Work ≥1 hour                                |
| `bug-fix-workflow` phase execute           | Optional; fixes touching ≥3 files           |
| `refactor-workflow` phase baseline         | Strongly recommended                        |
| `migration-workflow` phase execute         | Required for staging-side-effect migrations |
| `subagent-orchestration` mode `sequential` | Recommended caller                          |

## Anti-patterns

- Project-local worktree without `git check-ignore` verification — pollutes git status.
- Proceeding past failing baseline tests without asking.
- Hardcoding `npm install` — detect from lock files.
- Mixing JS package managers — never `npm install` in a `pnpm-lock.yaml` project.
- Skipping the CLAUDE.md preference check.

## References

- `references/setup-detection.md` — full detector table with commands and rationale.
- `references/cleanup.md` — post-workflow `git worktree remove` flow with safety rails on `--force` / `-D`.

## Termination

- Worktree created, baseline green → control returns to caller.
- Failure (couldn't verify ignore, baseline failed without approval) → report and abort.
- No manifest events emitted directly.

## Boundaries

- Creates worktrees and verifies clean baseline. Does NOT execute the implementation.
- Does NOT manage long-term stale-worktree state (see `cleanup.md`).
- Does NOT handle merge conflicts on the parent branch (workflow's job at PR time).
