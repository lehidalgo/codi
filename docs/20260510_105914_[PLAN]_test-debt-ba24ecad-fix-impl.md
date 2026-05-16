# Test Debt ba24ecad Fix — Implementation Plan

> **For agentic workers:** Use `codi-plan-execution` to implement this plan task-by-task. That skill asks the user to pick INLINE (sequential) or SUBAGENT (fresh subagent per task with two-stage review) mode. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** align 13 obsolete test fixtures with the behavior shipped by commit `ba24ecad` — no production code changes, no revert.

**Architecture:** read-only test rewrites across 6 files in 3 categories (A: Iron Law 7 token unification → "ok"; B: codex Stop schema → matcher-pattern; C: evaluateToolCall workflow blocks → advisories). Single atomic commit at the end.

**Tech Stack:** TypeScript strict, Vitest, Node, codi runtime modules.

---

## Spec Reference

Source spec: `docs/20260510_105152_[PLAN]_test-debt-ba24ecad-fix.md`. Tasks below match spec §10 one-to-one.

## Constraints (recap)

- NO touching production code under `src/`.
- NO revert of any part of `ba24ecad`.
- Strict TypeScript — no `any`.
- Pre-commit hook MUST pass — no `--no-verify`.
- Single atomic commit at the end (Task F).
- Per-test escalation: if a failing test asserts behavior that was REMOVED (not CHANGED), pause and report — do NOT delete a test unless user directs.

---

### Task 0: Pre-flight — verify failing files

**Files**: none (read-only).
**Est**: 2 min

**Steps**:

1. Run targeted suites and confirm 13 failures across the 6 files:
   ```bash
   pnpm vitest run \
     tests/runtime/iron-laws-enforcer.test.ts \
     tests/e2e/v3-zero-runtime.test.ts \
     tests/e2e/v3-zero-hooks.test.ts \
     tests/adapters/hooks-selection-emission.test.ts \
     tests/unit/adapters/codex.test.ts \
     tests/runtime/hook-logic.test.ts
   ```
2. Confirm exactly the 13 failures from the spec are present. If any other file fails, STOP and report back.
3. Read each test file once to lock current shape:
   ```bash
   wc -l tests/runtime/iron-laws-enforcer.test.ts \
         tests/e2e/v3-zero-runtime.test.ts \
         tests/e2e/v3-zero-hooks.test.ts \
         tests/adapters/hooks-selection-emission.test.ts \
         tests/unit/adapters/codex.test.ts \
         tests/runtime/hook-logic.test.ts
   ```

**Verification**: 13 failures observed, no new ones; per-file LoC recorded for the 800-line guardrail.

---

### Task A1: Rewrite Iron Law 7 unit tests for "ok" token

**Files**: `tests/runtime/iron-laws-enforcer.test.ts`
**Est**: 3 min

**Steps**:

1. Replace the existing test at line 110-116 with the new fixture. Old block:
   ```typescript
   it("allows `git commit` when 'commit' appears in a recent prompt", () => {
     const d = decideGitCommand({
       bashCommand: "git commit -m 'feat: x'",
       recentPrompts: ["please commit the changes"],
     });
     expect(d.allowed).toBe(true);
   });
   ```
   New block (rename + retoken):
   ```typescript
   it("allows `git commit` when 'ok' appears in a recent prompt", () => {
     const d = decideGitCommand({
       bashCommand: "git commit -m 'feat: x'",
       recentPrompts: ["ok"],
     });
     expect(d.allowed).toBe(true);
   });
   ```
2. Replace the existing test at line 134-140 with the case-insensitive variant. Old block:
   ```typescript
   it("matches approval tokens case-insensitively", () => {
     const d = decideGitCommand({
       bashCommand: "git commit -m 'x'",
       recentPrompts: ["Commit, please"],
     });
     expect(d.allowed).toBe(true);
   });
   ```
   New block:
   ```typescript
   it("matches the 'ok' approval token case-insensitively", () => {
     for (const token of ["ok", "OK", "Ok"]) {
       const d = decideGitCommand({
         bashCommand: "git commit -m 'x'",
         recentPrompts: [token],
       });
       expect(d.allowed).toBe(true);
     }
   });
   ```

**Verification**:

```bash
pnpm vitest run tests/runtime/iron-laws-enforcer.test.ts
```

Expected: file passes — both rewritten tests green, no regression on the other 5 IL7/IL5/IL8 tests in the suite.

---

### Task A2: Rewrite v3-zero-runtime L7 e2e

**Files**: `tests/e2e/v3-zero-runtime.test.ts`
**Est**: 2 min

**Steps**:

1. Replace the test at line 304-318. Old block:
   ```typescript
   it("L7: git mutation allowed when 'commit' / 'push' in recent prompts", () => {
     withHandle((h) => {
       ensureSession(h.raw, {
         sessionId: "s",
         projectId: "p",
         agentType: "claude-code",
         workingDir: dir,
       });
       recordPrompt(h.raw, { sessionId: "s", text: "ya, please commit and push" });
       const recent = readRecentPrompts(h.raw, { sessionId: "s", limit: 5 });
       expect(
         decideGitCommand({ bashCommand: "git commit -m 'x'", recentPrompts: recent }).allowed,
       ).toBe(true);
     });
   });
   ```
   New block:
   ```typescript
   it("L7: git mutation allowed when 'ok' is in recent prompts", () => {
     withHandle((h) => {
       ensureSession(h.raw, {
         sessionId: "s",
         projectId: "p",
         agentType: "claude-code",
         workingDir: dir,
       });
       recordPrompt(h.raw, { sessionId: "s", text: "ok" });
       const recent = readRecentPrompts(h.raw, { sessionId: "s", limit: 5 });
       expect(
         decideGitCommand({ bashCommand: "git commit -m 'x'", recentPrompts: recent }).allowed,
       ).toBe(true);
     });
   });
   ```

**Verification**:

```bash
pnpm vitest run tests/e2e/v3-zero-runtime.test.ts
```

Expected: file passes — rewritten test green, "L7: git mutation blocked" sibling at line 284 stays green (its prompt list "fix this bug"/"rerun the tests" already lacks "ok").

---

### Task A3: Rewrite v3-zero-hooks DEFECT-002 + approval e2e

**Files**: `tests/e2e/v3-zero-hooks.test.ts`
**Est**: 3 min

**Steps**:

1. Replace the test at line 215-228. Old block:
   ```typescript
   it("DEFECT-002 (FIXED) — clause split keeps 'fix bug, then commit' approved", () => {
     runHook("hook-user-prompt-submit.ts", {
       session_id: "sess-clause",
       prompt: "fix the auth bug, then commit",
       cwd: dir,
     });
     const result = runHook("hook-pre-tool-use.ts", {
       session_id: "sess-clause",
       cwd: dir,
       tool_name: "Bash",
       tool_input: { command: "git commit -m 'fix auth'" },
     });
     expect(result.code).toBe(0);
   });
   ```
   New block (rename + retoken — keeps the multi-clause regression intent, switches to "ok"):
   ```typescript
   it("DEFECT-002 (FIXED) — clause split keeps 'fix bug, then ok' approved", () => {
     runHook("hook-user-prompt-submit.ts", {
       session_id: "sess-clause",
       prompt: "fix the auth bug, then ok",
       cwd: dir,
     });
     const result = runHook("hook-pre-tool-use.ts", {
       session_id: "sess-clause",
       cwd: dir,
       tool_name: "Bash",
       tool_input: { command: "git commit -m 'fix auth'" },
     });
     expect(result.code).toBe(0);
   });
   ```
2. Replace the test at line 245-258. Old block:
   ```typescript
   it("hook-pre-tool-use allows git when an approval token is in recent prompts", () => {
     runHook("hook-user-prompt-submit.ts", {
       session_id: "sess-allow",
       prompt: "please commit and push the fix",
       cwd: dir,
     });
     const result = runHook("hook-pre-tool-use.ts", {
       session_id: "sess-allow",
       cwd: dir,
       tool_name: "Bash",
       tool_input: { command: "git commit -m 'x'" },
     });
     expect(result.code).toBe(0);
   });
   ```
   New block:
   ```typescript
   it("hook-pre-tool-use allows git when 'ok' is in recent prompts", () => {
     runHook("hook-user-prompt-submit.ts", {
       session_id: "sess-allow",
       prompt: "ok",
       cwd: dir,
     });
     const result = runHook("hook-pre-tool-use.ts", {
       session_id: "sess-allow",
       cwd: dir,
       tool_name: "Bash",
       tool_input: { command: "git commit -m 'x'" },
     });
     expect(result.code).toBe(0);
   });
   ```
3. Leave the "word boundary rejects 'commitment'" test (line 230-243) untouched — its expectation `code === 2` already aligns with the new "ok"-only world (the prompt has no "ok" token, so the hook still blocks).

**Verification**:

```bash
pnpm vitest run tests/e2e/v3-zero-hooks.test.ts
```

Expected: file passes — both rewritten tests green, sibling negatives stay red-on-deny / green-on-pass.

---

### Task B1: Add `stopCommands` helper + rewrite codex hooks-selection-emission

**Files**: `tests/adapters/hooks-selection-emission.test.ts`
**Est**: 4 min

**Steps**:

1. Add a typed helper just below the existing `findFile` helper (after line 45). Insert (note: production wraps Stop under root `hooks` key):
   ```typescript
   function stopCommands(hooksJson: {
     hooks?: { Stop?: Array<{ hooks?: Array<{ command?: string }> }> };
   }): string[] {
     const out: string[] = [];
     for (const entry of hooksJson.hooks?.Stop ?? []) {
       for (const h of entry.hooks ?? []) {
         if (typeof h.command === "string") out.push(h.command);
       }
     }
     return out;
   }
   ```
2. Replace the test at line 83-96. Old block:
   ```typescript
   it("emits observer + Stop launcher entry when enabled", async () => {
     writeState(projectRoot, ["skill-observer", "security-reminder"]);
     const opts: GenerateOptions = { projectRoot } as unknown as GenerateOptions;
     const files = await codexAdapter.generate(fakeConfig(), opts);
     const observer = findFile(files, "codi-skill-observer.cjs");
     const hooks = findFile(files, ".codex/hooks.json");
     expect(observer).toBeDefined();
     expect(hooks).toBeDefined();
     const hooksJson = JSON.parse(hooks!.content) as {
       Stop?: Array<{ command: string }>;
     };
     const stopCmds = (hooksJson.Stop ?? []).map((h) => h.command);
     expect(stopCmds.some((c) => c.includes("codi-skill-observer.cjs"))).toBe(true);
   });
   ```
   New block:
   ```typescript
   it("emits observer + Stop launcher entry when enabled", async () => {
     writeState(projectRoot, ["skill-observer", "security-reminder"]);
     const opts: GenerateOptions = { projectRoot } as unknown as GenerateOptions;
     const files = await codexAdapter.generate(fakeConfig(), opts);
     const observer = findFile(files, "codi-skill-observer.cjs");
     const hooks = findFile(files, ".codex/hooks.json");
     expect(observer).toBeDefined();
     expect(hooks).toBeDefined();
     const hooksJson = JSON.parse(hooks!.content) as {
       hooks?: { Stop?: Array<{ hooks?: Array<{ command?: string }> }> };
     };
     const stopCmds = stopCommands(hooksJson);
     expect(stopCmds.some((c) => c.includes("codi-skill-observer.cjs"))).toBe(true);
   });
   ```
3. Replace the test at line 98-112. Old block:
   ```typescript
   it("skips observer + Stop launcher entry when not selected", async () => {
     writeState(projectRoot, ["security-reminder"]);
     const opts: GenerateOptions = { projectRoot } as unknown as GenerateOptions;
     const files = await codexAdapter.generate(fakeConfig(), opts);
     const observer = findFile(files, "codi-skill-observer.cjs");
     const hooks = findFile(files, ".codex/hooks.json");
     expect(observer).toBeUndefined();
     expect(hooks).toBeDefined();
     const hooksJson = JSON.parse(hooks!.content) as {
       Stop?: Array<{ command: string }>;
     };
     const stopCmds = (hooksJson.Stop ?? []).map((h) => h.command);
     expect(stopCmds.some((c) => c.includes("codi-skill-observer.cjs"))).toBe(false);
     expect(stopCmds.some((c) => c.includes("codi hook stop"))).toBe(true);
   });
   ```
   New block:
   ```typescript
   it("skips observer + Stop launcher entry when not selected", async () => {
     writeState(projectRoot, ["security-reminder"]);
     const opts: GenerateOptions = { projectRoot } as unknown as GenerateOptions;
     const files = await codexAdapter.generate(fakeConfig(), opts);
     const observer = findFile(files, "codi-skill-observer.cjs");
     const hooks = findFile(files, ".codex/hooks.json");
     expect(observer).toBeUndefined();
     expect(hooks).toBeDefined();
     const hooksJson = JSON.parse(hooks!.content) as {
       hooks?: { Stop?: Array<{ hooks?: Array<{ command?: string }> }> };
     };
     const stopCmds = stopCommands(hooksJson);
     expect(stopCmds.some((c) => c.includes("codi-skill-observer.cjs"))).toBe(false);
     expect(stopCmds.some((c) => c.includes("codi hook stop"))).toBe(true);
   });
   ```

**Verification**:

```bash
pnpm vitest run tests/adapters/hooks-selection-emission.test.ts
```

Expected: file passes — both codex tests green, claude-code sibling tests still green.

---

### Task B2: Rewrite codex.test.ts Stop assertion

**Files**: `tests/unit/adapters/codex.test.ts`
**Est**: 2 min

**Steps**:

1. Replace the test body at line 447-460. Old block:

   ```typescript
   it("generates .codex/hooks.json with the Stop hook pointing to skill-observer", async () => {
     const config = createMockConfig({});
     const files = await codexAdapter.generate(config, {});

     const hooksFile = files.find((f) => f.path === ".codex/hooks.json");
     expect(hooksFile).toBeDefined();
     const parsed = JSON.parse(hooksFile!.content);
     expect(parsed.Stop).toBeDefined();
     expect(Array.isArray(parsed.Stop)).toBe(true);
     const hook = parsed.Stop[0];
     expect(hook.type).toBe("command");
     expect(hook.command).toContain("codi-skill-observer.cjs");
     expect(hook.timeout).toBeGreaterThan(0);
   });
   ```

   New block (assert matcher-pattern shape with one observer entry; production wraps under root `hooks` key):

   ```typescript
   it("generates .codex/hooks.json with the Stop hook pointing to skill-observer", async () => {
     const config = createMockConfig({});
     const files = await codexAdapter.generate(config, {});

     const hooksFile = files.find((f) => f.path === ".codex/hooks.json");
     expect(hooksFile).toBeDefined();
     const parsed = JSON.parse(hooksFile!.content) as {
       hooks?: {
         Stop?: Array<{ hooks?: Array<{ type?: string; command?: string; timeout?: number }> }>;
       };
     };
     expect(parsed.hooks?.Stop).toBeDefined();
     expect(Array.isArray(parsed.hooks?.Stop)).toBe(true);
     const stopGroup = parsed.hooks?.Stop?.[0];
     expect(stopGroup).toBeDefined();
     expect(Array.isArray(stopGroup?.hooks)).toBe(true);
     const observerHook = stopGroup!.hooks!.find((h) =>
       (h.command ?? "").includes("codi-skill-observer.cjs"),
     );
     expect(observerHook).toBeDefined();
     expect(observerHook!.type).toBe("command");
     expect(observerHook!.timeout ?? 0).toBeGreaterThan(0);
   });
   ```

**Verification**:

```bash
pnpm vitest run tests/unit/adapters/codex.test.ts
```

Expected: file passes — rewritten Stop test green, surrounding adapter assertions stay green.

---

### Task C1a: Classify hook-logic 5 failing tests

**Files**: none (read-only triage).
**Est**: 5 min

**Steps**:

1. Read the current `evaluateToolCall` source:
   ```bash
   sed -n '1,260p' src/runtime/hook-logic.ts
   ```
2. For each of the 5 failing tests at `tests/runtime/hook-logic.test.ts`, classify the new production behavior as ADVISORY (`decision.allow=true; decision.advisories=[...]`) or HARD (`decision.allow=false`):
   - "blocks gh pr create before phase done" (line 343)
   - "blocks git push in execute phase" (line 331)
   - "blocks edits in pre-execute phases (intent, plan, decompose)" (line 171)
   - "blocks edits to test files (always scope-expansion)" (line 136)
   - "suggests elevation for migration files" (line 152)
3. Cross-check with the production patterns from spec §5 (and the live source, which is the source of truth):
   - Bash classifier: gh pr create + git push + git push --force + git reset --hard + rm -rf → still HARD.
   - Workflow scope/file checks (pre-execute edits, test-file edits, migration edits) → ADVISORY.
4. Produce a tiny inline classification table at the top of Task C1b before rewriting. Per-test ESCALATION rule: if a test references a check that production has REMOVED entirely, pause and report — do NOT rewrite.

**Verification**: classification table written to scratchpad below; ready for Task C1b.

**Classification (verified against `src/runtime/hook-logic.ts:45-86, 270-295`):**

Production drift discovered — `git push` (no --force) and `gh pr create` were re-classified to `enforcement: "advisory"` in ba24ecad. Only `rm -rf /`, `git reset --hard`, `git push --force` remain hard-block (`enforcement: "block"`). All 5 failing tests now need advisory rewrites.

| Test (line)                     | Pattern                         | Production rule | New shape                            |
| ------------------------------- | ------------------------------- | --------------- | ------------------------------------ |
| line 331 — git push in execute  | `^git push\b(?!--force)`        | advisory        | ADVISORY `allow=true + advisories[]` |
| line 343 — gh pr create         | `^gh pr create\b`               | advisory        | ADVISORY `allow=true + advisories[]` |
| line 171 — edits in pre-execute | workflow file/scope             | advisory        | ADVISORY `allow=true + advisories[]` |
| line 136 — edits to test files  | workflow scope                  | advisory        | ADVISORY `allow=true + advisories[]` |
| line 152 — migration files      | workflow scope (elevation hint) | advisory        | ADVISORY `allow=true + advisories[]` |

---

### Task C1b: Rewrite advisory subset of hook-logic tests

**Files**: `tests/runtime/hook-logic.test.ts`
**Est**: 6 min

**Steps**: 0. Per C1a, ALL 5 failing tests are advisory under the new production rules. Rewrite all 5. The 2 bash tests get advisory shape; the bash classifier still hard-blocks `rm -rf /`, `git reset --hard`, `git push --force` (those tests at lines 352/361/370 remain green).

1. Replace the test at line 331-341 (git push). Old block:
   ```typescript
   it("blocks git push in execute phase", () => {
     const ctx = buildContext(tmpDir);
     const decision = evaluateToolCall(
       { tool_name: "Bash", tool_input: { command: "git push origin main" } },
       ctx,
     );
     expect(decision.allow).toBe(false);
     if (!decision.allow) {
       expect(decision.reason).toContain("git push");
     }
   });
   ```
   New block:
   ```typescript
   it("advises on git push in execute phase", () => {
     const ctx = buildContext(tmpDir);
     const decision = evaluateToolCall(
       { tool_name: "Bash", tool_input: { command: "git push origin main" } },
       ctx,
     );
     expect(decision.allow).toBe(true);
     if (decision.allow) {
       expect(decision.advisories).toBeDefined();
       const joined = (decision.advisories ?? []).join(" | ");
       expect(joined).toContain("git push");
     }
   });
   ```
   1b. Replace the test at line 343-350 (gh pr create). Old block:
   ```typescript
   it("blocks gh pr create before phase done", () => {
     const ctx = buildContext(tmpDir);
     const decision = evaluateToolCall(
       { tool_name: "Bash", tool_input: { command: "gh pr create --title x" } },
       ctx,
     );
     expect(decision.allow).toBe(false);
   });
   ```
   New block:
   ```typescript
   it("advises on gh pr create before phase done", () => {
     const ctx = buildContext(tmpDir);
     const decision = evaluateToolCall(
       { tool_name: "Bash", tool_input: { command: "gh pr create --title x" } },
       ctx,
     );
     expect(decision.allow).toBe(true);
     if (decision.allow) {
       expect(decision.advisories).toBeDefined();
       const joined = (decision.advisories ?? []).join(" | ");
       expect(joined).toContain("PR creation");
     }
   });
   ```
2. Replace the test at line 136-150 (test files). Old block:
   ```typescript
   it("blocks edits to test files (always scope-expansion)", () => {
     const ctx = buildContext(tmpDir);
     const decision = evaluateToolCall(
       {
         tool_name: "Edit",
         tool_input: { file_path: "src/foo.test.ts" },
       },
       ctx,
     );
     expect(decision.allow).toBe(false);
     if (!decision.allow) {
       expect(decision.reason).toContain("not in the plan");
       expect(decision.suggested_action).toContain("propose-expansion");
     }
   });
   ```
   New block (advisory shape):
   ```typescript
   it("advises on edits to test files (always scope-expansion)", () => {
     const ctx = buildContext(tmpDir);
     const decision = evaluateToolCall(
       {
         tool_name: "Edit",
         tool_input: { file_path: "src/foo.test.ts" },
       },
       ctx,
     );
     expect(decision.allow).toBe(true);
     if (decision.allow) {
       expect(decision.advisories).toBeDefined();
       const joined = (decision.advisories ?? []).join(" | ");
       expect(joined).toContain("not in the plan");
       expect(joined).toContain("propose-expansion");
     }
   });
   ```
3. Replace the test at line 152-169 (migration). Old block:
   ```typescript
   it("suggests elevation for migration files", () => {
     const ctx = buildContext(tmpDir);
     const decision = evaluateToolCall(
       {
         tool_name: "Write",
         tool_input: {
           file_path: "migrations/001_init.sql",
           content: "CREATE TABLE x();",
         },
       },
       ctx,
     );
     expect(decision.allow).toBe(false);
     if (!decision.allow) {
       expect(decision.suggested_action).toContain("elevation");
       expect(decision.suggested_action).toContain("migration");
     }
   });
   ```
   New block:
   ```typescript
   it("advises elevation for migration files", () => {
     const ctx = buildContext(tmpDir);
     const decision = evaluateToolCall(
       {
         tool_name: "Write",
         tool_input: {
           file_path: "migrations/001_init.sql",
           content: "CREATE TABLE x();",
         },
       },
       ctx,
     );
     expect(decision.allow).toBe(true);
     if (decision.allow) {
       expect(decision.advisories).toBeDefined();
       const joined = (decision.advisories ?? []).join(" | ");
       expect(joined).toContain("elevation");
       expect(joined).toContain("migration");
     }
   });
   ```
4. Replace the test at line 171-195 (pre-execute edits). Old block:
   ```typescript
   it("blocks edits in pre-execute phases (intent, plan, decompose)", () => {
     // Fresh workflow stays in intent
     const fresh = mkdtempSync(join(tmpdir(), "codi-fresh-"));
     try {
       withFreshBrain(fresh, () => {
         bootstrapKb(fresh);
         runWorkflow({ workflowType: "feature", task: "x", author: human, cwd: fresh });
         const ctx = buildContext(fresh);
         const decision = evaluateToolCall(
           {
             tool_name: "Edit",
             tool_input: { file_path: "src/anything.ts" },
           },
           ctx,
         );
         expect(decision.allow).toBe(false);
         if (!decision.allow) {
           expect(decision.reason).toContain("phase intent");
           expect(decision.suggested_action).toContain("transition --to execute");
         }
       });
     } finally {
       rmSync(fresh, { recursive: true, force: true });
     }
   });
   ```
   New block:
   ```typescript
   it("advises on edits in pre-execute phases (intent, plan, decompose)", () => {
     // Fresh workflow stays in intent
     const fresh = mkdtempSync(join(tmpdir(), "codi-fresh-"));
     try {
       withFreshBrain(fresh, () => {
         bootstrapKb(fresh);
         runWorkflow({ workflowType: "feature", task: "x", author: human, cwd: fresh });
         const ctx = buildContext(fresh);
         const decision = evaluateToolCall(
           {
             tool_name: "Edit",
             tool_input: { file_path: "src/anything.ts" },
           },
           ctx,
         );
         expect(decision.allow).toBe(true);
         if (decision.allow) {
           expect(decision.advisories).toBeDefined();
           const joined = (decision.advisories ?? []).join(" | ");
           expect(joined).toContain("phase intent");
           expect(joined).toContain("transition --to execute");
         }
       });
     } finally {
       rmSync(fresh, { recursive: true, force: true });
     }
   });
   ```
5. Re-confirm the bash hard-block siblings at lines 352 (`rm -rf /`), 361 (`git reset --hard`), 370 (`git push --force`) still pass — they remain `allow: false`.

**Verification**:

```bash
pnpm vitest run tests/runtime/hook-logic.test.ts
```

Expected: file passes — 3 advisory tests green, 2 bash-classifier tests stay green, no other regressions.

---

### Task F: Full suite green + single atomic commit

**Files**: all modified test files from A1 / A2 / A3 / B1 / B2 / C1b.
**Est**: 5 min

**Steps**:

1. Run the full vitest suite:
   ```bash
   pnpm vitest run
   ```
   Expected: every previously failing test now passes. No new failures.
2. Run typecheck and lint to satisfy pre-commit:
   ```bash
   pnpm typecheck
   pnpm lint
   ```
3. Stage exactly the 6 modified test files:
   ```bash
   git add \
     tests/runtime/iron-laws-enforcer.test.ts \
     tests/e2e/v3-zero-runtime.test.ts \
     tests/e2e/v3-zero-hooks.test.ts \
     tests/adapters/hooks-selection-emission.test.ts \
     tests/unit/adapters/codex.test.ts \
     tests/runtime/hook-logic.test.ts
   ```
4. Commit (single atomic commit, no AI attribution per project rules):

   ```bash
   git commit -m "test: align fixtures with ba24ecad (token / Stop schema / advisories)

   - iron-laws-enforcer: Iron Law 7 approval token reduced to literal 'ok'
   - v3-zero-runtime / v3-zero-hooks: rewrite L7 e2e fixtures around 'ok'
   - hooks-selection-emission / codex.test.ts: read Stop[*].hooks[*].command
   - hook-logic: workflow file/scope checks now assert advisory shape

   No production changes — pure test-debt cleanup."
   ```

5. Confirm clean tree:
   ```bash
   git status
   ```

**Verification**:

- `pnpm vitest run` exits 0.
- `git log -1 --pretty=%B` shows the commit message above.
- `git status` reports nothing to commit, working tree clean (apart from any pre-existing unstaged work that was already untouched).

---

## Pre-Write Self-Review

**1. Spec coverage:**

| Spec category                       | Tests covered                                              | Tasks      |
| ----------------------------------- | ---------------------------------------------------------- | ---------- |
| Cat A — IL7 token "ok"              | 5 tests across 3 files                                     | A1, A2, A3 |
| Cat B — codex Stop schema           | 3 tests across 2 files                                     | B1, B2     |
| Cat C — evaluateToolCall advisories | 5 tests in 1 file (3 ADVISORY rewrites + 2 HARD untouched) | C1a, C1b   |

13 / 13 failing tests addressed. ✓

**2. Placeholder scan:** none. Every step has runnable code or shell command. ✓

**3. Type consistency:**

- `stopCommands` helper signature `{ Stop?: Array<{ hooks?: Array<{ command?: string }> }> }` is reused identically in B1 and B2 (same nullability, same key ordering). ✓
- Decision shape `{ allow: true; advisories?: string[] }` is reused identically across all C1b rewrites. ✓
- Approval token literal `"ok"` is the only fixture across A1/A2/A3 (no leftover `commit/push/merge/tag/release`). ✓

**4. Task quality:**

- All tasks have real assertions, exact files, runnable verification commands. ✓
- No commit step inside individual tasks per spec — Task F is the only commit. ✓
- TDD ordering does not strictly apply (test-debt is rewrite, not new behavior); each task is still verify-fail → rewrite → verify-pass. ✓
- Conventional commit message in Task F: `test:` prefix. ✓

Self-review passes. Ready for reviewer subagent.
