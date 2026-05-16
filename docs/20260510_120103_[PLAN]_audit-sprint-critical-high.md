# Audit Sprint — CRITICAL + HIGH Findings

- **Date**: 2026-05-10 12:01
- **Document**: 20260510*120103*[PLAN]\_audit-sprint-critical-high.md
- **Category**: PLAN
- **Branch**: feature/codi-v3-harness (no worktree)
- **Source audit**: docs/20260509*232846*[AUDIT]\_codebase-extensive-audit.md
- **Scope**: 12 findings (§8.1 + §8.2 of source audit)
- **Commit strategy**: single commit at end of session, NOT per fix

---

## Iron rules for this sprint

1. **Verify before fix**: read the cited file at the cited line and confirm the symptom matches the audit description. Agent reports are not gospel — false positives must be invalidated and skipped.
2. **No batching**: process findings one at a time. Each fix gets its own evidence + proposal + approval cycle.
3. **Minimal patches**: change only what is necessary to close the finding. No speculative refactors, no surrounding cleanup.
4. **No tests per fix**: run `pnpm test` once at the end of the sprint. Per-fix testing for single-line changes is overhead without value.
5. **Industry-standard fixes**: robust + long-term, no workarounds, no `--no-verify`, no suppression flags.
6. **Single commit**: all 12 fixes accumulate in working tree; one conventional commit at end of sprint.

---

## Per-finding workflow

For each finding `Fn`:

1. **Evidence**: read the file(s) at the cited line range with `Read`. Confirm the audit's description is accurate.
2. **Decision branch**:
   - If symptom confirmed -> propose minimal fix as a diff sketch.
   - If symptom invalidated (false positive) -> report with quote of actual code; mark task as completed-skipped; move on.
3. **Approval**: wait for explicit user approval of the proposed fix.
4. **Apply**: use `Edit` (or `Write` for new files) to apply the fix exactly as proposed.
5. **TaskUpdate**: mark the task `completed`.
6. **Next**: load the next finding.

---

## Order (12 findings)

| #   | ID  | File                                                                       | Class         | Effort   |
| --- | --- | -------------------------------------------------------------------------- | ------------- | -------- |
| 1   | F1  | `package.json`                                                             | dep-CVE       | TRIVIAL  |
| 2   | F2  | `scripts/runtime/brain-ui-server.ts:54`                                    | sec-bind      | TRIVIAL  |
| 3   | F3  | `src/runtime/brain/migrate.ts` (BOOTSTRAP_STATEMENTS)                      | perf-index    | SMALL    |
| 4   | F4  | `src/templates/hooks/runtime/session-start.sh:50-90`                       | sec-shell     | SMALL    |
| 5   | F5  | `src/cli/preset-github.ts:96-99`                                           | sec-traversal | SMALL    |
| 6   | F6  | `src/runtime/brain/migrate.ts` (BOOTSTRAP_STATEMENTS)                      | perf-index    | SMALL    |
| 7   | F7  | new `src/core/artifact-layouts.ts` + 9 migrations                          | structure-SoT | MEDIUM   |
| 8   | F8  | `src/runtime/brain-ui/server.ts` + `routes-api.ts`                         | sec-csrf      | MEDIUM   |
| 9   | F9  | `scripts/runtime/hook-user-prompt-submit.ts` + `src/runtime/hook-logic.ts` | perf-handle   | MEDIUM   |
| 10  | F10 | `src/runtime/capture/stop-hook.ts:159-189`                                 | perf-stream   | MEDIUM   |
| 11  | F11 | `src/runtime/llm/registry.ts`                                              | perf-bundle   | SMALL    |
| 12  | F12 | SKIPPED — see "F12 deferral" below                                         | perf-build    | DEFERRED |

### F12 deferral

The audit's F-01 finding ("hooks shell out to tsx, ~2 s tax/turn") modelled
the production hot path as `tsx scripts/runtime/hook-X.ts`. Verification
showed that is the **legacy** plugin-mode path. The real hot path that fires
on every Claude turn is the compiled CLI subcommand:

```jsonc
// .claude/settings.json
{ "command": "cd \"${CLAUDE_PROJECT_DIR:-.}\" && codi hook user-prompt-submit --agent claude-code" }
```

`codi` resolves to `dist/cli.js` (already pre-compiled, no tsx). Measured
cold start of a real `codi hook user-prompt-submit` invocation: **710 ms**
on this machine — still significant (4 hooks/turn ≈ 2.8 s) but the cause
is **CLI bundle size eagerly loaded by Commander wiring**, not tsx startup.

The fix the audit recommended (pre-compile `scripts/runtime/hook-*.ts`)
would not change the production hot path because that path does not invoke
those scripts. The right fix is bundle splitting:

- New `src/hook-entry.ts` containing only `agent-hooks` subcommands.
- New tsup entry producing `dist/hook.js`.
- Update `.claude/settings.json` template to call `node dist/hook.js …`
  instead of `codi hook …`.

That refactor is bigger than the "minimal patch" budget for this sprint
and crosses into the per-agent settings template surface (Claude Code,
Codex, Cursor) which warrants its own plan + e2e validation. Deferred to
a dedicated follow-up PR.

**Also out of scope here**: `scripts/runtime/hook-*.ts` and the .sh
templates are still exercised by `tests/e2e/v3-zero-hooks.test.ts`, so
they are NOT dead code despite being off the production hot path.

---

## End-of-sprint checklist

Before commit:

1. `pnpm lint` — must pass.
2. `pnpm test` — must pass. If anything regresses, diagnose root cause before commit; do NOT bypass with `--no-verify`.
3. `pnpm build` — must succeed, especially relevant after F12 (new tsup entries).
4. Check `git status` — confirm no unintended files staged.
5. Commit message: `fix(audit-sprint): close 12 critical+high findings (closes audit §8.1 + §8.2)` with bulleted body listing each Fn ID + 1-line summary.
6. Do NOT push (per memory: push only at end of full session by user request, not auto).

---

## Out of scope for this sprint

- §8.3 backlog items (path-alias codemod, file splits, test fixture reorganization).
- LOW-severity findings.
- Doc rewrites.
- Test coverage gap-filling (separate plan).

If during a fix the obvious-and-correct path crosses into out-of-scope territory, STOP and report — do not silently expand scope.

---

## Risks

- **F7 (centralize ArtifactType)**: touches 9 files. Highest blast radius. Recommend doing it last among the verification-confirmed fixes so other fixes don't conflict.
- **F12 (pre-compile hooks)**: changes the build pipeline + 4 .sh templates. If the template change breaks the consumer hook contract, every install regresses. Verify the .sh wrapper falls back to `tsx` for source-mode dev.
- **F8 (CSRF)**: Hono middleware order matters. Risk that the new middleware blocks legitimate same-origin HTMX requests. Add an integration test for the HTMX page POST flow.
