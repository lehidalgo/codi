# Phase: verify

Invoke `devloop:verify-evidence` (5-step gate). Refactor success criterion is "no behavior change", which only evidence (running the baseline tests) can prove.

## Exit criteria

- [ ] All baseline tests still pass (RUN them; do not assume).
- [ ] All previously-existing tests still pass.
- [ ] No new test failures.
- [ ] The new module structure matches the plan.
- [ ] Implementation file count is reasonable (refactors that explode files are suspect).

## Optional: code review on the refactor diff

When `.devloop/config.yaml` declares `auto_review: true`, invoke `devloop:code-review` mode `request` after verify-evidence. Refactors are high-leverage candidates for review — the reviewer subagent gets the diff plus the "Module depth analysis" and "Seams" sections from the plan, and checks whether the new shape matches the deepening rationale. Critical or Important issues block the transition to `done`.

## Phase done

- Commit message declares "Refactor: no behavior change".
- Reviewer should confirm by reading the test diff: zero or near-zero changes to test assertions, only changes to test imports as files move.
