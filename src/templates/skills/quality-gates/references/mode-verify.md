# Mode: verify

Run all configured hooks end-to-end against current HEAD. Produces a pass/fail report per gate. Does NOT push or commit.

## Process

1. **Pre-commit run** — execute the configured pre-commit hook against the staged-equivalent file set:
   ```bash
   if [ -f .pre-commit-config.yaml ]; then
     pre-commit run --all-files
   elif [ -f .husky/pre-commit ]; then
     STAGED=$(git diff --name-only HEAD~1..HEAD) bash .husky/pre-commit
   fi
   ```
2. **Commit-msg validator** — run against the latest commit message:
   ```bash
   git log -1 --format=%B > /tmp/last-commit-msg
   bash .husky/commit-msg /tmp/last-commit-msg
   ```
3. **Pre-push hook** — execute against current branch and main:
   ```bash
   echo "$(git rev-parse HEAD) $(git rev-parse HEAD) refs/heads/$(git rev-parse --abbrev-ref HEAD) $(git rev-parse origin/main)" \
     | bash .husky/pre-push
   ```
4. **Branch-name validator** — confirm the current branch matches `<github-user>/<type>/<slug>` (or is grandfathered).
5. **CI emulation (optional)** — if `--ci-emulate` is passed, run the equivalent CI commands locally to catch CI-only failures.

## Output format

```
quality-gates verify — <timestamp>
Branch: <current-branch>
Last commit: <sha> <message>

✓ pre-commit       — 12 hooks ran, 0 failures
✓ commit-msg       — passes conventional-commit + 72-char
✓ pre-push         — lint + type-check + tests pass (28s)
✓ branch-naming    — laht/feature/wf-042-export-to-csv valid
- ci-emulate       — skipped (use --ci-emulate to run)

All gates pass.
```

If any gate fails:

```
quality-gates verify — <timestamp>

✗ pre-commit       — gitleaks found 1 secret in src/config.ts:42
✓ commit-msg       — passes
✓ pre-push         — lint + type-check + tests pass
✓ branch-naming    — laht/feature/wf-042-export-to-csv valid

1 gate failed. Fix and re-run.
```

## When `verify` is used

- After `setup` as a smoke test.
- On demand when a gate fails in CI and the user wants to reproduce locally.
- In CI pipelines as the authoritative gate (host repo's `.github/workflows/ci.yml` invokes `verify --ci-mode`).
- Before opening a PR.

## Read-only contract

Mode `verify` MUST NOT:

- Push or commit.
- Modify hook configurations.
- Install missing tools (it reports them as failures with install hints).

## Anti-patterns

- Modifying state in verify mode.
- Skipping a gate because "it's slow". The whole point is end-to-end coverage.
- Treating a gate failure as advisory. A failure means the gate would block in real use.
