# Hook Gap Fixes Implementation Plan

> **For agentic workers:** Use `codi-plan-execution` to implement this plan task-by-task. That skill asks the user to pick INLINE (sequential) or SUBAGENT (fresh subagent per task with two-stage review) mode. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the four post-#85 hook system gap fixes — vendored-dirs SSoT (Delta A), conflict-marker detection in `validate` and pre-commit (Delta B), batched install hints + `codi doctor --hooks` (Delta C) — as three independent commits on `feat/hook-gap-fixes`.

**Architecture:** Two new pure-data modules (`src/core/hooks/exclusions.ts`, `src/core/hooks/conflict-markers.ts`) act as single sources of truth. Existing modules swap inline literals for imports; no module changes shape. New CLI flag `--hooks` on `codi doctor` consumes existing `checkHookDependencies`. `validateConfig` becomes async to incorporate the new conflict-marker scan.

**Tech Stack:** TypeScript (strict, ESM, `moduleResolution: "NodeNext"`, path alias `#src/*`), vitest, eemeli/yaml v2.x, pnpm. Test runner: `pnpm test <pattern>`.

**Spec reference:** `docs/20260429_1500_SPEC_hook-gap-fixes.md`

**Branch:** `feat/hook-gap-fixes` (already created from `origin/develop`)

---

## Pre-flight

### Task P.1: Verify clean working tree on the right branch

**Files**: none
**Est**: 1 minute

**Steps**:
1. Verify branch and clean state: `git status -sb`
   - Expected: `## feat/hook-gap-fixes`, no uncommitted changes (the SPEC and PLAN docs are uncommitted but acceptable)
2. Verify branch is up to date with origin/develop: `git log --oneline origin/develop..HEAD | head -5`
   - Expected: only the SPEC/PLAN doc commits (or empty if not yet committed)
3. Run baseline test sweep: `pnpm test 2>&1 | tail -20`
   - Expected: all tests pass on develop baseline (the work-tree-untouched baseline)

**Verification**: Tests pass; branch correct.

---

## Commit 1 — Centralize Vendored-Dir Exclusions in Single Source of Truth

> **Scope:** Delta A.1 + A.2 from spec. Adds 6 missing agent dirs and extracts the list to a shared module consumed by both `yaml-renderer.ts` and `FILE_SIZE_CHECK_TEMPLATE`.

### Task 1.1: Add unit tests for the exclusions module

**Files**: `tests/unit/hooks/exclusions.test.ts` (new)
**Est**: 4 minutes

**Steps**:
1. Create the test file with full assertions (no implementation yet — these will fail):
   ```typescript
   import { describe, it, expect } from "vitest";
   import {
     VENDORED_DIRS,
     buildVendoredDirsRegex,
     buildVendoredDirsTemplatePatterns,
   } from "#src/core/hooks/exclusions.js";

   describe("VENDORED_DIRS", () => {
     it("includes the legacy build/output dirs", () => {
       expect(VENDORED_DIRS).toContain("node_modules");
       expect(VENDORED_DIRS).toContain(".venv");
       expect(VENDORED_DIRS).toContain("venv");
       expect(VENDORED_DIRS).toContain("dist");
       expect(VENDORED_DIRS).toContain("build");
       expect(VENDORED_DIRS).toContain("coverage");
       expect(VENDORED_DIRS).toContain(".next");
     });

     it("includes every supported agent directory", () => {
       expect(VENDORED_DIRS).toContain(".codi");
       expect(VENDORED_DIRS).toContain(".agents");
       expect(VENDORED_DIRS).toContain(".claude");
       expect(VENDORED_DIRS).toContain(".codex");
       expect(VENDORED_DIRS).toContain(".cursor");
       expect(VENDORED_DIRS).toContain(".windsurf");
       expect(VENDORED_DIRS).toContain(".cline");
     });

     it("contains exactly 14 entries", () => {
       expect(VENDORED_DIRS.length).toBe(14);
     });

     it("has no duplicates", () => {
       expect(new Set(VENDORED_DIRS).size).toBe(VENDORED_DIRS.length);
     });
   });

   describe("buildVendoredDirsRegex", () => {
     it("returns an anchored alternation matching every vendored dir", () => {
       const re = buildVendoredDirsRegex();
       expect(re).toBe(
         "^(node_modules|\\.venv|venv|dist|build|coverage|\\.next|\\.codi|\\.agents|\\.claude|\\.codex|\\.cursor|\\.windsurf|\\.cline)/",
       );
     });

     it("compiles to a valid JavaScript RegExp", () => {
       const re = new RegExp(buildVendoredDirsRegex());
       expect(re.test(".codi/skills/foo/SKILL.md")).toBe(true);
       expect(re.test(".cursor/skills/x/template.ts")).toBe(true);
       expect(re.test("node_modules/foo/index.js")).toBe(true);
       expect(re.test("src/index.ts")).toBe(false);
       expect(re.test("docs/guide.md")).toBe(false);
     });

     it("escapes literal dots in dotfile dir names", () => {
       const re = buildVendoredDirsRegex();
       // Without proper escape, a regex like .codi would also match xcodi/ etc.
       const compiled = new RegExp(re);
       expect(compiled.test("xcodi/file.md")).toBe(false);
     });
   });

   describe("buildVendoredDirsTemplatePatterns", () => {
     it("emits comma-separated regex literals for substitution into templates", () => {
       const out = buildVendoredDirsTemplatePatterns();
       // Each entry should be a regex literal of form /^<dir>\//
       expect(out).toContain("/^node_modules\\//");
       expect(out).toContain("/^\\.codi\\//");
       expect(out).toContain("/^\\.cursor\\//");
       expect(out).toContain("/^\\.cline\\//");
     });

     it("produces a string that, when injected into JS source, parses to valid regex literals", () => {
       const out = buildVendoredDirsTemplatePatterns();
       // Wrap in a synthetic array literal and eval-parse to verify validity.
       const synthetic = `[${out}]`;
       expect(() => new Function(`return ${synthetic}`)()).not.toThrow();
       const arr = new Function(`return ${synthetic}`)() as RegExp[];
       expect(arr.length).toBe(14);
       expect(arr.every((r) => r instanceof RegExp)).toBe(true);
       expect(arr.some((r) => r.test(".codi/foo"))).toBe(true);
       expect(arr.some((r) => r.test(".cursor/foo"))).toBe(true);
     });
   });
   ```
2. Verify tests fail (module doesn't exist yet): `pnpm test tests/unit/hooks/exclusions.test.ts 2>&1 | tail -20`
   - Expected: import resolution error or test failures referencing the missing module.

**Verification**: `pnpm test tests/unit/hooks/exclusions.test.ts` fails with module-not-found or similar.

---

### Task 1.2: Implement the exclusions module

**Files**: `src/core/hooks/exclusions.ts` (new)
**Est**: 3 minutes

**Steps**:
1. Create the module:
   ```typescript
   /**
    * Single source of truth for directories codi excludes from per-language hooks
    * and from the file-size check template.
    *
    * Adding a directory here automatically extends:
    *   - the YAML `exclude:` regex emitted by yaml-renderer
    *   - the `EXCLUDED` array inside the FILE_SIZE_CHECK_TEMPLATE script
    *
    * Used by:
    *   - src/core/hooks/renderers/yaml-renderer.ts (TOP_LEVEL_DEFAULTS)
    *   - src/core/hooks/hook-installer.ts (FILE_SIZE_CHECK_TEMPLATE substitution)
    */
   export const VENDORED_DIRS = [
     "node_modules",
     ".venv",
     "venv",
     "dist",
     "build",
     "coverage",
     ".next",
     ".codi",
     ".agents",
     ".claude",
     ".codex",
     ".cursor",
     ".windsurf",
     ".cline",
   ] as const;

   export type VendoredDir = (typeof VENDORED_DIRS)[number];

   /**
    * Build the anchored regex string used as the YAML `exclude:` value.
    * Matches any path beginning with one of the vendored directory names.
    *
    * Example output:
    *   "^(node_modules|\\.venv|...|\\.cline)/"
    */
   export function buildVendoredDirsRegex(): string {
     const escaped = VENDORED_DIRS.map((d) => d.replace(/\./g, "\\."));
     return `^(${escaped.join("|")})/`;
   }

   /**
    * Build the comma-separated literal for substitution into hook templates.
    * After the substitution, the rendered script contains a list of regex
    * literals that match the directory prefixes:
    *   /^node_modules\//, /^\.venv\//, ..., /^\.cline\//
    *
    * Each VENDORED_DIRS entry produces one regex literal. Dots in directory
    * names are escaped (\.codi instead of .codi) so the regex matches the
    * literal directory and not arbitrary single characters.
    */
   export function buildVendoredDirsTemplatePatterns(): string {
     return VENDORED_DIRS.map((d) => `/^${d.replace(/\./g, "\\.")}\\//`).join(", ");
   }
   ```
2. Verify tests pass: `pnpm test tests/unit/hooks/exclusions.test.ts 2>&1 | tail -10`
   - Expected: all 8 assertions pass.

**Verification**: `pnpm test tests/unit/hooks/exclusions.test.ts` — all tests passing.

---

### Task 1.3: Wire exclusions into the YAML renderer

**Files**: `src/core/hooks/renderers/yaml-renderer.ts`, `tests/unit/hooks/yaml-renderer.test.ts`
**Est**: 4 minutes

**Steps**:
1. Add a regression test to `tests/unit/hooks/yaml-renderer.test.ts` (append to the existing file at the end of the `describe` block; insert before the closing `});`):
   ```typescript
     it("emits a top-level exclude: regex covering every vendored agent dir", () => {
       const out = renderPreCommitConfig([ruff], null);
       const match = out.match(/^exclude: ['"]?(.+?)['"]?$/m);
       expect(match).not.toBeNull();
       const regex = new RegExp(match![1]!);
       // Legacy build/output dirs
       expect(regex.test("node_modules/foo")).toBe(true);
       expect(regex.test("dist/x.js")).toBe(true);
       // All seven supported agent dirs
       expect(regex.test(".codi/skills/foo/SKILL.md")).toBe(true);
       expect(regex.test(".agents/skills/foo/SKILL.md")).toBe(true);
       expect(regex.test(".claude/skills/foo/SKILL.md")).toBe(true);
       expect(regex.test(".codex/skills/foo/SKILL.md")).toBe(true);
       expect(regex.test(".cursor/skills/foo/template.ts")).toBe(true);
       expect(regex.test(".windsurf/skills/foo/SKILL.md")).toBe(true);
       expect(regex.test(".cline/skills/foo/SKILL.md")).toBe(true);
       // User source files must not be excluded
       expect(regex.test("src/foo.ts")).toBe(false);
     });
   ```
2. Run test — expected to fail (renderer still uses inline literal omitting agent dirs): `pnpm test tests/unit/hooks/yaml-renderer.test.ts 2>&1 | tail -15`
   - Expected: the new test fails on `.cursor` or `.cline` (whichever is first) because the current regex omits them.
3. Update `src/core/hooks/renderers/yaml-renderer.ts`:
   - Add to imports at the top of the file (before the existing `from "../yaml-document.js"` import):
     ```typescript
     import { buildVendoredDirsRegex } from "../exclusions.js";
     ```
   - Replace line 20 (the `["exclude", "^(node_modules|...)/"]` entry inside `TOP_LEVEL_DEFAULTS`):

     **Before:**
     ```typescript
       ["exclude", "^(node_modules|\\.venv|venv|dist|build|coverage|\\.next|\\.codi)/"],
     ```

     **After:**
     ```typescript
       ["exclude", buildVendoredDirsRegex()],
     ```
4. Verify all yaml-renderer tests pass: `pnpm test tests/unit/hooks/yaml-renderer.test.ts 2>&1 | tail -15`
   - Expected: every test passes including the new regression case.

**Verification**: `pnpm test tests/unit/hooks/yaml-renderer.test.ts` — all tests passing.

---

### Task 1.4: Add `{{VENDORED_DIRS_PATTERNS}}` substitution to `FILE_SIZE_CHECK_TEMPLATE`

**Files**: `src/core/hooks/hook-templates.ts`
**Est**: 3 minutes

**Steps**:
1. Open `src/core/hooks/hook-templates.ts` and locate the `FILE_SIZE_CHECK_TEMPLATE` constant (starts around line 179).
2. Find the `EXCLUDED` array literal inside the template (around line 189). It currently looks like:
   ```typescript
   const EXCLUDED = [/^\\.(clinerules|cursorrules|windsurfrules)$/, /^AGENTS\\.md$/, /^CLAUDE\\.md$/, /^\\.(claude|cursor|windsurf|cline|codex|agents|codi)\\//, /^docs\\//, /^site\\//, /-lock\\.json$/, /\\.lock$/, /-lock\\.yaml$/, /^pnpm-lock\\.yaml$/, /\\/assets\\//, /\\/references\\//, /\\/vendor\\//, /\\/scripts\\/office\\//, /\\.xsd$/, /\\.ttf$/, /\\.woff2?$/, /\\.pdf$/, /\\.html$/, /\\.css$/, /\\.svg$/, /\\.md$/, /\\.mdx$/, /\\.txt$/, /\\.rst$/];
   ```
3. Replace the inline `/^\\.(claude|cursor|windsurf|cline|codex|agents|codi)\\//` portion with `{{VENDORED_DIRS_PATTERNS}}` so the line becomes:
   ```typescript
   const EXCLUDED = [{{VENDORED_DIRS_PATTERNS}}, /^\\.(clinerules|cursorrules|windsurfrules)$/, /^AGENTS\\.md$/, /^CLAUDE\\.md$/, /^docs\\//, /^site\\//, /-lock\\.json$/, /\\.lock$/, /-lock\\.yaml$/, /^pnpm-lock\\.yaml$/, /\\/assets\\//, /\\/references\\//, /\\/vendor\\//, /\\/scripts\\/office\\//, /\\.xsd$/, /\\.ttf$/, /\\.woff2?$/, /\\.pdf$/, /\\.html$/, /\\.css$/, /\\.svg$/, /\\.md$/, /\\.mdx$/, /\\.txt$/, /\\.rst$/];
   ```
   (The `{{VENDORED_DIRS_PATTERNS}}` placeholder is now the first element of the array; the remaining file-specific patterns stay as-is.)
4. Verify the file still compiles: `pnpm lint 2>&1 | tail -5`
   - Expected: no TypeScript errors.

**Verification**: `pnpm lint` exits 0; the placeholder is in place.

---

### Task 1.5: Substitute the placeholder during hook installation

**Files**: `src/core/hooks/hook-installer.ts`
**Est**: 3 minutes

**Steps**:
1. Open `src/core/hooks/hook-installer.ts`.
2. Add the import at the top with the other `./` imports (near the other hook-template imports):
   ```typescript
   import { buildVendoredDirsTemplatePatterns } from "./exclusions.js";
   ```
3. Locate `buildFileSizeScript` (around line 87):

   **Before:**
   ```typescript
   function buildFileSizeScript(maxLines: number): string {
     return FILE_SIZE_CHECK_TEMPLATE.replace("{{MAX_LINES}}", String(maxLines));
   }
   ```

   **After:**
   ```typescript
   function buildFileSizeScript(maxLines: number): string {
     return FILE_SIZE_CHECK_TEMPLATE
       .replace("{{MAX_LINES}}", String(maxLines))
       .replace("{{VENDORED_DIRS_PATTERNS}}", buildVendoredDirsTemplatePatterns());
   }
   ```
4. Verify the project still compiles: `pnpm lint 2>&1 | tail -5`
   - Expected: no errors.

**Verification**: `pnpm lint` exits 0.

---

### Task 1.6: Add hook-installer test asserting the rendered script contains all vendored patterns

**Files**: `tests/unit/hooks/hook-installer.test.ts`
**Est**: 4 minutes

**Steps**:
1. Append a new `describe` block at the end of `tests/unit/hooks/hook-installer.test.ts` (before the final `});` closing the file):
   ```typescript
   describe("buildFileSizeScript — vendored dirs SSoT", () => {
     it("substitutes {{VENDORED_DIRS_PATTERNS}} with regex literals matching every vendored dir", () => {
       const script = buildFileSizeScript(800);
       // The substitution must replace the placeholder
       expect(script).not.toContain("{{VENDORED_DIRS_PATTERNS}}");
       // The MAX_LINES substitution must also still happen
       expect(script).toContain("const maxLines = 800;");
       // Every vendored dir must appear as a regex literal of form /^<dir>\//
       expect(script).toContain("/^node_modules\\//");
       expect(script).toContain("/^\\.codi\\//");
       expect(script).toContain("/^\\.agents\\//");
       expect(script).toContain("/^\\.claude\\//");
       expect(script).toContain("/^\\.codex\\//");
       expect(script).toContain("/^\\.cursor\\//");
       expect(script).toContain("/^\\.windsurf\\//");
       expect(script).toContain("/^\\.cline\\//");
     });

     it("produces a script whose EXCLUDED array parses as valid JavaScript", () => {
       const script = buildFileSizeScript(800);
       const match = script.match(/const EXCLUDED = (\[[\s\S]*?\]);/);
       expect(match).not.toBeNull();
       const arrayLiteral = match![1]!;
       const arr = new Function(`return ${arrayLiteral}`)() as RegExp[];
       expect(arr.every((r) => r instanceof RegExp)).toBe(true);
       // Every vendored dir must be matched by at least one regex
       const allMatch = (path: string) => arr.some((r) => r.test(path));
       expect(allMatch(".cursor/skills/foo/template.ts")).toBe(true);
       expect(allMatch(".cline/skills/foo/SKILL.md")).toBe(true);
       expect(allMatch("node_modules/foo/index.js")).toBe(true);
     });
   });
   ```
2. Run the test: `pnpm test tests/unit/hooks/hook-installer.test.ts 2>&1 | tail -15`
   - Expected: all tests pass including the new ones.

**Verification**: `pnpm test tests/unit/hooks/hook-installer.test.ts` — all passing.

---

### Task 1.7: Run full test sweep and commit

**Files**: all changes from Tasks 1.1-1.6
**Est**: 3 minutes

**Steps**:
1. Run the full test suite: `pnpm test 2>&1 | tail -15`
   - Expected: all tests pass.
2. Run lint: `pnpm lint 2>&1 | tail -5`
   - Expected: no errors.
3. Stage and commit:
   ```bash
   git add src/core/hooks/exclusions.ts \
           src/core/hooks/renderers/yaml-renderer.ts \
           src/core/hooks/hook-templates.ts \
           src/core/hooks/hook-installer.ts \
           tests/unit/hooks/exclusions.test.ts \
           tests/unit/hooks/yaml-renderer.test.ts \
           tests/unit/hooks/hook-installer.test.ts
   git commit -m "refactor(hooks): centralize vendored-dir exclusions in single source of truth"
   ```

**Verification**: `git log -1 --stat` shows the commit with the seven files; `git status -sb` shows clean tree.

---

## Commit 2 — Conflict-Marker Detection in `validate` and Pre-commit

> **Scope:** Delta B from spec. New pure module `conflict-markers.ts`, integration into `codi validate`, new global pre-commit hook.

### Task 2.1: Add unit tests for the conflict-markers module

**Files**: `tests/unit/hooks/conflict-markers.test.ts` (new)
**Est**: 5 minutes

**Steps**:
1. Create the test file:
   ```typescript
   import { describe, it, expect } from "vitest";
   import {
     findConflictMarkers,
     hasConflictMarkers,
   } from "#src/core/hooks/conflict-markers.js";

   describe("findConflictMarkers", () => {
     it("returns empty array for clean text", () => {
       expect(findConflictMarkers("hello\nworld\n")).toEqual([]);
       expect(findConflictMarkers("")).toEqual([]);
     });

     it("detects standard 2-way merge markers", () => {
       const text = [
         "function foo() {",
         "<<<<<<< HEAD",
         "  return 1;",
         "=======",
         "  return 2;",
         ">>>>>>> branch-x",
         "}",
       ].join("\n");
       const hits = findConflictMarkers(text);
       expect(hits.length).toBe(3);
       expect(hits[0]).toEqual({ line: 2, kind: "ours", text: "<<<<<<< HEAD" });
       expect(hits[1]).toEqual({ line: 4, kind: "sep", text: "=======" });
       expect(hits[2]).toEqual({ line: 6, kind: "theirs", text: ">>>>>>> branch-x" });
     });

     it("detects 3-way diff3-style merge markers including ||||||| ancestor", () => {
       const text = [
         "<<<<<<< HEAD",
         "  ours",
         "||||||| ancestor",
         "  base",
         "=======",
         "  theirs",
         ">>>>>>> branch",
       ].join("\n");
       const hits = findConflictMarkers(text);
       expect(hits.length).toBe(4);
       expect(hits.map((h) => h.kind)).toEqual(["ours", "base", "sep", "theirs"]);
     });

     it("uses 1-based line numbers", () => {
       const text = "line1\nline2\n<<<<<<< HEAD\n";
       const hits = findConflictMarkers(text);
       expect(hits[0]?.line).toBe(3);
     });

     it("handles CRLF line endings", () => {
       const text = "ok\r\n<<<<<<< HEAD\r\n=======\r\n>>>>>>> branch\r\n";
       const hits = findConflictMarkers(text);
       expect(hits.length).toBe(3);
       expect(hits[0]?.kind).toBe("ours");
     });

     it("rejects sigils of wrong length (8 chars or 6 chars)", () => {
       expect(findConflictMarkers("<<<<<<<<  HEAD\n")).toEqual([]); // 8 chars
       expect(findConflictMarkers("<<<<<< HEAD\n")).toEqual([]); // 6 chars
     });

     it("requires a space or end-of-line after the sigil to avoid false positives", () => {
       // ======= as part of a section heading is NOT a conflict marker
       expect(findConflictMarkers("=======break")).toEqual([]);
       // bare ======= on its own line IS a conflict marker (separator)
       expect(findConflictMarkers("=======\n")).toHaveLength(1);
     });
   });

   describe("hasConflictMarkers", () => {
     it("returns false for clean text", () => {
       expect(hasConflictMarkers("hello world")).toBe(false);
     });

     it("returns true when any marker is present", () => {
       expect(hasConflictMarkers("<<<<<<< HEAD\nfoo\n")).toBe(true);
     });

     it("is consistent with findConflictMarkers", () => {
       const cases = [
         "",
         "no markers here",
         "<<<<<<< HEAD\n=======\n>>>>>>> x",
         "||||||| anc\n",
       ];
       for (const c of cases) {
         expect(hasConflictMarkers(c)).toBe(findConflictMarkers(c).length > 0);
       }
     });
   });
   ```
2. Verify tests fail: `pnpm test tests/unit/hooks/conflict-markers.test.ts 2>&1 | tail -10`
   - Expected: import failure or test failure.

**Verification**: tests fail because module doesn't exist.

---

### Task 2.2: Implement the conflict-markers module

**Files**: `src/core/hooks/conflict-markers.ts` (new)
**Est**: 3 minutes

**Steps**:
1. Create the module:
   ```typescript
   /**
    * Pure scanner for git merge-conflict markers in text content.
    *
    * Detects all four marker variants:
    *   <<<<<<< (ours)        7 chars + space-or-EOL
    *   ||||||| (base/ancestor — only emitted with merge.conflictStyle = diff3)
    *   ======= (separator)
    *   >>>>>>> (theirs)
    *
    * Used by:
    *   - src/core/config/validator.ts (validateNoConflictMarkers)
    *   - hook-templates.ts CONFLICT_MARKER_CHECK_TEMPLATE (logic inlined into the template)
    */

   const MARKER_RE = /^(<{7}|={7}|>{7}|\|{7})( |$)/;

   export type MarkerKind = "ours" | "base" | "theirs" | "sep";

   export interface MarkerHit {
     /** 1-based line number where the marker appears. */
     line: number;
     kind: MarkerKind;
     /** Raw line text (truncated by the caller if needed). */
     text: string;
   }

   /**
    * Scan text for git merge-conflict markers. Returns one hit per marker line.
    * An empty array means the text is clean.
    */
   export function findConflictMarkers(text: string): MarkerHit[] {
     // Split on \n; trailing \r is stripped per-line so CRLF input works.
     const lines = text.split("\n");
     const hits: MarkerHit[] = [];
     for (let i = 0; i < lines.length; i++) {
       const raw = lines[i] ?? "";
       const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
       const match = MARKER_RE.exec(line);
       if (!match) continue;
       const sigil = match[1]!;
       let kind: MarkerKind = "sep";
       if (sigil.startsWith("<")) kind = "ours";
       else if (sigil.startsWith(">")) kind = "theirs";
       else if (sigil.startsWith("|")) kind = "base";
       hits.push({ line: i + 1, kind, text: line });
     }
     return hits;
   }

   /**
    * Fast yes/no check for callers that don't need line numbers.
    */
   export function hasConflictMarkers(text: string): boolean {
     return findConflictMarkers(text).length > 0;
   }
   ```
2. Verify tests pass: `pnpm test tests/unit/hooks/conflict-markers.test.ts 2>&1 | tail -10`
   - Expected: all assertions pass.

**Verification**: `pnpm test tests/unit/hooks/conflict-markers.test.ts` — passing.

---

### Task 2.3: Register `E_CONFLICT_MARKERS` in the error catalog

**Files**: `src/core/output/error-catalog.ts`
**Est**: 2 minutes

**Steps**:
1. Open `src/core/output/error-catalog.ts`.
2. Inside the `ERROR_CATALOG` object, add the new entry (place it next to `E_CONFIG_INVALID` for semantic grouping):
   ```typescript
     E_CONFLICT_MARKERS: {
       exitCode: EXIT_CODES.CONFIG_INVALID,
       severity: "error" as const,
       hintTemplate: "Git merge-conflict markers in {file} (line {line}). Resolve the conflict and re-stage.",
     },
   ```
3. Verify TypeScript still compiles: `pnpm lint 2>&1 | tail -5`
   - Expected: no errors. The `ErrorCode` type updates automatically because it's derived from `keyof ERROR_CATALOG`.

**Verification**: `pnpm lint` exits 0.

---

### Task 2.4: Add `validateNoConflictMarkers` step to the validator

**Files**: `src/core/config/validator.ts`, `tests/unit/core/config/validator.test.ts`
**Est**: 4 minutes

**Design note:** `NormalizedConfig.skills`, `.rules`, and `.agents` already carry the parsed file content as `content: string` (verified in `src/types/config.ts:84`, `:116`, `:169`). The scan is therefore an in-memory operation over already-loaded strings — no filesystem I/O, `validateConfig` stays synchronous.

**Steps**:
1. Add a failing test for the new behavior. Append to `tests/unit/core/config/validator.test.ts` at the end of the top-level `describe` block (before its closing `});`):
   ```typescript
   describe("validateConfig — conflict markers", () => {
     it("returns E_CONFLICT_MARKERS when a skill content contains git merge markers", () => {
       const config = {
         manifest: { name: "test", version: "1" },
         rules: [],
         skills: [
           {
             name: "demo",
             description: "demo",
             version: 1,
             content: "intro\n<<<<<<< HEAD\nA\n=======\nB\n>>>>>>> br\nend\n",
           },
         ],
         agents: [],
         flags: {},
         mcp: [],
       } as never as Parameters<typeof validateConfig>[0];

       const errors = validateConfig(config);

       const cm = errors.find((e) => e.code === "E_CONFLICT_MARKERS");
       expect(cm).toBeDefined();
       expect(cm!.message).toContain("demo");
     });

     it("returns no error when all artifact contents are clean", () => {
       const config = {
         manifest: { name: "test", version: "1" },
         rules: [{ name: "r1", priority: 1, content: "clean rule" }],
         skills: [{ name: "s1", description: "d", version: 1, content: "clean skill" }],
         agents: [{ name: "a1", content: "clean agent" }],
         flags: {},
         mcp: [],
       } as never as Parameters<typeof validateConfig>[0];

       const errors = validateConfig(config);

       expect(errors.find((e) => e.code === "E_CONFLICT_MARKERS")).toBeUndefined();
     });

     it("flags markers in agent and rule content as well", () => {
       const config = {
         manifest: { name: "test", version: "1" },
         rules: [{ name: "r1", priority: 1, content: "<<<<<<< HEAD\nx\n>>>>>>> br\n" }],
         skills: [],
         agents: [{ name: "a1", content: "||||||| anc\n" }],
         flags: {},
         mcp: [],
       } as never as Parameters<typeof validateConfig>[0];

       const errors = validateConfig(config);

       const cmErrors = errors.filter((e) => e.code === "E_CONFLICT_MARKERS");
       expect(cmErrors.length).toBe(2);
       expect(cmErrors.some((e) => e.message.includes("r1"))).toBe(true);
       expect(cmErrors.some((e) => e.message.includes("a1"))).toBe(true);
     });
   });
   ```

2. Run test — expected to fail (the new behavior doesn't exist): `pnpm test tests/unit/core/config/validator.test.ts 2>&1 | tail -15`

3. Update `src/core/config/validator.ts`:
   - Add the import at the top of the file (next to existing imports):
     ```typescript
     import { findConflictMarkers } from "#src/core/hooks/conflict-markers.js";
     ```
   - Add `import { createError } from "../output/errors.js";` if not already present.
   - Inside `validateConfig`, add one line before the `return errors;` statement:
     ```typescript
       errors.push(...validateNoConflictMarkers(config));
     ```
   - Add the new helper function right after `validateConfig` (or anywhere among the other `validateXxx` helpers):
     ```typescript
     function validateNoConflictMarkers(config: NormalizedConfig): ProjectError[] {
       const errors: ProjectError[] = [];

       const scan = (kind: string, name: string, content: string): void => {
         const hits = findConflictMarkers(content);
         if (hits.length === 0) return;
         errors.push(
           createError("E_CONFLICT_MARKERS", {
             file: `${kind} "${name}"`,
             line: hits[0]!.line,
           }),
         );
       };

       for (const rule of config.rules) scan("rule", rule.name, rule.content);
       for (const skill of config.skills) scan("skill", skill.name, skill.content);
       for (const agent of config.agents) scan("agent", agent.name, agent.content);

       return errors;
     }
     ```
   - **Do not** change `validateConfig` to async. The signature remains `(config: NormalizedConfig): ProjectError[]`.

4. Verify the validator tests pass: `pnpm test tests/unit/core/config/validator.test.ts 2>&1 | tail -15`
   - Expected: all assertions pass including the three new conflict-marker cases.

**Verification**: `pnpm test tests/unit/core/config/validator.test.ts` — all passing.

---

### Task 2.5: Verify existing `validateConfig` callers still compile (no signature change)

**Files**: none modified — verification only
**Est**: 1 minute

**Design note:** Because the new `validateNoConflictMarkers` is in-memory and synchronous, the `validateConfig` signature is unchanged. The two existing callers (`src/core/config/resolver.ts:48`, `src/cli/validate.ts:37`) need no edits.

**Steps**:
1. Verify the project still compiles: `pnpm lint 2>&1 | tail -5`
   - Expected: no errors.
2. Verify existing CLI and resolver tests still pass: `pnpm test tests/unit/core/config/validator.test.ts tests/unit/cli/ 2>&1 | tail -10`
   - Expected: passing.

**Verification**: `pnpm lint` exits 0; existing tests pass.

---

### Task 2.6: Add integration test for `codi validate` with conflict markers

**Files**: `tests/integration/validate-conflict-markers.test.ts` (new)
**Est**: 5 minutes

**Steps**:
1. Create the integration test:
   ```typescript
   import { describe, it, expect, beforeEach, afterEach } from "vitest";
   import fs from "node:fs/promises";
   import path from "node:path";
   import os from "node:os";
   import { cleanupTmpDir } from "#tests/helpers/fs.js";
   import { validateHandler } from "#src/cli/validate.js";
   import { Logger } from "#src/core/output/logger.js";
   import { EXIT_CODES } from "#src/core/output/exit-codes.js";
   import { PROJECT_NAME, PROJECT_DIR, MANIFEST_FILENAME } from "#src/constants.js";

   describe("codi validate — conflict markers", () => {
     let tmp: string;

     beforeEach(async () => {
       tmp = await fs.mkdtemp(path.join(os.tmpdir(), `${PROJECT_NAME}-validate-cm-`));
       Logger.init({ level: "error", mode: "human", noColor: true });
     });

     afterEach(async () => {
       await cleanupTmpDir(tmp);
     });

     async function writeMinimalProject(skillContent: string): Promise<void> {
       const cfg = path.join(tmp, PROJECT_DIR);
       await fs.mkdir(cfg, { recursive: true });
       await fs.writeFile(path.join(cfg, MANIFEST_FILENAME), `name: test\nversion: "1"\n`);
       const skillDir = path.join(cfg, "skills", "demo");
       await fs.mkdir(skillDir, { recursive: true });
       await fs.writeFile(
         path.join(skillDir, "SKILL.md"),
         `---\nname: demo\ndescription: test\n---\n${skillContent}\n`,
       );
     }

     it("fails with CONFIG_INVALID when a skill SKILL.md contains merge markers", async () => {
       await writeMinimalProject("<<<<<<< HEAD\nold\n=======\nnew\n>>>>>>> branch\n");

       const result = await validateHandler(tmp);

       expect(result.success).toBe(false);
       expect(result.exitCode).toBe(EXIT_CODES.CONFIG_INVALID);
       expect(result.data.errors.some((e) => e.code === "E_CONFLICT_MARKERS")).toBe(true);
     });

     it("succeeds when all artifacts are clean", async () => {
       await writeMinimalProject("# Demo skill\n\nClean body content.\n");

       const result = await validateHandler(tmp);

       // Validate may still fail for other reasons (missing fields, etc.) — assert specifically
       // that there is NO conflict-marker error.
       expect(result.data.errors.find((e) => e.code === "E_CONFLICT_MARKERS")).toBeUndefined();
     });
   });
   ```
2. Run the test: `pnpm test tests/integration/validate-conflict-markers.test.ts 2>&1 | tail -15`
   - Expected: both cases pass.

**Verification**: `pnpm test tests/integration/validate-conflict-markers.test.ts` — all passing.

---

### Task 2.7: Add `CONFLICT_MARKER_CHECK_TEMPLATE` to hook-templates.ts

**Files**: `src/core/hooks/hook-templates.ts`
**Est**: 4 minutes

**Steps**:
1. Open `src/core/hooks/hook-templates.ts`.
2. Add the new export at the end of the file (after the last existing template):
   ```typescript
   /**
    * Pre-commit hook script that scans staged files for git merge-conflict markers.
    * Mirrors the detection logic in src/core/hooks/conflict-markers.ts but inlined
    * so the runtime hook script has zero Codi runtime dependency.
    */
   export const CONFLICT_MARKER_CHECK_TEMPLATE = `#!/usr/bin/env node
   // ${PROJECT_NAME_DISPLAY} conflict-marker checker
   import fs from 'fs';

   const MARKER_RE = /^(<{7}|={7}|>{7}|\\|{7})( |$)/;
   const BINARY_EXT = [
     /\\.png$/i, /\\.jpe?g$/i, /\\.gif$/i, /\\.webp$/i, /\\.ico$/i,
     /\\.pdf$/i, /\\.ttf$/i, /\\.woff2?$/i, /\\.eot$/i,
     /\\.zip$/i, /\\.tar(\\.gz)?$/i, /\\.gz$/i, /\\.7z$/i,
     /\\.mp[34]$/i, /\\.mov$/i, /\\.webm$/i,
   ];

   const files = process.argv.slice(2).filter(f => !BINARY_EXT.some(p => p.test(f)));
   const findings = [];
   for (const file of files) {
     try {
       const content = fs.readFileSync(file, 'utf-8');
       if (!MARKER_RE.test(content)) continue;
       const lines = content.split('\\n');
       for (let i = 0; i < lines.length; i++) {
         const line = lines[i] ?? '';
         const stripped = line.endsWith('\\r') ? line.slice(0, -1) : line;
         if (MARKER_RE.test(stripped)) {
           findings.push({ file, line: i + 1, text: stripped.slice(0, 80) });
         }
       }
     } catch { /* unreadable — skip */ }
   }
   if (findings.length === 0) process.exit(0);

   console.error('Git merge-conflict markers detected:');
   for (const f of findings) console.error('  ' + f.file + ':' + f.line + '  ' + f.text);
   console.error('\\nResolve the conflict, re-stage the file, and commit again. Do not bypass with --no-verify.');
   process.exit(1);
   `;
   ```
3. Verify the project still compiles: `pnpm lint 2>&1 | tail -5`
   - Expected: no errors.

**Verification**: `pnpm lint` exits 0.

---

### Task 2.8: Add the `conflict-marker-check` HookSpec to `registry/global.ts`

**Files**: `src/core/hooks/registry/global.ts`
**Est**: 2 minutes

**Steps**:
1. Open `src/core/hooks/registry/global.ts`.
2. Add a new `HookSpec` to the `GLOBAL_HOOKS` array. Place it BEFORE `gitleaks` (since the conflict-marker check is the cheapest and should run first):
   ```typescript
     {
       name: "conflict-marker-check",
       language: "global",
       category: "meta",
       files: "**/*",
       stages: ["pre-commit"],
       required: true,
       shell: {
         command: `node .git/hooks/${PROJECT_NAME}-conflict-marker-check.mjs`,
         passFiles: true,
         modifiesFiles: false,
         toolBinary: "node",
       },
       preCommit: {
         kind: "local",
         entry: `node .git/hooks/${PROJECT_NAME}-conflict-marker-check.mjs`,
         language: "system",
       },
       installHint: { command: "" },
     },
   ```
3. Verify the project compiles: `pnpm lint 2>&1 | tail -5`
   - Expected: no errors.

**Verification**: `pnpm lint` exits 0.

---

### Task 2.9: Wire `conflict-marker-check` into hook-config-generator Stage-1

**Files**: `src/core/hooks/hook-config-generator.ts`, `tests/unit/hooks/hook-config-generator.test.ts`
**Est**: 4 minutes

**Steps**:
1. Add a failing test to `tests/unit/hooks/hook-config-generator.test.ts` (append at the end of the existing top-level `describe` block):
   ```typescript
     it("includes conflict-marker-check in Stage-1 hooks", () => {
       const cfg = generateHooksConfig({}, [], undefined);
       const names = cfg.hooks.map((h) => h.name);
       expect(names).toContain("conflict-marker-check");
       // It must run before gitleaks (cheaper instant check first)
       const cmIdx = names.indexOf("conflict-marker-check");
       const gitleaksIdx = names.indexOf("gitleaks");
       if (gitleaksIdx >= 0) {
         expect(cmIdx).toBeLessThan(gitleaksIdx);
       }
     });
   ```
2. Run test — expected to fail: `pnpm test tests/unit/hooks/hook-config-generator.test.ts 2>&1 | tail -10`

3. Open `src/core/hooks/hook-config-generator.ts` and locate the Stage-1 block (around line 144). Add the new `metaHook` call AFTER `staged-junk-check` and BEFORE `file-size-check`:

   **Insert right after the existing `staged-junk-check` block (around line 148):**
   ```typescript
     allHooks.push(
       metaHook({
         name: "conflict-marker-check",
         entry: `node .git/hooks/${PROJECT_NAME}-conflict-marker-check.mjs`,
         files: "**/*",
         category: "meta",
       }),
     );
   ```

4. Verify tests pass: `pnpm test tests/unit/hooks/hook-config-generator.test.ts 2>&1 | tail -10`
   - Expected: new assertion passes; existing tests unchanged.

**Verification**: `pnpm test tests/unit/hooks/hook-config-generator.test.ts` — all passing.

---

### Task 2.10: Wire conflict-marker template emission into hook-installer

**Files**: `src/core/hooks/hook-installer.ts`
**Est**: 3 minutes

**Steps**:
1. Open `src/core/hooks/hook-installer.ts`.
2. Add the import for the new template (at the top, alongside the other hook-template imports):
   ```typescript
   import { CONFLICT_MARKER_CHECK_TEMPLATE } from "./hook-templates.js";
   ```
   (If `hook-templates.ts` is imported as a barrel, add `CONFLICT_MARKER_CHECK_TEMPLATE` to the existing destructured import list instead.)

3. Add a new field to the `InstallOptions` interface (around line 53):
   ```typescript
     conflictMarkerCheck?: boolean;
   ```
   Place it next to the other meta-check flags (e.g., near `stagedJunkCheck`).

4. Inside `writeAuxiliaryScripts`, add a new conditional block after the `stagedJunkCheck` block:
   ```typescript
     if (options.conflictMarkerCheck) {
       const cmPath = path.join(hookDir, `${PROJECT_NAME}-conflict-marker-check.mjs`);
       await fs.writeFile(cmPath, CONFLICT_MARKER_CHECK_TEMPLATE, {
         encoding: "utf-8",
         mode: 0o755,
       });
       files.push(path.relative(options.projectRoot, cmPath));
     }
   ```

5. Update `src/cli/init.ts` and any other call sites of `installHooks` to pass `conflictMarkerCheck: true`. To find call sites:
   ```bash
   grep -rn "installHooks(" src/cli/ src/core/
   ```
   For each call site that constructs `InstallOptions` (typically `init.ts` and `generate.ts`), add `conflictMarkerCheck: true,` to the object literal next to `stagedJunkCheck`. The expected call sites are:
   - `src/cli/init.ts` (around the `installHooks({ ... })` call near line 620; passes a `hooksConfig`-derived options object)
   - `src/cli/generate.ts` (similar pattern if hooks are regenerated there)

   Concretely, look for the place that does `stagedJunkCheck: hooksConfig.stagedJunkCheck,` and add the line below it:
   ```typescript
   conflictMarkerCheck: hooksConfig.conflictMarkerCheck,
   ```

6. Update `src/core/hooks/hook-config-generator.ts` `HooksConfig` interface (around line 8) to include the new field, and ensure `generateHooksConfig` always sets it to `true`:
   - Add to the interface:
     ```typescript
       conflictMarkerCheck: boolean;
     ```
   - In the `return` statement of `generateHooksConfig`, add:
     ```typescript
       conflictMarkerCheck: true,
     ```
     (Place it next to `stagedJunkCheck: true,`.)

7. Verify everything compiles: `pnpm lint 2>&1 | tail -10`
   - Expected: no errors.

**Verification**: `pnpm lint` exits 0.

---

### Task 2.11: Add hook-installer test asserting the conflict-marker script is written

**Files**: `tests/unit/hooks/hook-installer.test.ts`
**Est**: 3 minutes

**Steps**:
1. Append a new test to `tests/unit/hooks/hook-installer.test.ts` (inside the existing `describe("installHooks", ...)` block):
   ```typescript
     it("writes codi-conflict-marker-check.mjs when conflictMarkerCheck is true", async () => {
       const result = await installHooks(
         baseOptions({ runner: "none", conflictMarkerCheck: true }),
       );
       expect(result.ok).toBe(true);
       const scriptPath = path.join(tmpDir, ".git", "hooks", `${PROJECT_NAME}-conflict-marker-check.mjs`);
       const stat = await fs.stat(scriptPath);
       expect(stat.isFile()).toBe(true);
       const content = await fs.readFile(scriptPath, "utf-8");
       expect(content).toMatch(/MARKER_RE = \/\^\(<\{7}/);
       expect(content).toMatch(/Git merge-conflict markers detected/);
     });
   ```
2. Run test: `pnpm test tests/unit/hooks/hook-installer.test.ts 2>&1 | tail -10`
   - Expected: passing.

**Verification**: `pnpm test tests/unit/hooks/hook-installer.test.ts` — all passing.

---

### Task 2.12: Add integration test for the conflict-marker pre-commit hook

**Files**: `tests/integration/hook-conflict-markers.test.ts` (new)
**Est**: 5 minutes

**Steps**:
1. Create the integration test:
   ```typescript
   import { describe, it, expect, beforeEach, afterEach } from "vitest";
   import fs from "node:fs/promises";
   import path from "node:path";
   import os from "node:os";
   import { spawnSync } from "node:child_process";
   import { cleanupTmpDir } from "#tests/helpers/fs.js";
   import { CONFLICT_MARKER_CHECK_TEMPLATE } from "#src/core/hooks/hook-templates.js";

   describe("conflict-marker hook script", () => {
     let tmp: string;

     beforeEach(async () => {
       tmp = await fs.mkdtemp(path.join(os.tmpdir(), "codi-cm-hook-"));
       const scriptPath = path.join(tmp, "check.mjs");
       await fs.writeFile(scriptPath, CONFLICT_MARKER_CHECK_TEMPLATE, "utf-8");
       await fs.chmod(scriptPath, 0o755);
     });

     afterEach(async () => {
       await cleanupTmpDir(tmp);
     });

     async function runScript(files: string[]): Promise<{ status: number; stderr: string }> {
       const scriptPath = path.join(tmp, "check.mjs");
       const result = spawnSync(process.execPath, [scriptPath, ...files], {
         encoding: "utf-8",
       });
       return { status: result.status ?? -1, stderr: result.stderr ?? "" };
     }

     it("exits 0 when no files have markers", async () => {
       const cleanFile = path.join(tmp, "clean.txt");
       await fs.writeFile(cleanFile, "hello world\n");
       const { status } = await runScript([cleanFile]);
       expect(status).toBe(0);
     });

     it("exits 1 when a staged file contains a marker", async () => {
       const dirty = path.join(tmp, "dirty.md");
       await fs.writeFile(dirty, "intro\n<<<<<<< HEAD\nA\n=======\nB\n>>>>>>> br\n");
       const { status, stderr } = await runScript([dirty]);
       expect(status).toBe(1);
       expect(stderr).toContain("Git merge-conflict markers detected");
       expect(stderr).toMatch(/dirty\.md:2/);
     });

     it("skips binary file extensions", async () => {
       const png = path.join(tmp, "image.png");
       // bytes that include the marker pattern but file is .png — should be skipped
       await fs.writeFile(png, "<<<<<<< HEAD\n");
       const { status } = await runScript([png]);
       expect(status).toBe(0);
     });

     it("detects 3-way diff3 ||||||| markers", async () => {
       const f = path.join(tmp, "diff3.txt");
       await fs.writeFile(f, "<<<<<<< HEAD\nours\n||||||| anc\nbase\n=======\ntheirs\n>>>>>>> br\n");
       const { status, stderr } = await runScript([f]);
       expect(status).toBe(1);
       expect(stderr).toMatch(/diff3\.txt/);
     });
   });
   ```
2. Run test: `pnpm test tests/integration/hook-conflict-markers.test.ts 2>&1 | tail -15`
   - Expected: all four cases pass.

**Verification**: `pnpm test tests/integration/hook-conflict-markers.test.ts` — all passing.

---

### Task 2.13: Run full test sweep and commit

**Files**: all changes from Tasks 2.1-2.12
**Est**: 3 minutes

**Steps**:
1. Run full test suite: `pnpm test 2>&1 | tail -15`
   - Expected: all tests pass.
2. Run lint: `pnpm lint 2>&1 | tail -5`
   - Expected: no errors.
3. Stage and commit:
   ```bash
   git add src/core/hooks/conflict-markers.ts \
           src/core/hooks/hook-templates.ts \
           src/core/hooks/registry/global.ts \
           src/core/hooks/hook-config-generator.ts \
           src/core/hooks/hook-installer.ts \
           src/core/output/error-catalog.ts \
           src/core/config/validator.ts \
           src/cli/init.ts \
           src/cli/generate.ts \
           tests/unit/hooks/conflict-markers.test.ts \
           tests/unit/hooks/hook-installer.test.ts \
           tests/unit/hooks/hook-config-generator.test.ts \
           tests/unit/core/config/validator.test.ts \
           tests/integration/validate-conflict-markers.test.ts \
           tests/integration/hook-conflict-markers.test.ts
   git commit -m "feat(hooks): conflict-marker detection in validate and pre-commit"
   ```
   (`init.ts` and `generate.ts` are listed for the `conflictMarkerCheck: true` wiring from Task 2.10. If `generate.ts` doesn't have an `installHooks(...)` call site, drop it.)

**Verification**: `git log -1 --stat` shows the commit; `pnpm test` clean.

---

## Commit 3 — Batched Install Hints and `codi doctor --hooks`

> **Scope:** Delta C from spec. `inferPackageManager` + grouping in `hook-dep-installer.ts`; `--hooks` flag on `codi doctor` with table renderer and JSON mode.

### Task 3.1: Add unit tests for package-manager inference

**Files**: `tests/unit/hooks/hook-dep-installer.test.ts` (existing; extend)
**Est**: 4 minutes

**Steps**:
1. Open `tests/unit/hooks/hook-dep-installer.test.ts` (or create it if it doesn't exist) and append:
   ```typescript
   import { describe, it, expect } from "vitest";
   import {
     inferPackageManager,
     extractPackagesFromHint,
     groupByPackageManager,
   } from "#src/core/hooks/hook-dep-installer.js";
   import type { DependencyCheck } from "#src/core/hooks/hook-dependency-checker.js";

   describe("inferPackageManager", () => {
     it("recognizes pip / pip3", () => {
       expect(inferPackageManager("pip install ruff")).toBe("pip");
       expect(inferPackageManager("pip3 install ruff")).toBe("pip");
     });
     it("recognizes brew", () => {
       expect(inferPackageManager("brew install gitleaks")).toBe("brew");
     });
     it("recognizes gem", () => {
       expect(inferPackageManager("gem install rubocop")).toBe("gem");
     });
     it("recognizes go install", () => {
       expect(inferPackageManager("go install github.com/x/y@latest")).toBe("go");
     });
     it("recognizes cargo install", () => {
       expect(inferPackageManager("cargo install x")).toBe("cargo");
     });
     it("recognizes rustup component add as a separate manager", () => {
       expect(inferPackageManager("rustup component add clippy")).toBe("rustup");
     });
     it("returns manual for unknown hints", () => {
       expect(inferPackageManager("Install .NET SDK from https://dot.net")).toBe("manual");
       expect(inferPackageManager("")).toBe("manual");
     });
     it("ignores leading whitespace", () => {
       expect(inferPackageManager("  pip install x")).toBe("pip");
     });
   });

   describe("extractPackagesFromHint", () => {
     it("returns empty array for manual", () => {
       expect(extractPackagesFromHint("Install .NET SDK from https://dot.net", "manual")).toEqual([]);
     });
     it("extracts a single pip package", () => {
       expect(extractPackagesFromHint("pip install ruff", "pip")).toEqual(["ruff"]);
     });
     it("extracts multiple brew packages", () => {
       expect(extractPackagesFromHint("brew install gitleaks clang-format", "brew")).toEqual([
         "gitleaks",
         "clang-format",
       ]);
     });
     it("extracts a go package", () => {
       expect(extractPackagesFromHint("go install github.com/x/y@latest", "go")).toEqual([
         "github.com/x/y@latest",
       ]);
     });
   });

   describe("groupByPackageManager — non-npm batching", () => {
     const dep = (name: string, hint: string): DependencyCheck => ({
       name,
       available: false,
       installHint: hint,
       isNodePackage: false,
     });

     it("batches multiple brew tools into one group", () => {
       const groups = groupByPackageManager([
         dep("gitleaks", "brew install gitleaks"),
         dep("clang-format", "brew install clang-format"),
       ]);
       const brew = groups.find((g) => g.label.startsWith("brew install"));
       expect(brew).toBeDefined();
       expect(brew!.deps.length).toBe(2);
       expect(brew!.label).toBe("brew install gitleaks clang-format");
     });

     it("keeps unknown hints as separate manual entries", () => {
       const groups = groupByPackageManager([
         dep("dotnet", "Install .NET SDK from https://dot.net"),
       ]);
       const manual = groups.filter((g) => g.deps[0]?.name === "dotnet");
       expect(manual.length).toBe(1);
     });

     it("emits separate groups per package manager", () => {
       const groups = groupByPackageManager([
         dep("ruff", "pip install ruff"),
         dep("gitleaks", "brew install gitleaks"),
         dep("rubocop", "gem install rubocop"),
       ]);
       expect(groups.find((g) => g.label === "pip install ruff")).toBeDefined();
       expect(groups.find((g) => g.label === "brew install gitleaks")).toBeDefined();
       expect(groups.find((g) => g.label === "gem install rubocop")).toBeDefined();
     });

     it("keeps cargo install and rustup component add in separate groups", () => {
       const groups = groupByPackageManager([
         dep("foo", "cargo install foo"),
         dep("clippy", "rustup component add clippy"),
       ]);
       const cargo = groups.find((g) => g.label.startsWith("cargo install"));
       const rustup = groups.find((g) => g.label.startsWith("rustup component add"));
       expect(cargo).toBeDefined();
       expect(rustup).toBeDefined();
       expect(cargo!.label).toBe("cargo install foo");
       expect(rustup!.label).toBe("rustup component add clippy");
     });
   });
   ```
2. Run tests — expected to fail (functions don't exist yet): `pnpm test tests/unit/hooks/hook-dep-installer.test.ts 2>&1 | tail -15`

**Verification**: tests fail referencing missing exports `inferPackageManager` / `extractPackagesFromHint`.

---

### Task 3.2: Implement `inferPackageManager`, `extractPackagesFromHint`, and refactor `groupByPackageManager`

**Files**: `src/core/hooks/hook-dep-installer.ts`
**Est**: 5 minutes

**Steps**:
1. Open `src/core/hooks/hook-dep-installer.ts`.
2. Add the new exports near the top of the file, after the existing `InstallGroup` interface:
   ```typescript
   export type PackageManager = "npm" | "pip" | "brew" | "gem" | "go" | "cargo" | "rustup" | "manual";

   /**
    * Infer the package manager from an installHint command string.
    * Returns "manual" for hints that don't match a known prefix.
    *
    * Note: cargo and rustup are kept separate because their command surfaces
    * are not interchangeable (rustup components are not crates).
    */
   export function inferPackageManager(installHint: string): PackageManager {
     const trimmed = installHint.trimStart();
     if (trimmed.startsWith("pip install ") || trimmed.startsWith("pip3 install ")) return "pip";
     if (trimmed.startsWith("brew install ")) return "brew";
     if (trimmed.startsWith("gem install ")) return "gem";
     if (trimmed.startsWith("go install ")) return "go";
     if (trimmed.startsWith("cargo install ")) return "cargo";
     if (trimmed.startsWith("rustup component add ")) return "rustup";
     return "manual";
   }

   /**
    * Extract package names from an installHint given its inferred manager.
    * Returns empty array when the manager is "manual" or the hint is malformed.
    */
   export function extractPackagesFromHint(installHint: string, pm: PackageManager): string[] {
     if (pm === "manual") return [];
     const trimmed = installHint.trimStart();
     const prefixes: Record<Exclude<PackageManager, "manual" | "npm">, string[]> = {
       pip: ["pip install ", "pip3 install "],
       brew: ["brew install "],
       gem: ["gem install "],
       go: ["go install "],
       cargo: ["cargo install "],
       rustup: ["rustup component add "],
     };
     const list = prefixes[pm as Exclude<PackageManager, "manual" | "npm">] ?? [];
     for (const p of list) {
       if (trimmed.startsWith(p)) {
         return trimmed.slice(p.length).split(/\s+/).filter(Boolean);
       }
     }
     return [];
   }
   ```
3. Replace the existing `groupByPackageManager` function with the batched version:

   **Before:**
   ```typescript
   function groupByPackageManager(deps: DependencyCheck[]): InstallGroup[] {
     const npmDeps = deps.filter((d) => d.isNodePackage);
     const otherDeps = deps.filter((d) => !d.isNodePackage);

     const groups: InstallGroup[] = [];

     if (npmDeps.length > 0) {
       const packages = npmDeps.map((d) => {
         if (d.name === "tsc") return "typescript";
         return d.name;
       });
       groups.push({
         label: `npm install -D ${packages.join(" ")}`,
         command: "npm",
         args: ["install", "-D", ...packages],
         deps: npmDeps,
       });
     }

     for (const dep of otherDeps) {
       groups.push({
         label: dep.installHint,
         command: "",
         args: [],
         deps: [dep],
       });
     }

     return groups;
   }
   ```

   **After:**
   ```typescript
   export function groupByPackageManager(deps: DependencyCheck[]): InstallGroup[] {
     const npmDeps = deps.filter((d) => d.isNodePackage);
     const otherDeps = deps.filter((d) => !d.isNodePackage);

     const groups: InstallGroup[] = [];

     if (npmDeps.length > 0) {
       const packages = npmDeps.map((d) => (d.name === "tsc" ? "typescript" : d.name));
       groups.push({
         label: `npm install -D ${packages.join(" ")}`,
         command: "npm",
         args: ["install", "-D", ...packages],
         deps: npmDeps,
       });
     }

     // Group non-npm deps by inferred package manager
     const byPm = new Map<PackageManager, DependencyCheck[]>();
     for (const dep of otherDeps) {
       const pm = inferPackageManager(dep.installHint);
       const list = byPm.get(pm) ?? [];
       list.push(dep);
       byPm.set(pm, list);
     }

     for (const [pm, batchDeps] of byPm.entries()) {
       if (pm === "manual") {
         // Each manual hint stays as its own entry
         for (const dep of batchDeps) {
           groups.push({ label: dep.installHint, command: "", args: [], deps: [dep] });
         }
         continue;
       }
       const allPackages = batchDeps.flatMap((d) => extractPackagesFromHint(d.installHint, pm));
       const prefix =
         pm === "pip" ? "pip install"
         : pm === "brew" ? "brew install"
         : pm === "gem" ? "gem install"
         : pm === "go" ? "go install"
         : pm === "cargo" ? "cargo install"
         : "rustup component add"; // pm === "rustup"
       groups.push({
         label: `${prefix} ${allPackages.join(" ")}`,
         command: "",
         args: [],
         deps: batchDeps,
       });
     }

     return groups;
   }
   ```
4. Verify lint and tests pass: `pnpm lint 2>&1 | tail -5 && pnpm test tests/unit/hooks/hook-dep-installer.test.ts 2>&1 | tail -10`
   - Expected: no lint errors; all dep-installer tests pass.

**Verification**: `pnpm test tests/unit/hooks/hook-dep-installer.test.ts` — all passing.

---

### Task 3.3: Add unit test for `doctor --hooks` flag

**Files**: `tests/unit/cli/doctor.test.ts`
**Est**: 4 minutes

**Steps**:
1. Append to `tests/unit/cli/doctor.test.ts` (inside the existing `describe` block):
   ```typescript
   describe("doctor --hooks", () => {
     it("returns 0 and lists hook tool diagnostics when configured project is healthy", async () => {
       const configDir = path.join(tmpDir, PROJECT_DIR);
       await fs.mkdir(configDir, { recursive: true });
       await fs.writeFile(path.join(configDir, MANIFEST_FILENAME), `name: test\nversion: "1"\n`);

       const result = await doctorHandler(tmpDir, { hooks: true });

       expect(result.success).toBeTypeOf("boolean");
       expect(result.data).toHaveProperty("hookDiagnostics");
       // Either 0 (all tools present) or DOCTOR_FAILED (something missing) — but never crash
       expect([EXIT_CODES.SUCCESS, EXIT_CODES.DOCTOR_FAILED]).toContain(result.exitCode);
     });

     it("returns the hook diagnostics array via JSON output", async () => {
       const configDir = path.join(tmpDir, PROJECT_DIR);
       await fs.mkdir(configDir, { recursive: true });
       await fs.writeFile(path.join(configDir, MANIFEST_FILENAME), `name: test\nversion: "1"\n`);

       const result = await doctorHandler(tmpDir, { hooks: true, ci: true });

       expect(Array.isArray(result.data.hookDiagnostics)).toBe(true);
       // Each diagnostic must have name + status fields
       for (const d of result.data.hookDiagnostics ?? []) {
         expect(typeof d.name).toBe("string");
         expect(["ok", "warning", "error"]).toContain(d.severity);
       }
     });

     it("handles a project without hooks installed gracefully", async () => {
       // No .codi config at all
       const result = await doctorHandler(tmpDir, { hooks: true });
       // Either succeeds with empty list or fails CONFIG_NOT_FOUND — both acceptable
       expect(result.exitCode).toBeTypeOf("number");
       expect(result.data).toHaveProperty("hookDiagnostics");
     });
   });
   ```
2. Run test — expected to fail (the `hooks` option isn't supported yet): `pnpm test tests/unit/cli/doctor.test.ts 2>&1 | tail -15`

**Verification**: tests fail referencing the missing `hooks` option or `hookDiagnostics` field.

---

### Task 3.4: Implement `--hooks` flag and table renderer in `cli/doctor.ts`

**Files**: `src/cli/doctor.ts`
**Est**: 6 minutes

**Steps**:
1. Open `src/cli/doctor.ts`.
2. Add the imports at the top (next to the existing core/hooks imports):
   ```typescript
   import { generateHooksConfig } from "../core/hooks/hook-config-generator.js";
   import { checkHookDependencies } from "../core/hooks/hook-dependency-checker.js";
   import type { DependencyDiagnostic } from "../core/hooks/hook-dependency-checker.js";
   import { detectStack } from "../core/hooks/stack-detector.js";
   ```
3. Update the `DoctorOptions` interface to include the new flag:
   ```typescript
   interface DoctorOptions extends GlobalOptions {
     ci?: boolean;
     hooks?: boolean;
   }
   ```
4. Update the `DoctorData` interface to optionally include hook diagnostics:
   ```typescript
   interface DoctorData {
     results: Array<{ check: string; passed: boolean; message: string }>;
     allPassed: boolean;
     hookDiagnostics?: DependencyDiagnostic[];
   }
   ```
5. Inside `doctorHandler`, BEFORE the existing `runAllChecks` call, add a branch that handles `--hooks` mode:
   ```typescript
     if (options.hooks) {
       return await doctorHooks(projectRoot, options);
     }
   ```
6. Add the new `doctorHooks` function (place it AFTER the existing `doctorHandler` function or before the `registerDoctorCommand` call):
   ```typescript
   async function doctorHooks(
     projectRoot: string,
     options: DoctorOptions,
   ): Promise<CommandResult<DoctorData>> {
     const cfgResult = await resolveConfig(projectRoot);
     if (!cfgResult.ok) {
       return createCommandResult({
         success: false,
         command: "doctor",
         data: { results: [], allPassed: false, hookDiagnostics: [] },
         errors: cfgResult.errors,
         exitCode: EXIT_CODES.DOCTOR_FAILED,
       });
     }
     const config = cfgResult.data;

     // Detect installed languages from project files (mirrors codi init)
     const stack = await detectStack(projectRoot);
     const hooksConfig = generateHooksConfig(config.flags, stack, config.manifest);
     const diagnostics = await checkHookDependencies(hooksConfig.hooks, projectRoot);

     // Render table to stderr (so JSON mode keeps stdout clean for piping)
     if (!options.ci) {
       renderHookDiagnosticsTable(diagnostics);
     }

     const requiredMissing = diagnostics.some(
       (d) => d.severity === "error" && d.found === false,
     );

     return createCommandResult({
       success: !requiredMissing,
       command: "doctor",
       data: {
         results: [],
         allPassed: !requiredMissing,
         hookDiagnostics: diagnostics,
       },
       exitCode: requiredMissing ? EXIT_CODES.DOCTOR_FAILED : EXIT_CODES.SUCCESS,
     });
   }

   function renderHookDiagnosticsTable(diagnostics: DependencyDiagnostic[]): void {
     if (diagnostics.length === 0) {
       Logger.getInstance().info("No hooks configured for this project.");
       return;
     }
     const log = Logger.getInstance();
     log.info("Hook dependencies for current configuration:");
     log.info("");
     for (const d of diagnostics) {
       const status =
         d.severity === "ok" ? "ok     "
         : d.severity === "warning" ? "warning"
         : "error  ";
       const location = d.found
         ? d.resolvedPath ?? "(found)"
         : `missing — ${d.installHint?.command ?? "install manually"}`;
       log.info(`  ${status}  ${d.name.padEnd(16)}  ${(d.category ?? "").padEnd(10)}  ${location}`);
     }
     log.info("");
   }
   ```
   Note: `Logger.getInstance()` is the existing pattern used at `src/cli/doctor.ts:107` (verified before plan write).

7. Update `registerDoctorCommand` (at the end of the file) to add the `--hooks` option:
   ```typescript
       .option("--hooks", "Show per-hook tool availability diagnostics")
   ```
   Insert this next to the existing `.option("--ci", ...)` line.

8. Verify everything compiles and tests pass: `pnpm lint 2>&1 | tail -5 && pnpm test tests/unit/cli/doctor.test.ts 2>&1 | tail -15`
   - Expected: no lint errors; all doctor tests pass.

**Verification**: `pnpm test tests/unit/cli/doctor.test.ts` — all passing.

---

### Task 3.5: Run full test sweep and commit

**Files**: all changes from Tasks 3.1-3.4
**Est**: 3 minutes

**Steps**:
1. Run the full suite: `pnpm test 2>&1 | tail -15`
   - Expected: all tests pass.
2. Run lint: `pnpm lint 2>&1 | tail -5`
   - Expected: no errors.
3. Stage and commit:
   ```bash
   git add src/core/hooks/hook-dep-installer.ts \
           src/cli/doctor.ts \
           tests/unit/hooks/hook-dep-installer.test.ts \
           tests/unit/cli/doctor.test.ts
   git commit -m "feat(hooks): batched install hints and codi doctor --hooks"
   ```

**Verification**: `git log --oneline -3` shows the three commits in order; `pnpm test` clean.

---

## Post-flight

### Task PF.1: Update CHANGELOG.md

**Files**: `CHANGELOG.md`
**Est**: 2 minutes

**Steps**:
1. Open `CHANGELOG.md` and add a new entry under the `## [Unreleased]` section (or create one):
   ```markdown
   ### Added
   - Single source of truth for vendored-dir exclusions (`src/core/hooks/exclusions.ts`) consumed by both the YAML renderer and the file-size check template.
   - Conflict-marker detection in `codi validate` for installed `.codi/` artifacts.
   - New global pre-commit hook `conflict-marker-check` that blocks commits containing git merge markers.
   - `codi doctor --hooks` mode for inspecting per-hook tool availability with install hints.
   - Batched install hints in `installMissingDeps`: missing pip/brew/gem/go/cargo tools are grouped into single commands.

   ### Fixed
   - Per-language pre-commit hooks no longer lint vendored content in `.agents/`, `.claude/`, `.codex/`, `.cursor/`, `.windsurf/`, `.cline/` (was already working for `.codi/`).
   ```
2. Stage and commit:
   ```bash
   git add CHANGELOG.md
   git commit -m "docs(changelog): hook gap fixes (vendored exclusions, conflict markers, doctor --hooks)"
   ```

**Verification**: `git log --oneline -4` shows four commits.

---

### Task PF.2: Open the pull request

**Files**: none (git/gh operation)
**Est**: 1 minute

**Steps**:
1. Push the branch:
   ```bash
   git push -u origin feat/hook-gap-fixes
   ```
2. Open the PR with conventional title and full body:
   ```bash
   gh pr create --base develop --title "feat(hooks): vendored-exclude SSoT, conflict-marker detection, and doctor --hooks" --body "$(cat <<'EOF'
   ## Summary
   - Centralizes the vendored-dirs list into `src/core/hooks/exclusions.ts` consumed by both `yaml-renderer.ts` and `FILE_SIZE_CHECK_TEMPLATE`. Adds the six missing agent dirs (`.agents`, `.claude`, `.codex`, `.cursor`, `.windsurf`, `.cline`).
   - Adds conflict-marker detection in `codi validate` and a new global pre-commit hook `conflict-marker-check`. Both consume `src/core/hooks/conflict-markers.ts`.
   - Batches non-npm install hints by inferred package manager (pip/brew/gem/go/cargo) and adds `codi doctor --hooks` for on-demand tool diagnostics.

   ## Spec
   - Spec: `docs/20260429_1500_SPEC_hook-gap-fixes.md`
   - Plan: `docs/20260429_1530_PLAN_hook-gap-fixes-impl.md`

   ## Test plan
   - [ ] `pnpm test` — all unit and integration tests pass
   - [ ] `pnpm lint` — clean
   - [ ] Manual: `codi validate` against a fixture skill containing `<<<<<<<` markers exits non-zero with `E_CONFLICT_MARKERS`
   - [ ] Manual: `codi doctor --hooks` prints the diagnostics table and exits non-zero when a required hook tool is missing
   EOF
   )"
   ```
3. Confirm PR URL is printed.

**Verification**: PR is open against `develop`; CI begins running.

---

## Summary

**13 implementation tasks** across three commits, plus 2 post-flight tasks:

| Commit | Tasks | LOC | Files touched |
|---|---|---|---|
| 1 — Vendored exclusions SSoT | 1.1-1.7 | ~120 | 4 source + 3 tests |
| 2 — Conflict-marker detection | 2.1-2.13 | ~250 | 8 source + 4 tests |
| 3 — Install hints + doctor --hooks | 3.1-3.5 | ~150 | 2 source + 2 tests |

Total estimated time: 50-75 minutes for an experienced engineer (longer with full TDD discipline). All tasks are atomic, runnable, and verifiable. Each commit lands the codebase in a working state.

**Execution note:** This plan uses TDD strictly — tests are written before implementations, verified to fail, then made to pass. Do not skip the "verify test fails" step; it confirms the test actually exercises the new behavior.
