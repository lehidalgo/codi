# Agent-Driven Conflict Resolution Implementation Plan

> **For agentic workers:** Use `codi-plan-executor` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When `codi generate` hits unresolvable conflicts in a non-TTY context (AI agent), emit structured JSON + exit code 2 instead of throwing, then teach the `codi-dev-operations` skill to intercept this, explain it in plain language, and offer the user two resolution paths.

**Architecture:** Two independent layers. Layer 1 changes the non-TTY throw in `conflict-resolver.ts` to emit a structured JSON payload and exit with code 2, returning failed entries in `skipped` so callers can inspect them. Layer 2 adds a `## Conflict Resolution` section to the `dev-operations` skill template that catches exit code 2, explains the conflict in plain language, and lets the user choose between agent-driven semantic merge or manual editor resolution.

**Tech Stack:** TypeScript, Vitest, Node.js `process.stdout`, existing `buildConflictMarkers` utility.

---

## Task 1: Add failing tests for non-TTY structured JSON output

- [ ] **Files**: `tests/unit/utils/conflict-resolver.test.ts`
- [ ] **Est**: 3 minutes

**Steps**:

1. Add a new `describe` block after the existing `"resolveConflicts - non-TTY"` block in `tests/unit/utils/conflict-resolver.test.ts`:

```typescript
describe("resolveConflicts - non-TTY structured output (exit 2)", () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let originalIsTTY: boolean | undefined;
  let originalExitCode: number | undefined;

  beforeEach(() => {
    originalIsTTY = process.stdout.isTTY;
    originalExitCode = process.exitCode as number | undefined;
    Object.defineProperty(process.stdout, "isTTY", {
      value: false,
      writable: true,
      configurable: true,
    });
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    Object.defineProperty(process.stdout, "isTTY", {
      value: originalIsTTY,
      writable: true,
      configurable: true,
    });
    process.exitCode = originalExitCode;
    stdoutSpy.mockRestore();
  });

  it("does NOT throw when there are unresolvable conflicts", async () => {
    const current = "line1\nUSER-VERSION\nline3\n";
    const incoming = "line1\nUPSTREAM-VERSION\nline3\n";
    const conflict = makeConflictEntry("rules/foo", "/tmp/foo.md", current, incoming);

    await expect(resolveConflicts([conflict])).resolves.not.toThrow();
  });

  it("sets process.exitCode to 2 for unresolvable conflicts", async () => {
    const current = "line1\nUSER-VERSION\nline3\n";
    const incoming = "line1\nUPSTREAM-VERSION\nline3\n";
    const conflict = makeConflictEntry("rules/foo", "/tmp/foo.md", current, incoming);

    await resolveConflicts([conflict]);

    expect(process.exitCode).toBe(2);
  });

  it("writes JSON payload to stdout for unresolvable conflicts", async () => {
    const current = "line1\nUSER-VERSION\nline3\n";
    const incoming = "line1\nUPSTREAM-VERSION\nline3\n";
    const conflict = makeConflictEntry("rules/foo", "/tmp/foo.md", current, incoming);

    await resolveConflicts([conflict]);

    const written = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    const parsed = JSON.parse(written) as unknown;
    expect(parsed).toMatchObject({ type: "conflicts" });
  });

  it("payload items contain label, fullPath, currentContent, incomingContent", async () => {
    const current = "line1\nUSER-VERSION\nline3\n";
    const incoming = "line1\nUPSTREAM-VERSION\nline3\n";
    const conflict = makeConflictEntry("rules/foo", "/tmp/foo.md", current, incoming);

    await resolveConflicts([conflict]);

    const written = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    const parsed = JSON.parse(written) as { type: string; items: unknown[] };
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]).toMatchObject({
      label: "rules/foo",
      fullPath: "/tmp/foo.md",
      currentContent: current,
      incomingContent: incoming,
    });
  });

  it("returns failed entries in skipped, auto-merged in merged", async () => {
    // c1: auto-mergeable (pure addition)
    const c1 = makeConflictEntry(
      "rules/safe",
      "/tmp/safe.md",
      "# Safe\n\nOriginal content\n",
      "# Safe\n\nOriginal content\n\n## New Section\nAdded upstream\n",
    );
    // c2: true conflict
    const c2 = makeConflictEntry(
      "rules/conflict",
      "/tmp/conflict.md",
      "line1\nUSER-VERSION\nline3\n",
      "line1\nUPSTREAM-VERSION\nline3\n",
    );

    const resolution = await resolveConflicts([c1, c2]);

    expect(resolution.merged).toHaveLength(1);
    expect(resolution.merged[0]!.label).toBe("rules/safe");
    expect(resolution.skipped).toHaveLength(1);
    expect(resolution.skipped[0]!.label).toBe("rules/conflict");
    expect(resolution.accepted).toHaveLength(0);
  });

  it("payload only lists unresolvable files, not auto-merged ones", async () => {
    const c1 = makeConflictEntry(
      "rules/safe",
      "/tmp/safe.md",
      "# Safe\n\nOriginal content\n",
      "# Safe\n\nOriginal content\n\n## New Section\nAdded upstream\n",
    );
    const c2 = makeConflictEntry(
      "rules/conflict",
      "/tmp/conflict.md",
      "line1\nUSER-VERSION\nline3\n",
      "line1\nUPSTREAM-VERSION\nline3\n",
    );

    await resolveConflicts([c1, c2]);

    const written = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    const parsed = JSON.parse(written) as { type: string; items: Array<{ label: string }> };
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]!.label).toBe("rules/conflict");
  });
});
```

2. Replace the existing import line at the top of the file:
```typescript
// Before:
import { describe, it, expect, beforeEach, afterEach } from "vitest";
// After:
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
```

3. Verify tests fail: `pnpm test tests/unit/utils/conflict-resolver.test.ts`
   Expected: 6 new failing tests (the existing tests still pass).

---

## Task 2: Implement structured JSON output in conflict-resolver.ts

- [ ] **Files**: `src/utils/conflict-resolver.ts`
- [ ] **Est**: 3 minutes

**Steps**:

1. In `tests/unit/utils/conflict-resolver.test.ts`, remove the three tests in the existing `"resolveConflicts - non-TTY"` block that assert the old `throw` behavior, since the implementation no longer throws. Remove these three `it(...)` blocks entirely:
   - `"throws UnresolvableConflictError when both sides change the same line"` (asserts `.rejects.toThrow(UnresolvableConflictError)`)
   - `"thrown error lists all unresolvable files"` (asserts `.files` contains both labels)
   - `"only lists truly unresolvable files in the error"` (asserts `.files` equals `["rules/conflict"]`)

   The remaining two tests in that block (`"auto-merges when changes are on different lines"` and `"returns merged entries when all conflicts auto-merge successfully"`) are still valid and must be kept.

2. In `src/utils/conflict-resolver.ts`, locate the non-TTY branch (lines ~247–275). Replace:

```typescript
    if (failed.length > 0) {
      throw new UnresolvableConflictError(failed.map((f) => f.label));
    }

    if (mergedEntries.length > 0) {
      Logger.getInstance().info(
        `${mergedEntries.length} file(s) auto-merged in non-interactive mode`,
      );
    }

    return { accepted: [], skipped: [], merged: mergedEntries };
```

With:

```typescript
    if (failed.length > 0) {
      process.stdout.write(
        JSON.stringify({
          type: "conflicts",
          items: failed.map((f) => ({
            label: f.label,
            fullPath: f.fullPath,
            currentContent: f.currentContent,
            incomingContent: f.incomingContent,
          })),
        }) + "\n",
      );
      process.exitCode = 2;
    }

    if (mergedEntries.length > 0) {
      Logger.getInstance().info(
        `${mergedEntries.length} file(s) auto-merged in non-interactive mode`,
      );
    }

    // failed entries go into skipped — callers inspect process.exitCode === 2
    // to know unresolvable conflicts were found.
    return { accepted: [], skipped: failed, merged: mergedEntries };
```

3. Verify tests pass: `pnpm test tests/unit/utils/conflict-resolver.test.ts`
   Expected: all tests passing including the 6 new ones (3 old throw-asserting tests removed, 2 existing tests kept, 6 new structured-output tests added).

3. Commit:
```bash
git add src/utils/conflict-resolver.ts tests/unit/utils/conflict-resolver.test.ts
git commit -m "feat(generate): emit structured JSON + exit 2 for non-TTY conflicts"
```

---

## Task 3: Add Conflict Resolution section to dev-operations skill template

- [ ] **Files**: `src/templates/skills/dev-operations/template.ts`
- [ ] **Est**: 4 minutes

**Steps**:

1. In `src/templates/skills/dev-operations/template.ts`, locate the `## Generation & Maintenance` section. Insert a new section **before** it:

```typescript
// Add this block before the "## Generation & Maintenance" section in the template string:
`
## Conflict Resolution

When \`${PROJECT_CLI} generate\` exits with code 2, it means one or more files have conflicts that could not be auto-merged. The command writes a JSON payload to stdout:

\`\`\`json
{
  "type": "conflicts",
  "items": [
    {
      "label": "CLAUDE.md",
      "fullPath": "/absolute/path/CLAUDE.md",
      "currentContent": "... your local version ...",
      "incomingContent": "... new template version ..."
    }
  ]
}
\`\`\`

### When you detect exit code 2

**[CODING AGENT]** Do the following immediately — do NOT show the raw JSON or exit code to the user:

1. Parse the JSON payload from stdout.
2. Tell the user in plain language:

> "I ran \`${PROJECT_CLI} generate\` and found conflicts in N file(s): [comma-separated labels].
> These files have local customizations that differ from the updated templates.
> How would you like to resolve this?"

3. Offer two options:

> **[A] Let me handle it** — I will read both versions, merge them preserving your customizations, and continue automatically.
>
> **[B] I'll do it manually** — I will open the files with conflict markers so you can choose each change yourself.

4. Wait for the user's choice before proceeding.

### Path A — Agent resolves

For each item in the payload:

1. Read \`currentContent\` (your local version) and \`incomingContent\` (the new template).
2. Produce a merged version:
   - Keep all content unique to \`currentContent\` (your customizations).
   - Add all sections present in \`incomingContent\` but absent from \`currentContent\`.
   - For sections present in both where the template changed: keep \`currentContent\` unless it matches the old template exactly, in which case take \`incomingContent\`.
3. Write the merged content to \`fullPath\`.

After writing all resolved files, re-run \`${PROJECT_CLI} generate\`:
- If it exits 0: report success to the user.
- If it exits 2 again: switch to Path B — the semantic merge was not sufficient. Tell the user: "The automatic merge could not fully resolve these conflicts. I've opened the files with conflict markers — please resolve them manually and confirm."

### Path B — Manual resolve

For each item in the payload:

1. Write the file at \`fullPath\` with git-style conflict markers:
\`\`\`
<<<<<<< current (your version)
[currentContent]
=======
[incomingContent]
>>>>>>> incoming (new template)
\`\`\`

2. Open the file in the user's editor (use \`$VISUAL\` → \`$EDITOR\` → \`code\` → \`vi\` resolution order).

3. Tell the user:
> "I've opened [label] with conflict markers. Choose the version you want for each section, remove the markers, save the file, and let me know when you're done."

4. When the user confirms, re-run \`${PROJECT_CLI} generate\`. If it exits 0, report success.

### Version bump reminder

After any successful \`${PROJECT_CLI} generate\` run that writes new content, remind the user:
> "Generation complete. If this was triggered by a template update, consider running \`${PROJECT_CLI} update\` to check for other stale artifacts."

`
```

2. Bump `version:` in the skill frontmatter from `10` to `11`:
```typescript
// In the template string, change:
version: 10
// To:
version: 11
```

3. Verify the template compiles: `pnpm build 2>&1 | tail -3`
   Expected: `Build success` with no errors.

4. Commit:
```bash
git add src/templates/skills/dev-operations/template.ts
git commit -m "feat(dev-operations): add conflict resolution guidance for non-TTY generate"
```

---

## Task 4: Regenerate and verify the installed skill

- [ ] **Files**: generated `.claude/skills/codi-dev-operations/SKILL.md`
- [ ] **Est**: 2 minutes

**Steps**:

1. Run generate with force to apply the new template (the conflict is in CLAUDE.md and brand-creator, not dev-operations — so dev-operations will write cleanly):
```bash
node dist/cli.js generate --force
```

2. Verify the installed skill contains the new section:
```bash
grep -c "Conflict Resolution" .claude/skills/codi-dev-operations/SKILL.md
```
Expected: `1`

3. Verify the conflict resolution section contains both paths:
```bash
grep "Path A" .claude/skills/codi-dev-operations/SKILL.md
grep "Path B" .claude/skills/codi-dev-operations/SKILL.md
```
Expected: both lines found.

4. Run full test suite to confirm nothing regressed:
```bash
pnpm test
```
Expected: all tests passing.

5. Commit generated file:
```bash
git add .claude/skills/codi-dev-operations/SKILL.md
git commit -m "chore(generate): regenerate dev-operations skill with conflict resolution"
```

---

## Verification

After all tasks complete:

```bash
pnpm test tests/unit/utils/conflict-resolver.test.ts
```
Expected: all tests pass including the 6 new structured-output tests.

```bash
grep "type.*conflicts" src/utils/conflict-resolver.ts
```
Expected: line found in the non-TTY branch.

```bash
grep "Conflict Resolution" .claude/skills/codi-dev-operations/SKILL.md
```
Expected: section present in the generated skill.
