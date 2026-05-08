# Changelog — worktrees skill

## [0.1.0] — 2026-05-02

### Added

- Initial skill, adapted to devloop conventions.
- 5-step process — directory selection (existing > CLAUDE.md > ask) → safety verification (ignore-status check + auto-fix gitignore) → branch creation with workflow-typed naming → auto-detected project setup → baseline test pass.
- Anti-patterns catalog — never create project-local worktree without `git check-ignore`, never proceed past failing baseline silently, never assume `.worktrees/` when project uses `worktrees/`, never hardcode `npm install`, never mix JS package managers.
- `references/cleanup.md` — post-workflow teardown flow (`git worktree remove`, `git branch -d/-D`, `git worktree prune`) with safety rails on `--force` and `-D`.

### Devloop conventions

- Global directory: `~/.config/devloop/worktrees/`.
- Branch naming follows devloop workflow conventions: `feature/`, `bugfix/`, `refactor/`, `migration/` prefixes plus workflow-id and slug.
- JS package-manager detection prefers `pnpm-lock.yaml` first (per global agent instructions), then `package-lock.json`, then `yarn.lock`. Warns when multiple lock files coexist.
- Python detection uses `uv sync` / `uv pip install` (per global agent instructions to never use `pip install` directly).
- Tool allowlist constrained to git, ls, basename, and the supported package managers — no shell escapes.

### Integration

- `feature-workflow` phase execute → invoke `worktrees` before slicing tasks when work is ≥1 hour
- `bug-fix-workflow` phase execute → optional, recommended when fix touches ≥3 files
- `refactor-workflow` phase baseline → strongly recommended (clean baseline does not affect main)
- `migration-workflow` phase execute → required for migrations with staging side-effects
- `subagent-orchestration` mode `sequential` → recommended caller (each task's commits land on the worktree branch)

### Boundaries

- Creates worktrees and verifies clean baseline. Does NOT execute the implementation work that follows.
- Does NOT manage long-term stale-worktree state (cleanup is in the `references/cleanup.md` companion).
- Does NOT handle merge conflicts on the parent branch (workflow's job at PR time).
