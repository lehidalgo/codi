# Pre-commit Multi-Language Redesign Implementation Plan

> **For agentic workers:** Use `codi-plan-execution` to implement this plan task-by-task. That skill asks the user to pick INLINE (sequential) or SUBAGENT (fresh subagent per task with two-stage review) mode. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign Codi's pre-commit hook installation so multi-language repos work cleanly: fix the YAML insertion bug, switch to canonical upstream pre-commit repos with pinned revs, add hybrid auto-detection with visible override, defer type-checking and tests to pre-push by default, add commitlint, ensure idempotent regeneration via YAML AST round-trip.

**Architecture:** Three layers — detection (`auto-detection.ts`), spec building (`hook-registry.ts`), rendering (`renderers/yaml-renderer.ts` + `renderers/shell-renderer.ts`). Two supporting modules (`yaml-document.ts`, `legacy-cleanup.ts`). New `HookSpec` shape with explicit per-runner emission descriptors. YAML emission via `eemeli/yaml` AST round-trip, identifying Codi entries by `# managed by codi` comment marker.

**Tech Stack:** TypeScript (strict, ESM, `moduleResolution: "NodeNext"`, path alias `#src/*`), vitest, `yaml` package (eemeli/yaml v2.x), pnpm.

**Spec reference:** `docs/20260428_1430_SPEC_precommit-multilanguage-redesign.md`

**Branch:** `feat/precommit-multilanguage-redesign` → PR to `develop`

---

## Pre-flight

### Task P.1: Create feature branch

**Files**: none
**Est**: 1 minute

**Steps**:
1. Confirm clean working tree: `git status` — expected: nothing to commit (any unrelated WIP must be stashed first)
2. Create branch from develop: `git checkout develop && git pull origin develop && git checkout -b feat/precommit-multilanguage-redesign`
3. Verify: `git rev-parse --abbrev-ref HEAD` — expected: `feat/precommit-multilanguage-redesign`

**Verification**: `git status` clean on the new branch.

---

## Commit 1 — Hotfix: lock first list indent in `findReposInsertionPoint`

This commit ships a standalone fix for the C1 bug. It uses the existing text-based code path; the redesign supersedes it in commit 6.

### Task 1.1: Add unit test file with the failing C1 case

**Files**: `tests/unit/hooks/pre-commit-framework.test.ts` (new)
**Est**: 4 minutes

**Steps**:
1. Create the test file with the failing case:
   ```typescript
   import { describe, it, expect } from 'vitest';
   import {
     findReposInsertionPoint,
     renderPreCommitBlock,
     stripPreCommitGeneratedBlock,
   } from '#src/core/hooks/pre-commit-framework.js';

   describe('findReposInsertionPoint', () => {
     it('returns null when repos: key is missing', () => {
       const lines = ['default_stages: [pre-commit]'];
       expect(findReposInsertionPoint(lines)).toBeNull();
     });

     it('handles empty repos: list', () => {
       const lines = ['repos:'];
       const result = findReposInsertionPoint(lines);
       expect(result).toEqual({ insertAt: 1, listIndent: '  ' });
     });

     it('keeps two-space indent for a single top-level repo with no nested hooks', () => {
       const lines = [
         'repos:',
         '  - repo: https://github.com/external/tool',
         '    rev: v1.0.0',
       ];
       const result = findReposInsertionPoint(lines);
       expect(result).toEqual({ insertAt: 3, listIndent: '  ' });
     });

     it('does NOT use nested hook indent when external repo has nested hooks (C1 regression)', () => {
       // The C1 bug: previously this returned listIndent = "      " (6 spaces),
       // which inserted the Codi block INSIDE the external repo's hooks: list.
       const lines = [
         'repos:',
         '  - repo: https://github.com/external/tool',
         '    rev: v1.0.0',
         '    hooks:',
         '      - id: existing-hook-1',
         '      - id: existing-hook-2',
       ];
       const result = findReposInsertionPoint(lines);
       expect(result).not.toBeNull();
       expect(result!.listIndent).toBe('  ');
       expect(result!.insertAt).toBe(6);
     });

     it('preserves first-seen indent across multiple sibling repos at varied indent', () => {
       const lines = [
         'repos:',
         '  - repo: https://github.com/a/a',
         '    rev: v1',
         '    hooks:',
         '      - id: a-hook',
         '  - repo: https://github.com/b/b',
         '    rev: v2',
       ];
       const result = findReposInsertionPoint(lines);
       expect(result!.listIndent).toBe('  ');
       expect(result!.insertAt).toBe(7);
     });

     it('stops scanning at next root-level key', () => {
       const lines = [
         'repos:',
         '  - repo: https://github.com/a/a',
         '    rev: v1',
         'default_stages: [pre-commit]',
       ];
       const result = findReposInsertionPoint(lines);
       expect(result!.insertAt).toBe(3);
     });

     it('skips blank lines and comments inside the block', () => {
       const lines = [
         'repos:',
         '',
         '  # external tool',
         '  - repo: https://github.com/a/a',
         '    rev: v1',
         '',
       ];
       const result = findReposInsertionPoint(lines);
       expect(result!.insertAt).toBe(5);
     });
   });
   ```
2. Verify the test fails: `pnpm test tests/unit/hooks/pre-commit-framework.test.ts` — expected: the C1 regression test fails (current code returns `listIndent = "      "`).

**Verification**: at least one failing test confirming the C1 bug.

### Task 1.2: Fix `findReposInsertionPoint` to lock first list indent

**Files**: `src/core/hooks/pre-commit-framework.ts`
**Est**: 3 minutes

**Steps**:
1. Replace the body of `findReposInsertionPoint` with:
   ```typescript
   export function findReposInsertionPoint(
     lines: string[],
   ): { insertAt: number; listIndent: string } | null {
     const reposIdx = lines.findIndex((l) => /^repos\s*:\s*$/.test(l));
     if (reposIdx === -1) return null;

     let listIndent: string | null = null;
     let lastMemberIdx = reposIdx;

     for (let i = reposIdx + 1; i < lines.length; i++) {
       const line = lines[i]!;
       if (line === '' || /^\s*#/.test(line)) continue;
       if (/^[A-Za-z_][\w-]*\s*:/.test(line)) break;

       const indentMatch = line.match(/^(\s+)- /);
       if (indentMatch && listIndent === null) {
         listIndent = indentMatch[1]!;
       }
       if (/^\s+\S/.test(line)) {
         lastMemberIdx = i;
       }
     }

     return { insertAt: lastMemberIdx + 1, listIndent: listIndent ?? '  ' };
   }
   ```
2. Run the test suite: `pnpm test tests/unit/hooks/pre-commit-framework.test.ts` — expected: all 7 cases passing.
3. Run the full test suite to verify no regression: `pnpm test` — expected: all green.
4. Commit:
   ```
   git add src/core/hooks/pre-commit-framework.ts tests/unit/hooks/pre-commit-framework.test.ts
   git commit -m "fix(hooks): lock first list indent in findReposInsertionPoint"
   ```

**Verification**: `pnpm test` all green; new test file produces 7 passing cases.

---

## Commit 2 — `HookSpec` foundations: shape + registry rewrite

### Task 2.1: Add `HookSpec` types to a new types module

**Files**: `src/core/hooks/hook-spec.ts` (new), `tests/unit/hooks/hook-spec.test.ts` (new)
**Est**: 4 minutes

**Steps**:
1. Write a type-shape test:
   ```typescript
   // tests/unit/hooks/hook-spec.test.ts
   import { describe, it, expectTypeOf } from 'vitest';
   import type {
     HookSpec,
     ShellEmission,
     PreCommitEmission,
   } from '#src/core/hooks/hook-spec.js';

   describe('HookSpec types', () => {
     it('HookSpec requires both shell and preCommit emissions', () => {
       const spec: HookSpec = {
         name: 'sample',
         language: 'typescript',
         category: 'lint',
         files: '**/*.ts',
         stages: ['pre-commit'],
         required: false,
         shell: {
           command: 'npx eslint --fix',
           passFiles: true,
           modifiesFiles: true,
           toolBinary: 'eslint',
         },
         preCommit: {
           kind: 'upstream',
           repo: 'https://github.com/example/eslint',
           rev: 'v1.0.0',
           id: 'eslint',
         },
         installHint: { command: 'npm i -D eslint' },
       };
       expectTypeOf(spec).toEqualTypeOf<HookSpec>();
     });

     it('PreCommitEmission discriminates upstream vs local', () => {
       const upstream: PreCommitEmission = {
         kind: 'upstream',
         repo: 'https://github.com/x/y',
         rev: 'v1',
         id: 'foo',
       };
       const local: PreCommitEmission = {
         kind: 'local',
         entry: 'node script.mjs',
         language: 'system',
       };
       expectTypeOf(upstream).toEqualTypeOf<PreCommitEmission>();
       expectTypeOf(local).toEqualTypeOf<PreCommitEmission>();
     });
   });
   ```
2. Verify failure: `pnpm test tests/unit/hooks/hook-spec.test.ts` — expected: module-not-found.
3. Implement the types:
   ```typescript
   // src/core/hooks/hook-spec.ts
   import type { InstallHint } from './hook-registry.js';

   export type HookLanguage =
     | 'typescript'
     | 'javascript'
     | 'python'
     | 'go'
     | 'rust'
     | 'java'
     | 'kotlin'
     | 'swift'
     | 'csharp'
     | 'cpp'
     | 'php'
     | 'ruby'
     | 'dart'
     | 'shell'
     | 'global';

   export type HookCategory = 'format' | 'lint' | 'type-check' | 'security' | 'test' | 'meta';

   export type HookStage = 'pre-commit' | 'pre-push' | 'commit-msg' | 'manual';

   export interface ShellEmission {
     command: string;
     passFiles: boolean;
     modifiesFiles: boolean;
     toolBinary: string;
   }

   export type PreCommitEmission =
     | {
         kind: 'upstream';
         repo: string;
         rev: string;
         id: string;
         args?: string[];
         additionalDependencies?: string[];
         passFilenames?: boolean;
         alias?: string;
       }
     | {
         kind: 'local';
         entry: string;
         language: 'system' | 'node' | 'python';
         additionalDependencies?: string[];
         passFilenames?: boolean;
       };

   export interface HookSpec {
     name: string;
     language: HookLanguage;
     category: HookCategory;
     files: string;
     exclude?: string;
     stages: HookStage[];
     required: boolean;
     shell: ShellEmission;
     preCommit: PreCommitEmission;
     installHint: InstallHint;
   }
   ```
4. Verify: `pnpm test tests/unit/hooks/hook-spec.test.ts` — expected: passing.

**Verification**: `pnpm lint` — expected: no type errors.

### Task 2.2: Migrate TypeScript and JavaScript registry entries to `HookSpec`

**Files**: `src/core/hooks/hook-registry.ts`, `tests/unit/hooks/hook-registry.test.ts`
**Est**: 5 minutes

**Steps**:
1. Append registry-integrity tests:
   ```typescript
   // tests/unit/hooks/hook-registry.test.ts (append)
   import { describe, it, expect } from 'vitest';
   import {
     getHooksForLanguage,
     getGlobalHooks,
     getSupportedLanguages,
   } from '#src/core/hooks/hook-registry.js';

   describe('HookSpec registry data integrity', () => {
     it('every spec has both shell and preCommit emissions', () => {
       for (const lang of getSupportedLanguages()) {
         for (const spec of getHooksForLanguage(lang)) {
           expect(spec.shell, `${spec.name} shell`).toBeDefined();
           expect(spec.preCommit, `${spec.name} preCommit`).toBeDefined();
           expect(spec.shell.toolBinary).toBeTruthy();
         }
       }
       for (const spec of getGlobalHooks()) {
         expect(spec.shell, `${spec.name} shell`).toBeDefined();
         expect(spec.preCommit, `${spec.name} preCommit`).toBeDefined();
       }
     });

     it('upstream preCommit emissions pin a non-empty rev', () => {
       const all = [
         ...getSupportedLanguages().flatMap(getHooksForLanguage),
         ...getGlobalHooks(),
       ];
       for (const spec of all) {
         if (spec.preCommit.kind === 'upstream') {
           expect(spec.preCommit.rev, `${spec.name} rev`).toMatch(/^v?\d/);
           expect(spec.preCommit.repo, `${spec.name} repo`).toMatch(/^https?:\/\//);
         }
       }
     });

     it('hook ids are unique within a language group', () => {
       for (const lang of getSupportedLanguages()) {
         const ids = getHooksForLanguage(lang).map((h) => h.name);
         expect(new Set(ids).size, lang).toBe(ids.length);
       }
     });
   });
   ```
2. Verify the new tests fail (registry still in old shape): `pnpm test tests/unit/hooks/hook-registry.test.ts`.
3. Replace the `LANGUAGE_HOOKS` and `GLOBAL_HOOKS` consts in `src/core/hooks/hook-registry.ts`. Replace the existing `HookEntry` export with a type re-export, and rebuild every language entry. Show only the typescript+javascript blocks in this task; subsequent tasks add the rest. Open `src/core/hooks/hook-registry.ts` and replace the existing `LANGUAGE_HOOKS` const definition with this expanded version (keep top-of-file imports plus the new HookSpec import; we will add the other languages in following tasks):
   ```typescript
   import { PROJECT_CLI, PROJECT_NAME } from '#src/constants.js';
   import type { HookSpec } from './hook-spec.js';

   export interface InstallHint {
     command: string;
     url?: string;
   }

   /** @deprecated Kept for callers transitioning to HookSpec — will be removed in a follow-up. */
   export type HookEntry = HookSpec;

   const LANGUAGE_HOOKS: Record<string, HookSpec[]> = {
     typescript: [
       {
         name: 'eslint',
         language: 'typescript',
         category: 'lint',
         files: '**/*.{ts,tsx,js,jsx}',
         stages: ['pre-commit'],
         required: false,
         shell: {
           command: 'npx eslint --fix',
           passFiles: true,
           modifiesFiles: true,
           toolBinary: 'eslint',
         },
         preCommit: {
           kind: 'local',
           entry: 'npx eslint --fix',
           language: 'system',
         },
         installHint: { command: 'npm install -D eslint' },
       },
       {
         name: 'prettier',
         language: 'typescript',
         category: 'format',
         files: '**/*.{ts,tsx,js,jsx,mjs,cjs,json,md,mdx,yaml,yml,css,scss,html}',
         stages: ['pre-commit'],
         required: false,
         shell: {
           command: 'npx prettier --write',
           passFiles: true,
           modifiesFiles: true,
           toolBinary: 'prettier',
         },
         preCommit: {
           kind: 'upstream',
           repo: 'https://github.com/pre-commit/mirrors-prettier',
           rev: 'v4.0.0-alpha.8',
           id: 'prettier',
         },
         installHint: { command: 'npm install -D prettier' },
       },
       {
         name: 'tsc',
         language: 'typescript',
         category: 'type-check',
         files: '**/*.{ts,tsx}',
         stages: ['pre-push'],
         required: true,
         shell: {
           command: 'npx tsc --noEmit',
           passFiles: false,
           modifiesFiles: false,
           toolBinary: 'tsc',
         },
         preCommit: {
           kind: 'local',
           entry: 'npx tsc --noEmit',
           language: 'system',
           passFilenames: false,
         },
         installHint: { command: 'npm install -D typescript' },
       },
     ],
     javascript: [
       {
         name: 'eslint',
         language: 'javascript',
         category: 'lint',
         files: '**/*.{js,jsx,mjs,cjs}',
         stages: ['pre-commit'],
         required: false,
         shell: {
           command: 'npx eslint --fix',
           passFiles: true,
           modifiesFiles: true,
           toolBinary: 'eslint',
         },
         preCommit: {
           kind: 'local',
           entry: 'npx eslint --fix',
           language: 'system',
         },
         installHint: { command: 'npm install -D eslint' },
       },
       {
         name: 'prettier',
         language: 'javascript',
         category: 'format',
         files: '**/*.{js,jsx,mjs,cjs,json,md,mdx,yaml,yml,css,scss,html}',
         stages: ['pre-commit'],
         required: false,
         shell: {
           command: 'npx prettier --write',
           passFiles: true,
           modifiesFiles: true,
           toolBinary: 'prettier',
         },
         preCommit: {
           kind: 'upstream',
           repo: 'https://github.com/pre-commit/mirrors-prettier',
           rev: 'v4.0.0-alpha.8',
           id: 'prettier',
         },
         installHint: { command: 'npm install -D prettier' },
       },
     ],
     // Other language entries follow in tasks 2.3 and 2.4.
   };
   ```
4. Verify partial: `pnpm test tests/unit/hooks/hook-registry.test.ts` — TS/JS entries should pass the integrity tests; missing language entries from earlier code may cause failures elsewhere — that is expected at this checkpoint.

**Verification**: `pnpm lint` — no type errors. New tests for TS/JS pass.

### Task 2.3: Migrate Python registry entries (with basedpyright + bandit toml fix)

**Files**: `src/core/hooks/hook-registry.ts`
**Est**: 4 minutes

**Steps**:
1. Inside `LANGUAGE_HOOKS`, after `javascript`, insert the python block. Show the ruff/basedpyright/mypy/bandit entries in full:
   ```typescript
   python: [
     {
       name: 'ruff-check',
       language: 'python',
       category: 'lint',
       files: '**/*.py',
       stages: ['pre-commit'],
       required: true,
       shell: {
         command: 'ruff check --fix',
         passFiles: true,
         modifiesFiles: true,
         toolBinary: 'ruff',
       },
       preCommit: {
         kind: 'upstream',
         repo: 'https://github.com/astral-sh/ruff-pre-commit',
         rev: 'v0.15.12',
         id: 'ruff-check',
         args: ['--fix'],
       },
       installHint: { command: 'pip install ruff', url: 'https://docs.astral.sh/ruff' },
     },
     {
       name: 'ruff-format',
       language: 'python',
       category: 'format',
       files: '**/*.py',
       stages: ['pre-commit'],
       required: false,
       shell: {
         command: 'ruff format',
         passFiles: true,
         modifiesFiles: true,
         toolBinary: 'ruff',
       },
       preCommit: {
         kind: 'upstream',
         repo: 'https://github.com/astral-sh/ruff-pre-commit',
         rev: 'v0.15.12',
         id: 'ruff-format',
       },
       installHint: { command: 'pip install ruff' },
     },
     {
       name: 'basedpyright',
       language: 'python',
       category: 'type-check',
       files: '**/*.py',
       stages: ['pre-push'],
       required: true,
       shell: {
         command: 'basedpyright',
         passFiles: false,
         modifiesFiles: false,
         toolBinary: 'basedpyright',
       },
       preCommit: {
         kind: 'local',
         entry: 'basedpyright',
         language: 'python',
         additionalDependencies: ['basedpyright'],
         passFilenames: false,
       },
       installHint: { command: 'pip install basedpyright' },
     },
     {
       name: 'mypy',
       language: 'python',
       category: 'type-check',
       files: '**/*.py',
       stages: ['pre-push'],
       required: true,
       shell: {
         command: 'mypy',
         passFiles: false,
         modifiesFiles: false,
         toolBinary: 'mypy',
       },
       preCommit: {
         kind: 'upstream',
         repo: 'https://github.com/pre-commit/mirrors-mypy',
         rev: 'v1.13.0',
         id: 'mypy',
         passFilenames: false,
       },
       installHint: { command: 'pip install mypy' },
     },
     {
       name: 'pyright',
       language: 'python',
       category: 'type-check',
       files: '**/*.py',
       stages: ['pre-push'],
       required: true,
       shell: {
         command: 'npx pyright',
         passFiles: false,
         modifiesFiles: false,
         toolBinary: 'pyright',
       },
       preCommit: {
         kind: 'local',
         entry: 'npx pyright',
         language: 'system',
         passFilenames: false,
       },
       installHint: { command: 'npm install -D pyright' },
     },
     {
       name: 'bandit',
       language: 'python',
       category: 'security',
       files: '**/*.py',
       stages: ['pre-commit'],
       required: true,
       shell: {
         command: 'bandit -c pyproject.toml -lll -r',
         passFiles: true,
         modifiesFiles: false,
         toolBinary: 'bandit',
       },
       preCommit: {
         kind: 'upstream',
         repo: 'https://github.com/PyCQA/bandit',
         rev: '1.8.0',
         id: 'bandit',
         args: ['-c', 'pyproject.toml', '-lll'],
         additionalDependencies: ['bandit[toml]'],
       },
       installHint: { command: 'pip install "bandit[toml]"' },
     },
   ],
   ```
2. Verify partial: `pnpm test tests/unit/hooks/hook-registry.test.ts` — the python entries pass integrity tests.

**Verification**: data integrity tests now cover python entries.

### Task 2.4: Migrate remaining language registry entries

**Files**: `src/core/hooks/hook-registry.ts`
**Est**: 5 minutes

**Steps**:
1. Continue inside `LANGUAGE_HOOKS`, after `python`. For each remaining language we keep the existing semantics but add `shell` + `preCommit` emissions. All non-Python/JS languages use `kind: 'local'` with `language: 'system'` because they call host-side tools without isolated venvs. Add (in alphabetical order to match existing convention):
   ```typescript
   go: [
     {
       name: 'golangci-lint',
       language: 'go',
       category: 'lint',
       files: '**/*.go',
       stages: ['pre-commit'],
       required: true,
       shell: { command: 'golangci-lint run', passFiles: false, modifiesFiles: false, toolBinary: 'golangci-lint' },
       preCommit: { kind: 'local', entry: 'golangci-lint run', language: 'system', passFilenames: false },
       installHint: {
         command: 'go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest',
         url: 'https://golangci-lint.run/usage/install/',
       },
     },
     {
       name: 'gofmt',
       language: 'go',
       category: 'format',
       files: '**/*.go',
       stages: ['pre-commit'],
       required: true,
       shell: { command: 'gofmt -w', passFiles: true, modifiesFiles: true, toolBinary: 'gofmt' },
       preCommit: { kind: 'local', entry: 'gofmt -w', language: 'system' },
       installHint: { command: 'Install Go from https://go.dev (gofmt is included)' },
     },
     {
       name: 'gosec',
       language: 'go',
       category: 'security',
       files: '**/*.go',
       stages: ['pre-commit'],
       required: true,
       shell: { command: 'gosec', passFiles: false, modifiesFiles: false, toolBinary: 'gosec' },
       preCommit: { kind: 'local', entry: 'gosec', language: 'system', passFilenames: false },
       installHint: { command: 'go install github.com/securego/gosec/v2/cmd/gosec@latest' },
     },
   ],
   rust: [
     {
       name: 'cargo-fmt',
       language: 'rust',
       category: 'format',
       files: '**/*.rs',
       stages: ['pre-commit'],
       required: true,
       shell: { command: 'cargo fmt', passFiles: false, modifiesFiles: true, toolBinary: 'cargo' },
       preCommit: { kind: 'local', entry: 'cargo fmt', language: 'system', passFilenames: false },
       installHint: { command: 'rustup component add rustfmt' },
     },
     {
       name: 'cargo-clippy',
       language: 'rust',
       category: 'lint',
       files: '**/*.rs',
       stages: ['pre-commit'],
       required: true,
       shell: { command: 'cargo clippy', passFiles: false, modifiesFiles: false, toolBinary: 'cargo' },
       preCommit: { kind: 'local', entry: 'cargo clippy', language: 'system', passFilenames: false },
       installHint: { command: 'rustup component add clippy' },
     },
   ],
   java: [
     {
       name: 'google-java-format',
       language: 'java',
       category: 'format',
       files: '**/*.java',
       stages: ['pre-commit'],
       required: false,
       shell: { command: 'google-java-format --replace', passFiles: true, modifiesFiles: true, toolBinary: 'google-java-format' },
       preCommit: { kind: 'local', entry: 'google-java-format --replace', language: 'system' },
       installHint: { command: 'brew install google-java-format' },
     },
     {
       name: 'checkstyle',
       language: 'java',
       category: 'lint',
       files: '**/*.java',
       stages: ['pre-commit'],
       required: true,
       shell: { command: 'checkstyle -c /google_checks.xml', passFiles: true, modifiesFiles: false, toolBinary: 'checkstyle' },
       preCommit: { kind: 'local', entry: 'checkstyle -c /google_checks.xml', language: 'system' },
       installHint: { command: 'brew install checkstyle' },
     },
   ],
   kotlin: [
     {
       name: 'ktfmt',
       language: 'kotlin',
       category: 'format',
       files: '**/*.kt',
       stages: ['pre-commit'],
       required: false,
       shell: { command: 'ktfmt --kotlinlang-style', passFiles: true, modifiesFiles: true, toolBinary: 'ktfmt' },
       preCommit: { kind: 'local', entry: 'ktfmt --kotlinlang-style', language: 'system' },
       installHint: { command: 'brew install ktfmt' },
     },
     {
       name: 'detekt',
       language: 'kotlin',
       category: 'lint',
       files: '**/*.kt',
       stages: ['pre-commit'],
       required: true,
       shell: { command: 'detekt --input', passFiles: true, modifiesFiles: false, toolBinary: 'detekt' },
       preCommit: { kind: 'local', entry: 'detekt --input', language: 'system' },
       installHint: { command: 'brew install detekt' },
     },
   ],
   swift: [
     {
       name: 'swiftformat',
       language: 'swift',
       category: 'format',
       files: '**/*.swift',
       stages: ['pre-commit'],
       required: false,
       shell: { command: 'swiftformat', passFiles: true, modifiesFiles: true, toolBinary: 'swiftformat' },
       preCommit: { kind: 'local', entry: 'swiftformat', language: 'system' },
       installHint: { command: 'brew install swiftformat' },
     },
     {
       name: 'swiftlint',
       language: 'swift',
       category: 'lint',
       files: '**/*.swift',
       stages: ['pre-commit'],
       required: true,
       shell: { command: 'swiftlint lint --strict', passFiles: true, modifiesFiles: false, toolBinary: 'swiftlint' },
       preCommit: { kind: 'local', entry: 'swiftlint lint --strict', language: 'system' },
       installHint: { command: 'brew install swiftlint' },
     },
   ],
   csharp: [
     {
       name: 'dotnet-format',
       language: 'csharp',
       category: 'format',
       files: '**/*.cs',
       stages: ['pre-commit'],
       required: false,
       shell: { command: 'dotnet format --include', passFiles: true, modifiesFiles: true, toolBinary: 'dotnet' },
       preCommit: { kind: 'local', entry: 'dotnet format --include', language: 'system' },
       installHint: { command: 'Install .NET SDK from https://dot.net' },
     },
     {
       name: 'dotnet-build',
       language: 'csharp',
       category: 'type-check',
       files: '**/*.cs',
       stages: ['pre-push'],
       required: true,
       shell: { command: 'dotnet build --no-incremental -nologo', passFiles: false, modifiesFiles: false, toolBinary: 'dotnet' },
       preCommit: { kind: 'local', entry: 'dotnet build --no-incremental -nologo', language: 'system', passFilenames: false },
       installHint: { command: 'Install .NET SDK from https://dot.net' },
     },
   ],
   cpp: [
     {
       name: 'clang-format',
       language: 'cpp',
       category: 'format',
       files: '**/*.{cpp,hpp,cc,h}',
       stages: ['pre-commit'],
       required: false,
       shell: { command: 'clang-format -i', passFiles: true, modifiesFiles: true, toolBinary: 'clang-format' },
       preCommit: { kind: 'local', entry: 'clang-format -i', language: 'system' },
       installHint: { command: 'brew install clang-format' },
     },
     {
       name: 'clang-tidy',
       language: 'cpp',
       category: 'lint',
       files: '**/*.{cpp,cc}',
       stages: ['pre-commit'],
       required: true,
       shell: { command: 'clang-tidy', passFiles: true, modifiesFiles: false, toolBinary: 'clang-tidy' },
       preCommit: { kind: 'local', entry: 'clang-tidy', language: 'system' },
       installHint: { command: 'brew install llvm  # provides clang-tidy' },
     },
   ],
   php: [
     {
       name: 'php-cs-fixer',
       language: 'php',
       category: 'format',
       files: '**/*.php',
       stages: ['pre-commit'],
       required: false,
       shell: { command: 'php-cs-fixer fix', passFiles: true, modifiesFiles: true, toolBinary: 'php-cs-fixer' },
       preCommit: { kind: 'local', entry: 'php-cs-fixer fix', language: 'system' },
       installHint: { command: 'composer global require friendsofphp/php-cs-fixer' },
     },
     {
       name: 'phpstan',
       language: 'php',
       category: 'type-check',
       files: '**/*.php',
       stages: ['pre-push'],
       required: true,
       shell: { command: 'phpstan analyse', passFiles: false, modifiesFiles: false, toolBinary: 'phpstan' },
       preCommit: { kind: 'local', entry: 'phpstan analyse', language: 'system', passFilenames: false },
       installHint: { command: 'composer global require phpstan/phpstan' },
     },
     {
       name: 'phpcs-security',
       language: 'php',
       category: 'security',
       files: '**/*.php',
       stages: ['pre-commit'],
       required: true,
       shell: { command: 'phpcs --standard=Security', passFiles: true, modifiesFiles: false, toolBinary: 'phpcs' },
       preCommit: { kind: 'local', entry: 'phpcs --standard=Security', language: 'system' },
       installHint: { command: 'composer global require pheromone/phpcs-security-audit' },
     },
   ],
   ruby: [
     {
       name: 'rubocop',
       language: 'ruby',
       category: 'lint',
       files: '**/*.rb',
       stages: ['pre-commit'],
       required: true,
       shell: { command: 'rubocop -a', passFiles: true, modifiesFiles: true, toolBinary: 'rubocop' },
       preCommit: { kind: 'local', entry: 'rubocop -a', language: 'system' },
       installHint: { command: 'gem install rubocop' },
     },
     {
       name: 'brakeman',
       language: 'ruby',
       category: 'security',
       files: '**/*.rb',
       stages: ['pre-commit'],
       required: true,
       shell: { command: 'brakeman --no-pager -q', passFiles: false, modifiesFiles: false, toolBinary: 'brakeman' },
       preCommit: { kind: 'local', entry: 'brakeman --no-pager -q', language: 'system', passFilenames: false },
       installHint: { command: 'gem install brakeman' },
     },
   ],
   dart: [
     {
       name: 'dart-format',
       language: 'dart',
       category: 'format',
       files: '**/*.dart',
       stages: ['pre-commit'],
       required: false,
       shell: { command: 'dart format', passFiles: true, modifiesFiles: true, toolBinary: 'dart' },
       preCommit: { kind: 'local', entry: 'dart format', language: 'system' },
       installHint: { command: 'Install Dart SDK from https://dart.dev' },
     },
     {
       name: 'dart-analyze',
       language: 'dart',
       category: 'lint',
       files: '**/*.dart',
       stages: ['pre-commit'],
       required: true,
       shell: { command: 'dart analyze', passFiles: true, modifiesFiles: false, toolBinary: 'dart' },
       preCommit: { kind: 'local', entry: 'dart analyze', language: 'system' },
       installHint: { command: 'Install Dart SDK from https://dart.dev' },
     },
   ],
   shell: [
     {
       name: 'shellcheck',
       language: 'shell',
       category: 'lint',
       files: '**/*.sh',
       stages: ['pre-commit'],
       required: true,
       shell: { command: 'shellcheck -S warning', passFiles: true, modifiesFiles: false, toolBinary: 'shellcheck' },
       preCommit: {
         kind: 'upstream',
         repo: 'https://github.com/koalaman/shellcheck-precommit',
         rev: 'v0.10.0',
         id: 'shellcheck',
         args: ['-S', 'warning'],
       },
       installHint: { command: 'brew install shellcheck' },
     },
   ],
   ```
2. Verify all entries pass: `pnpm test tests/unit/hooks/hook-registry.test.ts` — expected: integrity tests pass for every language.

**Verification**: every language in `getSupportedLanguages()` returns specs that pass `it('every spec has both shell and preCommit emissions')`.

### Task 2.5: Migrate global hooks (gitleaks + doctor + commitlint)

**Files**: `src/core/hooks/hook-registry.ts`
**Est**: 3 minutes

**Steps**:
1. Replace the `GLOBAL_HOOKS` const with:
   ```typescript
   const GLOBAL_HOOKS: HookSpec[] = [
     {
       name: 'gitleaks',
       language: 'global',
       category: 'security',
       files: '**/*',
       stages: ['pre-commit'],
       required: true,
       shell: {
         command: 'gitleaks protect --staged --no-banner',
         passFiles: false,
         modifiesFiles: false,
         toolBinary: 'gitleaks',
       },
       preCommit: {
         kind: 'upstream',
         repo: 'https://github.com/gitleaks/gitleaks',
         rev: 'v8.21.0',
         id: 'gitleaks',
       },
       installHint: {
         command: 'brew install gitleaks',
         url: 'https://github.com/gitleaks/gitleaks#installing',
       },
     },
     {
       name: 'commitlint',
       language: 'global',
       category: 'meta',
       files: '',
       stages: ['commit-msg'],
       required: false,
       shell: {
         command: 'npx --no -- commitlint --edit',
         passFiles: false,
         modifiesFiles: false,
         toolBinary: 'commitlint',
       },
       preCommit: {
         kind: 'upstream',
         repo: 'https://github.com/alessandrojcm/commitlint-pre-commit-hook',
         rev: 'v9.23.0',
         id: 'commitlint',
         additionalDependencies: ['@commitlint/config-conventional'],
       },
       installHint: { command: 'npm install -D @commitlint/config-conventional @commitlint/cli' },
     },
     {
       name: `${PROJECT_NAME}-doctor`,
       language: 'global',
       category: 'meta',
       files: '',
       stages: ['pre-commit'],
       required: false,
       shell: {
         command: `npx ${PROJECT_CLI} doctor --ci`,
         passFiles: false,
         modifiesFiles: false,
         toolBinary: PROJECT_CLI,
       },
       preCommit: {
         kind: 'local',
         entry: `npx ${PROJECT_CLI} doctor --ci`,
         language: 'system',
         passFilenames: false,
       },
       installHint: { command: '' },
     },
   ];
   ```
2. Update accessor functions and exports — replace the bottom of the file with:
   ```typescript
   export function getDoctorHook(): HookSpec {
     return GLOBAL_HOOKS.find((h) => h.name === `${PROJECT_NAME}-doctor`)!;
   }

   export function getGlobalHooks(): HookSpec[] {
     return [...GLOBAL_HOOKS];
   }

   export function getCommitlintHook(): HookSpec {
     return GLOBAL_HOOKS.find((h) => h.name === 'commitlint')!;
   }

   export function getHooksForLanguage(language: string): HookSpec[] {
     const normalized = language.toLowerCase();
     const hooks = LANGUAGE_HOOKS[normalized] ?? [];
     return hooks.map((h) => ({ ...h, language: normalized as HookSpec['language'] }));
   }

   export function getSupportedLanguages(): string[] {
     return Object.keys(LANGUAGE_HOOKS);
   }

   export type { HookSpec } from './hook-spec.js';
   ```
3. Run the full test suite to confirm callers still compile (TypeScript will surface `HookEntry` consumers that broke): `pnpm lint && pnpm test`. Expected: existing consumers compile because `HookEntry = HookSpec` alias is in place. If any test fails with "Property X missing", investigate before continuing.
4. Commit the foundations:
   ```
   git add src/core/hooks/hook-spec.ts src/core/hooks/hook-registry.ts \
           tests/unit/hooks/hook-spec.test.ts tests/unit/hooks/hook-registry.test.ts
   git commit -m "feat(hooks): introduce HookSpec shape and per-runner emission descriptors"
   ```

**Verification**: `pnpm lint` clean. `pnpm test` all green.

---

## Commit 3 — Auto-detection module + four flags

### Task 3.1: Add the four flag definitions

**Files**: `src/core/flags/flag-catalog.ts`, `src/types/flags.ts` (only if a TS literal-union type needs the new keys)
**Est**: 4 minutes

**Steps**:
1. Open `src/core/flags/flag-catalog.ts` and add the four new flags using the same shape as the existing `type_checking` / `security_scan` entries. Confirm the entry shape with `grep -n "type_checking" src/core/flags/flag-catalog.ts | head`. Schematic addition (adapt key names to the file's actual interface):
   ```typescript
   {
     key: 'python_type_checker',
     description: 'Python type checker for pre-commit hooks',
     values: ['auto', 'mypy', 'basedpyright', 'pyright', 'off'],
     default: 'auto',
   },
   {
     key: 'js_format_lint',
     description: 'JavaScript/TypeScript lint and format toolchain',
     values: ['auto', 'eslint-prettier', 'biome', 'off'],
     default: 'auto',
   },
   {
     key: 'commit_type_check',
     description: 'Run type checker on pre-commit instead of pre-push',
     values: ['auto', 'on', 'off'],
     default: 'auto',
   },
   {
     key: 'commit_test_run',
     description: 'Run test suite on pre-commit instead of pre-push',
     values: ['auto', 'on', 'off'],
     default: 'auto',
   },
   ```
2. Add a unit test (filename must match the existing test convention for the catalog — typically `tests/unit/flags/flag-catalog.test.ts`):
   ```typescript
   import { describe, it, expect } from 'vitest';
   // Replace with the actual exported symbol name in flag-catalog.ts
   // (e.g. FLAG_CATALOG, FLAGS, flagCatalog). Discover via `grep -n "^export" src/core/flags/flag-catalog.ts`.
   import { FLAG_CATALOG } from '#src/core/flags/flag-catalog.js';

   describe('new precommit flags', () => {
     it.each(['python_type_checker', 'js_format_lint', 'commit_type_check', 'commit_test_run'])(
       '%s is registered with default auto',
       (key) => {
         const flag = FLAG_CATALOG.find((f) => f.key === key);
         expect(flag).toBeDefined();
         expect(flag!.default).toBe('auto');
         expect(flag!.values).toContain('auto');
       },
     );
   });
   ```
3. Verify: `pnpm test tests/unit/flags/flag-catalog.test.ts` — expected: passing.

**Verification**: all four flags resolvable via `FLAG_DEFINITIONS`.

### Task 3.2: Create `auto-detection.ts` with `DetectionContext` builder

**Files**: `src/core/hooks/auto-detection.ts` (new), `tests/unit/hooks/auto-detection.test.ts` (new)
**Est**: 5 minutes

**Steps**:
1. Add the test scaffold first (failing):
   ```typescript
   // tests/unit/hooks/auto-detection.test.ts
   import { describe, it, expect } from 'vitest';
   import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
   import { tmpdir } from 'node:os';
   import path from 'node:path';
   import { buildDetectionContext } from '#src/core/hooks/auto-detection.js';

   async function fixture(files: Record<string, string>): Promise<string> {
     const dir = await mkdtemp(path.join(tmpdir(), 'codi-detect-'));
     for (const [rel, content] of Object.entries(files)) {
       const full = path.join(dir, rel);
       await mkdir(path.dirname(full), { recursive: true });
       await writeFile(full, content, 'utf-8');
     }
     return dir;
   }

   describe('buildDetectionContext', () => {
     it('parses pyproject.toml and reads dependencies', async () => {
       const root = await fixture({
         'pyproject.toml': `[project]\nname = "x"\ndependencies = ["fastapi", "pydantic>=2"]\n`,
       });
       const ctx = await buildDetectionContext(root);
       expect(ctx.pythonDeps).toEqual(expect.arrayContaining(['fastapi', 'pydantic']));
     });

     it('detects django from requirements.txt', async () => {
       const root = await fixture({
         'requirements.txt': 'Django==5.0\nrequests\n',
       });
       const ctx = await buildDetectionContext(root);
       expect(ctx.pythonDeps).toContain('django');
     });

     it('counts python and ts LOC roughly', async () => {
       const root = await fixture({
         'a.py': 'x = 1\ny = 2\n',
         'b.ts': 'const x = 1;\nconst y = 2;\n',
       });
       const ctx = await buildDetectionContext(root);
       expect(ctx.locFiles.python).toBeGreaterThan(0);
       expect(ctx.locFiles.ts).toBeGreaterThan(0);
     });

     it('reads existing tool-config presence flags', async () => {
       const root = await fixture({
         'mypy.ini': '[mypy]\n',
         'biome.json': '{}',
       });
       const ctx = await buildDetectionContext(root);
       expect(ctx.has.mypyConfig).toBe(true);
       expect(ctx.has.biomeConfig).toBe(true);
     });
   });
   ```
2. Verify failure: `pnpm test tests/unit/hooks/auto-detection.test.ts`.
3. Implement the module:
   ```typescript
   // src/core/hooks/auto-detection.ts
   import fs from 'node:fs/promises';
   import path from 'node:path';
   import { fileExists } from '#src/utils/fs.js';

   export interface DetectionContext {
     projectRoot: string;
     pythonDeps: string[];
     jsDeps: string[];
     locFiles: { python: number; ts: number; js: number };
     has: {
       mypyConfig: boolean;
       basedpyrightConfig: boolean;
       pyrightConfig: boolean;
       biomeConfig: boolean;
       eslintConfig: boolean;
       prettierConfig: boolean;
       monorepoSignal: boolean;
     };
   }

   const PYPROJECT_DEPS_RE = /dependencies\s*=\s*\[([^\]]*)\]/m;
   const TOOL_BANDIT_RE = /\[tool\.bandit\]/m;
   const TOOL_MYPY_RE = /\[tool\.mypy\]/m;
   const TOOL_BASEDPYRIGHT_RE = /\[tool\.basedpyright\]/m;
   const TOOL_PYRIGHT_RE = /\[tool\.pyright\]/m;

   async function readSafe(file: string): Promise<string | null> {
     try {
       return await fs.readFile(file, 'utf-8');
     } catch {
       return null;
     }
   }

   function parsePyprojectDeps(text: string): string[] {
     const m = PYPROJECT_DEPS_RE.exec(text);
     if (!m) return [];
     return m[1]!
       .split(',')
       .map((s) => s.trim().replace(/^["']|["']$/g, ''))
       .map((s) => s.split(/[<>=!~\s]/)[0]!.toLowerCase())
       .filter(Boolean);
   }

   function parseRequirementsTxt(text: string): string[] {
     return text
       .split(/\r?\n/)
       .map((l) => l.trim())
       .filter((l) => l && !l.startsWith('#'))
       .map((l) => l.split(/[<>=!~\s;]/)[0]!.toLowerCase())
       .filter(Boolean);
   }

   function parsePackageJsonDeps(text: string): string[] {
     try {
       const pkg = JSON.parse(text) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
       return [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})];
     } catch {
       return [];
     }
   }

   const SCAN_SKIP = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.venv', 'venv', '__pycache__']);
   const PY_EXT = /\.py$/;
   const TS_EXT = /\.(ts|tsx)$/;
   const JS_EXT = /\.(js|jsx|mjs|cjs)$/;

   async function countLoc(dir: string, depth = 0, acc = { python: 0, ts: 0, js: 0 }): Promise<{ python: number; ts: number; js: number }> {
     if (depth > 4) return acc;
     let entries: import('node:fs').Dirent[];
     try {
       entries = await fs.readdir(dir, { withFileTypes: true });
     } catch {
       return acc;
     }
     for (const entry of entries) {
       if (entry.isDirectory()) {
         if (SCAN_SKIP.has(entry.name)) continue;
         await countLoc(path.join(dir, entry.name), depth + 1, acc);
       } else {
         const name = entry.name;
         const which = PY_EXT.test(name) ? 'python' : TS_EXT.test(name) ? 'ts' : JS_EXT.test(name) ? 'js' : null;
         if (!which) continue;
         try {
           const text = await fs.readFile(path.join(dir, name), 'utf-8');
           acc[which] += text.split('\n').length;
         } catch {
           // unreadable, skip
         }
       }
     }
     return acc;
   }

   export async function buildDetectionContext(projectRoot: string): Promise<DetectionContext> {
     const pyproject = await readSafe(path.join(projectRoot, 'pyproject.toml'));
     const requirements = await readSafe(path.join(projectRoot, 'requirements.txt'));
     const packageJson = await readSafe(path.join(projectRoot, 'package.json'));

     const pythonDeps = [
       ...(pyproject ? parsePyprojectDeps(pyproject) : []),
       ...(requirements ? parseRequirementsTxt(requirements) : []),
     ];
     const jsDeps = packageJson ? parsePackageJsonDeps(packageJson) : [];

     const has = {
       mypyConfig:
         (await fileExists(path.join(projectRoot, 'mypy.ini'))) ||
         (pyproject ? TOOL_MYPY_RE.test(pyproject) : false),
       basedpyrightConfig: pyproject ? TOOL_BASEDPYRIGHT_RE.test(pyproject) : false,
       pyrightConfig:
         (await fileExists(path.join(projectRoot, 'pyrightconfig.json'))) ||
         (pyproject ? TOOL_PYRIGHT_RE.test(pyproject) : false),
       biomeConfig:
         (await fileExists(path.join(projectRoot, 'biome.json'))) ||
         (await fileExists(path.join(projectRoot, 'biome.jsonc'))),
       eslintConfig:
         (await fileExists(path.join(projectRoot, '.eslintrc.json'))) ||
         (await fileExists(path.join(projectRoot, '.eslintrc.js'))) ||
         (await fileExists(path.join(projectRoot, '.eslintrc.cjs'))) ||
         (await fileExists(path.join(projectRoot, 'eslint.config.js'))) ||
         (await fileExists(path.join(projectRoot, 'eslint.config.mjs'))),
       prettierConfig:
         (await fileExists(path.join(projectRoot, '.prettierrc'))) ||
         (await fileExists(path.join(projectRoot, '.prettierrc.json'))) ||
         (await fileExists(path.join(projectRoot, '.prettierrc.js'))) ||
         (await fileExists(path.join(projectRoot, 'prettier.config.js'))),
       monorepoSignal: (() => {
         if (!packageJson) return false;
         try {
           const pkg = JSON.parse(packageJson) as { workspaces?: unknown };
           return pkg.workspaces !== undefined;
         } catch {
           return false;
         }
       })(),
     };

     // Suppress no-bandit ban: bandit refers to a python tool, not the eslint plugin
     // (the regex below filters lint-only namespaces out before normalization).

     const locFiles = await countLoc(projectRoot);

     return {
       projectRoot,
       pythonDeps,
       jsDeps,
       locFiles,
       has,
     };
   }
   ```
4. Verify: `pnpm test tests/unit/hooks/auto-detection.test.ts` — all four cases pass.

**Verification**: detection context tests green.

### Task 3.3: Implement the four resolver functions

**Files**: `src/core/hooks/auto-detection.ts`, `tests/unit/hooks/auto-detection.test.ts`
**Est**: 5 minutes

**Steps**:
1. Append resolver tests to the existing test file:
   ```typescript
   // tests/unit/hooks/auto-detection.test.ts (append)
   import {
     resolvePythonTypeChecker,
     resolveJsFormatLint,
     resolveCommitTypeCheck,
     resolveCommitTestRun,
     type DetectionContext,
   } from '#src/core/hooks/auto-detection.js';

   const empty: DetectionContext = {
     projectRoot: '/',
     pythonDeps: [],
     jsDeps: [],
     locFiles: { python: 0, ts: 0, js: 0 },
     has: {
       mypyConfig: false,
       basedpyrightConfig: false,
       pyrightConfig: false,
       biomeConfig: false,
       eslintConfig: false,
       prettierConfig: false,
       monorepoSignal: false,
     },
   };

   describe('resolvePythonTypeChecker', () => {
     it('respects [tool.mypy]', () => {
       expect(resolvePythonTypeChecker({ ...empty, has: { ...empty.has, mypyConfig: true } })).toBe('mypy');
     });
     it('respects [tool.basedpyright]', () => {
       expect(
         resolvePythonTypeChecker({ ...empty, has: { ...empty.has, basedpyrightConfig: true } }),
       ).toBe('basedpyright');
     });
     it('treats existing pyright config as basedpyright (compatible)', () => {
       expect(
         resolvePythonTypeChecker({ ...empty, has: { ...empty.has, pyrightConfig: true } }),
       ).toBe('basedpyright');
     });
     it('picks mypy for django/sqlalchemy projects', () => {
       expect(resolvePythonTypeChecker({ ...empty, pythonDeps: ['django'] })).toBe('mypy');
     });
     it('picks basedpyright for fastapi/pydantic projects', () => {
       expect(resolvePythonTypeChecker({ ...empty, pythonDeps: ['fastapi', 'pydantic'] })).toBe('basedpyright');
     });
     it('picks basedpyright for large codebases', () => {
       expect(resolvePythonTypeChecker({ ...empty, locFiles: { python: 25_000, ts: 0, js: 0 } })).toBe('basedpyright');
     });
     it('falls back to basedpyright', () => {
       expect(resolvePythonTypeChecker(empty)).toBe('basedpyright');
     });
   });

   describe('resolveJsFormatLint', () => {
     it('biome.json wins', () => {
       expect(resolveJsFormatLint({ ...empty, has: { ...empty.has, biomeConfig: true } })).toBe('biome');
     });
     it('existing eslint config picks eslint-prettier', () => {
       expect(resolveJsFormatLint({ ...empty, has: { ...empty.has, eslintConfig: true } })).toBe('eslint-prettier');
     });
     it('falls back to eslint-prettier', () => {
       expect(resolveJsFormatLint(empty)).toBe('eslint-prettier');
     });
   });

   describe('resolveCommitTypeCheck', () => {
     it('off for large codebases', () => {
       expect(resolveCommitTypeCheck({ ...empty, locFiles: { python: 15_000, ts: 10_000, js: 0 } })).toBe('off');
     });
     it('off for monorepos', () => {
       expect(resolveCommitTypeCheck({ ...empty, has: { ...empty.has, monorepoSignal: true } })).toBe('off');
     });
     it('falls back to off (industry default)', () => {
       expect(resolveCommitTypeCheck(empty)).toBe('off');
     });
   });

   describe('resolveCommitTestRun', () => {
     it('always off', () => {
       expect(resolveCommitTestRun(empty)).toBe('off');
       expect(resolveCommitTestRun({ ...empty, locFiles: { python: 1, ts: 1, js: 1 } })).toBe('off');
     });
   });
   ```
2. Verify failure: `pnpm test tests/unit/hooks/auto-detection.test.ts`.
3. Append resolver implementations to `src/core/hooks/auto-detection.ts`:
   ```typescript
   // src/core/hooks/auto-detection.ts (append)
   const PYTHON_DEPS_FAVORING_MYPY = new Set(['django', 'django-stubs', 'sqlalchemy']);
   const PYTHON_DEPS_FAVORING_BASEDPYRIGHT = new Set(['fastapi', 'pydantic', 'sqlmodel']);

   export function resolvePythonTypeChecker(
     ctx: DetectionContext,
   ): 'mypy' | 'basedpyright' | 'off' {
     if (ctx.has.mypyConfig) return 'mypy';
     if (ctx.has.basedpyrightConfig) return 'basedpyright';
     if (ctx.has.pyrightConfig) return 'basedpyright';
     if (ctx.pythonDeps.some((d) => PYTHON_DEPS_FAVORING_MYPY.has(d))) return 'mypy';
     if (ctx.pythonDeps.some((d) => PYTHON_DEPS_FAVORING_BASEDPYRIGHT.has(d))) return 'basedpyright';
     if (ctx.locFiles.python > 20_000) return 'basedpyright';
     return 'basedpyright';
   }

   export function resolveJsFormatLint(
     ctx: DetectionContext,
   ): 'eslint-prettier' | 'biome' | 'off' {
     if (ctx.has.biomeConfig) return 'biome';
     if (ctx.has.eslintConfig || ctx.has.prettierConfig) return 'eslint-prettier';
     return 'eslint-prettier';
   }

   export function resolveCommitTypeCheck(ctx: DetectionContext): 'on' | 'off' {
     const totalLoc = ctx.locFiles.ts + ctx.locFiles.python;
     if (totalLoc > 20_000) return 'off';
     if (ctx.has.monorepoSignal) return 'off';
     return 'off';
   }

   export function resolveCommitTestRun(_ctx: DetectionContext): 'on' | 'off' {
     return 'off';
   }
   ```
4. Verify: `pnpm test tests/unit/hooks/auto-detection.test.ts` — all green.
5. Commit:
   ```
   git add src/core/hooks/auto-detection.ts tests/unit/hooks/auto-detection.test.ts \
           src/core/flags/definitions.ts tests/unit/flags/flag-definitions.test.ts \
           src/types/flags.ts
   git commit -m "feat(hooks): add auto-detection module and four flag definitions"
   ```

**Verification**: `pnpm test` all green. `pnpm lint` no errors.

---

## Commit 4 — YAML round-trip renderer + legacy cleanup

### Task 4.1: Confirm `yaml` dependency is present (no install needed)

**Files**: `package.json` (read-only check)
**Est**: 1 minute

**Steps**:
1. `yaml@^2.8.2` is already declared in `package.json` (~line 85). Verify with `grep '"yaml"' package.json` — expected: `"yaml": "^2.8.2"`.
2. If the line is missing for any reason, run `pnpm add yaml@^2.8.2`. Otherwise skip — no install needed.

**Verification**: `pnpm lint` clean. Skip this commit-step entirely if no install was needed (the dep is already there from prior work).

### Task 4.2: Create `yaml-document.ts` AST helpers

**Files**: `src/core/hooks/yaml-document.ts` (new), `tests/unit/hooks/yaml-document.test.ts` (new)
**Est**: 5 minutes

**Steps**:
1. Test first:
   ```typescript
   // tests/unit/hooks/yaml-document.test.ts
   import { describe, it, expect } from 'vitest';
   import { loadOrEmptyDoc, findReposNode, isCodiManagedRepo, CODI_MARKER } from '#src/core/hooks/yaml-document.js';

   describe('yaml-document helpers', () => {
     it('loadOrEmptyDoc returns a Document with empty repos when input is empty', () => {
       const doc = loadOrEmptyDoc('');
       const repos = findReposNode(doc);
       expect(repos).toBeDefined();
       expect(repos!.items).toHaveLength(0);
     });

     it('loadOrEmptyDoc preserves existing repos:', () => {
       const yaml = `repos:\n  - repo: https://github.com/x/y\n    rev: v1\n    hooks:\n      - id: foo\n`;
       const doc = loadOrEmptyDoc(yaml);
       const repos = findReposNode(doc);
       expect(repos!.items).toHaveLength(1);
     });

     it('isCodiManagedRepo recognizes the marker comment', () => {
       const yaml = `repos:\n  - repo: https://github.com/x/y    # ${CODI_MARKER}\n    rev: v1\n    hooks:\n      - id: foo\n`;
       const doc = loadOrEmptyDoc(yaml);
       const repos = findReposNode(doc);
       expect(isCodiManagedRepo(repos!.items[0]!)).toBe(true);
     });

     it('isCodiManagedRepo returns false when no marker', () => {
       const yaml = `repos:\n  - repo: https://github.com/x/y\n    rev: v1\n    hooks:\n      - id: foo\n`;
       const doc = loadOrEmptyDoc(yaml);
       const repos = findReposNode(doc);
       expect(isCodiManagedRepo(repos!.items[0]!)).toBe(false);
     });
   });
   ```
2. Verify failure: module not found.
3. Implement:
   ```typescript
   // src/core/hooks/yaml-document.ts
   import {
     parseDocument,
     Document,
     YAMLSeq,
     YAMLMap,
     isMap,
     isSeq,
   } from 'yaml';

   export const CODI_MARKER = 'managed by codi';

   export function loadOrEmptyDoc(input: string): Document {
     const trimmed = input.trim();
     if (!trimmed) {
       const doc = new Document({ repos: [] });
       return doc;
     }
     const doc = parseDocument(input);
     if (!doc.has('repos')) {
       doc.set('repos', new YAMLSeq());
     }
     return doc;
   }

   export function findReposNode(doc: Document): YAMLSeq | undefined {
     const node = doc.get('repos');
     return isSeq(node) ? (node as YAMLSeq) : undefined;
   }

   export function isCodiManagedRepo(node: unknown): boolean {
     if (!isMap(node)) return false;
     const map = node as YAMLMap;
     const items = map.items;
     for (const pair of items) {
       const keyAny = pair.key as unknown;
       const keyName =
         keyAny && typeof keyAny === 'object' && 'value' in (keyAny as Record<string, unknown>)
           ? (keyAny as { value: unknown }).value
           : keyAny;
       if (keyName === 'repo') {
         const comment = pair.value && typeof pair.value === 'object' && 'comment' in (pair.value as Record<string, unknown>)
           ? ((pair.value as { comment?: string }).comment ?? '')
           : '';
         return comment.trim().includes(CODI_MARKER);
       }
     }
     return false;
   }

   export function setCodiMarker(node: YAMLMap): void {
     for (const pair of node.items) {
       const keyAny = pair.key as unknown;
       const keyName =
         keyAny && typeof keyAny === 'object' && 'value' in (keyAny as Record<string, unknown>)
           ? (keyAny as { value: unknown }).value
           : keyAny;
       if (keyName === 'repo' && pair.value && typeof pair.value === 'object') {
         (pair.value as { comment?: string }).comment = ` ${CODI_MARKER}`;
         return;
       }
     }
   }

   export function readUserPinnedRev(node: YAMLMap): string | null {
     const rev = node.get('rev');
     return typeof rev === 'string' ? rev : null;
   }

   export function serialize(doc: Document): string {
     return String(doc).replace(/\n+$/, '') + '\n';
   }
   ```
4. Verify: `pnpm test tests/unit/hooks/yaml-document.test.ts` — passing.

**Verification**: `pnpm lint` clean.

### Task 4.3: Create `legacy-cleanup.ts`

**Files**: `src/core/hooks/legacy-cleanup.ts` (new), `tests/unit/hooks/legacy-cleanup.test.ts` (new)
**Est**: 4 minutes

**Steps**:
1. Test first:
   ```typescript
   // tests/unit/hooks/legacy-cleanup.test.ts
   import { describe, it, expect } from 'vitest';
   import { stripLegacyTextMarkers } from '#src/core/hooks/legacy-cleanup.js';

   describe('stripLegacyTextMarkers', () => {
     it('removes the BEGIN/END marker block', () => {
       const input = [
         'repos:',
         '  - repo: https://github.com/x/y',
         '    rev: v1',
         '    hooks:',
         '      - id: foo',
         '  # Codi hooks: BEGIN (auto-generated — do not edit between markers)',
         '  - repo: local',
         '    hooks:',
         '      - id: codi-junk',
         '  # Codi hooks: END',
         '',
       ].join('\n');
       const result = stripLegacyTextMarkers(input);
       expect(result).not.toMatch(/Codi hooks: BEGIN/);
       expect(result).not.toMatch(/codi-junk/);
       expect(result).toMatch(/external\/?|x\/y/);
     });

     it('removes legacy column-zero block', () => {
       const input = [
         'repos:',
         '  - repo: https://github.com/x/y',
         '# Codi hooks',
         '- repo: local',
         '  hooks:',
         '    - id: codi-something',
         '',
       ].join('\n');
       const result = stripLegacyTextMarkers(input);
       expect(result).not.toMatch(/Codi hooks/);
       expect(result).not.toMatch(/codi-something/);
     });

     it('passes through input with no markers', () => {
       const input = 'repos:\n  - repo: https://github.com/x/y\n    rev: v1\n';
       expect(stripLegacyTextMarkers(input)).toContain('https://github.com/x/y');
     });
   });
   ```
2. Implement:
   ```typescript
   // src/core/hooks/legacy-cleanup.ts
   import { PROJECT_NAME_DISPLAY } from '#src/constants.js';

   const LEGACY_BEGIN = `# ${PROJECT_NAME_DISPLAY} hooks: BEGIN (auto-generated — do not edit between markers)`;
   const LEGACY_END = `# ${PROJECT_NAME_DISPLAY} hooks: END`;
   const LEGACY_COLUMN_ZERO = `# ${PROJECT_NAME_DISPLAY} hooks`;

   export function stripLegacyTextMarkers(content: string): string {
     const lines = content.split('\n');
     const out: string[] = [];
     let skipping = false;
     let legacySkipping = false;

     for (let i = 0; i < lines.length; i++) {
       const line = lines[i]!;
       const trimmed = line.trim();

       if (!skipping && trimmed === LEGACY_BEGIN.trim()) {
         skipping = true;
         continue;
       }
       if (skipping) {
         if (trimmed === LEGACY_END.trim()) skipping = false;
         continue;
       }

       if (
         !legacySkipping &&
         trimmed === LEGACY_COLUMN_ZERO &&
         lines[i + 1]?.startsWith('- repo: local')
       ) {
         legacySkipping = true;
         continue;
       }
       if (legacySkipping) {
         if (line.startsWith('- ') || line.startsWith('  ') || line === '') continue;
         legacySkipping = false;
         out.push(line);
         continue;
       }

       out.push(line);
     }

     return out
       .join('\n')
       .replace(/\n{3,}/g, '\n\n')
       .replace(/\n+$/, '\n');
   }
   ```
3. Verify: `pnpm test tests/unit/hooks/legacy-cleanup.test.ts` — three cases pass.

**Verification**: `pnpm test tests/unit/hooks/` — green.

### Task 4.4: Create `yaml-renderer.ts` skeleton + empty-input case

**Files**: `src/core/hooks/renderers/yaml-renderer.ts` (new), `tests/unit/hooks/yaml-renderer.test.ts` (new)
**Est**: 5 minutes

**Steps**:
1. Test first (single case):
   ```typescript
   // tests/unit/hooks/yaml-renderer.test.ts
   import { describe, it, expect } from 'vitest';
   import { renderPreCommitConfig } from '#src/core/hooks/renderers/yaml-renderer.js';
   import type { HookSpec } from '#src/core/hooks/hook-spec.js';

   const ruff: HookSpec = {
     name: 'ruff-check',
     language: 'python',
     category: 'lint',
     files: '**/*.py',
     stages: ['pre-commit'],
     required: true,
     shell: { command: 'ruff check --fix', passFiles: true, modifiesFiles: true, toolBinary: 'ruff' },
     preCommit: {
       kind: 'upstream',
       repo: 'https://github.com/astral-sh/ruff-pre-commit',
       rev: 'v0.15.12',
       id: 'ruff-check',
       args: ['--fix'],
     },
     installHint: { command: 'pip install ruff' },
   };

   describe('renderPreCommitConfig — empty input', () => {
     it('produces top-level keys + repos with the upstream block', () => {
       const out = renderPreCommitConfig([ruff], null);
       expect(out).toMatch(/default_install_hook_types:/);
       expect(out).toMatch(/exclude:/);
       expect(out).toMatch(/repos:/);
       expect(out).toMatch(/astral-sh\/ruff-pre-commit/);
       expect(out).toMatch(/rev: v0\.15\.12/);
       expect(out).toMatch(/managed by codi/);
       expect(out).toMatch(/ruff-check/);
       expect(out).toMatch(/--fix/);
       expect(out).toMatch(/\n$/);
     });

     it('is idempotent on second render', () => {
       const first = renderPreCommitConfig([ruff], null);
       const second = renderPreCommitConfig([ruff], first);
       expect(second).toBe(first);
     });
   });
   ```
2. Implement (initial version covering empty + idempotent):
   ```typescript
   // src/core/hooks/renderers/yaml-renderer.ts
   import { Document, YAMLMap, YAMLSeq } from 'yaml';
   import type { HookSpec, PreCommitEmission } from '../hook-spec.js';
   import {
     loadOrEmptyDoc,
     findReposNode,
     isCodiManagedRepo,
     setCodiMarker,
     readUserPinnedRev,
     serialize,
   } from '../yaml-document.js';
   import { stripLegacyTextMarkers } from '../legacy-cleanup.js';

   const TOP_LEVEL_DEFAULTS = {
     default_install_hook_types: ['pre-commit', 'commit-msg', 'pre-push'],
     default_language_version: { python: 'python3.12', node: '22' },
     minimum_pre_commit_version: '3.5.0',
     exclude: '^(node_modules|\\.venv|venv|dist|build|coverage|\\.next|\\.codi)/',
   };

   function buildRepoEntry(spec: HookSpec, userPinnedRev: string | null): YAMLMap | null {
     const e = spec.preCommit;
     if (e.kind === 'upstream') {
       const map = new YAMLMap();
       map.set('repo', e.repo);
       map.set('rev', userPinnedRev ?? e.rev);
       const hookEntry = new YAMLMap();
       hookEntry.set('id', e.id);
       if (e.args && e.args.length > 0) hookEntry.set('args', [...e.args]);
       if (e.additionalDependencies && e.additionalDependencies.length > 0) {
         hookEntry.set('additional_dependencies', [...e.additionalDependencies]);
       }
       if (e.passFilenames === false) hookEntry.set('pass_filenames', false);
       if (spec.stages.length > 0 && !(spec.stages.length === 1 && spec.stages[0] === 'pre-commit')) {
         hookEntry.set('stages', [...spec.stages]);
       }
       const hooks = new YAMLSeq();
       hooks.add(hookEntry);
       map.set('hooks', hooks);
       setCodiMarker(map);
       return map;
     }
     // local
     const map = new YAMLMap();
     map.set('repo', 'local');
     const hookEntry = new YAMLMap();
     hookEntry.set('id', spec.name);
     hookEntry.set('name', spec.name);
     hookEntry.set('entry', e.entry);
     hookEntry.set('language', e.language);
     if (e.additionalDependencies && e.additionalDependencies.length > 0) {
       hookEntry.set('additional_dependencies', [...e.additionalDependencies]);
     }
     if (e.passFilenames === false) hookEntry.set('pass_filenames', false);
     if (spec.stages.length > 0 && !(spec.stages.length === 1 && spec.stages[0] === 'pre-commit')) {
       hookEntry.set('stages', [...spec.stages]);
     }
     if (spec.files === '' || spec.files === '**' || spec.files === '**/*') {
       hookEntry.set('always_run', true);
     }
     const hooks = new YAMLSeq();
     hooks.add(hookEntry);
     map.set('hooks', hooks);
     setCodiMarker(map);
     return map;
   }

   function repoKey(e: PreCommitEmission, name: string): string {
     return e.kind === 'upstream' ? `upstream:${e.repo}:${e.id}` : `local:${name}`;
   }

   function existingCodiRevByKey(reposNode: YAMLSeq): Map<string, string> {
     const out = new Map<string, string>();
     for (const item of reposNode.items) {
       if (!isCodiManagedRepo(item)) continue;
       const map = item as YAMLMap;
       const repo = map.get('repo');
       if (repo === 'local') continue;
       if (typeof repo !== 'string') continue;
       const hooksNode = map.get('hooks');
       const rev = readUserPinnedRev(map);
       if (!rev) continue;
       if (hooksNode && typeof hooksNode === 'object' && 'items' in hooksNode) {
         for (const h of (hooksNode as YAMLSeq).items) {
           if (h && typeof h === 'object' && 'get' in h) {
             const id = (h as YAMLMap).get('id');
             if (typeof id === 'string') out.set(`upstream:${repo}:${id}`, rev);
           }
         }
       }
     }
     return out;
   }

   export function renderPreCommitConfig(specs: HookSpec[], existing: string | null): string {
     const cleaned = existing ? stripLegacyTextMarkers(existing) : '';
     let doc: Document;
     try {
       doc = loadOrEmptyDoc(cleaned);
     } catch {
       doc = loadOrEmptyDoc('');
     }

     for (const [k, v] of Object.entries(TOP_LEVEL_DEFAULTS)) {
       if (!doc.has(k)) doc.set(k, v);
     }

     const repos = findReposNode(doc)!;

     const userPinned = existingCodiRevByKey(repos);

     const remaining = repos.items.filter((it) => !isCodiManagedRepo(it));
     repos.items.length = 0;
     for (const it of remaining) repos.items.push(it);

     for (const spec of specs) {
       const userRev = userPinned.get(repoKey(spec.preCommit, spec.name)) ?? null;
       const node = buildRepoEntry(spec, userRev);
       if (node) repos.items.push(node);
     }

     return serialize(doc);
   }
   ```
3. Verify: `pnpm test tests/unit/hooks/yaml-renderer.test.ts` — both cases pass.

**Verification**: `pnpm lint` clean.

### Task 4.5: Add the 10 specific test cases from spec §8.2

**Files**: `tests/unit/hooks/yaml-renderer.test.ts`, `tests/fixtures/precommit/{ts-only,py-only,polyglot,with-user-repo,malformed,nested-hooks,user-pinned-rev}/{input.yaml,expected.yaml}` (new fixture files as needed)
**Est**: 5 minutes

**Steps**:
1. Append the cases (use inline strings rather than fixture files for compactness; only break out fixtures when they exceed ~30 lines):
   ```typescript
   // tests/unit/hooks/yaml-renderer.test.ts (append)
   import type { HookSpec } from '#src/core/hooks/hook-spec.js';

   const eslintSpec: HookSpec = {
     name: 'eslint',
     language: 'typescript',
     category: 'lint',
     files: '**/*.{ts,tsx,js,jsx}',
     stages: ['pre-commit'],
     required: false,
     shell: { command: 'npx eslint --fix', passFiles: true, modifiesFiles: true, toolBinary: 'eslint' },
     preCommit: { kind: 'local', entry: 'npx eslint --fix', language: 'system' },
     installHint: { command: 'npm i -D eslint' },
   };

   describe('renderPreCommitConfig — full case set', () => {
     it('1. empty file produces fresh repos: list with managed entries', () => {
       const out = renderPreCommitConfig([ruff], null);
       expect(out).toMatch(/repos:/);
       expect(out).toMatch(/managed by codi/);
     });

     it('2. existing file with one external repo, no nested hooks → Codi block sibling', () => {
       const existing = `repos:\n  - repo: https://github.com/external/tool\n    rev: v1.0.0\n`;
       const out = renderPreCommitConfig([ruff], existing);
       const idx = out.indexOf('astral-sh/ruff-pre-commit');
       const externalIdx = out.indexOf('external/tool');
       expect(externalIdx).toBeLessThan(idx);
       expect(out).toMatch(/external\/tool/);
     });

     it('3. external repo with nested hooks (C1 case) — Codi block remains a sibling under repos:', () => {
       const existing = `repos:\n  - repo: https://github.com/external/tool\n    rev: v1.0.0\n    hooks:\n      - id: existing-1\n      - id: existing-2\n`;
       const out = renderPreCommitConfig([ruff], existing);
       expect(out).toMatch(/existing-1/);
       expect(out).toMatch(/existing-2/);
       expect(out).toMatch(/astral-sh\/ruff-pre-commit/);
       const lines = out.split('\n');
       const ruffLineIdx = lines.findIndex((l) => l.includes('ruff-pre-commit'));
       expect(lines[ruffLineIdx]).toMatch(/^  - repo:/);
     });

     it('4. multiple external repos at varied indent — output uses two-space', () => {
       const existing = [
         'repos:',
         '  - repo: https://github.com/a/a',
         '    rev: v1',
         '  - repo: https://github.com/b/b',
         '    rev: v2',
         '    hooks:',
         '      - id: b-hook',
         '',
       ].join('\n');
       const out = renderPreCommitConfig([ruff], existing);
       const ruffLine = out.split('\n').find((l) => l.includes('ruff-pre-commit'));
       expect(ruffLine).toMatch(/^  - repo:/);
     });

     it('5. file Codi previously wrote (text-marker form) → migration removes block', () => {
       const existing = [
         'repos:',
         '  - repo: https://github.com/external/tool',
         '    rev: v1.0.0',
         '  # Codi hooks: BEGIN (auto-generated — do not edit between markers)',
         '  - repo: local',
         '    hooks:',
         '      - id: codi-staged-junk-check',
         '        entry: node .git/hooks/codi-staged-junk-check.mjs',
         '  # Codi hooks: END',
         '',
       ].join('\n');
       const out = renderPreCommitConfig([ruff], existing);
       expect(out).not.toMatch(/Codi hooks: BEGIN/);
       expect(out).toMatch(/external\/tool/);
       expect(out).toMatch(/astral-sh\/ruff-pre-commit/);
     });

     it('6. malformed YAML → backup behavior delegated to caller (renderer falls back to empty)', () => {
       const existing = ': not yaml :::\n  - foo\n bar';
       const out = renderPreCommitConfig([ruff], existing);
       // Renderer regenerates from scratch
       expect(out).toMatch(/astral-sh\/ruff-pre-commit/);
     });

     it('7. user-pinned rev preserved on regenerate', () => {
       const existing = [
         'repos:',
         '  - repo: https://github.com/astral-sh/ruff-pre-commit  # managed by codi',
         '    rev: v0.15.10',
         '    hooks:',
         '      - id: ruff-check',
         '        args: [--fix]',
         '',
       ].join('\n');
       const out = renderPreCommitConfig([ruff], existing);
       expect(out).toMatch(/rev: v0\.15\.10/);
       expect(out).not.toMatch(/rev: v0\.15\.12/);
     });

     it('8. polyglot: TS + Python both rendered', () => {
       const out = renderPreCommitConfig([eslintSpec, ruff], null);
       expect(out).toMatch(/eslint/);
       expect(out).toMatch(/astral-sh\/ruff-pre-commit/);
     });

     it('9. re-rendering identical input produces identical output', () => {
       const a = renderPreCommitConfig([eslintSpec, ruff], null);
       const b = renderPreCommitConfig([eslintSpec, ruff], a);
       expect(b).toBe(a);
     });

     it('10. user adds external repo between renders → preserved', () => {
       const first = renderPreCommitConfig([ruff], null);
       const userEdited = first.replace(
         'repos:',
         'repos:\n  - repo: https://github.com/user/added\n    rev: v9\n',
       );
       const second = renderPreCommitConfig([ruff], userEdited);
       expect(second).toMatch(/user\/added/);
       expect(second).toMatch(/astral-sh\/ruff-pre-commit/);
     });
   });
   ```
2. Verify: `pnpm test tests/unit/hooks/yaml-renderer.test.ts` — all 12 cases pass. If any fail, refine `yaml-renderer.ts` until they do; common adjustments include preserving non-Codi entries in their original order and ensuring `serialize()` emits trailing newline.
3. Commit:
   ```
   git add src/core/hooks/yaml-document.ts src/core/hooks/legacy-cleanup.ts \
           src/core/hooks/renderers/yaml-renderer.ts \
           tests/unit/hooks/yaml-document.test.ts tests/unit/hooks/legacy-cleanup.test.ts \
           tests/unit/hooks/yaml-renderer.test.ts \
           package.json pnpm-lock.yaml
   git commit -m "feat(hooks): YAML round-trip renderer with AST markers and legacy cleanup"
   ```

**Verification**: `pnpm test tests/unit/hooks/` all green. Idempotency cases (9) green.

---

## Commit 5 — Shell renderer refactor (byte-identical output)

### Task 5.1: Capture current `buildHuskyCommands` output as golden fixture

**Files**: `tests/fixtures/shell/husky/golden-current.sh` (new), `tests/unit/hooks/shell-renderer.test.ts` (new)
**Est**: 4 minutes

**Steps**:
1. Run an ad-hoc script to dump the current output for a representative set of hooks (TS+Python) using the existing `buildHuskyCommands`. Add a one-time test that calls the existing function and writes its output. The simplest approach: write a snapshot test that captures the current output, then later we ensure the new renderer matches that snapshot. Note: `commitlint` was added to `GLOBAL_HOOKS` in Task 2.5 — filter it out of this baseline so commit 5's parity check stays scoped to behavior that did not change. (The `gitleaks` and `*-doctor` global hooks remain.)
   ```typescript
   // tests/unit/hooks/shell-renderer.test.ts (initial snapshot capture)
   import { describe, it, expect } from 'vitest';
   import { buildHuskyCommands } from '#src/core/hooks/hook-installer.js';
   import { getHooksForLanguage, getGlobalHooks } from '#src/core/hooks/hook-registry.js';

   describe('shell renderer parity (golden snapshot)', () => {
     it('matches snapshot for typescript+python+global hooks (excluding new commitlint)', () => {
       const hooks = [
         ...getHooksForLanguage('typescript'),
         ...getHooksForLanguage('python'),
         ...getGlobalHooks().filter((h) => h.name !== 'commitlint'),
       ];
       const out = buildHuskyCommands(hooks);
       expect(out).toMatchSnapshot();
     });
   });
   ```
2. Run: `pnpm test tests/unit/hooks/shell-renderer.test.ts -u` to write the snapshot.
3. Inspect the generated `tests/unit/hooks/__snapshots__/shell-renderer.test.ts.snap` — confirm it contains the expected shell skeleton (STAGED variable, language comments, grep filters).

**Verification**: snapshot file committed with the captured baseline.

### Task 5.2: Implement `shell-renderer.ts` consuming `HookSpec` and matching the snapshot

**Files**: `src/core/hooks/renderers/shell-renderer.ts` (new), `tests/unit/hooks/shell-renderer.test.ts` (extended)
**Est**: 5 minutes

**Steps**:
1. Implement (largely a move from `buildHuskyCommands`, adapted to `HookSpec.shell`):
   ```typescript
   // src/core/hooks/renderers/shell-renderer.ts
   import type { HookSpec } from '../hook-spec.js';

   function globToGrepPattern(glob: string): string {
     const match = glob.match(/\*\*\/\*\.(?:\{([^}]+)\}|(\w+))$/);
     if (!match) return '';
     const extensions = match[1] ? match[1].split(',') : [match[2]];
     return `\\.(${extensions!.join('|')})$`;
   }

   export function renderShellHooks(specs: HookSpec[], _runner: 'husky' | 'standalone' | 'lefthook'): string {
     const lines: string[] = ['STAGED=$(git diff --cached --name-only --diff-filter=ACMR)'];
     const modifiedVars: string[] = [];
     let lastLanguage: string | undefined;

     for (const spec of specs) {
       const lang = spec.language;
       if (lang !== lastLanguage) {
         lines.push(lang === 'global' ? '# — global —' : `# — ${lang} —`);
         lastLanguage = lang;
       }

       if (!spec.files) {
         const tool = spec.shell.toolBinary;
         if (spec.required) {
           const hint = spec.installHint.command || `install ${tool}`;
           lines.push(
             `if ! command -v ${tool} > /dev/null 2>&1; then`,
             `  echo "  ✗ BLOCKING — install ${spec.name} to commit: ${hint}"`,
             `  exit 1`,
             `fi`,
             spec.shell.command,
           );
         } else {
           lines.push(spec.shell.command);
         }
         continue;
       }

       const grepPattern = globToGrepPattern(spec.files);
       const varName = spec.name.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();

       if (!grepPattern) {
         if (spec.shell.passFiles === false) {
           lines.push(`[ -n "$STAGED" ] && ${spec.shell.command}`);
         } else {
           lines.push(`[ -n "$STAGED" ] && printf '%s\\n' $STAGED | xargs ${spec.shell.command}`);
         }
         if (spec.shell.modifiesFiles) modifiedVars.push('STAGED');
         continue;
       }

       lines.push(`${varName}=$(echo "$STAGED" | grep -E '${grepPattern}' || true)`);

       const tool = spec.shell.toolBinary;
       const hint = spec.installHint.command || `install ${tool}`;
       const passFilesPart = spec.shell.passFiles === false
         ? `  ${spec.shell.command}`
         : `  printf '%s\\n' $${varName} | xargs ${spec.shell.command}`;

       if (spec.required) {
         lines.push(
           `if [ -n "$${varName}" ]; then`,
           `  if ! command -v ${tool} > /dev/null 2>&1 && ! [ -f "./node_modules/.bin/${tool}" ]; then`,
           `    echo "  ✗ BLOCKING — install ${spec.name} to commit: ${hint}"`,
           `    exit 1`,
           `  fi`,
           passFilesPart,
           `fi`,
         );
       } else if (spec.shell.passFiles === false) {
         lines.push(`[ -n "$${varName}" ] && ${spec.shell.command}`);
       } else {
         lines.push(`[ -n "$${varName}" ] && printf '%s\\n' $${varName} | xargs ${spec.shell.command}`);
       }

       if (spec.shell.modifiesFiles) modifiedVars.push(varName);
     }

     if (modifiedVars.length > 0) {
       const unique = [...new Set(modifiedVars)];
       for (const v of unique) {
         lines.push(`[ -n "$${v}" ] && printf '%s\\n' $${v} | xargs git add || true`);
       }
     }

     return lines.join('\n');
   }
   ```
2. Add a parity test that `renderShellHooks` matches the snapshot:
   ```typescript
   // tests/unit/hooks/shell-renderer.test.ts (append)
   import { renderShellHooks } from '#src/core/hooks/renderers/shell-renderer.js';

   describe('shell renderer parity (new path)', () => {
     it('renderShellHooks produces same output as buildHuskyCommands for the canonical input', () => {
       const hooks = [
         ...getHooksForLanguage('typescript'),
         ...getHooksForLanguage('python'),
         ...getGlobalHooks().filter((h) => h.name !== 'commitlint' && !h.name.endsWith('-doctor')),
       ];
       const oldOut = buildHuskyCommands(hooks);
       const newOut = renderShellHooks(hooks, 'husky');
       expect(newOut).toBe(oldOut);
     });
   });
   ```
3. Run: `pnpm test tests/unit/hooks/shell-renderer.test.ts` — must pass byte-identical.
4. If parity fails, walk through differences in the diff output and adjust until equal. Most likely culprits: comment formatting for global hooks (`# — global —`), order of language groups, `printf` quoting.

**Verification**: parity test green. Snapshot still passes.

### Task 5.3: Commit shell renderer

**Files**: shell-renderer.ts, shell-renderer.test.ts, snapshot file
**Est**: 1 minute

**Steps**:
1. Commit:
   ```
   git add src/core/hooks/renderers/shell-renderer.ts \
           tests/unit/hooks/shell-renderer.test.ts \
           tests/unit/hooks/__snapshots__/shell-renderer.test.ts.snap
   git commit -m "refactor(hooks): shell-renderer consumes HookSpec (byte-identical output)"
   ```

**Verification**: `pnpm test` all green.

---

## Commit 6 — Wire new renderers into `hook-installer.ts`

### Task 6.1: Replace `installPreCommitFramework` body with yaml-renderer call

**Files**: `src/core/hooks/hook-installer.ts`, `src/core/hooks/pre-commit-framework.ts`
**Est**: 5 minutes

**Steps**:
1. In `src/core/hooks/pre-commit-framework.ts`, replace the body of `installPreCommitFramework` with:
   ```typescript
   import { renderPreCommitConfig } from './renderers/yaml-renderer.js';

   export async function installPreCommitFramework(
     projectRoot: string,
     hooks: HookEntry[],
   ): Promise<Result<HookFileResult>> {
     const configPath = path.join(projectRoot, '.pre-commit-config.yaml');
     try {
       let existing: string | null = null;
       try {
         existing = await fs.readFile(configPath, 'utf-8');
       } catch {
         existing = null;
       }

       let nextContent: string;
       try {
         nextContent = renderPreCommitConfig(hooks, existing);
       } catch (parseErr) {
         // Malformed YAML — back it up and regenerate
         if (existing) {
           const backupPath = configPath + '.codi-backup';
           await fs.writeFile(backupPath, existing, 'utf-8');
         }
         nextContent = renderPreCommitConfig(hooks, null);
       }

       if (existing !== null && existing === nextContent) {
         return ok({ files: [path.relative(projectRoot, configPath)] });
       }

       await fs.writeFile(configPath, nextContent, 'utf-8');
       return ok({ files: [path.relative(projectRoot, configPath)] });
     } catch (cause) {
       return err([
         createError('E_HOOK_FAILED', {
           hook: 'pre-commit-config',
           reason: `Failed to write config: ${(cause as Error).message}`,
         }),
       ]);
     }
   }
   ```
2. In `src/core/hooks/hook-installer.ts`, switch `installHusky` to call `renderShellHooks` instead of `buildHuskyCommands`:
   ```typescript
   import { renderShellHooks } from './renderers/shell-renderer.js';

   async function installHusky(
     projectRoot: string,
     hooks: HookEntry[],
   ): Promise<Result<HookFileResult>> {
     const huskyFile = path.join(projectRoot, '.husky', 'pre-commit');
     const commands = renderShellHooks(hooks, 'husky');
     const block = `\n# ${PROJECT_NAME_DISPLAY} hooks\n${commands}\n`;
     // existing read/strip/write logic unchanged
     try {
       let existing = '';
       try {
         existing = await fs.readFile(huskyFile, 'utf-8');
       } catch {
         // file doesn't exist yet
       }
       const cleaned = stripGeneratedSection(existing);
       await fs.writeFile(huskyFile, cleaned + block, { encoding: 'utf-8', mode: 0o755 });
       return ok({ files: [path.relative(projectRoot, huskyFile)] });
     } catch (cause) {
       return err([
         createError('E_HOOK_FAILED', {
           hook: 'husky',
           reason: `Failed to write husky hook: ${(cause as Error).message}`,
         }),
       ]);
     }
   }
   ```
3. Keep `buildHuskyCommands` exported (the parity test imports it). Mark `@deprecated` in the JSDoc.
4. Run the full test suite: `pnpm test` — expected: existing tests still pass; the parity test still passes; the YAML renderer's tests pass.
5. Commit:
   ```
   git add src/core/hooks/hook-installer.ts src/core/hooks/pre-commit-framework.ts
   git commit -m "feat(hooks): wire new renderers into hook-installer"
   ```

**Verification**: `pnpm test` all green.

---

## Commit 7 — Wizard summary screen

### Task 7.1: Add wizard summary helper

**Files**: `src/cli/wizard-prompts.ts` (extend) or `src/cli/init-helpers.ts` (extend, depending on existing structure — confirm with `grep -n "summary\|wizard" src/cli/init-helpers.ts src/cli/wizard*.ts | head`); add `tests/unit/wizard/summary.test.ts` (new)
**Est**: 5 minutes

**Steps**:
1. Identify the existing wizard helpers location and pattern. Run `grep -rn "select(\|multiselect(" src/cli/ | head`.
2. Add a helper that renders the summary and prompts `[Enter] / [c] / [s]`. Schematic implementation (adapt to the existing prompt library — likely `@clack/prompts`):
   ```typescript
   // src/cli/wizard-summary.ts (new)
   import * as p from '@clack/prompts';
   import {
     resolvePythonTypeChecker,
     resolveJsFormatLint,
     resolveCommitTypeCheck,
     resolveCommitTestRun,
     type DetectionContext,
   } from '#src/core/hooks/auto-detection.js';

   export interface ToolingDefaults {
     python_type_checker: 'mypy' | 'basedpyright' | 'pyright' | 'off';
     js_format_lint: 'eslint-prettier' | 'biome' | 'off';
     commit_type_check: 'on' | 'off';
     commit_test_run: 'on' | 'off';
   }

   export function computeToolingDefaults(ctx: DetectionContext): ToolingDefaults {
     return {
       python_type_checker: resolvePythonTypeChecker(ctx),
       js_format_lint: resolveJsFormatLint(ctx),
       commit_type_check: resolveCommitTypeCheck(ctx),
       commit_test_run: resolveCommitTestRun(ctx),
     };
   }

   export function renderSummary(d: ToolingDefaults, signals: { pyReason: string; jsReason: string; ttReason: string; trReason: string }): string {
     const lines = [
       'Tooling defaults Codi will install:',
       '',
       `  Python type checker     ${d.python_type_checker.padEnd(15)} (${signals.pyReason})`,
       `  JS lint+format          ${d.js_format_lint.padEnd(15)} (${signals.jsReason})`,
       `  Type-check on commit    ${d.commit_type_check.padEnd(15)} (${signals.ttReason})`,
       `  Tests on commit         ${d.commit_test_run.padEnd(15)} (${signals.trReason})`,
     ];
     return lines.join('\n');
   }

   export async function promptToolingDefaults(
     ctx: DetectionContext,
   ): Promise<{ accepted: ToolingDefaults; skipped: boolean }> {
     const defaults = computeToolingDefaults(ctx);
     const reasons = {
       pyReason: ctx.has.mypyConfig
         ? 'signal: mypy.ini'
         : ctx.has.basedpyrightConfig
           ? 'signal: [tool.basedpyright]'
           : ctx.pythonDeps.includes('django')
             ? 'signal: django dependency'
             : ctx.pythonDeps.includes('fastapi')
               ? 'signal: fastapi dependency'
               : 'fallback default',
       jsReason: ctx.has.biomeConfig
         ? 'signal: biome.json'
         : ctx.has.eslintConfig
           ? 'signal: existing eslint config'
           : 'fallback default',
       ttReason: 'signal: defer to pre-push',
       trReason: 'industry default',
     };

     p.note(renderSummary(defaults, reasons), 'Pre-commit hooks');

     const choice = await p.select({
       message: 'Accept defaults?',
       options: [
         { value: 'accept', label: 'Accept (Enter)' },
         { value: 'customize', label: 'Customize each' },
         { value: 'skip', label: 'Skip hooks entirely' },
       ],
     });

     if (p.isCancel(choice) || choice === 'accept') {
       return { accepted: defaults, skipped: false };
     }
     if (choice === 'skip') {
       return { accepted: defaults, skipped: true };
     }

     // customize
     const py = await p.select({
       message: 'Python type checker',
       initialValue: defaults.python_type_checker,
       options: [
         { value: 'mypy', label: 'mypy (stable, slower)' },
         { value: 'basedpyright', label: 'basedpyright (fast, no npm)' },
         { value: 'pyright', label: 'pyright (npm dep)' },
         { value: 'off', label: 'off' },
       ],
     });
     const js = await p.select({
       message: 'JS lint+format',
       initialValue: defaults.js_format_lint,
       options: [
         { value: 'eslint-prettier', label: 'eslint+prettier' },
         { value: 'biome', label: 'biome' },
         { value: 'off', label: 'off' },
       ],
     });
     const tt = await p.select({
       message: 'Run type-check on commit?',
       initialValue: defaults.commit_type_check,
       options: [
         { value: 'on', label: 'on (slower commits)' },
         { value: 'off', label: 'off (defer to pre-push)' },
       ],
     });
     const tr = await p.select({
       message: 'Run test suite on commit?',
       initialValue: defaults.commit_test_run,
       options: [
         { value: 'on', label: 'on (slow)' },
         { value: 'off', label: 'off (industry default)' },
       ],
     });

     return {
       accepted: {
         python_type_checker: (p.isCancel(py) ? defaults.python_type_checker : py) as ToolingDefaults['python_type_checker'],
         js_format_lint: (p.isCancel(js) ? defaults.js_format_lint : js) as ToolingDefaults['js_format_lint'],
         commit_type_check: (p.isCancel(tt) ? defaults.commit_type_check : tt) as ToolingDefaults['commit_type_check'],
         commit_test_run: (p.isCancel(tr) ? defaults.commit_test_run : tr) as ToolingDefaults['commit_test_run'],
       },
       skipped: false,
     };
   }
   ```
3. Add a unit test that exercises only the pure pieces (`computeToolingDefaults`, `renderSummary`):
   ```typescript
   // tests/unit/wizard/summary.test.ts
   import { describe, it, expect } from 'vitest';
   import { computeToolingDefaults, renderSummary } from '#src/cli/wizard-summary.js';

   const baseCtx = {
     projectRoot: '/',
     pythonDeps: [],
     jsDeps: [],
     locFiles: { python: 0, ts: 0, js: 0 },
     has: {
       mypyConfig: false,
       basedpyrightConfig: false,
       pyrightConfig: false,
       biomeConfig: false,
       eslintConfig: false,
       prettierConfig: false,
       monorepoSignal: false,
     },
   };

   describe('wizard summary', () => {
     it('computeToolingDefaults returns industry defaults for empty ctx', () => {
       expect(computeToolingDefaults(baseCtx)).toEqual({
         python_type_checker: 'basedpyright',
         js_format_lint: 'eslint-prettier',
         commit_type_check: 'off',
         commit_test_run: 'off',
       });
     });

     it('renderSummary contains all four labels', () => {
       const d = computeToolingDefaults(baseCtx);
       const text = renderSummary(d, { pyReason: 'fallback', jsReason: 'fallback', ttReason: 'defer', trReason: 'industry' });
       expect(text).toMatch(/Python type checker/);
       expect(text).toMatch(/JS lint\+format/);
       expect(text).toMatch(/Type-check on commit/);
       expect(text).toMatch(/Tests on commit/);
     });
   });
   ```
4. Verify: `pnpm test tests/unit/wizard/summary.test.ts` — passing.

**Verification**: pure helpers tested. Interactive `promptToolingDefaults` is exercised by E2E in commit 9.

### Task 7.2: Wire summary into init flow + persist to flags.yaml

**Files**: `src/cli/init.ts`, `src/cli/init-helpers.ts`
**Est**: 5 minutes

**Steps**:
1. The wizard summary must run between language detection (`init.ts:253`, `stack = wizardResult.languages;`) and the hook-install block at `init.ts:599-602` (where `resolvedFlags = configResult.data.flags` is consumed). The cleanest insertion point is **right after line 253** — capture the user's tooling picks into a local variable, then thread that variable into the flags-write path. Two options for persistence:
   - (a) extend the wizard return value carried into `applyConfiguration(configResult.data, projectRoot, ...)` (line 553), adding the four flags to `configResult.data.flags` before `applyConfiguration` writes `.codi/flags.yaml` — preferred path.
   - (b) write directly via the existing `saveFlags` / `writeFile` helper used by `init-helpers.ts:132` (`fs.writeFile(path.join(configDir, FLAGS_FILENAME), ...)`).

   Schematic insertion at line 254 (after `stack = wizardResult.languages;`):
   ```typescript
   import { buildDetectionContext } from '#src/core/hooks/auto-detection.js';
   import { promptToolingDefaults } from '#src/cli/wizard-summary.js';

   // existing: stack = wizardResult.languages;
   const detectCtx = await buildDetectionContext(projectRoot);
   const tooling = await promptToolingDefaults(detectCtx);
   // tooling.accepted is consumed below when configResult.data.flags is finalized
   ```
   Then, at line 602 (inside `if (configResult.ok) { ... const resolvedFlags = configResult.data.flags; }`), merge the wizard picks before `generateHooksConfig`:
   ```typescript
   if (!tooling.skipped) {
     resolvedFlags.python_type_checker = { value: tooling.accepted.python_type_checker, mode: 'enabled' };
     resolvedFlags.js_format_lint = { value: tooling.accepted.js_format_lint, mode: 'enabled' };
     resolvedFlags.commit_type_check = { value: tooling.accepted.commit_type_check, mode: 'enabled' };
     resolvedFlags.commit_test_run = { value: tooling.accepted.commit_test_run, mode: 'enabled' };
   }
   const hooksConfig = generateHooksConfig(resolvedFlags, stack);
   ```
   Confirm the exact flag-value shape (`{ value, mode }` vs other) with `grep -n "resolvedFlags\\[\\|resolvedFlags\\." src/cli/init.ts src/core/flags/*.ts | head`.
2. To persist the wizard picks across reruns (so `codi generate` sees them as non-`auto`), additionally update the call to `applyConfiguration` at line 553 — pass the merged flags object so it lands in `.codi/flags.yaml`. Inspect `applyConfiguration`'s signature to confirm where the flags map is sourced.
3. Run: `pnpm test` — existing tests should pass. If any init snapshot test fails because of the new summary screen, update the snapshot with `pnpm test -u` after manually verifying the new output is correct.

**Verification**: `pnpm test` all green; `.codi/flags.yaml` after `codi init` contains the four new flag entries; rerunning `codi generate` does not re-prompt.

### Task 7.3: Honor persisted flags during `codi generate` (no re-prompt)

**Files**: `src/cli/generate.ts`, `src/core/hooks/hook-config-generator.ts`
**Est**: 4 minutes

**Steps**:
1. In `generate.ts`, after loading flags, call `buildDetectionContext` once but only use it to populate `'auto'` flag values:
   ```typescript
   import { buildDetectionContext } from '#src/core/hooks/auto-detection.js';
   import {
     resolvePythonTypeChecker,
     resolveJsFormatLint,
     resolveCommitTypeCheck,
     resolveCommitTestRun,
   } from '#src/core/hooks/auto-detection.js';

   async function resolveAutoFlags(projectRoot: string, flags: ResolvedFlags): Promise<ResolvedFlags> {
     const out = { ...flags };
     if (out.python_type_checker?.value === 'auto' || out.js_format_lint?.value === 'auto'
         || out.commit_type_check?.value === 'auto' || out.commit_test_run?.value === 'auto') {
       const ctx = await buildDetectionContext(projectRoot);
       if (out.python_type_checker?.value === 'auto') {
         out.python_type_checker = { ...out.python_type_checker, value: resolvePythonTypeChecker(ctx) };
       }
       if (out.js_format_lint?.value === 'auto') {
         out.js_format_lint = { ...out.js_format_lint, value: resolveJsFormatLint(ctx) };
       }
       if (out.commit_type_check?.value === 'auto') {
         out.commit_type_check = { ...out.commit_type_check, value: resolveCommitTypeCheck(ctx) };
       }
       if (out.commit_test_run?.value === 'auto') {
         out.commit_test_run = { ...out.commit_test_run, value: resolveCommitTestRun(ctx) };
       }
     }
     return out;
   }
   ```
2. Insert call site before `generateHooksConfig(resolvedFlags, languages)`:
   ```typescript
   const flagsForHooks = await resolveAutoFlags(projectRoot, resolvedFlags);
   const hooksConfig = generateHooksConfig(flagsForHooks, languages);
   ```
3. In `hook-config-generator.ts`, consume the new flags. Specifically: filter Python type checker hooks by `python_type_checker` value, JS lint+format hooks by `js_format_lint`, override `stages:` based on `commit_type_check` and `commit_test_run`. Add inline near existing flag mappings:
   ```typescript
   function selectedPythonTypeChecker(flags: ResolvedFlags): 'mypy' | 'basedpyright' | 'pyright' | 'off' {
     const f = flags['python_type_checker'];
     if (!f || f.value === 'auto' || f.mode === 'disabled') return 'basedpyright';
     return f.value as 'mypy' | 'basedpyright' | 'pyright' | 'off';
   }

   function selectedJsFormatLint(flags: ResolvedFlags): 'eslint-prettier' | 'biome' | 'off' {
     const f = flags['js_format_lint'];
     if (!f || f.value === 'auto' || f.mode === 'disabled') return 'eslint-prettier';
     return f.value as 'eslint-prettier' | 'biome' | 'off';
   }
   ```
   Then in the language-hook loop, skip hooks that don't match the selection (e.g., if `selectedPythonTypeChecker` is `mypy`, skip `basedpyright`/`pyright`; if `off`, skip all three).
4. Verify: `pnpm test` — green.
5. Commit:
   ```
   git add src/cli/wizard-summary.ts src/cli/init.ts src/cli/init-helpers.ts \
           src/cli/generate.ts src/core/hooks/hook-config-generator.ts \
           tests/unit/wizard/summary.test.ts
   git commit -m "feat(wizard): tooling defaults summary screen with customize walkthrough"
   ```

**Verification**: `pnpm test` all green.

---

## Commit 8 — Defaults flip + commitlint + scope expansion + top-level keys

This was already largely accomplished by tasks 2.2–2.5 (registry shape carries new defaults). Remaining surgical changes:

### Task 8.1: Ensure `prettier` includes commit-msg-friendly globs and `bandit` includes `[toml]` in installHint

Already done in tasks 2.2/2.3. Verify by re-running `pnpm test tests/unit/hooks/hook-registry.test.ts`. No additional changes here — confirm and commit nothing if all good.

### Task 8.2: Ensure stages default to pre-push for type-check + tests in `getTestHooksForLanguages`

**Files**: `src/core/hooks/hook-config-generator.ts`
**Est**: 3 minutes

**Steps**:
1. Find `getTestHooksForLanguages` (line 327) and replace each entry with `HookSpec`-shaped values carrying `stages: ['pre-push']`. The function's return type is `HookEntry[]`; since Task 2.5 made `HookEntry = HookSpec` (alias), the new objects are type-compatible without changing the signature. Example for the `python` entry:
   ```typescript
   python: {
     name: 'test-py',
     language: 'python',
     category: 'test',
     files: '',
     stages: ['pre-push'],
     required: false,
     shell: { command: getPythonTestCommand(), passFiles: false, modifiesFiles: false, toolBinary: 'pytest' },
     preCommit: { kind: 'local', entry: getPythonTestCommand(), language: 'system', passFilenames: false },
     installHint: { command: 'pip install pytest' },
   },
   ```
   Apply the same pattern to all language entries in the `TEST_COMMANDS` map.
2. Update `isTestBeforeCommitEnabled` to consult `commit_test_run` flag instead of (or in addition to) `test_before_commit`:
   ```typescript
   function isTestBeforeCommitEnabled(flags: ResolvedFlags): boolean {
     const newFlag = flags['commit_test_run'];
     if (newFlag && newFlag.mode !== 'disabled') return newFlag.value === 'on';
     // backward compat
     const flag = flags['test_before_commit'];
     if (!flag) return false;
     if (flag.mode === 'disabled') return false;
     return flag.value !== false;
   }
   ```
3. Verify: `pnpm test` — green.

**Verification**: tests + type-check stages now default to `pre-push`.

### Task 8.3: Add commitlint to global hooks emission

**Files**: `src/core/hooks/hook-config-generator.ts`
**Est**: 2 minutes

**Steps**:
1. Inside `generateHooksConfig`, after the existing global hook emission loop, add commitlint conditionally (defaults: enabled when commit-msg validation is on):
   ```typescript
   import { getCommitlintHook } from './hook-registry.js';

   if (commitMsgValidation /* existing var */) {
     const cl = getCommitlintHook();
     const alreadyAdded = allHooks.some((h) => h.name === cl.name);
     if (!alreadyAdded) allHooks.push(cl);
   }
   ```
2. Verify: `pnpm test` — green.

### Task 8.4: Commit

**Steps**:
1. Commit:
   ```
   git add src/core/hooks/hook-config-generator.ts
   git commit -m "feat(hooks): flip defaults for type-check and tests, add commitlint, expand prettier scope"
   ```

**Verification**: `pnpm test` all green.

---

## Commit 9 — Integration + E2E

### Task 9.1: Integration test for `installHooks` on a polyglot temp dir

**Files**: `tests/integration/hook-install-precommit.test.ts` (new)
**Est**: 5 minutes

**Steps**:
1. Add the integration test:
   ```typescript
   // tests/integration/hook-install-precommit.test.ts
   import { describe, it, expect } from 'vitest';
   import { mkdtemp, writeFile, mkdir, readFile } from 'node:fs/promises';
   import { tmpdir } from 'node:os';
   import path from 'node:path';
   import { installHooks } from '#src/core/hooks/hook-installer.js';
   import { generateHooksConfig } from '#src/core/hooks/hook-config-generator.js';
   import type { ResolvedFlags } from '#src/types/flags.js';

   async function makeRepo(extra: Record<string, string> = {}): Promise<string> {
     const dir = await mkdtemp(path.join(tmpdir(), 'codi-pc-'));
     await mkdir(path.join(dir, '.git'), { recursive: true });
     await writeFile(path.join(dir, '.git', 'HEAD'), 'ref: refs/heads/main\n');
     for (const [rel, content] of Object.entries(extra)) {
       const full = path.join(dir, rel);
       await mkdir(path.dirname(full), { recursive: true });
       await writeFile(full, content);
     }
     return dir;
   }

   const minimalFlags: ResolvedFlags = {
     security_scan: { value: true, mode: 'enabled' },
     type_checking: { value: 'on', mode: 'enabled' },
   } as unknown as ResolvedFlags;

   describe('installHooks for pre-commit framework runner — polyglot', () => {
     it('produces a valid YAML with managed entries for TS+Python', async () => {
       const root = await makeRepo({
         'package.json': '{"name":"app"}',
         'pyproject.toml': '[project]\nname = "x"\ndependencies = ["fastapi"]\n',
         'tsconfig.json': '{}',
       });
       const cfg = generateHooksConfig(minimalFlags, ['typescript', 'python']);
       const result = await installHooks({
         projectRoot: root,
         runner: 'pre-commit',
         hooks: cfg.hooks,
         flags: minimalFlags,
         secretScan: cfg.secretScan,
         fileSizeCheck: cfg.fileSizeCheck,
         stagedJunkCheck: cfg.stagedJunkCheck,
         commitMsgValidation: cfg.commitMsgValidation,
         importDepthCheck: cfg.importDepthCheck,
         docNamingCheck: cfg.docNamingCheck,
       });
       expect(result.ok).toBe(true);
       const yaml = await readFile(path.join(root, '.pre-commit-config.yaml'), 'utf-8');
       expect(yaml).toMatch(/repos:/);
       expect(yaml).toMatch(/managed by codi/);
       expect(yaml).toMatch(/astral-sh\/ruff-pre-commit/);
       expect(yaml).toMatch(/gitleaks/);
       expect(yaml).toMatch(/default_install_hook_types/);
     });

     it('migrates a file with the C1 broken layout', async () => {
       const broken = [
         'repos:',
         '  - repo: https://github.com/external/tool',
         '    rev: v1.0.0',
         '    hooks:',
         '      # Codi hooks: BEGIN (auto-generated — do not edit between markers)',
         '      - repo: local',
         '        hooks:',
         '          - id: codi-staged-junk-check',
         '      # Codi hooks: END',
         '',
       ].join('\n');
       const root = await makeRepo({ '.pre-commit-config.yaml': broken });
       const cfg = generateHooksConfig(minimalFlags, ['typescript']);
       await installHooks({
         projectRoot: root,
         runner: 'pre-commit',
         hooks: cfg.hooks,
         flags: minimalFlags,
       } as Parameters<typeof installHooks>[0]);
       const yaml = await readFile(path.join(root, '.pre-commit-config.yaml'), 'utf-8');
       expect(yaml).not.toMatch(/Codi hooks: BEGIN/);
       expect(yaml).toMatch(/external\/tool/);
       expect(yaml).toMatch(/managed by codi/);
     });
   });
   ```
2. Verify: `pnpm test:integration tests/integration/hook-install-precommit.test.ts`.

**Verification**: integration tests green.

### Task 9.2: E2E test using `pre-commit validate-config`

**Files**: `tests/e2e/precommit-multilanguage.test.ts` (new)
**Est**: 5 minutes

**Steps**:
1. Add the E2E test (skipped when `pre-commit` binary missing):
   ```typescript
   // tests/e2e/precommit-multilanguage.test.ts
   import { describe, it, expect } from 'vitest';
   import { execFileSync } from 'node:child_process';
   import { mkdtemp, writeFile, mkdir, readFile } from 'node:fs/promises';
   import { tmpdir } from 'node:os';
   import path from 'node:path';

   function commandExists(cmd: string): boolean {
     try {
       execFileSync('which', [cmd], { stdio: 'ignore' });
       return true;
     } catch {
       return false;
     }
   }

   const hasPreCommit = commandExists('pre-commit');

   describe.skipIf(!hasPreCommit)('precommit-multilanguage E2E', () => {
     it('generated config validates with pre-commit validate-config', async () => {
       const { renderPreCommitConfig } = await import('#src/core/hooks/renderers/yaml-renderer.js');
       const { getHooksForLanguage, getGlobalHooks } = await import('#src/core/hooks/hook-registry.js');
       const specs = [
         ...getHooksForLanguage('typescript'),
         ...getHooksForLanguage('python'),
         ...getGlobalHooks(),
       ];
       const yaml = renderPreCommitConfig(specs, null);
       const dir = await mkdtemp(path.join(tmpdir(), 'codi-e2e-'));
       await mkdir(path.join(dir, '.git'), { recursive: true });
       await writeFile(path.join(dir, '.git', 'HEAD'), 'ref: refs/heads/main\n');
       await writeFile(path.join(dir, '.pre-commit-config.yaml'), yaml);

       expect(() =>
         execFileSync('pre-commit', ['validate-config'], { cwd: dir, stdio: 'pipe' }),
       ).not.toThrow();
     });
   });
   ```
2. Verify: `pnpm test:e2e tests/e2e/precommit-multilanguage.test.ts` — passes locally if `pre-commit` available; skips otherwise.
3. Update CI workflow (`.github/workflows/test.yml` or equivalent) to install `pre-commit`:
   ```yaml
   - name: Install pre-commit (for E2E)
     run: pip install pre-commit
   ```
4. Commit:
   ```
   git add tests/integration/hook-install-precommit.test.ts \
           tests/e2e/precommit-multilanguage.test.ts \
           .github/workflows/*.yml
   git commit -m "test(hooks): integration plus e2e for polyglot precommit and migration"
   ```

**Verification**: `pnpm test` (unit+integration) green; E2E green when `pre-commit` is installed.

---

## Commit 10 — CHANGELOG + migration note

### Task 10.1: Update CHANGELOG.md and write migration guide

**Files**: `CHANGELOG.md`, `docs/src/content/docs/guides/hooks.md` (or create new)
**Est**: 4 minutes

**Steps**:
1. Prepend to `CHANGELOG.md` (insert under the next-release header — confirm format from the file's existing entries):
   ```markdown
   ## [Unreleased]

   ### Fixed
   - Pre-commit YAML insertion no longer corrupts `.pre-commit-config.yaml` when the project has external repos with nested `hooks:` lists. The renderer now uses YAML AST round-trip via the `yaml` package, identifying Codi-managed entries by `# managed by codi` comments. Malformed input is backed up to `.pre-commit-config.yaml.codi-backup` before regeneration.

   ### Changed
   - Pre-commit framework runner now emits canonical upstream `repo:` references with pinned `rev:` (ruff, mypy, bandit, prettier, biome, commitlint, gitleaks) and `additional_dependencies` where required. Codi's own `.mjs` scripts remain `repo: local`.
   - Default Python type checker is now **basedpyright** (PyPI wheel, no npm dependency) when no project signals point elsewhere. mypy chosen automatically when project uses Django, SQLAlchemy, or has `[tool.mypy]`.
   - Type-checking (`tsc`, `mypy`, `basedpyright`, `pyright`) and full test suites now default to **pre-push** stage. Override via the `commit_type_check` and `commit_test_run` flags or the wizard's customize flow.
   - Bandit is now invoked with `-lll` (high severity only) by default; install hint corrected to `pip install "bandit[toml]"`.
   - Prettier scope expanded to `{ts,tsx,js,jsx,mjs,cjs,json,md,mdx,yaml,yml,css,scss,html}`.
   - `.pre-commit-config.yaml` now includes top-level `default_install_hook_types`, `default_language_version`, `minimum_pre_commit_version`, and a global `exclude:` for `node_modules`, `.venv`, `dist`, `build`, `coverage`, `.next`, `.codi`.

   ### Added
   - Four new flags: `python_type_checker`, `js_format_lint`, `commit_type_check`, `commit_test_run`. All default to `'auto'`; `codi init` shows a summary screen with detected picks and offers a customize walkthrough.
   - Commitlint hook (`commit-msg` stage) wired to the canonical upstream pre-commit hook with `@commitlint/config-conventional`.

   ### Migration
   On first regeneration after upgrading, Codi:
   1. Strips any legacy `# Codi hooks: BEGIN/END` text-marker block.
   2. If your `.pre-commit-config.yaml` is malformed, copies it to `.pre-commit-config.yaml.codi-backup` and rewrites from scratch.
   3. Re-emits Codi-managed entries with the new layout. Your manually-edited `rev:` values on Codi-managed entries are preserved with a one-line warning.
   ```
2. Add a focused doc page `docs/src/content/docs/guides/precommit-hooks.md` (or update existing) summarizing the four flags and runner choice. Skeleton:
   ```markdown
   ---
   title: Pre-commit hooks
   ---

   Codi installs a pre-commit hook configuration on `codi init`. The runner is auto-detected:

   - `.husky/` exists → husky
   - `.pre-commit-config.yaml` exists → pre-commit framework
   - `lefthook.yml` exists → lefthook
   - none → standalone `.git/hooks/pre-commit`

   ## Tooling defaults

   ...
   ```
3. Commit:
   ```
   git add CHANGELOG.md docs/src/content/docs/guides/precommit-hooks.md
   git commit -m "docs: changelog and migration note for precommit v2 layout"
   ```

**Verification**: doc pages build (`pnpm --filter docs build` or equivalent).

---

## Final — push branch + open PR

### Task F.1: Push branch and open PR

**Files**: none
**Est**: 1 minute

**Steps**:
1. Push: `git push -u origin feat/precommit-multilanguage-redesign`
2. Open PR via GitHub CLI (`gh pr create --base develop --fill`) or web UI. PR title: `feat(hooks): pre-commit multi-language redesign`. PR body should reference `docs/20260428_1430_SPEC_precommit-multilanguage-redesign.md` and `docs/20260428_1500_PLAN_precommit-multilanguage-impl.md`.
3. Wait for CI green.

**Verification**: PR opened, CI green, ready for review.

---

## Summary

- 10 commits, ~37 atomic tasks, ~1.5–2.5 weeks of focused work depending on skill.
- All commits chained on a single branch → single PR.
- Test pyramid: unit (per layer) + golden (renderers) + integration (`installHooks` end-to-end) + E2E (`pre-commit validate-config`).
- Migration is automatic; users with broken configs get a `.codi-backup` plus a regenerated v2 layout.
- No feature gate; the YAML AST round-trip plus byte-identical shell parity makes this safe to ship in one cut.
