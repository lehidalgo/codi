# Test Debt Fix — ba24ecad Aftermath

- **Date**: 2026-05-10 10:51
- **Document**: 20260510*105152*[PLAN]\_test-debt-ba24ecad-fix.md
- **Category**: PLAN
- **Status**: draft — pending user approval
- **Source commit (cause)**: `ba24ecad feat(codex): tokens + hooks + agent_text capture parity`
- **Goal**: align 13 obsolete test fixtures with the new behaviour shipped by ba24ecad — no production rollback

## 1. Summary

Commit `ba24ecad` intentionally changed three subsystems. The production code is correct and shipped. 13 tests still assert the old shapes. This plan rewrites the 13 tests to match the new shipped behaviour, preserving the original test intent (Iron Law 7 still works, codex Stop is still emitted, evaluateToolCall still gates phase edits) while updating the assertions to the new shapes.

## 2. Goals

- Update 13 failing tests to assert ba24ecad's new behaviour.
- Preserve original test intent + edge cases (clause-split, retry timing, integration via tsx, multi-tool dispatch).
- Bring the suite back to **3598 pass / 0 fail / 2 skip**.

## 3. Non-goals

- Touching production code in `src/`. The behaviour is intended.
- Reverting any part of `ba24ecad`.
- Adding new tests beyond aligning existing ones.
- Splitting the suite or changing the test runner.

## 4. The three categories

### 4.1 Category A — Iron Law 7 token unification

**What changed**: Iron Law 7 now accepts only the literal token `ok` (case-insensitive, exactly 2 chars). The previous list `[commit, push, merge, tag, release]` is retired. Iron Law 4 was unified to use the same token. The `GIT_MUTATING_RE` patterns Iron Law 7 applies to are still: `commit`, `push`, `tag`, `merge`, `reset --hard`, `branch -D`, `push --force` (7 patterns).

**Test rewrite rule**: replace prompt fixtures `please commit ...` / `fix bug, then commit` with `ok` (one of `ok`, `OK`, `Ok`). Add positive cases for the 3 casings. Add negative cases for `okay`, `oK` (lowercase-K), `okayyyy` to confirm only the literal 2-char form passes.

### 4.2 Category B — codex adapter Stop schema rewrite

**What changed**: `.codex/hooks.json` Stop entry was flat `[{ command, timeout, type }, ...]`. Now it follows the matcher pattern (same as Claude Code): `[{ matcher: "...", hooks: [{ type, command, timeout }, ...] }]`.

**Test rewrite rule**: extract Stop commands via `Stop[*].hooks[*].command` instead of `Stop[*].command`. Add a small helper `stopCommands(hooksJson)` that flattens, used by all three tests.

### 4.3 Category C — evaluateToolCall blocks → advisories

**What changed**: workflow scope/file edits in pre-execute phases used to return `decision.allow=false, decision.suggested_action=...`. Now they return `decision.allow=true, decision.advisories=[ ...strings... ]`. Hard-block remains for: dangerous-bash classifier (e.g. `rm -rf /`), Iron Law 7 git mutations.

**Test rewrite rule**: change assertions from `expect(d.allow).toBe(false)` to `expect(d.allow).toBe(true); expect(d.advisories).toBeDefined(); expect(d.advisories!.some(s => s.includes("phase plan"))).toBe(true)` (or the appropriate keyword). Rename `it("blocks ...")` to `it("emits advisory for ...")` for naming clarity.

## 5. File-by-file plan

| #   | File                                              | Cat | Tests | LoC est. |
| --- | ------------------------------------------------- | --- | ----- | -------- |
| 1   | `tests/runtime/iron-laws-enforcer.test.ts`        | A   | 2     | 30       |
| 2   | `tests/e2e/v3-zero-runtime.test.ts`               | A   | 1     | 8        |
| 3   | `tests/e2e/v3-zero-hooks.test.ts`                 | A   | 2     | 12       |
| 4   | `tests/adapters/hooks-selection-emission.test.ts` | B   | 2     | 10       |
| 5   | `tests/unit/adapters/codex.test.ts`               | B   | 1     | 8        |
| 6   | `tests/runtime/hook-logic.test.ts`                | C   | 5     | 50       |

Total: 6 files, 13 tests, ~120 LoC of test changes. Single commit.

## 6. Concrete rewrites — per category

### 6.1 Cat A patterns (token unification)

For each test currently asserting `['commit', ...]` approval:

```ts
// BEFORE
recentPrompts: ["please commit the changes"];
// AFTER
recentPrompts: ["ok"];
```

For each test asserting case-insensitivity:

```ts
// BEFORE
recentPrompts: ["COMMIT"]; // matched in old set
// AFTER
recentPrompts: ["OK"]; // 1 of 3 valid casings
```

For each negative test asserting non-approval (no token in prompt):

```ts
// BEFORE
recentPrompts: ["fix the bug"]; // no commit verb → blocked
// AFTER
recentPrompts: ["fix the bug"]; // still blocked, semantics identical
```

Negation tests (`don't commit yet`) are still relevant because the negation logic still applies — but the token to negate is now `ok` not `commit`. Update fixtures: `"don't commit yet"` → `"don't ok this yet"` (artificial but tests the negation path).

DEFECT-002 clause-split test (`"fix bug, then commit"`): rewrite to `"fix bug, then ok"` and assert allowed. Keeps the clause-split coverage since the splitter is what's being tested.

### 6.2 Cat B helper

Add this helper at the top of each codex test file (or in a shared fixture):

```ts
function stopCommands(hooksJson: {
  Stop?: Array<{ matcher?: string; hooks?: Array<{ command?: string }> }>;
}): string[] {
  const out: string[] = [];
  for (const entry of hooksJson.Stop ?? []) {
    for (const h of entry.hooks ?? []) {
      if (typeof h.command === "string") out.push(h.command);
    }
  }
  return out;
}
```

Replace existing `(hooksJson.Stop ?? []).map((h) => h.command)` with `stopCommands(hooksJson)`. No assertion logic changes.

### 6.3 Cat C decision shape

Rename `it("blocks ...")` → `it("emits advisory for ...")` for the 5 hook-logic tests. Replace assertion patterns:

```ts
// BEFORE
expect(decision.allow).toBe(false);
expect(decision.reason).toContain("phase plan");
expect(decision.suggested_action).toContain("transition --to execute");

// AFTER
expect(decision.allow).toBe(true);
expect(decision.advisories).toBeDefined();
const adv = decision.advisories!;
expect(adv.some((s) => s.includes("phase plan"))).toBe(true);
expect(adv.some((s) => s.includes("transition --to execute"))).toBe(true);
```

Iron Law 7 hard-block tests inside `hook-logic.test.ts` (if any) keep `expect(allow).toBe(false)` since the bash + git classifier still hard-blocks. Read each test individually to determine which strand applies.

## 7. Risk register

| #   | Risk                                                                                               | Mitigation                                                                                                                           |
| --- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Some test asserts behaviour that was REMOVED, not changed                                          | Read each test once before rewriting; flag any whose intent no longer applies — delete those instead of rewriting (escalate to user) |
| 2   | DEFECT-002 clause-split test specifically about the 2021 bug — losing it loses regression coverage | Keep the test; just swap the verb. The clause splitter logic is the same                                                             |
| 3   | The 3-casings literal `ok / OK / Ok` matters — `oK` / `OkAY` should NOT pass                       | Add explicit negative tests in `iron-laws-enforcer.test.ts` for the rejected casings                                                 |
| 4   | hook-logic.test.ts has 5 tests; some may already be advisory-aware after ba24ecad                  | Re-read each; only rewrite the failing ones, do not touch already-passing ones                                                       |
| 5   | Pre-commit hook may fail on commit again                                                           | Run `pnpm test` before commit to catch regressions; tests should be the only diff in this PR                                         |
| 6   | Iron Law 7 commit token is also a SESSION token                                                    | Setting `recentPrompts: ["ok"]` in tests is fine — it's a string fixture, not a real workflow event                                  |

## 8. Test plan

| Layer        | Approach                                                                                                                                                                                                                                                 |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Per-file run | After each file rewrite: `pnpm test <file>` should be green                                                                                                                                                                                              |
| Targeted run | After all 6 files: `pnpm test tests/runtime/iron-laws-enforcer.test.ts tests/e2e/v3-zero-{runtime,hooks}.test.ts tests/runtime/hook-logic.test.ts tests/adapters/hooks-selection-emission.test.ts tests/unit/adapters/codex.test.ts` should be all green |
| Full suite   | `pnpm test` — 3598 pass / 0 fail / 2 skip target                                                                                                                                                                                                         |
| Build        | `pnpm build` clean                                                                                                                                                                                                                                       |
| TS strict    | `npx tsc --noEmit` — no new errors (pre-existing ones in routes-api.ts unrelated)                                                                                                                                                                        |

## 9. Rollout

| #   | Step                                                          |
| --- | ------------------------------------------------------------- |
| 1   | Read each failing test once to confirm rewrite vs delete      |
| 2   | Cat A — rewrite 5 tests (3 files)                             |
| 3   | Cat B — rewrite 3 tests (2 files) + add `stopCommands` helper |
| 4   | Cat C — rewrite 5 tests (1 file)                              |
| 5   | Run full suite green                                          |
| 6   | Single atomic commit at end                                   |

Total est. ~1.5 hours.

## 10. Atomic tasks (input for codi-plan-writer)

| #   | Task                                                                                                                                                                                               | File                                              | Tests touched |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------- |
| 0   | **Pre-flight**: re-run `pnpm test` to confirm exact failing files; verify each test in §5 belongs to the file listed; if any fails to find, escalate before edits                                  | repo                                              | —             |
| A1  | Rewrite Iron Law 7 unit tests for "ok" token. Per-test escalation if intent no longer applies                                                                                                      | `tests/runtime/iron-laws-enforcer.test.ts`        | 2             |
| A2  | Rewrite v3-zero-runtime L7 e2e. Per-test escalation if intent dead                                                                                                                                 | `tests/e2e/v3-zero-runtime.test.ts`               | 1             |
| A3  | Rewrite v3-zero-hooks DEFECT-002 + approval e2e. Per-test escalation                                                                                                                               | `tests/e2e/v3-zero-hooks.test.ts`                 | 2             |
| B1  | Add `stopCommands` helper + rewrite codex hooks-selection-emission                                                                                                                                 | `tests/adapters/hooks-selection-emission.test.ts` | 2             |
| B2  | Rewrite codex.test.ts Stop assertion                                                                                                                                                               | `tests/unit/adapters/codex.test.ts`               | 1             |
| C1a | **Read** the 5 failing hook-logic tests; classify each as `advisory-rewrite` (decision.allow=true + advisories) or `hard-block-keep` (Iron Law 7 / dangerous bash). Print the classification table | `tests/runtime/hook-logic.test.ts`                | 0             |
| C1b | Rewrite the `advisory-rewrite` subset; leave `hard-block-keep` untouched                                                                                                                           | `tests/runtime/hook-logic.test.ts`                | 5 (or fewer)  |
| F   | Full suite green + single atomic commit                                                                                                                                                            | repo                                              | —             |

8 atomic tasks (was 7 — split C1 per reviewer recommendation), single commit at end (per user preference).

**Escalation checkpoint (Risk #1)**: in tasks A1/A2/A3/C1a, if a failing test asserts behaviour that was REMOVED rather than CHANGED (i.e., the original intent no longer maps to anything in the new system), the implementer pauses, reports the test, and waits for user direction before delete-vs-rewrite.

## 11. Open questions

None at present. Both design decisions confirmed in brainstorm:

- Q1: Approach A — rewrite all 13 to match new shape.
- Q2: Strategy 1 — assert allow:true + advisories non-empty + keyword match for Cat C.

## 12. Approval gate

This spec must be reviewed and explicitly approved before any task begins. Once approved, the next step is to invoke `codi-plan-writer` with this document as input.
