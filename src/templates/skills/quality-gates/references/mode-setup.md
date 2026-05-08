# Mode: setup

Install missing hooks adaptively. Idempotent — re-runnable without overwriting existing rules.

## Preconditions

- `audit` should run first to surface gaps. `setup` works without `audit` but is most useful after.
- User should be on a non-protected branch (not main/master).
- User has approved the standard's contract (the skill explains what it will install).

## Process

1. **Detect runner** per `runner-detection.md`.
2. **Detect GitHub user** via `scripts/github-user.sh`. Save to `git config devloop.githubUser` if not already set.
3. **Record adoption timestamp** — `git config devloop.branchConvention.adoptedAt $(date +%s)`. Branches predating this are grandfathered.
4. **Pre-commit hook**:
   - If existing `.husky/pre-commit` (or `.pre-commit-config.yaml`): READ it, MERGE the standard checks, surface the diff.
   - If absent: write the runner-appropriate config covering the 5-category contract for the detected stack(s).
   - Always include universal hooks: gitleaks, file-size, conflict-marker, branch-name validator.
5. **Commit-msg hook**:
   - Write `.husky/commit-msg` per `commit-msg-validator.md`.
6. **Pre-push hook**:
   - Preserve existing devloop pre-push (archive-protection).
   - Append: full lint + type-check + tests (per detected stack).
7. **CI workflow extension**:
   - If `.github/workflows/*.yml` exists, compute proposed diff per `ci-extension.md`.
   - Display the diff. Ask for explicit user approval (HARD GATE).
   - Only on approval, write the changes.
8. **Smoke test**:
   - Run mode `verify` automatically as the final step.
   - Report any gates that fail at install time.

## Idempotency

Running `setup` twice produces the same files. Mechanism:

- Each generated section has a `# devloop:quality-gates managed` marker.
- On re-run, the skill replaces ONLY the marked section, leaving custom rules outside the marker untouched.
- Markers look like:
  ```sh
  # >>> devloop:quality-gates managed (do not edit between markers)
  ...managed content...
  # <<< devloop:quality-gates managed
  ```

## Tools the user must have installed

The skill detects each tool's presence and prints install hints when missing:

| Tool              | Install                                    |
| ----------------- | ------------------------------------------ |
| gitleaks          | `brew install gitleaks`                    |
| husky             | `pnpm add -D husky lint-staged` (or `npm`) |
| pre-commit        | `pip install pre-commit`                   |
| eslint, prettier  | `pnpm add -D eslint prettier`              |
| ruff, bandit      | `uv add --dev ruff bandit`                 |
| shellcheck, shfmt | `brew install shellcheck shfmt`            |

The skill does NOT install tools automatically — it prints the command and asks the user to run it. Auto-install changes the host's global state, which is out of scope.

## Conflict resolution

If a custom rule conflicts with the standard contract:

- Ask the user which to keep.
- If the user keeps the custom rule, mark it `# devloop:quality-gates user-override` so future audits know it is intentional.
- Never silently overwrite a user-flagged override.

## Anti-patterns

- Auto-installing tools (changes host state).
- Overwriting existing hooks without merging.
- Skipping the HARD GATE on CI workflow edits.
- Setting `devloop.githubUser` from email without confirming with the user.
- Forgetting to preserve the existing `pre-push.sh` archive-protection logic.
