# Changelog — quality-gates skill

## [0.1.0] — 2026-05-02

### Added

- Initial skill — git-lifecycle quality gates (pre-commit, commit-msg, pre-push) with adaptive runner detection (husky / pre-commit framework / lefthook) and per-language hook table covering TS, Python, Go, Rust, Shell.
- Three modes:
  - `audit` — read-only scan; punch list grouped by HIGH / MEDIUM / LOW severity.
  - `setup` — install missing hooks adaptively. Idempotent via managed-block markers. CI workflow edits HARD-GATED.
  - `verify` — run all configured hooks end-to-end against HEAD. Pass/fail per gate.
- 5-category Hook Contract: `format / lint / type-check / security / test`. Pre-commit budget ≤5s; pre-push budget ≤30s; CI authoritative.
- Universal hooks: gitleaks (secret scan), file-size check, conflict-marker check, branch-name validator, no-commit-to-branch.
- Conventional commit + 72-char enforcement at commit-msg.
- Branch naming convention: `<github-user>/<type>/<slug>` with types `feature | bugfix | refactor | migration | chore | hotfix`.
- GitHub user detection priority: `gh api user --jq .login` → saved `git config devloop.githubUser` → parsed `user.email` → interactive prompt.
- Grandfathering: branches whose first commit predates `devloop.branchConvention.adoptedAt` are warned, not blocked.
- Scripts:
  - `audit.sh` — gap detection (read-only).
  - `setup.sh` — hook installation (husky path implemented; pre-commit/lefthook paths stubbed).
  - `verify.sh` — end-to-end smoke test.
  - `github-user.sh` — detection per priority order.
  - `verify-branch-name.sh` — pre-commit validator.
- 10 eval cases including pressure scenarios (refuse `--no-verify` bypass, refuse CI modification without approval, branch-name validator blocks bare `feature/` on a post-convention repo, grandfathered branches warn but don't block, GH user detection priority order).
- References: `runner-detection.md`, `language-hook-table.md`, `branch-naming.md`, `commit-msg-validator.md`, `ci-extension.md`, `mode-audit.md`, `mode-setup.md`, `mode-verify.md`.

### Composition

- `init-knowledge-base` → after CONTEXT.md is bootstrapped, propose `quality-gates audit` → `setup` for the host repo.
- `worktrees` → branch naming reads `<github-user>` per the convention. The worktrees skill's branch table now references `quality-gates references/branch-naming.md`.
- Standalone via `/devloop:quality-gates`.

### Boundaries

- Manages git-lifecycle hooks. Does NOT manage devloop's agent-runtime hooks (separate layer in `hooks/`).
- CI workflow edits gated behind explicit per-repo approval (HARD GATE pattern).
- Does NOT auto-install missing tools (gitleaks, eslint, etc.) — prints install hints and surfaces them at hook execution time.
