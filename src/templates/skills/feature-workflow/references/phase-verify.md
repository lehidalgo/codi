# Phase: verify

Goal: confirm the feature does what the plan said it would, with green validation and tests covering the new behavior.

## How to run this phase (chained skills)

You **MUST** invoke `devloop:verify-evidence` before proposing transition to `done`. It enforces a 5-step gate:

1. **Identify** — list what specifically must be verified (success criteria from the plan).
2. **Run** — execute the verification command(s) against real code, not against mocks or imagination.
3. **Read** — read the actual output of the commands; do not assume.
4. **Verify** — confirm output matches the success criterion.
5. **Claim** — only now you may say "verify phase complete".

Evidence before assertions. Without verify-evidence, claiming `done` is just optimism.

### Optional: code review on the diff

When `.devloop/config.yaml` has `auto_review: true`, **invoke `devloop:code-review` mode `request`** after verify-evidence and before proposing `done`. It dispatches a forked reviewer subagent on `git diff base..HEAD`, returns a structured verdict, and blocks the transition to `done` if Critical or Important issues are found. This is opt-in — verify-evidence is mandatory; code-review request is recommended for major features and required before merge to main.

`code-review` complements verify-evidence — verify-evidence checks the work against the plan; code-review checks the work against another reviewer's eyes. Run both for high-stakes features.

## What you produce

- A passing `pnpm run validate` (latest `validation_run` event has `exit_code: 0`)
- Tests added for new behavior covered by the change set
- Final summary in the manifest as a `decision_recorded` event
- Optional addressing of any deep-module recommendations from `gate-deep-modules`

## How to verify

1. Run the full validation pipeline:
   ```bash
   pnpm run validate
   ```
2. Append a `validation_run` event with the result.
3. If anything is red, return to `execute` (propose transition back) and fix.
4. Review the diff against the plan. For each item in the plan's "Files to be modified", confirm it changed as planned.
5. For each success criterion in the plan, confirm the corresponding test asserts the criterion.
6. If the agent gate `gate-test-coverage` (M4) reports missing coverage, address it.

## When to transition to done

You are ready when:

- [ ] Latest `validation_run` exit code is 0
- [ ] Every success criterion has a test that asserts it
- [ ] Every file in `scope.files_in_plan` has been touched
- [ ] No outstanding gate failures from M3 LLM gates
- [ ] PR description bloque "Workflow Summary" generated (M5)

Then propose:

```bash
devloop transition --to done
```

On approve, the system writes `workflow_completed`. The branch is ready for PR.

## Common mistakes

- Stopping at "tests pass" without checking coverage of new behavior. Existing tests passing tells you nothing about your new code.
- Re-running validation many times to fish for a green result. If it is flaky, fix the flakiness or document it.
- Skipping the diff review against the plan. A diff that does not match the plan is either a planning error or scope creep that was missed.
- Writing the PR description before transitioning to `done`. The PR description references `done` events in M5; do them in order.
