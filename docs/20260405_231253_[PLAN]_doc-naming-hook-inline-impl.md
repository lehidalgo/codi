# Doc Naming Hook Inline Implementation Plan

> **For agentic workers:** Use `codi-subagent-dev` (recommended) or `codi-plan-executor` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `DOC_NAMING_CHECK_TEMPLATE` hook's dependency on `scripts/validate-docs.py` with self-contained inline JavaScript, so the hook runs in every user project.

**Architecture:** Inline the Python script's validation logic (regex, category list, skip rules) directly into the `DOC_NAMING_CHECK_TEMPLATE` string in `hook-templates.ts`. Remove the `existsSync("scripts/validate-docs.py")` gate in `hook-config-generator.ts` so the hook activates universally.

**Tech Stack:** TypeScript, Vitest, Node.js built-ins only (no new dependencies)

---

### Task 1: Write failing unit tests for the inline validation logic

**Files**: `tests/unit/hooks/doc-naming-check.test.ts`
**Est**: 3 minutes

**Steps**:
- [ ] 1. Create `tests/unit/hooks/doc-naming-check.test.ts` with tests asserting: no python3/validate-docs.py references, all 11 categories present, YYYYMMDD_HHMMSS regex pattern present, skip dirs present (project, codi_docs, superpowers, DEPRECATED).
- [ ] 2. Verify tests fail: `pnpm test tests/unit/hooks/doc-naming-check.test.ts`
- [ ] 3. Commit: `git add tests/unit/hooks/doc-naming-check.test.ts && git commit -m "test(hooks): add failing tests for inline doc-naming-check template"`

---

### Task 2: Replace DOC_NAMING_CHECK_TEMPLATE with inline validation logic

**Files**: `src/core/hooks/hook-templates.ts`
**Est**: 5 minutes

**Steps**:
- [ ] 1. Locate `DOC_NAMING_CHECK_TEMPLATE` (around line 463) and replace its body. The new inline logic must:
  - Define `ALLOWED_CATEGORIES` Set: ARCHITECTURE, AUDIT, GUIDE, REPORT, ROADMAP, RESEARCH, SECURITY, TESTING, BUSINESS, TECH, PLAN
  - Define `SKIP_DIRS` Set: project, codi_docs, superpowers, DEPRECATED
  - Define `SKIP_FILES` Set: .DS_Store
  - Define `VALID_PATTERN` regex matching `YYYYMMDD_HHMMSS_[CATEGORY]_rest`
  - Read staged files via git diff --cached
  - Filter to docs/ files; exit 0 if none
  - For each file: skip if in SKIP_FILES, skip if path segment in SKIP_DIRS, fail if parts.length > 2 (subdirectory), fail if no regex match, fail if category not in ALLOWED_CATEGORIES
  - Print failures with path + reason + format reminder, exit 1; else exit 0
- [ ] 2. Verify tests pass: `pnpm test tests/unit/hooks/doc-naming-check.test.ts`
- [ ] 3. Commit: `git add src/core/hooks/hook-templates.ts && git commit -m "feat(hooks): inline doc-naming validation — remove python3 dependency"`

---

### Task 3: Remove the scripts/validate-docs.py gate

**Files**: `src/core/hooks/hook-config-generator.ts`, `tests/unit/hooks/hook-config-generator.test.ts`
**Est**: 3 minutes

**Steps**:
- [ ] 1. In `tests/unit/hooks/hook-config-generator.test.ts`, find any test that asserts `docNamingCheck` is `false` (or that `doc-naming-check` is absent from hooks for a clean project). Update the assertion to expect `true` (or that the hook is present).
- [ ] 2. Verify the updated test now fails: `pnpm test tests/unit/hooks/hook-config-generator.test.ts`
   Expected: the updated assertion fails because `hasDocNamingCheck()` still returns false
- [ ] 3. In `src/core/hooks/hook-config-generator.ts`, replace `hasDocNamingCheck()`:
   ```typescript
   function hasDocNamingCheck(): boolean {
     return true;
   }
   ```
- [ ] 4. Run `grep -n "existsSync" src/core/hooks/hook-config-generator.ts` — remove the `existsSync` import only if no other call uses it.
- [ ] 5. Verify tests pass: `pnpm test tests/unit/hooks/hook-config-generator.test.ts`
- [ ] 6. Commit: `git add src/core/hooks/hook-config-generator.ts tests/unit/hooks/hook-config-generator.test.ts && git commit -m "feat(hooks): enable doc-naming-check for all projects"`

---

### Task 4: Regenerate baseline and run full test suite

**Files**: `src/core/version/artifact-version-baseline.json`
**Est**: 2 minutes

**Steps**:
- [ ] 1. Run `pnpm run baseline:update` — expected: artifact-version-baseline.json updates with new hashes for hook-templates.ts
- [ ] 2. Run `pnpm test` — expected: all tests pass
- [ ] 3. Commit: `git add src/core/version/artifact-version-baseline.json && git commit -m "chore: update artifact version baseline after doc-naming hook inline"`
