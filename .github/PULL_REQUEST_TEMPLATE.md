<!--
Pull request template for codi-cli.

Replace each `<…>` placeholder. Delete sections that don't apply (be honest:
"None" is a valid answer; deleting is fine; lying is not).

The CI `test` job blocks merge until coverage thresholds pass — the bar is
defined in vitest.config.ts and enforced at pre-push and in CI. Codecov
will post a separate comment with file-level coverage breakdown.
-->

## Summary

<!-- 1-3 sentences. What does this PR do, in plain language? -->

## Why

<!--
What problem does this solve? Link to the issue, incident, user complaint, or
audit finding that motivated it. If this is a chore/cleanup with no external
trigger, say "tech debt" and explain the cost of leaving it untouched.
-->

## Approach

<!--
How does the change work? Mention the architectural decisions, not just the
mechanics. Why this design over the alternatives? What was deliberately NOT
changed?
-->

## Test plan

<!--
What did you run to convince yourself this works? Include the actual commands
you ran. Examples:

- [ ] pnpm lint && pnpm test:coverage — all pass locally on Node 20.19.5
- [ ] codi init / generate / status / verify smoke against tmp project
- [ ] Manual reproduction: <how to reproduce the original bug>
- [ ] Edge cases tested: <list>
-->

## Risk

<!--
What could break? Who would notice first? How would we know? Pick one:

- [ ] **Low** — pure addition, isolated module, no behavior change for existing flows
- [ ] **Medium** — touches a code path multiple users hit; clear rollback exists
- [ ] **High** — touches release, install, or generate flows; rollback would require a follow-up
-->

## Verification before merge

<!-- Anything reviewers must check or run before approving. Examples: -->

- [ ] CI green (test, secrets-scan, shellcheck, version-check)
- [ ] Codecov delta is acceptable (no large unexplained coverage drops)
- [ ] CHANGELOG entry under `[Unreleased]` (or `[VERSION]` if this is a release PR)
- [ ] Version bumped in `package.json` (release PRs only)

## Notes for the next session

<!--
Optional: things future-you (or future-someone-else) needs to know that don't
fit anywhere else. Followup work, deferred decisions, weird interactions.
-->
