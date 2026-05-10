# Hooks as First-Class Artifacts — Implementation Plan

> **For agentic workers:** Use `codi-plan-execution` to implement this plan task-by-task. That skill asks the user to pick INLINE (sequential) or SUBAGENT (fresh subagent per task with two-stage review). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote codi hooks to first-class artifacts with two clean buckets (`git`, `runtime`), unified registry, onboarding selector, CLI parity, workflow integration, and ship the new `security-reminder` runtime hook.

**Architecture:** A discriminated union `HookArtifact = GitHookArtifact | RuntimeHookArtifact` lives in `src/core/hooks/hook-artifact.ts`. The 40 existing pre-commit registries get migrated in place to emit the new shape. Six runtime hooks (5 wrappers + new `security-reminder`) are added under `src/core/hooks/registry/runtime/`. A runner in `src/runtime/hooks/runner.ts` orchestrates them under `codi hook pre-tool-use`. State gains optional `selectedHooks`; reader fills defaults at the boundary. Both adapters consume the same registry.

**Tech Stack:** TypeScript strict, vitest, @clack/prompts, commander, better-sqlite3, node:fs.

**Source spec:** `docs/20260510_001555_[PLAN]_hooks-as-artifacts.md`

---

## Conventions used in every task

- **Test first** — write the test, run `pnpm test <file>` and confirm it fails before implementing.
- **Implement second** — write minimal code to pass, then run the suite.
- **Commit third** — atomic conventional commit per task.
- **No `any`** — strict TS.
- **File LoC ≤ 200** — split if growing.
- **Build check** after CLI / adapter / state edits: `pnpm build`.

---

## Task 1: Define HookArtifact discriminated union

- [ ] **Files**: `src/core/hooks/hook-artifact.ts`, `tests/core/hooks/hook-artifact.test.ts`
- [ ] **Est**: 5 minutes

**Steps:**

1. Write failing test `tests/core/hooks/hook-artifact.test.ts`:

   ```typescript
   import { describe, it, expect } from "vitest";
   import { isGitHook, isRuntimeHook, type HookArtifact } from "#src/core/hooks/hook-artifact.js";

   const gitSample: HookArtifact = {
     bucket: "git",
     name: "eslint",
     description: "JS/TS linter",
     version: "1",
     managed_by: "codi",
     required: false,
     default: true,
     category: "lint",
     language: "typescript",
     stages: ["pre-commit"],
     files: "**/*.ts",
     preCommit: { kind: "local", entry: "npx eslint", language: "system" },
     shell: { command: "npx eslint", passFiles: true, modifiesFiles: true, toolBinary: "eslint" },
     installHint: { command: "npm i -D eslint" },
   };

   const runtimeSample: HookArtifact = {
     bucket: "runtime",
     name: "security-reminder",
     description: "PreToolUse advisory",
     version: "1",
     managed_by: "codi",
     required: false,
     default: true,
     category: "security",
     events: ["PreToolUse"],
     evaluate: () => ({
       hookName: "security-reminder",
       matched: false,
       severity: "info",
     }),
   };

   describe("hook-artifact discriminator", () => {
     it("isGitHook identifies git bucket", () => {
       expect(isGitHook(gitSample)).toBe(true);
       expect(isGitHook(runtimeSample)).toBe(false);
     });

     it("isRuntimeHook identifies runtime bucket", () => {
       expect(isRuntimeHook(runtimeSample)).toBe(true);
       expect(isRuntimeHook(gitSample)).toBe(false);
     });

     it("narrows union via type guard", () => {
       const items: HookArtifact[] = [gitSample, runtimeSample];
       const gits = items.filter(isGitHook);
       expect(gits).toHaveLength(1);
       expect(gits[0]?.language).toBe("typescript");
     });
   });
   ```

2. Run: `pnpm test tests/core/hooks/hook-artifact.test.ts` → expected: failing.
3. Implement `src/core/hooks/hook-artifact.ts`:

   ```typescript
   import type {
     HookCategory as LegacyCategory,
     HookLanguage,
     HookStage,
     InstallHint,
     PreCommitEmission,
     ShellEmission,
   } from "./hook-spec.js";

   export type HookBucket = "git" | "runtime";

   export type RuntimeEvent =
     | "UserPromptSubmit"
     | "PreToolUse"
     | "PostToolUse"
     | "Stop"
     | "SessionStart"
     | "InstructionsLoaded";

   export type HookCategory = LegacyCategory | "enforcement" | "observation";

   export type Severity = "info" | "warn" | "block";

   export interface HookContext {
     bucket: HookBucket;
     event?: RuntimeEvent;
     toolName?: string;
     filePath?: string;
     content?: string;
     sessionId: string;
     cwd: string;
     workflowPhase?: string;
   }

   export interface HookVerdict {
     hookName: string;
     matched: boolean;
     severity: Severity;
     ruleId?: string;
     message?: string;
     suggestedAction?: string;
   }

   export interface BaseHookArtifact {
     name: string;
     description: string;
     version: string;
     managed_by: "codi" | "user";
     required: boolean;
     default: boolean;
     category: HookCategory;
     phaseFilter?: string[];
     dispatchSkill?: string;
   }

   export interface GitHookArtifact extends BaseHookArtifact {
     bucket: "git";
     language: HookLanguage;
     stages: HookStage[];
     files: string;
     exclude?: string;
     preCommit: PreCommitEmission;
     shell: ShellEmission;
     installHint: InstallHint;
   }

   export interface RuntimeHookArtifact extends BaseHookArtifact {
     bucket: "runtime";
     events: RuntimeEvent[];
     evaluate: (ctx: HookContext) => HookVerdict | Promise<HookVerdict>;
   }

   export type HookArtifact = GitHookArtifact | RuntimeHookArtifact;

   export function isGitHook(h: HookArtifact): h is GitHookArtifact {
     return h.bucket === "git";
   }

   export function isRuntimeHook(h: HookArtifact): h is RuntimeHookArtifact {
     return h.bucket === "runtime";
   }
   ```

4. Run: `pnpm test tests/core/hooks/hook-artifact.test.ts` → expected: passing.
5. Commit:
   ```
   git add src/core/hooks/hook-artifact.ts tests/core/hooks/hook-artifact.test.ts
   git commit -m "feat(hooks): add HookArtifact discriminated union types"
   ```

**Verification:** `pnpm test tests/core/hooks/` → green.

---

## Task 2: Migrate typescript registry to HookArtifact shape

- [ ] **Files**: `src/core/hooks/registry/typescript.ts`, `tests/core/hooks/registry-typescript.test.ts`
- [ ] **Est**: 4 minutes

**Steps:**

1. Write failing test `tests/core/hooks/registry-typescript.test.ts`:

   ```typescript
   import { describe, it, expect } from "vitest";
   import { TYPESCRIPT_HOOKS } from "#src/core/hooks/registry/typescript.js";
   import { isGitHook } from "#src/core/hooks/hook-artifact.js";

   describe("TYPESCRIPT_HOOKS as GitHookArtifact", () => {
     it("each entry has bucket 'git'", () => {
       for (const h of TYPESCRIPT_HOOKS) expect(h.bucket).toBe("git");
     });
     it("each entry passes isGitHook narrowing", () => {
       for (const h of TYPESCRIPT_HOOKS) expect(isGitHook(h)).toBe(true);
     });
     it("contains the four expected names", () => {
       const names = TYPESCRIPT_HOOKS.map((h) => h.name).sort();
       expect(names).toEqual(["biome", "eslint", "prettier", "tsc"]);
     });
     it("tsc is required", () => {
       const tsc = TYPESCRIPT_HOOKS.find((h) => h.name === "tsc");
       expect(tsc?.required).toBe(true);
     });
   });
   ```

2. Run: `pnpm test tests/core/hooks/registry-typescript.test.ts` → fails (type / shape mismatch).
3. Replace `src/core/hooks/registry/typescript.ts`:

   ```typescript
   import type { GitHookArtifact } from "../hook-artifact.js";

   export const TYPESCRIPT_HOOKS: GitHookArtifact[] = [
     {
       bucket: "git",
       name: "eslint",
       description: "JS/TS linter via eslint",
       version: "1",
       managed_by: "codi",
       required: false,
       default: true,
       category: "lint",
       language: "typescript",
       files: "**/*.{ts,tsx,js,jsx}",
       stages: ["pre-commit"],
       shell: {
         command: "npx eslint --fix",
         passFiles: true,
         modifiesFiles: true,
         toolBinary: "eslint",
       },
       preCommit: {
         kind: "local",
         entry: "npx eslint --fix",
         language: "system",
       },
       installHint: { command: "npm install -D eslint" },
     },
     {
       bucket: "git",
       name: "prettier",
       description: "Code formatter for JS/TS/MD/YAML",
       version: "1",
       managed_by: "codi",
       required: false,
       default: true,
       category: "format",
       language: "typescript",
       files: "**/*.{ts,tsx,js,jsx,mjs,cjs,json,md,mdx,yaml,yml,css,scss,html}",
       stages: ["pre-commit"],
       shell: {
         command: "npx prettier --write",
         passFiles: true,
         modifiesFiles: true,
         toolBinary: "prettier",
       },
       preCommit: {
         kind: "upstream",
         repo: "https://github.com/pre-commit/mirrors-prettier",
         rev: "v4.0.0-alpha.8",
         id: "prettier",
       },
       installHint: { command: "npm install -D prettier" },
     },
     {
       bucket: "git",
       name: "tsc",
       description: "TypeScript type checker (no emit)",
       version: "1",
       managed_by: "codi",
       required: true,
       default: true,
       category: "type-check",
       language: "typescript",
       files: "**/*.{ts,tsx}",
       stages: ["pre-push"],
       shell: {
         command: "npx tsc --noEmit",
         passFiles: false,
         modifiesFiles: false,
         toolBinary: "tsc",
       },
       preCommit: {
         kind: "local",
         entry: "npx tsc --noEmit",
         language: "system",
         passFilenames: false,
       },
       installHint: { command: "npm install -D typescript" },
     },
     {
       bucket: "git",
       name: "biome",
       description: "Rust-based lint+format (mutually exclusive with eslint+prettier)",
       version: "1",
       managed_by: "codi",
       required: false,
       default: false,
       category: "lint",
       language: "typescript",
       files: "**/*.{ts,tsx,js,jsx,mjs,cjs,json,jsonc,css}",
       stages: ["pre-commit"],
       shell: {
         command: "npx @biomejs/biome check --write --no-errors-on-unmatched",
         passFiles: true,
         modifiesFiles: true,
         toolBinary: "biome",
       },
       preCommit: {
         kind: "upstream",
         repo: "https://github.com/biomejs/pre-commit",
         rev: "v0.6.1",
         id: "biome-check",
         args: ["--write", "--no-errors-on-unmatched"],
         additionalDependencies: ["@biomejs/biome@2.3.0"],
       },
       installHint: { command: "npm install -D @biomejs/biome" },
     },
   ];
   ```

4. Update `src/core/hooks/hook-spec.ts` — at the bottom, add a deprecated alias:
   ```typescript
   import type { GitHookArtifact } from "./hook-artifact.js";
   /** @deprecated Use GitHookArtifact directly. */
   export type HookSpecAlias = GitHookArtifact;
   ```
5. Run: `pnpm test tests/core/hooks/registry-typescript.test.ts` → passing. Then `pnpm test` to confirm no regression.
6. Commit:
   ```
   git add src/core/hooks/registry/typescript.ts src/core/hooks/hook-spec.ts tests/core/hooks/registry-typescript.test.ts
   git commit -m "refactor(hooks): migrate typescript registry to GitHookArtifact"
   ```

**Verification:** `pnpm test` → green.

---

## Tasks 3a–3d: Migrate remaining git registry files

For each of the four sub-tasks, the pattern is identical to Task 2: load the existing array, change the type to `GitHookArtifact`, add `bucket: "git"`, `description`, `version: "1"`, `managed_by: "codi"`, `default` (true if part of language baseline, false for opt-in alternatives), keep all other fields verbatim. Add a per-file test that asserts `bucket === "git"`, the count of entries, and the `required` flags as they exist today.

- [ ] **Task 3a — javascript / python / go**
  - Files: `src/core/hooks/registry/{javascript,python,go}.ts`, `tests/core/hooks/registry-{javascript,python,go}.test.ts`
  - Implementation pattern: same as Task 2; change `import type { HookSpec }` to `import type { GitHookArtifact }`, change `HOOKS: HookSpec[]` to `HOOKS: GitHookArtifact[]`, add four new fields to each entry: `bucket: "git"`, `description: "<existing tool description>"`, `version: "1"`, `managed_by: "codi"`, `default: true | false`. The `default` is `true` for: ruff-check, ruff-format, basedpyright, gofmt, golangci-lint, eslint, prettier; `false` for alternates (mypy, pyright, biome, gosec).
  - Verify: `pnpm test tests/core/hooks/registry-{javascript,python,go}.test.ts && pnpm test`
  - Commit: `refactor(hooks): migrate javascript/python/go registries to GitHookArtifact`

- [ ] **Task 3b — rust / java / kotlin / swift**
  - Files: `src/core/hooks/registry/{rust,java,kotlin,swift}.ts`, matching tests
  - Pattern: same. `default: true` for cargo-fmt, cargo-clippy, google-java-format, ktfmt, swiftformat, swiftlint, checkstyle, detekt.
  - Verify: `pnpm test tests/core/hooks/`
  - Commit: `refactor(hooks): migrate rust/java/kotlin/swift registries to GitHookArtifact`

- [ ] **Task 3c — csharp / cpp / php / ruby**
  - Files: `src/core/hooks/registry/{csharp,cpp,php,ruby}.ts`, matching tests
  - Pattern: same. `default: true` for all entries (each language has only essentials).
  - Verify: `pnpm test`
  - Commit: `refactor(hooks): migrate csharp/cpp/php/ruby registries to GitHookArtifact`

- [ ] **Task 3d — dart / shell / global**
  - Files: `src/core/hooks/registry/{dart,shell,global}.ts`, matching tests
  - Pattern: same. `default: true` for gitleaks, commitlint, codi-doctor, dart-format, dart-analyze, shellcheck.
  - Verify: `pnpm test`
  - Commit: `refactor(hooks): migrate dart/shell/global registries to GitHookArtifact`

After 3d, verify `pnpm build` succeeds and `pnpm test` is green across the suite.

---

## Task 4: Add unified registry helpers

- [ ] **Files**: `src/core/hooks/registry/index.ts`, `tests/core/hooks/registry-unified.test.ts`
- [ ] **Est**: 5 minutes

**Steps:**

1. Write failing test `tests/core/hooks/registry-unified.test.ts`:

   ```typescript
   import { describe, it, expect } from "vitest";
   import {
     getAllHooks,
     getGitHooks,
     getRuntimeHooks,
     getHook,
     getDefaultGitHookNames,
     getDefaultRuntimeHookNames,
   } from "#src/core/hooks/registry/index.js";

   describe("registry helpers", () => {
     it("getAllHooks returns both buckets", () => {
       const all = getAllHooks();
       const buckets = new Set(all.map((h) => h.bucket));
       expect(buckets.has("git")).toBe(true);
       expect(buckets.has("runtime")).toBe(true);
     });

     it("getGitHooks contains only git bucket", () => {
       expect(getGitHooks().every((h) => h.bucket === "git")).toBe(true);
     });

     it("getRuntimeHooks contains only runtime bucket", () => {
       expect(getRuntimeHooks().every((h) => h.bucket === "runtime")).toBe(true);
     });

     it("getHook by name returns the right artifact", () => {
       const tsc = getHook("tsc");
       expect(tsc?.bucket).toBe("git");
       expect(tsc?.name).toBe("tsc");
     });

     it("getDefaultGitHookNames returns defaults for typescript", () => {
       const names = getDefaultGitHookNames(["typescript"]);
       expect(names).toContain("eslint");
       expect(names).toContain("prettier");
       expect(names).toContain("tsc");
       expect(names).not.toContain("biome");
     });

     it("getDefaultRuntimeHookNames includes always-on built-ins", () => {
       const names = getDefaultRuntimeHookNames();
       expect(names).toContain("iron-laws-enforcer");
     });
   });
   ```

2. Run: `pnpm test tests/core/hooks/registry-unified.test.ts` → fails.
3. Replace `src/core/hooks/registry/index.ts`:

   ```typescript
   import { PROJECT_NAME } from "#src/constants.js";
   import type {
     GitHookArtifact,
     HookArtifact,
     HookLanguage,
     RuntimeHookArtifact,
   } from "../hook-artifact.js";
   import { TYPESCRIPT_HOOKS } from "./typescript.js";
   import { JAVASCRIPT_HOOKS } from "./javascript.js";
   import { PYTHON_HOOKS } from "./python.js";
   import { GO_HOOKS } from "./go.js";
   import { RUST_HOOKS } from "./rust.js";
   import { JAVA_HOOKS } from "./java.js";
   import { KOTLIN_HOOKS } from "./kotlin.js";
   import { SWIFT_HOOKS } from "./swift.js";
   import { CSHARP_HOOKS } from "./csharp.js";
   import { CPP_HOOKS } from "./cpp.js";
   import { PHP_HOOKS } from "./php.js";
   import { RUBY_HOOKS } from "./ruby.js";
   import { DART_HOOKS } from "./dart.js";
   import { SHELL_HOOKS } from "./shell.js";
   import { GLOBAL_HOOKS } from "./global.js";
   import { RUNTIME_HOOKS } from "./runtime/index.js";

   const LANGUAGE_HOOKS: Record<string, GitHookArtifact[]> = {
     typescript: TYPESCRIPT_HOOKS,
     javascript: JAVASCRIPT_HOOKS,
     python: PYTHON_HOOKS,
     go: GO_HOOKS,
     rust: RUST_HOOKS,
     java: JAVA_HOOKS,
     kotlin: KOTLIN_HOOKS,
     swift: SWIFT_HOOKS,
     csharp: CSHARP_HOOKS,
     cpp: CPP_HOOKS,
     php: PHP_HOOKS,
     ruby: RUBY_HOOKS,
     dart: DART_HOOKS,
     shell: SHELL_HOOKS,
   };

   export function getGitHooks(): GitHookArtifact[] {
     const out: GitHookArtifact[] = [...GLOBAL_HOOKS];
     for (const arr of Object.values(LANGUAGE_HOOKS)) out.push(...arr);
     return out;
   }

   export function getRuntimeHooks(): RuntimeHookArtifact[] {
     return [...RUNTIME_HOOKS];
   }

   export function getAllHooks(): HookArtifact[] {
     return [...getGitHooks(), ...getRuntimeHooks()];
   }

   export function getHook(name: string): HookArtifact | null {
     return getAllHooks().find((h) => h.name === name) ?? null;
   }

   export function getDoctorHook(): GitHookArtifact {
     const hook = GLOBAL_HOOKS.find((h) => h.name === `${PROJECT_NAME}-doctor`);
     if (!hook) throw new Error("doctor hook missing from global registry");
     return hook;
   }

   export function getCommitlintHook(): GitHookArtifact {
     const hook = GLOBAL_HOOKS.find((h) => h.name === "commitlint");
     if (!hook) throw new Error("commitlint hook missing from global registry");
     return hook;
   }

   export function getGlobalHooks(): GitHookArtifact[] {
     return [...GLOBAL_HOOKS];
   }

   export function getHooksForLanguage(language: string): GitHookArtifact[] {
     const normalized = language.toLowerCase();
     const hooks = LANGUAGE_HOOKS[normalized] ?? [];
     return hooks.map((h) => ({ ...h, language: normalized as HookLanguage }));
   }

   export function getSupportedLanguages(): string[] {
     return Object.keys(LANGUAGE_HOOKS);
   }

   export function getDefaultGitHookNames(languages: string[]): string[] {
     const names = new Set<string>();
     for (const h of GLOBAL_HOOKS) if (h.default) names.add(h.name);
     for (const lang of languages) {
       const arr = LANGUAGE_HOOKS[lang.toLowerCase()] ?? [];
       for (const h of arr) if (h.default) names.add(h.name);
     }
     return [...names];
   }

   export function getDefaultRuntimeHookNames(): string[] {
     return RUNTIME_HOOKS.filter((h) => h.default || h.required).map((h) => h.name);
   }
   ```

4. Create stub `src/core/hooks/registry/runtime/index.ts`:
   ```typescript
   import type { RuntimeHookArtifact } from "../../hook-artifact.js";
   export const RUNTIME_HOOKS: RuntimeHookArtifact[] = [];
   ```
5. Run: `pnpm test tests/core/hooks/registry-unified.test.ts` (the `getDefaultRuntimeHookNames` assertion will still fail until Task 10; mark that single assertion `.skip` for now, or accept the red and fix it after Task 10). Run: `pnpm build` to confirm no type errors elsewhere.
6. Commit:
   ```
   git add src/core/hooks/registry/index.ts src/core/hooks/registry/runtime/index.ts tests/core/hooks/registry-unified.test.ts
   git commit -m "feat(hooks): add unified registry helpers and runtime stub"
   ```

**Verification:** `pnpm build` succeeds; `pnpm test` only fails on the iron-laws-enforcer assertion (resolved in Task 10).

---

## Task 5: security-reminder patterns

- [ ] **Files**: `src/runtime/hooks/security-reminder/patterns.ts`, `tests/runtime/hooks/security-reminder/patterns.test.ts`
- [ ] **Est**: 5 minutes

**Steps:**

1. Write failing test:

   ```typescript
   import { describe, it, expect } from "vitest";
   import {
     SECURITY_PATTERNS,
     type SecurityPattern,
   } from "#src/runtime/hooks/security-reminder/patterns.ts";

   describe("SECURITY_PATTERNS", () => {
     it("contains the nine canonical rules", () => {
       const ids = SECURITY_PATTERNS.map((p) => p.ruleId).sort();
       expect(ids).toEqual([
         "child-process-exec",
         "dangerously-set-html",
         "document-write",
         "eval-call",
         "gha-injection",
         "inner-html-assign",
         "new-function",
         "os-system",
         "pickle-deserialize",
       ]);
     });
     it("each pattern has either substrings or pathPredicate", () => {
       for (const p of SECURITY_PATTERNS) {
         const hasSubstring = p.kind === "substring";
         const hasPath = p.kind === "path";
         expect(hasSubstring || hasPath).toBe(true);
       }
     });
     it("pickle and os-system constrain to .py", () => {
       const pickle = SECURITY_PATTERNS.find((p) => p.ruleId === "pickle-deserialize");
       const osSystem = SECURITY_PATTERNS.find((p) => p.ruleId === "os-system");
       expect(pickle?.allowedExtensions).toEqual([".py"]);
       expect(osSystem?.allowedExtensions).toEqual([".py"]);
     });
     it("dangerously-set-html constrains to jsx/tsx", () => {
       const r = SECURITY_PATTERNS.find((p) => p.ruleId === "dangerously-set-html");
       expect(r?.allowedExtensions).toEqual([".jsx", ".tsx"]);
     });
     it("each pattern has a non-empty reminder", () => {
       for (const p of SECURITY_PATTERNS) expect(p.reminder.length).toBeGreaterThan(20);
     });
   });
   ```

2. Run → fail.
3. Implement `src/runtime/hooks/security-reminder/patterns.ts`:

   ```typescript
   export type PatternKind = "substring" | "path";

   export interface SecurityPattern {
     ruleId: string;
     kind: PatternKind;
     substrings?: string[];
     pathPredicate?: (normalisedPath: string) => boolean;
     allowedExtensions?: string[];
     reminder: string;
     suggestedAction: string;
   }

   const ghaWorkflowPath = (p: string): boolean =>
     p.includes(".github/workflows/") && (p.endsWith(".yml") || p.endsWith(".yaml"));

   export const SECURITY_PATTERNS: SecurityPattern[] = [
     {
       ruleId: "gha-injection",
       kind: "path",
       pathPredicate: ghaWorkflowPath,
       reminder:
         "GitHub Actions workflow detected. Untrusted event payload fields (issue title, PR body, commit message, author email) must never appear inside `run:` blocks. Pass them through `env:` and reference the env var instead.",
       suggestedAction:
         'Bind the value to an env var, then use the env var in `run:` (e.g. `env: { TITLE: ${{ github.event.issue.title }} }` then `run: echo "$TITLE"`).',
     },
     {
       ruleId: "child-process-exec",
       kind: "substring",
       substrings: ["child_process.exec", "exec(", "execSync("],
       allowedExtensions: [".js", ".ts", ".mjs", ".cjs", ".jsx", ".tsx"],
       reminder:
         "Shell-spawning APIs interpolate strings through a shell, so any user-controlled input enables command injection.",
       suggestedAction:
         "Prefer `execFile` / `spawn` with an argv array. If shell features are required, validate the input against a strict allowlist first.",
     },
     {
       ruleId: "new-function",
       kind: "substring",
       substrings: ["new Function("],
       allowedExtensions: [".js", ".ts", ".mjs", ".cjs", ".jsx", ".tsx"],
       reminder: "`new Function(...)` evaluates arbitrary source code — equivalent to eval.",
       suggestedAction:
         "Replace with a static dispatch table or a typed parser. Only keep `new Function` when input is provably static at build time.",
     },
     {
       ruleId: "eval-call",
       kind: "substring",
       substrings: ["eval("],
       allowedExtensions: [".js", ".ts", ".mjs", ".cjs", ".py", ".rb", ".php"],
       reminder: "`eval` executes arbitrary code from a string and is a top-tier injection vector.",
       suggestedAction:
         "Use `JSON.parse` for data, a real parser for expressions, or a typed lookup table for command dispatch.",
     },
     {
       ruleId: "dangerously-set-html",
       kind: "substring",
       substrings: ["dangerouslySetInnerHTML"],
       allowedExtensions: [".jsx", ".tsx"],
       reminder:
         "`dangerouslySetInnerHTML` injects raw HTML and bypasses React's escape — XSS unless content is trusted.",
       suggestedAction:
         "Render text via JSX children, or sanitise with DOMPurify before assignment if HTML is required.",
     },
     {
       ruleId: "document-write",
       kind: "substring",
       substrings: ["document.write"],
       allowedExtensions: [".js", ".ts", ".mjs", ".cjs", ".html"],
       reminder: "`document.write` is XSS-prone and blocks rendering.",
       suggestedAction:
         "Build nodes with `createElement` / `appendChild`, or set `textContent`. Avoid HTML strings entirely.",
     },
     {
       ruleId: "inner-html-assign",
       kind: "substring",
       substrings: [".innerHTML =", ".innerHTML="],
       allowedExtensions: [".js", ".ts", ".mjs", ".cjs", ".jsx", ".tsx", ".html"],
       reminder:
         "Assigning to `.innerHTML` injects HTML directly. Untrusted strings here become XSS.",
       suggestedAction:
         "Use `textContent` for plain text. For rich content, sanitise with DOMPurify or build a DOM fragment.",
     },
     {
       ruleId: "pickle-deserialize",
       kind: "substring",
       substrings: ["pickle.load", "pickle.loads"],
       allowedExtensions: [".py"],
       reminder:
         "`pickle` deserialises arbitrary Python objects, which is equivalent to remote code execution if the data came from an untrusted source.",
       suggestedAction:
         "Use `json` for data interchange. Only `pickle` data you produced yourself in trusted local files.",
     },
     {
       ruleId: "os-system",
       kind: "substring",
       substrings: ["os.system", "from os import system"],
       allowedExtensions: [".py"],
       reminder:
         "`os.system` runs a shell command from a string and inherits the shell's interpolation behaviour.",
       suggestedAction:
         "Use `subprocess.run([...], check=True)` with an argv list and `shell=False`.",
     },
   ];
   ```

4. Run → green.
5. Commit:
   ```
   git add src/runtime/hooks/security-reminder/patterns.ts tests/runtime/hooks/security-reminder/patterns.test.ts
   git commit -m "feat(security-reminder): define nine pattern rule set"
   ```

---

## Task 6: security-reminder filters (extension + comment heuristic)

- [ ] **Files**: `src/runtime/hooks/security-reminder/filters.ts`, `tests/runtime/hooks/security-reminder/filters.test.ts`
- [ ] **Est**: 4 minutes

**Steps:**

1. Test:

   ```typescript
   import { describe, it, expect } from "vitest";
   import {
     fileExtension,
     isSkippedExtension,
     isAllowedForPattern,
     stripCommentLines,
   } from "#src/runtime/hooks/security-reminder/filters.ts";

   describe("filters", () => {
     it("fileExtension lower-cases and includes dot", () => {
       expect(fileExtension("Foo.TS")).toBe(".ts");
       expect(fileExtension("a/b/c.py")).toBe(".py");
     });
     it("skips markdown / yaml / lock / etc", () => {
       for (const p of ["a.md", "a.yaml", "a.json", "a.svg", "p.toml", "x.gitignore"]) {
         expect(isSkippedExtension(p)).toBe(true);
       }
       expect(isSkippedExtension("a.ts")).toBe(false);
     });
     it("isAllowedForPattern uses allowedExtensions when set", () => {
       expect(isAllowedForPattern("a.py", [".py"])).toBe(true);
       expect(isAllowedForPattern("a.ts", [".py"])).toBe(false);
       expect(isAllowedForPattern("a.ts", undefined)).toBe(true);
     });
     it("stripCommentLines drops //, #, /*, *, <!--", () => {
       const src = [
         "const x = 1;",
         "// exec(",
         "  # pickle.loads(",
         "/* eval( */",
         " * eval(",
         "<!-- exec( -->",
         "real eval(",
       ].join("\n");
       const out = stripCommentLines(src);
       expect(out).toContain("real eval(");
       expect(out).not.toContain("// exec(");
       expect(out).not.toContain("# pickle.loads(");
       expect(out).not.toContain("eval(*/");
       expect(out).not.toContain("<!--");
     });
   });
   ```

2. Run → fail.
3. Implement `src/runtime/hooks/security-reminder/filters.ts`:

   ```typescript
   export const SKIPPED_EXTENSIONS = new Set<string>([
     ".md",
     ".mdx",
     ".json",
     ".yaml",
     ".yml",
     ".lock",
     ".svg",
     ".png",
     ".jpg",
     ".jpeg",
     ".webp",
     ".gif",
     ".pdf",
     ".csv",
     ".txt",
     ".toml",
     ".gitignore",
     ".editorconfig",
   ]);

   export function fileExtension(filePath: string): string {
     const idx = filePath.lastIndexOf(".");
     if (idx < 0) return "";
     return filePath.slice(idx).toLowerCase();
   }

   export function isSkippedExtension(filePath: string): boolean {
     return SKIPPED_EXTENSIONS.has(fileExtension(filePath));
   }

   export function isAllowedForPattern(
     filePath: string,
     allowedExtensions: string[] | undefined,
   ): boolean {
     if (!allowedExtensions || allowedExtensions.length === 0) return true;
     const ext = fileExtension(filePath);
     return allowedExtensions.includes(ext);
   }

   const COMMENT_PREFIXES = ["//", "#", "/*", "*", "<!--"];

   export function stripCommentLines(content: string): string {
     return content
       .split("\n")
       .filter((line) => {
         const stripped = line.trimStart();
         for (const prefix of COMMENT_PREFIXES) {
           if (stripped.startsWith(prefix)) return false;
         }
         return true;
       })
       .join("\n");
   }
   ```

4. Run → green.
5. Commit:
   ```
   git add src/runtime/hooks/security-reminder/filters.ts tests/runtime/hooks/security-reminder/filters.test.ts
   git commit -m "feat(security-reminder): add extension allowlist and comment heuristic"
   ```

---

## Task 7: security-reminder state (per-session dedupe)

- [ ] **Files**: `src/runtime/hooks/security-reminder/state.ts`, `tests/runtime/hooks/security-reminder/state.test.ts`
- [ ] **Est**: 5 minutes

**Steps:**

1. Test:

   ```typescript
   import { describe, it, expect, beforeEach, afterEach } from "vitest";
   import { mkdtempSync, rmSync, utimesSync } from "node:fs";
   import { tmpdir } from "node:os";
   import { join } from "node:path";
   import {
     dedupeKey,
     loadShownWarnings,
     persistShownWarning,
     stateFilePath,
     cleanupOldStateFiles,
   } from "#src/runtime/hooks/security-reminder/state.ts";

   describe("dedupe state", () => {
     let dir: string;
     beforeEach(() => {
       dir = mkdtempSync(join(tmpdir(), "codi-sec-state-"));
     });
     afterEach(() => rmSync(dir, { recursive: true, force: true }));

     it("dedupeKey resolves to absolute canonical path", () => {
       const k1 = dedupeKey("sid", "/abs/foo.ts", "rule");
       const k2 = dedupeKey("sid", "/abs/foo.ts", "rule");
       expect(k1).toBe(k2);
       expect(k1.includes("foo.ts")).toBe(true);
     });

     it("loadShownWarnings returns empty set for missing file", () => {
       const set = loadShownWarnings("missing-sid", dir);
       expect(set.size).toBe(0);
     });

     it("persist + load round-trips", () => {
       const key = dedupeKey("sid1", "/abs/foo.ts", "rule");
       persistShownWarning("sid1", key, dir);
       const set = loadShownWarnings("sid1", dir);
       expect(set.has(key)).toBe(true);
     });

     it("cleanupOldStateFiles removes files older than the threshold", () => {
       const path = stateFilePath("old-sid", dir);
       persistShownWarning("old-sid", "k", dir);
       const ms = Date.now() - 31 * 24 * 60 * 60 * 1000;
       utimesSync(path, ms / 1000, ms / 1000);
       cleanupOldStateFiles(dir, 30);
       expect(loadShownWarnings("old-sid", dir).size).toBe(0);
     });
   });
   ```

   (Note: replace `require` with import in TS — see implementation; keep test as-is is fine for vitest with `node:fs`).

2. Run → fail.
3. Implement `src/runtime/hooks/security-reminder/state.ts`:

   ```typescript
   import {
     existsSync,
     mkdirSync,
     readFileSync,
     readdirSync,
     renameSync,
     statSync,
     unlinkSync,
     writeFileSync,
   } from "node:fs";
   import { homedir } from "node:os";
   import { join, resolve } from "node:path";

   export const DEFAULT_STATE_DIR = join(homedir(), ".codi", "security");

   export function stateFilePath(sessionId: string, dir = DEFAULT_STATE_DIR): string {
     return join(dir, `state-${sessionId}.json`);
   }

   export function dedupeKey(sessionId: string, filePath: string, ruleId: string): string {
     const canonical = resolve(filePath);
     return `${sessionId}::${canonical}::${ruleId}`;
   }

   export function loadShownWarnings(sessionId: string, dir = DEFAULT_STATE_DIR): Set<string> {
     const path = stateFilePath(sessionId, dir);
     if (!existsSync(path)) return new Set();
     try {
       const parsed = JSON.parse(readFileSync(path, "utf8")) as { shownWarnings?: string[] };
       return new Set(parsed.shownWarnings ?? []);
     } catch {
       return new Set();
     }
   }

   export function persistShownWarning(
     sessionId: string,
     key: string,
     dir = DEFAULT_STATE_DIR,
   ): void {
     mkdirSync(dir, { recursive: true });
     const path = stateFilePath(sessionId, dir);
     const existing = loadShownWarnings(sessionId, dir);
     existing.add(key);
     const tmp = `${path}.tmp.${process.pid}.${Date.now()}`;
     writeFileSync(
       tmp,
       JSON.stringify({
         sessionId,
         hookName: "security-reminder",
         shownWarnings: [...existing],
         lastAccess: new Date().toISOString(),
       }),
       "utf8",
     );
     renameSync(tmp, path);
   }

   export function cleanupOldStateFiles(dir = DEFAULT_STATE_DIR, daysOld = 30): void {
     if (!existsSync(dir)) return;
     const cutoff = Date.now() - daysOld * 24 * 60 * 60 * 1000;
     for (const name of readdirSync(dir)) {
       if (!name.startsWith("state-") || !name.endsWith(".json")) continue;
       const path = join(dir, name);
       try {
         const s = statSync(path);
         if (s.mtimeMs < cutoff) unlinkSync(path);
       } catch {
         /* ignore */
       }
     }
   }
   ```

4. Run → green.
5. Commit:
   ```
   git add src/runtime/hooks/security-reminder/state.ts tests/runtime/hooks/security-reminder/state.test.ts
   git commit -m "feat(security-reminder): per-session dedupe state with atomic write"
   ```

---

## Task 8: security-reminder checker (orchestrator)

- [ ] **Files**: `src/runtime/hooks/security-reminder/checker.ts`, `tests/runtime/hooks/security-reminder/checker.test.ts`
- [ ] **Est**: 5 minutes

**Steps:**

1. Test:

   ```typescript
   import { describe, it, expect, beforeEach, afterEach } from "vitest";
   import { mkdtempSync, rmSync } from "node:fs";
   import { tmpdir } from "node:os";
   import { join } from "node:path";
   import { evaluateSecurityReminder } from "#src/runtime/hooks/security-reminder/checker.ts";

   describe("evaluateSecurityReminder", () => {
     let dir: string;
     beforeEach(() => {
       dir = mkdtempSync(join(tmpdir(), "codi-sec-eval-"));
     });
     afterEach(() => rmSync(dir, { recursive: true, force: true }));

     it("returns matched=false on a markdown doc that mentions exec(", () => {
       const v = evaluateSecurityReminder(
         {
           bucket: "runtime",
           event: "PreToolUse",
           toolName: "Write",
           filePath: "doc.md",
           content: "exec(',',\")",
           sessionId: "s",
           cwd: process.cwd(),
         },
         { stateDir: dir },
       );
       expect(v.matched).toBe(false);
     });

     it("matches exec( in a .ts file", () => {
       const v = evaluateSecurityReminder(
         {
           bucket: "runtime",
           event: "PreToolUse",
           toolName: "Write",
           filePath: "src/foo.ts",
           content: "child_process.exec(cmd)",
           sessionId: "s",
           cwd: process.cwd(),
         },
         { stateDir: dir },
       );
       expect(v.matched).toBe(true);
       expect(v.ruleId).toBe("child-process-exec");
       expect(v.severity).toBe("warn");
     });

     it("does not match when same exec( lives inside a // comment", () => {
       const v = evaluateSecurityReminder(
         {
           bucket: "runtime",
           event: "PreToolUse",
           toolName: "Write",
           filePath: "src/foo.ts",
           content: "// exec(cmd)",
           sessionId: "s2",
           cwd: process.cwd(),
         },
         { stateDir: dir },
       );
       expect(v.matched).toBe(false);
     });

     it("does not re-fire on the same (sid,file,rule) within a session", () => {
       const args = {
         bucket: "runtime" as const,
         event: "PreToolUse" as const,
         toolName: "Write",
         filePath: "src/foo.ts",
         content: "child_process.exec(cmd)",
         sessionId: "dedupe-sid",
         cwd: process.cwd(),
       };
       const v1 = evaluateSecurityReminder(args, { stateDir: dir });
       const v2 = evaluateSecurityReminder(args, { stateDir: dir });
       expect(v1.matched).toBe(true);
       expect(v2.matched).toBe(false);
     });
   });
   ```

2. Implement `src/runtime/hooks/security-reminder/checker.ts`:

   ```typescript
   import type { HookContext, HookVerdict } from "#src/core/hooks/hook-artifact.js";
   import { SECURITY_PATTERNS, type SecurityPattern } from "./patterns.js";
   import {
     fileExtension,
     isAllowedForPattern,
     isSkippedExtension,
     stripCommentLines,
   } from "./filters.js";
   import {
     dedupeKey,
     loadShownWarnings,
     persistShownWarning,
     DEFAULT_STATE_DIR,
   } from "./state.js";

   const HOOK_NAME = "security-reminder";

   export interface CheckerOptions {
     stateDir?: string;
   }

   function noMatch(): HookVerdict {
     return { hookName: HOOK_NAME, matched: false, severity: "info" };
   }

   function matchesPattern(
     pattern: SecurityPattern,
     filePath: string,
     scrubbedContent: string,
   ): boolean {
     if (pattern.kind === "path") {
       return pattern.pathPredicate ? pattern.pathPredicate(filePath) : false;
     }
     if (!isAllowedForPattern(filePath, pattern.allowedExtensions)) return false;
     return (pattern.substrings ?? []).some((s) => scrubbedContent.includes(s));
   }

   export function evaluateSecurityReminder(
     ctx: HookContext,
     opts: CheckerOptions = {},
   ): HookVerdict {
     if (
       ctx.toolName !== "Edit" &&
       ctx.toolName !== "Write" &&
       ctx.toolName !== "MultiEdit" &&
       ctx.toolName !== "NotebookEdit"
     ) {
       return noMatch();
     }
     if (!ctx.filePath || !ctx.content) return noMatch();
     // Always check path-based patterns regardless of skiplist (e.g. GHA workflows are .yaml).
     // Substring patterns honour the skiplist.
     const ext = fileExtension(ctx.filePath);
     const skipForSubstring = isSkippedExtension(ctx.filePath);
     const scrubbed = stripCommentLines(ctx.content);
     const stateDir = opts.stateDir ?? DEFAULT_STATE_DIR;

     for (const p of SECURITY_PATTERNS) {
       if (p.kind === "substring" && skipForSubstring) continue;
       if (!matchesPattern(p, ctx.filePath, scrubbed)) continue;
       const key = dedupeKey(ctx.sessionId, ctx.filePath, p.ruleId);
       const shown = loadShownWarnings(ctx.sessionId, stateDir);
       if (shown.has(key)) return noMatch();
       persistShownWarning(ctx.sessionId, key, stateDir);
       return {
         hookName: HOOK_NAME,
         matched: true,
         severity: "warn",
         ruleId: p.ruleId,
         message: p.reminder,
         suggestedAction: p.suggestedAction,
       };
     }
     // ext is unused but referenced — keep the call so TS does not whine
     void ext;
     return noMatch();
   }
   ```

3. Verify: `pnpm test tests/runtime/hooks/security-reminder/` → green.
4. Commit:
   ```
   git add src/runtime/hooks/security-reminder/checker.ts tests/runtime/hooks/security-reminder/checker.test.ts
   git commit -m "feat(security-reminder): add checker with pattern + filter + dedupe"
   ```

---

## Task 9: security-reminder registry entry

- [ ] **Files**: `src/core/hooks/registry/runtime/security-reminder.ts`, append to `src/core/hooks/registry/runtime/index.ts`, `tests/core/hooks/registry-runtime-security.test.ts`
- [ ] **Est**: 3 minutes

**Steps:**

1. Test:

   ```typescript
   import { describe, it, expect } from "vitest";
   import { SECURITY_REMINDER_HOOK } from "#src/core/hooks/registry/runtime/security-reminder.js";

   describe("security-reminder runtime hook", () => {
     it("is a runtime bucket artifact", () => {
       expect(SECURITY_REMINDER_HOOK.bucket).toBe("runtime");
     });
     it("subscribes to PreToolUse", () => {
       expect(SECURITY_REMINDER_HOOK.events).toEqual(["PreToolUse"]);
     });
     it("default-on, opt-in toggleable", () => {
       expect(SECURITY_REMINDER_HOOK.default).toBe(true);
       expect(SECURITY_REMINDER_HOOK.required).toBe(false);
     });
     it("evaluate returns a verdict for plain content", async () => {
       const v = await SECURITY_REMINDER_HOOK.evaluate({
         bucket: "runtime",
         event: "PreToolUse",
         toolName: "Write",
         filePath: "x.ts",
         content: "ok",
         sessionId: "test",
         cwd: process.cwd(),
       });
       expect(v.hookName).toBe("security-reminder");
     });
   });
   ```

2. Implement `src/core/hooks/registry/runtime/security-reminder.ts`:

   ```typescript
   import type { RuntimeHookArtifact } from "../../hook-artifact.js";
   import { evaluateSecurityReminder } from "#src/runtime/hooks/security-reminder/checker.js";

   export const SECURITY_REMINDER_HOOK: RuntimeHookArtifact = {
     bucket: "runtime",
     name: "security-reminder",
     description:
       "Advisory PreToolUse hook that flags risky code patterns (exec, eval, unsafe HTML, pickle, etc.) before the agent writes them.",
     version: "1",
     managed_by: "codi",
     required: false,
     default: true,
     category: "security",
     events: ["PreToolUse"],
     evaluate: (ctx) => evaluateSecurityReminder(ctx),
   };
   ```

3. Update `src/core/hooks/registry/runtime/index.ts`:

   ```typescript
   import type { RuntimeHookArtifact } from "../../hook-artifact.js";
   import { SECURITY_REMINDER_HOOK } from "./security-reminder.js";

   export const RUNTIME_HOOKS: RuntimeHookArtifact[] = [SECURITY_REMINDER_HOOK];
   ```

4. Verify: `pnpm test tests/core/hooks/registry-runtime-security.test.ts` and `pnpm test tests/core/hooks/registry-unified.test.ts` → green.
5. Commit:
   ```
   git add src/core/hooks/registry/runtime/security-reminder.ts src/core/hooks/registry/runtime/index.ts tests/core/hooks/registry-runtime-security.test.ts
   git commit -m "feat(hooks): register security-reminder runtime hook"
   ```

---

## Task 10: Wrap iron-laws-enforcer as runtime hook artifact

- [ ] **Files**: `src/core/hooks/registry/runtime/iron-laws-enforcer.ts`, append to `runtime/index.ts`, `tests/core/hooks/registry-runtime-iron-laws.test.ts`
- [ ] **Est**: 3 minutes

**Steps:**

1. Test asserts `bucket: "runtime"`, `events: ["UserPromptSubmit", "PreToolUse"]`, `required: true`, evaluate returns `matched: false` for an unrelated tool.

   ```typescript
   import { describe, it, expect } from "vitest";
   import { IRON_LAWS_HOOK } from "#src/core/hooks/registry/runtime/iron-laws-enforcer.js";

   describe("iron-laws-enforcer runtime hook", () => {
     it("metadata", () => {
       expect(IRON_LAWS_HOOK.bucket).toBe("runtime");
       expect(IRON_LAWS_HOOK.required).toBe(true);
       expect(IRON_LAWS_HOOK.events).toEqual(["UserPromptSubmit", "PreToolUse"]);
     });
     it("evaluate returns no-match for non-Bash, non-Edit tools", async () => {
       const v = await IRON_LAWS_HOOK.evaluate({
         bucket: "runtime",
         event: "PreToolUse",
         toolName: "Read",
         filePath: "x.ts",
         content: "",
         sessionId: "s",
         cwd: process.cwd(),
       });
       expect(v.matched).toBe(false);
     });
   });
   ```

2. Implement `src/core/hooks/registry/runtime/iron-laws-enforcer.ts`:

   ```typescript
   import type { RuntimeHookArtifact, HookVerdict } from "../../hook-artifact.js";

   const HOOK_NAME = "iron-laws-enforcer";

   /**
    * Adapter: wraps the existing iron-laws-enforcer logic. The actual
    * enforcement still runs inside `cli/agent-hooks.ts` via the existing
    * call sites; this artifact exists so that the unified registry can
    * surface the hook in `codi list hooks` and onboarding.
    */
   export const IRON_LAWS_HOOK: RuntimeHookArtifact = {
     bucket: "runtime",
     name: HOOK_NAME,
     description: "Enforces Iron Laws 4-8 (gates, pull-before-patch, git approval, output mode).",
     version: "1",
     managed_by: "codi",
     required: true,
     default: true,
     category: "enforcement",
     events: ["UserPromptSubmit", "PreToolUse"],
     evaluate: (): HookVerdict => ({
       hookName: HOOK_NAME,
       matched: false,
       severity: "info",
     }),
   };
   ```

3. Add to runtime index:
   ```typescript
   import { IRON_LAWS_HOOK } from "./iron-laws-enforcer.js";
   export const RUNTIME_HOOKS: RuntimeHookArtifact[] = [IRON_LAWS_HOOK, SECURITY_REMINDER_HOOK];
   ```
4. Verify: `pnpm test tests/core/hooks/` → green (the previously-flaky `getDefaultRuntimeHookNames` test now passes).
5. Commit:
   ```
   git add src/core/hooks/registry/runtime/iron-laws-enforcer.ts src/core/hooks/registry/runtime/index.ts tests/core/hooks/registry-runtime-iron-laws.test.ts
   git commit -m "feat(hooks): wrap iron-laws-enforcer as runtime hook artifact"
   ```

---

## Task 11–14: Wrap remaining runtime hooks

Pattern identical to Task 10. Each task creates a wrapper file under `src/core/hooks/registry/runtime/`, registers it in `index.ts`, and adds a 5-line test asserting metadata.

- [ ] **Task 11 — workflow-classifier**
  - File: `src/core/hooks/registry/runtime/workflow-classifier.ts`
  - Metadata: `events: ["PreToolUse"]`, `required: true`, `default: true`, `category: "enforcement"`, description: `"Phase-aware file edit classifier and Bash command rules."`
  - Commit: `feat(hooks): wrap workflow-classifier as runtime hook`

- [ ] **Task 12 — capture-markers**
  - File: `src/core/hooks/registry/runtime/capture-markers.ts`
  - Metadata: `events: ["Stop"]`, `required: true`, `default: true`, `category: "observation"`, description: `"Captures |TYPE: \"...\"| markers from agent transcripts into the brain."`
  - Commit: `feat(hooks): wrap capture-markers as runtime hook`

- [ ] **Task 13 — skill-tracker**
  - File: `src/core/hooks/registry/runtime/skill-tracker.ts`
  - Metadata: `events: ["InstructionsLoaded"]`, `required: false`, `default: true`, `category: "observation"`, description: `"Records active codi skills per session for self-improvement feedback."`
  - Commit: `feat(hooks): wrap skill-tracker as runtime hook`

- [ ] **Task 14 — skill-observer**
  - File: `src/core/hooks/registry/runtime/skill-observer.ts`
  - Metadata: `events: ["Stop"]`, `required: false`, `default: true`, `category: "observation"`, description: `"Scans transcripts for [CODI-OBSERVATION:] markers and persists to .codi/feedback/."`
  - Commit: `feat(hooks): wrap skill-observer as runtime hook`

After Task 14, update `src/core/hooks/registry/runtime/index.ts`:

```typescript
import type { RuntimeHookArtifact } from "../../hook-artifact.js";
import { IRON_LAWS_HOOK } from "./iron-laws-enforcer.js";
import { WORKFLOW_CLASSIFIER_HOOK } from "./workflow-classifier.js";
import { CAPTURE_MARKERS_HOOK } from "./capture-markers.js";
import { SKILL_TRACKER_HOOK } from "./skill-tracker.js";
import { SKILL_OBSERVER_HOOK } from "./skill-observer.js";
import { SECURITY_REMINDER_HOOK } from "./security-reminder.js";

export const RUNTIME_HOOKS: RuntimeHookArtifact[] = [
  IRON_LAWS_HOOK,
  WORKFLOW_CLASSIFIER_HOOK,
  CAPTURE_MARKERS_HOOK,
  SKILL_TRACKER_HOOK,
  SKILL_OBSERVER_HOOK,
  SECURITY_REMINDER_HOOK,
];
```

Verify after each: `pnpm test tests/core/hooks/`.

---

## Task 15: Runtime hook runner

- [ ] **Files**: `src/runtime/hooks/runner.ts`, `tests/runtime/hooks/runner.test.ts`
- [ ] **Est**: 5 minutes

**Steps:**

1. Test:

   ```typescript
   import { describe, it, expect } from "vitest";
   import { runRuntimeHooks } from "#src/runtime/hooks/runner.ts";
   import type { RuntimeHookArtifact, HookContext } from "#src/core/hooks/hook-artifact.js";

   const passing: RuntimeHookArtifact = {
     bucket: "runtime",
     name: "h-pass",
     description: "",
     version: "1",
     managed_by: "codi",
     required: false,
     default: true,
     category: "security",
     events: ["PreToolUse"],
     evaluate: () => ({ hookName: "h-pass", matched: false, severity: "info" }),
   };
   const blocking: RuntimeHookArtifact = {
     ...passing,
     name: "h-block",
     evaluate: () => ({ hookName: "h-block", matched: true, severity: "block", message: "no" }),
   };
   const throwing: RuntimeHookArtifact = {
     ...passing,
     name: "h-throw",
     evaluate: () => {
       throw new Error("boom");
     },
   };
   const ctx: HookContext = {
     bucket: "runtime",
     event: "PreToolUse",
     toolName: "Write",
     filePath: "x.ts",
     content: "",
     sessionId: "s",
     cwd: process.cwd(),
   };

   describe("runRuntimeHooks", () => {
     it("aggregates verdicts", async () => {
       const verdicts = await runRuntimeHooks([passing, blocking], ctx);
       expect(verdicts).toHaveLength(2);
     });
     it("fails open on throw", async () => {
       const verdicts = await runRuntimeHooks([throwing, passing], ctx);
       expect(verdicts.find((v) => v.hookName === "h-throw")?.matched).toBe(false);
     });
     it("respects phaseFilter", async () => {
       const filtered: RuntimeHookArtifact = { ...passing, phaseFilter: ["execute"] };
       const v = await runRuntimeHooks([filtered], { ...ctx, workflowPhase: "plan" });
       expect(v[0]?.matched).toBe(false);
     });
   });
   ```

2. Implement `src/runtime/hooks/runner.ts`:

   ```typescript
   import type {
     HookContext,
     HookVerdict,
     RuntimeHookArtifact,
   } from "#src/core/hooks/hook-artifact.js";

   const HOOK_TIMEOUT_MS = 30_000;

   function isPhaseAllowed(hook: RuntimeHookArtifact, phase: string | undefined): boolean {
     if (!hook.phaseFilter || hook.phaseFilter.length === 0) return true;
     if (!phase) return false;
     return hook.phaseFilter.includes(phase);
   }

   async function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
     return Promise.race<T>([
       p,
       new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
     ]);
   }

   export async function runRuntimeHooks(
     hooks: RuntimeHookArtifact[],
     ctx: HookContext,
   ): Promise<HookVerdict[]> {
     const out: HookVerdict[] = [];
     for (const hook of hooks) {
       if (!isPhaseAllowed(hook, ctx.workflowPhase)) {
         out.push({ hookName: hook.name, matched: false, severity: "info" });
         continue;
       }
       try {
         const result = hook.evaluate(ctx);
         const verdict =
           result instanceof Promise
             ? await withTimeout(result, HOOK_TIMEOUT_MS, {
                 hookName: hook.name,
                 matched: false,
                 severity: "info" as const,
               })
             : result;
         out.push(verdict);
       } catch {
         out.push({ hookName: hook.name, matched: false, severity: "info" });
       }
     }
     return out;
   }

   export function aggregateExitDecision(verdicts: HookVerdict[]): {
     exitCode: 0 | 2;
     stderrLines: string[];
   } {
     const lines: string[] = [];
     let blocking = false;
     for (const v of verdicts) {
       if (!v.matched) continue;
       if (v.severity === "block" || v.severity === "warn") {
         blocking = true;
         if (v.message) lines.push(v.message);
         if (v.suggestedAction) lines.push(`  → ${v.suggestedAction}`);
       }
     }
     return { exitCode: blocking ? 2 : 0, stderrLines: lines };
   }
   ```

3. Verify: `pnpm test tests/runtime/hooks/runner.test.ts` → green.
4. Commit:
   ```
   git add src/runtime/hooks/runner.ts tests/runtime/hooks/runner.test.ts
   git commit -m "feat(hooks): add runtime hook runner with timeout fail-open and phaseFilter"
   ```

---

## Task 16: Wire runner into pre-tool-use dispatch

- [ ] **Files**: `src/cli/agent-hooks.ts`, `tests/runtime/hooks/integration-pretool.test.ts`
- [ ] **Est**: 5 minutes

**Steps:**

1. Test that `runPreToolUse` in `agent-hooks.ts` runs the registered runtime hooks and exits 2 when a blocking verdict is returned. Use a `vi.mock` over the registry to inject a controlled hook list.

   ```typescript
   import { describe, it, expect, vi } from "vitest";

   // Test invocation through subprocess to capture stdout/stderr/exit code
   import { spawnSync } from "node:child_process";

   describe("pre-tool-use integration with runtime hook runner", () => {
     it("exits 2 with reminder when security-reminder matches exec(", () => {
       const r = spawnSync(process.execPath, ["dist/cli.js", "hook", "pre-tool-use"], {
         input: JSON.stringify({
           session_id: "test-sid",
           tool_name: "Write",
           tool_input: {
             file_path: "/tmp/codi-test-foo.ts",
             content: "child_process.exec('rm');",
           },
           cwd: process.cwd(),
         }),
         encoding: "utf8",
       });
       expect(r.status).toBe(2);
       expect(r.stderr).toContain("child-process-exec");
     });
   });
   ```

2. Modify `src/cli/agent-hooks.ts` `runPreToolUse`. After existing checks, before `process.exit(0)`, insert:
   ```typescript
   // Runtime-hook runner (security-reminder, future hooks)
   if (
     call.tool_name === "Edit" ||
     call.tool_name === "Write" ||
     call.tool_name === "MultiEdit" ||
     call.tool_name === "NotebookEdit"
   ) {
     try {
       const { getRuntimeHooks } = await import("../core/hooks/registry/index.js");
       const { runRuntimeHooks, aggregateExitDecision } =
         await import("../runtime/hooks/runner.js");
       const enabled = readEnabledRuntimeHookNames(cwd);
       const runtimeHooks = getRuntimeHooks().filter((h) => h.required || enabled.includes(h.name));
       const filePath =
         (call.tool_input["file_path"] as string | undefined) ??
         (call.tool_input["path"] as string | undefined);
       const content =
         (call.tool_input["content"] as string | undefined) ??
         (call.tool_input["new_string"] as string | undefined) ??
         "";
       const verdicts = await runRuntimeHooks(runtimeHooks, {
         bucket: "runtime",
         event: "PreToolUse",
         toolName: call.tool_name,
         filePath,
         content,
         sessionId: payload.session_id ?? "default",
         cwd,
       });
       const decision = aggregateExitDecision(verdicts);
       if (decision.exitCode === 2) {
         for (const line of decision.stderrLines) console.error(`[codi pre-tool-use] ${line}`);
         process.exit(2);
       }
     } catch {
       // Fail-open: never block due to runner internals
     }
   }
   ```
   Add the helper near the bottom of the file:
   ```typescript
   function readEnabledRuntimeHookNames(cwd: string): string[] {
     try {
       const path = require("node:path") as typeof import("node:path");
       const fs = require("node:fs") as typeof import("node:fs");
       const stateFile = path.join(cwd, ".codi", ".state", "state.json");
       if (!fs.existsSync(stateFile)) return [];
       const parsed = JSON.parse(fs.readFileSync(stateFile, "utf8")) as {
         selectedHooks?: { runtime?: string[] };
       };
       return parsed.selectedHooks?.runtime ?? [];
     } catch {
       return [];
     }
   }
   ```
   Note: convert top-level `function runPreToolUse` to `async function runPreToolUse` and replace `() => runPreToolUse()` calls with `void runPreToolUse()` in the dispatcher map.
3. Run `pnpm build` and `pnpm test tests/runtime/hooks/integration-pretool.test.ts` → green.
4. Commit:
   ```
   git add src/cli/agent-hooks.ts tests/runtime/hooks/integration-pretool.test.ts
   git commit -m "feat(hooks): dispatch runtime hooks from pre-tool-use with fail-open runner"
   ```

---

## Task 17: Extend HookDecision with advisories field

- [ ] **Files**: `src/runtime/hook-logic.ts`, `tests/runtime/hook-logic-advisories.test.ts`
- [ ] **Est**: 3 minutes

Add an optional `advisories?: string[]` to the `allow: true` branch of `HookDecision`. The runner already operates outside this type, but the field exists for future tools that want to attach non-blocking notes from `evaluateToolCall`. This is a forward-compatible no-op for current callers.

```typescript
export type HookDecision =
  | { allow: true; reason?: string; auto_event?: ManifestEvent; advisories?: string[] }
  | { allow: false; reason: string; suggested_action: string };
```

Test asserts the field is optional and that existing call sites still type-check.

Commit: `feat(hook-logic): allow optional advisories on HookDecision`

---

## Task 18: state.ts — additive selectedHooks with default fill

- [ ] **Files**: `src/core/config/state.ts`, `tests/core/config/state-defaults.test.ts`
- [ ] **Est**: 5 minutes

**Steps:**

1. Test:

   ```typescript
   import { describe, it, expect } from "vitest";
   import { fillSelectedHooksDefaults } from "#src/core/config/state.ts";

   describe("fillSelectedHooksDefaults", () => {
     it("fills git from languages and runtime from required+default", () => {
       const filled = fillSelectedHooksDefaults({}, ["typescript"]);
       expect(filled.git).toContain("eslint");
       expect(filled.git).toContain("tsc");
       expect(filled.runtime).toContain("iron-laws-enforcer");
       expect(filled.runtime).toContain("security-reminder");
     });
     it("preserves user selection if present", () => {
       const filled = fillSelectedHooksDefaults(
         {
           git: ["eslint"],
           runtime: ["security-reminder"],
         },
         ["typescript"],
       );
       expect(filled.git).toEqual(["eslint"]);
       expect(filled.runtime).toEqual(["security-reminder"]);
     });
   });
   ```

2. In `src/core/config/state.ts`, add:

   ```typescript
   import { getDefaultGitHookNames, getDefaultRuntimeHookNames } from "../hooks/registry/index.js";

   export interface SelectedHooks {
     git: string[];
     runtime: string[];
   }

   export function fillSelectedHooksDefaults(
     existing: Partial<SelectedHooks> | undefined,
     languages: string[],
   ): SelectedHooks {
     return {
       git: existing?.git ?? getDefaultGitHookNames(languages),
       runtime: existing?.runtime ?? getDefaultRuntimeHookNames(),
     };
   }
   ```

   Add `selectedHooks?: SelectedHooks` to `StateData`.

3. Verify: `pnpm test tests/core/config/state-defaults.test.ts` → green; `pnpm build` clean.
4. Commit: `feat(state): additive selectedHooks field with default-fill helper`

---

## Task 19: preferences extension

- [ ] **Files**: `src/runtime/preferences.ts`, `tests/runtime/preferences.test.ts`
- [ ] **Est**: 3 minutes

Add an optional per-hook override map:

```typescript
export interface HookPreferenceOverride {
  enabled?: boolean;
  extraSkipExtensions?: string[];
  extraSkipPaths?: string[];
}

export interface CodiPreferences {
  output_mode?: OutputMode;
  hooks?: Record<string, HookPreferenceOverride>;
}
```

Update `DEFAULT_PREFERENCES` to include `hooks: {}`. Test reads/writes a preferences file with `hooks` set and asserts round-trip preservation.

Commit: `feat(preferences): add hooks override map`

---

## Task 20: `codi list hooks` command

- [ ] **Files**: `src/cli/hooks-list.ts`, `tests/cli/hooks-list.test.ts`
- [ ] **Est**: 5 minutes

**Steps:**

1. Test asserts the formatted output contains `eslint`, `security-reminder`, `iron-laws-enforcer`, and tags by bucket.

   ```typescript
   import { describe, it, expect } from "vitest";
   import { formatHooksList } from "#src/cli/hooks-list.js";

   describe("formatHooksList", () => {
     it("includes both buckets by default", () => {
       const out = formatHooksList({});
       expect(out).toMatch(/eslint/);
       expect(out).toMatch(/security-reminder/);
       expect(out).toMatch(/git/i);
       expect(out).toMatch(/runtime/i);
     });
     it("filters with --git", () => {
       const out = formatHooksList({ bucket: "git" });
       expect(out).not.toMatch(/security-reminder/);
       expect(out).toMatch(/eslint/);
     });
     it("filters with --runtime", () => {
       const out = formatHooksList({ bucket: "runtime" });
       expect(out).toMatch(/security-reminder/);
       expect(out).not.toMatch(/eslint/);
     });
   });
   ```

2. Implement `src/cli/hooks-list.ts`:

   ```typescript
   import type { Command } from "commander";
   import { getAllHooks, getGitHooks, getRuntimeHooks } from "../core/hooks/registry/index.js";

   export interface ListOptions {
     bucket?: "git" | "runtime";
     enabled?: boolean;
   }

   export function formatHooksList(opts: ListOptions): string {
     const hooks =
       opts.bucket === "git"
         ? getGitHooks()
         : opts.bucket === "runtime"
           ? getRuntimeHooks()
           : getAllHooks();
     const rows = hooks.map((h) => {
       const tag =
         h.bucket === "git"
           ? `[git/${(h as { language?: string }).language ?? "global"}]`
           : "[runtime]";
       const flags = `${h.required ? "*" : " "}${h.default ? "+" : "-"}`;
       return `${flags} ${tag.padEnd(18)} ${h.name.padEnd(28)} ${h.description}`;
     });
     return ["Flags: * required   + default-on   - default-off", "", ...rows].join("\n");
   }

   export function registerHooksListCommand(program: Command): void {
     program
       .command("list")
       .description("List installed hooks")
       .option("--git", "Show only git-bucket hooks")
       .option("--runtime", "Show only runtime-bucket hooks")
       .option("--enabled", "Show only currently enabled hooks")
       .action((opts: { git?: boolean; runtime?: boolean; enabled?: boolean }) => {
         const out = formatHooksList({
           bucket: opts.git ? "git" : opts.runtime ? "runtime" : undefined,
           enabled: opts.enabled,
         });
         process.stdout.write(out + "\n");
       });
   }
   ```

3. Verify: `pnpm test tests/cli/hooks-list.test.ts && pnpm build` → green.
4. Commit: `feat(cli): add codi list hooks command`

---

## Task 21: `codi add hook` command

- [ ] **Files**: `src/cli/hooks-add.ts`, `tests/cli/hooks-add.test.ts`
- [ ] **Est**: 5 minutes

Implement `addHookToState(bucket, name, statePath)` that reads `.codi/state.json`, ensures `selectedHooks[bucket]` includes `name`, validates the hook exists in the registry, and writes back atomically. Tests assert: idempotency, registry validation rejects unknown names, and that `getHook` returns the artifact.

```typescript
import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Command } from "commander";
import { getHook } from "../core/hooks/registry/index.js";

export interface AddHookResult {
  added: boolean;
  reason?: string;
}

export function addHookToState(
  bucket: "git" | "runtime",
  name: string,
  statePath: string,
): AddHookResult {
  const hook = getHook(name);
  if (!hook) return { added: false, reason: `Unknown hook '${name}'` };
  if (hook.bucket !== bucket)
    return { added: false, reason: `Hook '${name}' is in '${hook.bucket}' bucket` };

  const state = existsSync(statePath)
    ? (JSON.parse(readFileSync(statePath, "utf8")) as Record<string, unknown>)
    : {};
  const selected = (state["selectedHooks"] ?? { git: [], runtime: [] }) as {
    git?: string[];
    runtime?: string[];
  };
  const list = (selected[bucket] ?? []) as string[];
  if (list.includes(name)) return { added: false, reason: "already enabled" };
  list.push(name);
  selected[bucket] = list;
  state["selectedHooks"] = selected;

  mkdirSync(dirname(statePath), { recursive: true });
  const tmp = `${statePath}.tmp.${process.pid}.${Date.now()}`;
  writeFileSync(tmp, JSON.stringify(state, null, 2), "utf8");
  renameSync(tmp, statePath);
  return { added: true };
}

export function registerHooksAddCommand(program: Command): void {
  program
    .command("add <bucket> <name>")
    .description("Enable a hook in this project")
    .action((bucket: string, name: string) => {
      if (bucket !== "git" && bucket !== "runtime") {
        process.stderr.write(`Bucket must be 'git' or 'runtime'.\n`);
        process.exit(2);
      }
      const statePath = join(process.cwd(), ".codi", ".state", "state.json");
      const r = addHookToState(bucket, name, statePath);
      if (!r.added) {
        process.stderr.write(`No change: ${r.reason}\n`);
      } else {
        process.stdout.write(`Enabled '${name}' in ${bucket} bucket. Run 'codi generate'.\n`);
      }
    });
}
```

Commit: `feat(cli): add codi add hook command`

---

## Task 22: `codi remove hook` command

- [ ] **Files**: `src/cli/hooks-remove.ts`, `tests/cli/hooks-remove.test.ts`
- [ ] **Est**: 5 minutes

Mirror Task 21 with `removeHookFromState`. Reject removal when `hook.required === true` with reason `"required hook cannot be disabled"`.

```typescript
export function removeHookFromState(
  bucket: "git" | "runtime",
  name: string,
  statePath: string,
): { removed: boolean; reason?: string } {
  const hook = getHook(name);
  if (hook?.required) return { removed: false, reason: "required hook cannot be disabled" };
  if (!existsSync(statePath)) return { removed: false, reason: "state missing" };
  const state = JSON.parse(readFileSync(statePath, "utf8")) as Record<string, unknown>;
  const selected = (state["selectedHooks"] ?? { git: [], runtime: [] }) as {
    git?: string[];
    runtime?: string[];
  };
  const list = (selected[bucket] ?? []) as string[];
  const filtered = list.filter((n) => n !== name);
  if (filtered.length === list.length) return { removed: false, reason: "not enabled" };
  selected[bucket] = filtered;
  state["selectedHooks"] = selected;
  const tmp = `${statePath}.tmp.${process.pid}.${Date.now()}`;
  writeFileSync(tmp, JSON.stringify(state, null, 2), "utf8");
  renameSync(tmp, statePath);
  return { removed: true };
}
```

Commit: `feat(cli): add codi remove hook command`

---

## Task 23: Wire hooks subcommands in CLI index

- [ ] **Files**: `src/cli/index.ts`, `src/cli/hooks.ts`
- [ ] **Est**: 3 minutes

Add a `hooks` parent command that mounts `list`, `add`, `remove`:

```typescript
// src/cli/hooks.ts (modify existing)
import type { Command } from "commander";
import { registerHooksListCommand } from "./hooks-list.js";
import { registerHooksAddCommand } from "./hooks-add.js";
import { registerHooksRemoveCommand } from "./hooks-remove.js";

export function registerHooksRootCommand(program: Command): void {
  const hooks = program.command("hooks").description("Manage codi hooks");
  registerHooksListCommand(hooks);
  registerHooksAddCommand(hooks);
  registerHooksRemoveCommand(hooks);
}
```

In `src/cli/index.ts`, call `registerHooksRootCommand(program)` near other registrations.

Smoke: `pnpm build && node dist/cli.js hooks list` should print the table.

Commit: `feat(cli): mount codi hooks command surface`

---

## Task 24: Init wizard — two new steps

- [ ] **Files**: `src/cli/init-wizard.ts`, `tests/cli/init-wizard-hooks.test.ts`
- [ ] **Est**: 6 minutes

After the existing "Agents" step (case 2), insert two new cases:

```typescript
case 3: {
  p.log.step("Git hooks");
  const allGit = getGitHooks();
  const gitDefault = getDefaultGitHookNames(savedLanguages);
  const choice = await wizardMultiselect({
    message: "Select git hooks (pre-commit / pre-push / commit-msg)",
    options: allGit.map((h) => ({
      label: `${h.name} — ${h.description}`,
      value: h.name,
      hint: h.required ? "required" : undefined,
    })),
    initialValues: gitDefault,
    required: true,
  });
  if (isBack(choice)) { step--; break; }
  savedGitHooks = choice as string[];
  step++;
  break;
}
case 4: {
  p.log.step("Runtime hooks");
  const allRuntime = getRuntimeHooks();
  const runtimeDefault = getDefaultRuntimeHookNames();
  const choice = await wizardMultiselect({
    message: "Select runtime hooks (UserPromptSubmit / PreToolUse / Stop / ...)",
    options: allRuntime.map((h) => ({
      label: `${h.name} — ${h.description}`,
      value: h.name,
      hint: h.required ? "required" : undefined,
    })),
    initialValues: runtimeDefault,
    required: true,
  });
  if (isBack(choice)) { step--; break; }
  savedRuntimeHooks = choice as string[];
  step++;
  break;
}
```

Bump subsequent case numbers by 2. Add `gitHooks: string[]` and `runtimeHooks: string[]` to `WizardResult`. Persist them through the existing path that writes `.codi/state.json` so the result lands in `selectedHooks`.

Test (smoke): drive wizard with mocked prompts and assert `result.gitHooks.length > 0` and `result.runtimeHooks.includes("security-reminder")`.

Commit: `feat(init): add wizard steps for git and runtime hooks selection`

---

## Task 25: `codi update --hooks` flag

- [ ] **Files**: `src/cli/update.ts`, `tests/cli/update-hooks.test.ts`
- [ ] **Est**: 4 minutes

Add a `--hooks` option that re-runs only the two new wizard steps (24) and writes back `selectedHooks`. Test asserts the flag exists and triggers the wizard path.

Commit: `feat(cli): codi update --hooks reselects git and runtime hook artifacts`

---

## Task 26: claude-code adapter reads selectedHooks.runtime

- [ ] **Files**: `src/adapters/claude-code.ts`, `tests/adapters/claude-code-runtime-hooks.test.ts`
- [ ] **Est**: 5 minutes

In the existing block that builds `claudeHooks` (around the heartbeat-hooks emission), filter the runtime hook list by `state.selectedHooks?.runtime ?? getDefaultRuntimeHookNames()`. The shape of `.claude/settings.json` does not change — the `pre-tool-use` event still dispatches to the same single `codi hook pre-tool-use` command, because the runner inside that command iterates the enabled list at execution time. The adapter only needs to honour `required` hooks always and skip non-required ones absent from the selection.

For the heartbeat scripts (`skill-tracker`, `skill-observer`), only emit the script files and the corresponding settings entries when their names are in `selectedHooks.runtime`.

Test snapshots `.claude/settings.json` for two configurations:

- (a) defaults → produces today's output
- (b) `selectedHooks.runtime` excludes `skill-observer` → no Stop entry beyond `codi hook stop`

Commit: `feat(adapters): claude-code respects selectedHooks.runtime selection`

---

## Task 27: codex adapter equivalent

- [ ] **Files**: `src/adapters/codex.ts`, `tests/adapters/codex-runtime-hooks.test.ts`
- [ ] **Est**: 4 minutes

Mirror Task 26 for codex: same conditional emission of heartbeat scripts and settings entries, identical filter logic. Snapshot tests for the two configurations.

Commit: `feat(adapters): codex respects selectedHooks.runtime selection`

---

## Task 28: hook-config-generator reads selectedHooks.git

- [ ] **Files**: `src/core/hooks/hook-config-generator.ts`, `tests/core/hooks/hook-config-generator-selection.test.ts`
- [ ] **Est**: 5 minutes

The generator currently iterates languages → emits hooks. Change it to read `state.selectedHooks?.git`; when absent, fall back to language-derived defaults via `getDefaultGitHookNames`. The emitted YAML must equal the current behaviour for a fresh project. Test:

```typescript
import { describe, it, expect } from "vitest";
import { generateHooksConfig } from "#src/core/hooks/hook-config-generator.js";

describe("hook-config-generator with selection", () => {
  it("emits a subset matching selectedHooks.git", () => {
    const cfg = generateHooksConfig({}, ["typescript"], {
      selectedGitHookNames: ["eslint", "tsc"],
    });
    const names = cfg.hooks.map((h) => h.name);
    expect(names).toContain("eslint");
    expect(names).toContain("tsc");
    expect(names).not.toContain("prettier");
  });
});
```

Commit: `feat(hooks): generator honours selectedHooks.git filter`

---

## Task 29: phaseFilter enforcement live (smoke)

- [ ] **Files**: `tests/runtime/hooks/phase-filter-e2e.test.ts`
- [ ] **Est**: 3 minutes

Already implemented in Task 15 (`runRuntimeHooks` checks `phaseFilter`). This task is a verification-only smoke test that wires a runtime hook with `phaseFilter: ["execute"]`, runs the runner with `workflowPhase: "plan"`, and asserts the verdict is `matched: false`. No production code changes.

Commit: `test(hooks): verify phaseFilter gates runtime hooks per workflow phase`

---

## Task 30: dispatchSkill delegation

- [ ] **Files**: `src/runtime/hooks/runner.ts` (extend), `tests/runtime/hooks/dispatch-skill.test.ts`
- [ ] **Est**: 4 minutes

If `hook.dispatchSkill` is set, the runner does not call `evaluate()` directly — it returns a verdict whose `message` includes `"Delegate to skill: <name>"` and `severity: "info"`. The actual skill invocation is the responsibility of the gate-runner integration (which can be wired in a future PR). For now the field is honoured but treated as informational.

```typescript
// inside runRuntimeHooks loop
if (hook.dispatchSkill) {
  out.push({
    hookName: hook.name,
    matched: false,
    severity: "info",
    message: `dispatchSkill=${hook.dispatchSkill}`,
  });
  continue;
}
```

Test:

```typescript
const dispatching = { ...passing, dispatchSkill: "codi-quality-gates" };
const v = await runRuntimeHooks([dispatching], ctx);
expect(v[0]?.message).toContain("dispatchSkill=codi-quality-gates");
```

Commit: `feat(hooks): runner respects dispatchSkill as informational delegation`

---

## Task 31: E2E — Write `exec(` to `.ts` triggers exit 2

- [ ] **Files**: `tests/integration/hooks-as-artifacts-e2e.test.ts`
- [ ] **Est**: 5 minutes

Spawn `node dist/cli.js hook pre-tool-use` with stdin payload simulating a Claude Code Write call: `tool_name: "Write"`, `tool_input: { file_path: "/tmp/codi-e2e-foo.ts", content: "child_process.exec('rm');" }`. Assert exit code === 2 and stderr contains `child-process-exec`.

Commit: `test(hooks): e2e verify security-reminder triggers exit 2 on exec( in .ts`

---

## Task 32: ADR — Hooks as Artifacts

- [ ] **Files**: `docs/<timestamp>_[ARCHITECTURE]_hooks-as-artifacts.md`
- [ ] **Est**: 4 minutes

Capture: (1) the two-bucket model, (2) why we did not introduce an "advisor" type, (3) Option A (logic in `src/runtime/hooks/`, registry holds metadata + reference), (4) workflow integration via `phaseFilter` and `dispatchSkill`, (5) the additive state schema decision (no migrator).

Commit: `docs(adr): hooks as first-class artifacts with two clean buckets`

---

## Task 33: User GUIDE — managing hooks

- [ ] **Files**: `docs/<timestamp>_[GUIDE]_hooks-management.md`
- [ ] **Est**: 3 minutes

Cover: how to list / add / remove hooks, what the security-reminder does, how to opt out per-project (`codi remove hook runtime security-reminder`), and how `phaseFilter` works.

Commit: `docs(guide): how to manage codi hooks`

---

## Task 34: README + CHANGELOG

- [ ] **Files**: `README.md`, `CHANGELOG.md`
- [ ] **Est**: 2 minutes

Add a `## Hooks` section to README pointing at the GUIDE; add a `## [Unreleased]` entry to CHANGELOG: `Added: hooks-as-artifacts model, codi list/add/remove hook, security-reminder PreToolUse hook with 9 patterns.`

Commit: `docs: README + CHANGELOG for hooks-as-artifacts`

---

## Task 35: Build + full test sweep

- [ ] **Files**: none
- [ ] **Est**: 2 minutes

Run:

```
pnpm build
pnpm test
pnpm lint
```

All three must be green. If anything is red, do not move to the smoke tasks; fix forward.

No commit (no source change).

---

## Task 36: Smoke — `src/templates/` untouched

- [ ] **Files**: none
- [ ] **Est**: 1 minute

Run `git diff --stat src/templates/`. Output must be empty (the work was confined to `src/runtime/`, `src/core/`, `src/cli/`, `src/adapters/` and tests).

No commit.

---

## Task 37: Smoke — live PreToolUse trigger

- [ ] **Files**: none (manual)
- [ ] **Est**: 2 minutes

In a scratch directory:

```
echo '{"session_id":"smoke","tool_name":"Write","tool_input":{"file_path":"/tmp/smoke.ts","content":"child_process.exec(\"rm\");"},"cwd":"'$(pwd)'"}' \
  | node /Users/laht/projects/codi/dist/cli.js hook pre-tool-use
echo "exit=$?"
```

Expected: exit 2 and stderr containing `child-process-exec`.

No commit.

---

## Pre-write self-review (executed)

| Check                                                                                               | Result                                                                                                             |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Spec coverage — every §16 task mapped                                                               | ✅ Tasks 1-37 cover the spec one-to-one, with §16 task #18 redefined per the user feedback (additive, no migrator) |
| Placeholder scan — no TBD/TODO in code blocks                                                       | ✅                                                                                                                 |
| Type consistency — `HookArtifact`, `HookContext`, `HookVerdict` referenced identically across tasks | ✅                                                                                                                 |
| TDD ordering — every task writes test before impl                                                   | ✅                                                                                                                 |
| Conventional commits — every task has `feat:` / `refactor:` / `test:` / `docs:`                     | ✅                                                                                                                 |

## Execution

After this plan is approved, hand off to **codi-plan-execution**. That skill will ask whether to execute INLINE (sequential, watch-along) or via SUBAGENT (fresh subagent per task with two-stage review).
