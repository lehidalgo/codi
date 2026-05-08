---
name: quality-gates
description: Use when a repository needs git-lifecycle quality gates (pre-commit, commit-msg, pre-push), when CI integration must be audited, when branch naming convention is missing, or when the user asks for industry-grade hook setup. Triggers on "set up pre-commit", "configure git hooks", "audit the quality gates", "add commit-msg validator", "enforce branch naming", "install gitleaks", "pre-push checks needed". Body documents the three modes and the 5-category Hook Contract. First-run repository setup (chained from `init-knowledge-base`). Periodic audit via `/devloop:quality-gates`. After-the-fact when a CI failure surfaces a gap that should have been caught locally.
---

# quality-gates

Audit, configure, and verify git-lifecycle quality gates. Adapts to the host stack. Composes with devloop's agent-runtime hooks (separate layer).

## Pick a mode

| Mode     | Purpose                                                | Output                                       |
| -------- | ------------------------------------------------------ | -------------------------------------------- |
| `audit`  | Detect stack and report missing/weak hooks. Read-only. | Punch list by severity                       |
| `setup`  | Install missing hooks adaptively. Idempotent.          | `.husky/*` + commit-msg + pre-push extension |
| `verify` | Run all configured hooks against HEAD                  | Pass/fail per gate                           |

## Process

`audit` first → review punch list → `setup` if user approves the contract → `verify` runs as a smoke test. Full per-mode flows in `references/mode-{audit,setup,verify}.md`.

## The 5-category Hook Contract

| Category     | Pre-commit (≤5s)     | Pre-push (≤30s)      | CI (authoritative)   |
| ------------ | -------------------- | -------------------- | -------------------- |
| `format`     | auto-fix + re-stage  | —                    | block PR if drift    |
| `lint`       | block on error       | full lint            | full lint            |
| `type-check` | (skip — too slow)    | tsc / pyright / mypy | tsc / pyright / mypy |
| `security`   | gitleaks + per-stack | full security scan   | full security scan   |
| `test`       | (skip — too slow)    | full test suite      | full test suite      |

Per-language commands in `references/language-hook-table.md`.

## Universal rules

1. HARD GATE on CI workflow edits — show diff, require explicit approval before writing `.github/workflows/*.yml`.
2. No `--no-verify` bypass — policy forbids it.
3. Idempotent setup — read existing hooks first; merge via managed-block markers; surface conflicts.
4. Universal hooks always run — gitleaks, file-size, conflict-markers, branch-name validator.
5. Branch naming enforced — `<github-user>/<type>/<slug>` (types: feature/bugfix/refactor/migration/chore/hotfix). Missing prefix → block (post-convention) or warn (grandfathered). GH user detection: `gh api user` → saved git config → parsed email → ask once. Full flow in `references/branch-naming.md`.

## Anti-patterns

- `--no-verify` bypass.
- Auto-modifying `.github/workflows/` without approval.
- Overwriting existing custom hooks.
- Hardcoding a single stack.
- Type-check or tests at pre-commit (too slow).
- Skipping gitleaks.

## References

- `references/runner-detection.md` — husky / pre-commit / lefthook decision tree.
- `references/language-hook-table.md` — per-language commands.
- `references/branch-naming.md` — convention + GH user detection.
- `references/commit-msg-validator.md` — conventional commit + 72-char validator template.
- `references/ci-extension.md` — CI workflow extension (HARD GATE).
- `references/mode-{audit,setup,verify}.md` — per-mode flows.

## Scripts

- `scripts/audit.sh`, `scripts/setup.sh`, `scripts/verify.sh`, `scripts/github-user.sh`, `scripts/verify-branch-name.sh`.

## Termination

- `audit` → punch list → user decides whether to invoke `setup`.
- `setup` → hooks installed → `verify` runs automatically.
- `verify` → pass/fail report → user decides whether to fix or accept.
- No manifest events emitted directly.

## Boundaries

- Manages git-lifecycle hooks. Does NOT manage agent-runtime hooks (those live in `hooks/`).
- CI workflow edits HARD-GATED. Local hooks always; CI changes require explicit approval.
- Does NOT replace `verify-evidence` (workflow correctness vs repo hygiene).
- Does NOT auto-install missing tools — prints install hints.
