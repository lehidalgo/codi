# Mode: plan

Write the detailed implementation plan for a workflow. This is the artifact phase plan produces.

## Pre-conditions

- A `discover` dialogue has reached explicit user approval of the design (mode `wide`) or the resolved decision tree (modes `sharpen` or `domain`). If decisions are not yet resolved, stop and tell the user to run `devloop:discover` first.
- `docs/CONTEXT.md` exists (run `init-knowledge-base` if not).
- The active workflow is in phase `plan`.

## File naming and location

Use the project's documentation convention:

```
docs/YYYYMMDD_HHMMSS_[PLAN]_<kebab-slug>.md
```

The timestamp is UTC (`date -u +"%Y%m%d_%H%M%S"`). The slug is a short kebab-case description matching the task.

Do NOT write the plan to the workflow archive. The plan is a `[PLAN]` doc; the archive is the manifest event log. They serve different audiences.

## Plan structure

Use `references/plan-template.md` as the starting structure. The template includes:

- Header with status, workflow id, owner, date
- Context (1-2 paragraphs, why this plan exists, references to discover output)
- Scope (in / out)
- Files to be modified (table — each row populates `manifest.scope.files_in_plan` via `scope_expansion_proposed`)
- Modules and contracts (interface design, deep module rationale, deletion test result)
- Test strategy (which behaviors, which seam, which test runner)
- Success criteria (testable, copied from intent and reaffirmed)
- Risks (what could go wrong, how detected, how mitigated)
- Open questions (none should remain at gate time)

## Bite-sized task granularity

Each task in the plan has steps that are 2-5 minutes each:

- "Write the failing test" — step
- "Run it to verify it fails" — step
- "Implement the minimal code" — step
- "Run the tests to verify they pass" — step
- "Commit" — step

Each step contains the actual content an engineer needs. No placeholders.

## Task structure (literal template)

````markdown
### Task N: <Component or change name>

**Files:**

- Create: `exact/path/to/file.ts`
- Modify: `exact/path/to/existing.ts:123-145`
- Test: `tests/exact/path/to/file.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/exact/path/to/file.test.ts
import { describe, it, expect } from "vitest";
import { funcUnderTest } from "../../../src/exact/path/to/file";

describe("funcUnderTest", () => {
  it("does the thing the spec describes", () => {
    expect(funcUnderTest(input)).toEqual(expected);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test tests/exact/path/to/file.test.ts`
Expected: FAIL with "funcUnderTest is not defined"

- [ ] **Step 3: Write the minimal implementation**

```ts
// src/exact/path/to/file.ts
export function funcUnderTest(input: Input): Output {
  // actual code, not a placeholder
  return output;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test tests/exact/path/to/file.test.ts`
Expected: PASS

- [ ] **Step 5: Run full validation**

Run: `pnpm run validate`
Expected: all tests pass, type-check clean, schema validation clean

- [ ] **Step 6: Commit**

```bash
git add tests/exact/path/to/file.test.ts src/exact/path/to/file.ts
git commit -m "feat: add funcUnderTest"
```
````

## Files-in-plan synchronization

For each file the plan declares, propose scope expansion to the workflow:

```bash
devloop scope propose-expansion --file <path> --reason "<why>"
```

After the user approves each, `manifest.scope.files_in_plan` will contain every file in the plan. The pre-tool-use hook will then permit edits to those files during phase execute, and block edits to others.

## After writing the plan

1. Run the self-review (`references/self-review.md`).
2. Emit `artifact_linked` event with type `plan` and the file path.
3. Surface the path to the user with a 1-2 line summary:
   > "Plan written at `docs/YYYYMMDD_HHMMSS_[PLAN]_<slug>.md`. Files in scope: <count>. Tasks: <count>. Review and approve."
4. Do NOT propose phase transition. The user reviews the plan, then explicitly invokes `devloop transition --to decompose` (or `--to execute` if the workflow type skips decompose).

## What you do NOT do in this mode

- Interview the user. The plan is a synthesis; if information is missing, run `devloop:discover` first.
- Echo the plan content into the chat. Write the file; surface the path.
- Use placeholders. Every code block is real code that compiles.
- Cross between tasks. If task 3 defines `clearLayers()`, task 7 must also use `clearLayers()` exactly. The type-consistency check in self-review catches these.
- Add tasks for "future improvements". The plan is the plan; defer optional work to a separate workflow.
