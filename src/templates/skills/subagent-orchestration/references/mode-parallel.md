# Mode: parallel

Fan out N subagents on N independent problems.

## When parallelism is safe

All four must be true:

1. **Independent root causes.** Fixing problem A does not affect problem B's signal.
2. **No shared state.** Agents do not edit the same files, run on the same DB, or compete for the same resources.
3. **No sequential dependency.** Problem B does not need problem A's result.
4. **Parallelism saves time.** If each subagent finishes in 30 seconds, the orchestration overhead is not worth it. Dispatch parallel when each subagent is non-trivial work.

If any one is false, fall through to mode `sequential` or to direct Task usage.

## Process

### 1. Partition the work

Group failures by domain:

- File A tests: tool approval flow
- File B tests: batch completion
- File C tests: abort functionality

Each domain is an independent agent task. Cross-cutting concerns (e.g., a bug in a shared util) collapse into one agent.

### 2. Construct each prompt

Each agent gets:

```
SCOPE: <specific file or subsystem>
GOAL: <what success looks like, e.g., "make these 3 tests pass">
CONSTRAINTS: <"do not change production code", "do not edit files outside src/X", etc.>
CONTEXT: <error messages, test names, repro steps — no session history>
EXPECTED_OUTPUT: <"summary of root cause and changes, list of files modified">
```

### 3. Dispatch in parallel

Use the Task tool with N concurrent invocations. Same message, multiple tool calls.

```typescript
// Pseudo-code — actual is N Task tool calls in one message
Task("Fix agent-tool-abort.test.ts", { prompt, scope, ... })
Task("Fix batch-completion.test.ts", { prompt, scope, ... })
Task("Fix tool-approval-race.test.ts", { prompt, scope, ... })
```

### 4. Tally results

When all return:

- Read each summary
- Note files modified by each agent
- Check for cross-agent conflicts (same file edited by two agents = stop and reconcile)
- Run the full test suite (not just the targeted tests) — local fixes can break global behavior

### 5. Reconcile conflicts

If two agents touched the same file:

1. Read the diff each made
2. Decide which agent's change is correct, OR
3. Merge manually by re-reading the file with both diffs in mind
4. Re-run all targeted tests after reconciliation

### 6. Final verification

Even if no conflicts, run `pnpm run validate` (or equivalent). Subagents can each be locally correct yet collectively introduce a regression elsewhere.

## When NOT to use mode `parallel`

- Failures are related — fix one might fix others. Investigate together first.
- Need full system context to understand. Dispatching agents with partial context wastes their work.
- Exploratory debugging — you do not yet know what is broken.
- Shared state — agents would interfere (same files, same DB, same fixtures).

## Example partition

**Scenario:** 6 test failures across 3 files after a refactor.

| Agent | Scope                                                       | Constraint                    |
| ----- | ----------------------------------------------------------- | ----------------------------- |
| 1     | `agent-tool-abort.test.ts` (3 failures, timing)             | Do not change production code |
| 2     | `batch-completion.test.ts` (2 failures, missing executions) | Investigate event structure   |
| 3     | `tool-approval-race.test.ts` (1 failure, count=0)           | Async timing issue            |

All three dispatched concurrently. All three return. No file overlap. Full suite green after fan-in.

## Manifest events

- `subagent_dispatched` — one event per agent, payload includes agent index and scope
- `subagent_completed` — one per return, payload includes status and tokens
- `subagent_failed` — if any return BLOCKED
- `validation_run` — after fan-in integration check

## Red flags

- Three agents, three different agents edited `src/shared/util.ts` — the work was not actually independent. Stop, partition differently.
- Agent returned DONE but tests still fail — agent's fix targeted the wrong thing. Re-dispatch with the failing assertion as context.
- More than 5 agents in parallel for one problem — partition is too fine, overhead exceeds benefit. Group into 2-3 agents.
