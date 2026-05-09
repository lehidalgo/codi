# Worktree cleanup

After the workflow that owns the worktree ships (PR merged, branch deleted, or workflow abandoned), clean up the worktree to avoid stale state.

## When to clean up

- Workflow reached `done` and the branch was merged
- Workflow was abandoned with `codi abandon --reason "<text>"`
- The branch was force-pushed and the local one is now divergent (rare)

## Process

### 1. Confirm the worktree's commits are safe

If the workflow shipped via PR, confirm the PR was merged. If abandoned, confirm the user does not want the work salvaged.

```bash
# From the main working tree (NOT inside the worktree itself)
git log <branch-name> --oneline
gh pr view <branch-name> 2>/dev/null
```

Only proceed when commits are merged or the user confirms abandonment.

### 2. Remove the worktree

```bash
# From the main working tree
git worktree remove <path-to-worktree>
```

If the worktree has uncommitted changes and you are sure they should go: `--force`. Default to NOT using force; ask the user first.

### 3. Delete the branch (if no longer needed)

```bash
git branch -d <branch-name>     # safe — fails if not merged
git branch -D <branch-name>     # force — only when the user confirms abandonment
```

Use `-d` by default. Reach for `-D` only after explicit user confirmation that the work is being thrown away.

### 4. Prune stale worktree metadata

Worktree directories sometimes leak metadata in `.git/worktrees/`. Clean it up:

```bash
git worktree prune
```

### 5. Report

```
Worktree removed: <path>
Branch deleted: <name> (merged) | (abandoned, force-deleted)
Pruned stale metadata
```

## Anti-patterns

- Removing a worktree with uncommitted changes via `--force` without asking — silent data loss.
- Force-deleting a branch (`-D`) before confirming the work was either merged or explicitly abandoned.
- Cleaning up worktrees from inside the worktree itself — git refuses, but the error message can confuse. Always run from the main working tree.
- Forgetting `git worktree prune` after manually deleting the worktree directory — stale metadata persists.
