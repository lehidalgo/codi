# Adaptive Pre-commit Hooks Implementation Plan

> **For agentic workers:** Use `codi-subagent-dev` (recommended) or `codi-plan-executor` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make codi-installed pre-commit hooks adaptive to each project's language stack, blocking commits when required tools are missing and printing exact install instructions.

**Architecture:** Extend `HookEntry` with `category`, `required`, and `installHint` fields. Update `RUNNER_TEMPLATE` to block on missing required tools. Update `buildHuskyCommands` to emit bash `command -v` guards. Add `codi hooks doctor [--fix]` and `codi hooks reinstall` CLI subcommands. Fill registry gaps for all 14 languages.

**Tech Stack:** TypeScript, Node.js, Commander.js, Husky v9, Vitest

**Scope note — `test` category hooks**: The `test` category is defined in the hook contract but deferred to a follow-up task. Running full test suites on every commit is opt-in per-project (`test_before_commit` flag in `HooksConfig`). The `generateHooksConfig` Stage 6 already handles this. No new test-category hook entries are added here.

**Design note — `InstallHint` shape**: The spec described a multi-manager object (`npm`, `pip`, `brew` keys). This plan simplifies to `{ command: string; url?: string }` — one install command with an optional doc URL. This is cleaner for the terminal output use case and avoids platform-detection logic. The spec's multi-manager format is not implemented.

---

### Task 1: Extend HookEntry interface and add getGlobalHooks() with gitleaks

**Files**: `src/core/hooks/hook-registry.ts`
**Est**: 3 minutes

**Steps**:

- [ ] 1. Write failing test in `tests/unit/hooks/hook-registry.test.ts`:
   ```typescript
   // Add inside the existing file after the getSupportedLanguages describe block

   import {
     getHooksForLanguage,
     getSupportedLanguages,
     getGlobalHooks,
   } from "#src/core/hooks/hook-registry.js";

   describe("getGlobalHooks", () => {
     it("returns gitleaks as the first global hook", () => {
       const hooks = getGlobalHooks();
       expect(hooks.length).toBeGreaterThanOrEqual(1);
       const gitleaks = hooks.find((h) => h.name === "gitleaks");
       expect(gitleaks).toBeDefined();
       expect(gitleaks!.category).toBe("security");
       expect(gitleaks!.required).toBe(true);
       expect(gitleaks!.installHint).toBeDefined();
       expect(gitleaks!.installHint!.command).toContain("gitleaks");
     });
   });

   describe("HookEntry contract", () => {
     it("all typescript hooks have category and required fields", () => {
       const hooks = getHooksForLanguage("typescript");
       for (const h of hooks) {
         expect(h.category, `${h.name} missing category`).toBeDefined();
         expect(h.required, `${h.name} missing required`).toBeDefined();
       }
     });

     it("all python hooks have installHint", () => {
       const hooks = getHooksForLanguage("python");
       for (const h of hooks) {
         expect(h.installHint, `${h.name} missing installHint`).toBeDefined();
       }
     });
   });
   ```

- [ ] 2. Verify test fails: `pnpm test tests/unit/hooks/hook-registry.test.ts` — expected: failing on `getGlobalHooks` import error and missing fields

- [ ] 3. Update `src/core/hooks/hook-registry.ts` — add `InstallHint` interface and extend `HookEntry`, then add `getGlobalHooks()`:
   ```typescript
   import { PROJECT_CLI, PROJECT_NAME } from "#src/constants.js";

   export interface InstallHint {
     /** Single-line install command to show in the terminal (e.g. "brew install gitleaks") */
     command: string;
     /** Optional URL for extended instructions */
     url?: string;
   }

   export interface HookEntry {
     name: string;
     command: string;
     stagedFilter: string;
     /** When false, the tool uses project config (e.g. tsconfig.json) and should not receive file args. Defaults to true. */
     passFiles?: boolean;
     /** When true, the hook modifies files (formatters/fixers). Modified files are re-staged automatically after the hook runs. */
     modifiesFiles?: boolean;
     /** Language this hook belongs to (e.g. "python", "typescript"). Used for grouping in generated hook scripts. */
     language?: string;
     /** When true, the command is run via execSync with shell: true instead of execFileSync. Required for commands that use shell operators (&&, ||, 2>/dev/null). */
     shell?: boolean;
     /** Hook contract category: format | lint | type-check | security | test */
     category?: "format" | "lint" | "type-check" | "security" | "test";
     /** When true, a missing tool blocks the commit with install instructions. When false (format tools), a missing tool prints a warning and skips. */
     required?: boolean;
     /** Install instructions printed when the tool is missing and required=true */
     installHint?: InstallHint;
   }
   ```

- [ ] 4. Replace `LANGUAGE_HOOKS` typescript entry with category/required/installHint fields, and update `GLOBAL_HOOKS` + add `getGlobalHooks()`:
   ```typescript
   const LANGUAGE_HOOKS: Record<string, HookEntry[]> = {
     typescript: [
       {
         name: "eslint",
         command: "npx eslint --fix",
         stagedFilter: "**/*.{ts,tsx,js,jsx}",
         modifiesFiles: true,
         category: "lint",
         required: false,
         installHint: { command: "npm install -D eslint" },
       },
       {
         name: "prettier",
         command: "npx prettier --write",
         stagedFilter: "**/*.{ts,tsx,js,jsx}",
         modifiesFiles: true,
         category: "format",
         required: false,
         installHint: { command: "npm install -D prettier" },
       },
       {
         name: "tsc",
         command: "npx tsc --noEmit",
         stagedFilter: "**/*.{ts,tsx}",
         passFiles: false,
         category: "type-check",
         required: true,
         installHint: { command: "npm install -D typescript" },
       },
     ],
     javascript: [
       {
         name: "eslint",
         command: "npx eslint --fix",
         stagedFilter: "**/*.{ts,tsx,js,jsx}",
         modifiesFiles: true,
         category: "lint",
         required: false,
         installHint: { command: "npm install -D eslint" },
       },
       {
         name: "prettier",
         command: "npx prettier --write",
         stagedFilter: "**/*.{ts,tsx,js,jsx}",
         modifiesFiles: true,
         category: "format",
         required: false,
         installHint: { command: "npm install -D prettier" },
       },
     ],
     python: [
       {
         name: "ruff-check",
         command: "ruff check --fix",
         stagedFilter: "**/*.py",
         modifiesFiles: true,
         category: "lint",
         required: true,
         installHint: { command: "pip install ruff", url: "https://docs.astral.sh/ruff" },
       },
       {
         name: "ruff-format",
         command: "ruff format",
         stagedFilter: "**/*.py",
         modifiesFiles: true,
         category: "format",
         required: false,
         installHint: { command: "pip install ruff" },
       },
       {
         name: "pyright",
         command: "npx pyright",
         stagedFilter: "**/*.py",
         passFiles: false,
         category: "type-check",
         required: true,
         installHint: { command: "npm install -D pyright" },
       },
       {
         name: "bandit",
         command: "bandit -c pyproject.toml -r",
         stagedFilter: "**/*.py",
         category: "security",
         required: true,
         installHint: { command: "pip install bandit" },
       },
     ],
     go: [
       {
         name: "golangci-lint",
         command: "golangci-lint run",
         stagedFilter: "**/*.go",
         passFiles: false,
         category: "lint",
         required: true,
         installHint: { command: "go install github.com/golangci-lint/golangci-lint/cmd/golangci-lint@latest", url: "https://golangci-lint.run/usage/install/" },
       },
       {
         name: "gofmt",
         command: "gofmt -w",
         stagedFilter: "**/*.go",
         modifiesFiles: true,
         category: "format",
         required: true,
         installHint: { command: "(included with Go — install Go from https://go.dev)" },
       },
       {
         name: "gosec",
         command: "gosec",
         stagedFilter: "**/*.go",
         passFiles: false,
         category: "security",
         required: true,
         installHint: { command: "go install github.com/securego/gosec/v2/cmd/gosec@latest" },
       },
     ],
     rust: [
       {
         name: "cargo-fmt",
         command: "cargo fmt",
         stagedFilter: "**/*.rs",
         passFiles: false,
         modifiesFiles: true,
         category: "format",
         required: true,
         installHint: { command: "rustup component add rustfmt" },
       },
       {
         name: "cargo-clippy",
         command: "cargo clippy",
         stagedFilter: "**/*.rs",
         passFiles: false,
         category: "lint",
         required: true,
         installHint: { command: "rustup component add clippy" },
       },
     ],
     java: [
       {
         name: "google-java-format",
         command: "google-java-format --replace",
         stagedFilter: "**/*.java",
         modifiesFiles: true,
         category: "format",
         required: false,
         installHint: { command: "brew install google-java-format", url: "https://github.com/google/google-java-format" },
       },
       {
         name: "checkstyle",
         command: "checkstyle -c /google_checks.xml",
         stagedFilter: "**/*.java",
         category: "lint",
         required: true,
         installHint: { command: "brew install checkstyle" },
       },
     ],
     kotlin: [
       {
         name: "ktfmt",
         command: "ktfmt --kotlinlang-style",
         stagedFilter: "**/*.kt",
         modifiesFiles: true,
         category: "format",
         required: false,
         installHint: { command: "brew install ktfmt" },
       },
       {
         name: "detekt",
         command: "detekt --input",
         stagedFilter: "**/*.kt",
         category: "lint",
         required: true,
         installHint: { command: "brew install detekt", url: "https://detekt.dev" },
       },
     ],
     swift: [
       {
         name: "swiftformat",
         command: "swiftformat",
         stagedFilter: "**/*.swift",
         modifiesFiles: true,
         category: "format",
         required: false,
         installHint: { command: "brew install swiftformat" },
       },
       {
         name: "swiftlint",
         command: "swiftlint lint --strict",
         stagedFilter: "**/*.swift",
         category: "lint",
         required: true,
         installHint: { command: "brew install swiftlint", url: "https://github.com/realm/SwiftLint" },
       },
     ],
     csharp: [
       {
         name: "dotnet-format",
         command: "dotnet format --include",
         stagedFilter: "**/*.cs",
         modifiesFiles: true,
         category: "format",
         required: false,
         installHint: { command: "Install .NET SDK from https://dot.net" },
       },
       {
         name: "dotnet-build",
         command: "dotnet build --no-incremental -nologo",
         stagedFilter: "**/*.cs",
         passFiles: false,
         category: "type-check",
         required: true,
         installHint: { command: "Install .NET SDK from https://dot.net" },
       },
     ],
     cpp: [
       {
         name: "clang-format",
         command: "clang-format -i",
         stagedFilter: "**/*.{cpp,hpp,cc,h}",
         modifiesFiles: true,
         category: "format",
         required: false,
         installHint: { command: "brew install clang-format" },
       },
       {
         name: "clang-tidy",
         command: "clang-tidy",
         stagedFilter: "**/*.{cpp,cc}",
         category: "lint",
         required: true,
         installHint: { command: "brew install llvm  # provides clang-tidy" },
       },
     ],
     php: [
       {
         name: "php-cs-fixer",
         command: "php-cs-fixer fix",
         stagedFilter: "**/*.php",
         modifiesFiles: true,
         category: "format",
         required: false,
         installHint: { command: "composer global require friendsofphp/php-cs-fixer" },
       },
       {
         name: "phpstan",
         command: "phpstan analyse",
         stagedFilter: "**/*.php",
         passFiles: false,
         category: "type-check",
         required: true,
         installHint: { command: "composer global require phpstan/phpstan" },
       },
       {
         name: "phpcs-security",
         command: "phpcs --standard=Security",
         stagedFilter: "**/*.php",
         category: "security",
         required: true,
         installHint: { command: "composer global require pheromone/phpcs-security-audit" },
       },
     ],
     ruby: [
       {
         name: "rubocop",
         command: "rubocop -a",
         stagedFilter: "**/*.rb",
         modifiesFiles: true,
         category: "lint",
         required: true,
         installHint: { command: "gem install rubocop" },
       },
       {
         name: "brakeman",
         command: "brakeman --no-pager -q",
         stagedFilter: "**/*.rb",
         passFiles: false,
         category: "security",
         required: true,
         installHint: { command: "gem install brakeman" },
       },
     ],
     dart: [
       {
         name: "dart-format",
         command: "dart format",
         stagedFilter: "**/*.dart",
         modifiesFiles: true,
         category: "format",
         required: false,
         installHint: { command: "Install Dart SDK from https://dart.dev" },
       },
       {
         name: "dart-analyze",
         command: "dart analyze",
         stagedFilter: "**/*.dart",
         category: "lint",
         required: true,
         installHint: { command: "Install Dart SDK from https://dart.dev" },
       },
     ],
     shell: [
       {
         name: "shellcheck",
         command: "shellcheck -S warning",
         stagedFilter: "**/*.sh",
         category: "lint",
         required: true,
         installHint: { command: "brew install shellcheck" },
       },
     ],
   };

   const GLOBAL_HOOKS: HookEntry[] = [
     {
       name: "gitleaks",
       command: "gitleaks protect --staged --no-banner",
       stagedFilter: "**/*",
       passFiles: false,
       category: "security",
       required: true,
       installHint: {
         command: "brew install gitleaks",
         url: "https://github.com/gitleaks/gitleaks#installing",
       },
     },
     {
       name: `${PROJECT_NAME}-doctor`,
       command: `npx ${PROJECT_CLI} doctor --ci`,
       stagedFilter: "",
       category: "lint",
       required: false,
     },
   ];

   export function getDoctorHook(): HookEntry {
     return GLOBAL_HOOKS.find((h) => h.name === `${PROJECT_NAME}-doctor`)!;
   }

   export function getGlobalHooks(): HookEntry[] {
     return [...GLOBAL_HOOKS];
   }

   export function getHooksForLanguage(language: string): HookEntry[] {
     const normalized = language.toLowerCase();
     const hooks = LANGUAGE_HOOKS[normalized] ?? [];
     return hooks.map((h) => ({ ...h, language: normalized }));
   }

   export function getSupportedLanguages(): string[] {
     return Object.keys(LANGUAGE_HOOKS);
   }
   ```

- [ ] 5. Verify test passes: `pnpm test tests/unit/hooks/hook-registry.test.ts` — expected: new tests pass, existing tests still pass (hook counts unchanged)

- [ ] 6. Commit: `git add src/core/hooks/hook-registry.ts tests/unit/hooks/hook-registry.test.ts && git commit -m "feat(hooks): extend HookEntry with category/required/installHint + getGlobalHooks() with gitleaks"`

**Verification**: `pnpm test tests/unit/hooks/` — expected: all passing

---

### Task 2: Update RUNNER_TEMPLATE to block on missing required tools

**Files**: `src/core/hooks/hook-templates.ts`
**Est**: 4 minutes

**Steps**:

- [ ] 1. Write failing test in `tests/unit/hooks/hook-templates.test.ts`:
   ```typescript
   import { describe, it, expect } from "vitest";
   import { RUNNER_TEMPLATE } from "#src/core/hooks/hook-templates.js";

   describe("RUNNER_TEMPLATE", () => {
     it("contains ENOENT blocking logic for required tools", () => {
       expect(RUNNER_TEMPLATE).toContain("required");
       expect(RUNNER_TEMPLATE).toContain("BLOCKING — install");
       expect(RUNNER_TEMPLATE).toContain("installHint");
       expect(RUNNER_TEMPLATE).toContain("exitCode = 1");
     });

     it("contains warning logic for non-required tools", () => {
       expect(RUNNER_TEMPLATE).toContain("WARNING — install");
     });

     it("is a valid shell script starting with #!/bin/sh", () => {
       expect(RUNNER_TEMPLATE.trimStart()).toMatch(/^#!\/bin\/sh/);
     });
   });
   ```

- [ ] 2. Verify test fails: `pnpm test tests/unit/hooks/hook-templates.test.ts` — expected: "BLOCKING — install" not found

- [ ] 3. In `src/core/hooks/hook-templates.ts`, replace the ENOENT catch block inside `RUNNER_TEMPLATE`. Find the existing catch block:
   ```javascript
   // CURRENT (lines 47-54 inside RUNNER_TEMPLATE string):
   } catch (e) {
     if (e && typeof e === 'object' && 'code' in e && e.code === 'ENOENT') {
       console.log(\`  \${hook.name}: skipped (tool not installed)\`);
     } else {
       console.error(\`\${hook.name} failed\`);
       exitCode = 1;
     }
   }
   ```

   Replace with:
   ```javascript
   // REPLACEMENT (inside the RUNNER_TEMPLATE template literal):
   } catch (e) {
     if (e && typeof e === 'object' && 'code' in e && e.code === 'ENOENT') {
       if (hook.required === true) {
         console.error(\`\\n  ✗ BLOCKING — install \${hook.name} to commit:\`);
         if (hook.installHint && hook.installHint.command) {
           console.error(\`    \${hook.installHint.command}\`);
         }
         if (hook.installHint && hook.installHint.url) {
           console.error(\`    See: \${hook.installHint.url}\`);
         }
         exitCode = 1;
       } else {
         console.warn(\`  ⚠ WARNING — install \${hook.name} to enable \${hook.category ?? 'this check'} (optional)\`);
         if (hook.installHint && hook.installHint.command) {
           console.warn(\`    \${hook.installHint.command}\`);
         }
       }
     } else {
       console.error(\`\${hook.name} failed\`);
       exitCode = 1;
     }
   }
   ```

- [ ] 4. Verify test passes: `pnpm test tests/unit/hooks/hook-templates.test.ts` — expected: all 3 tests passing

- [ ] 5. Commit: `git add src/core/hooks/hook-templates.ts tests/unit/hooks/hook-templates.test.ts && git commit -m "feat(hooks): block commit on missing required tools, warn for optional tools"`

**Verification**: `pnpm test tests/unit/hooks/` — expected: all passing

---

### Task 3: Update buildHuskyCommands to emit bash tool-presence guards

**Files**: `src/core/hooks/hook-installer.ts`, `tests/unit/hooks/hook-installer.test.ts`
**Est**: 4 minutes

**Steps**:

- [ ] 1. Write failing test in `tests/unit/hooks/hook-installer.test.ts` (create file if it does not exist):
   ```typescript
   import { describe, it, expect } from "vitest";
   import { buildHuskyCommands } from "#src/core/hooks/hook-installer.js";
   import type { HookEntry } from "#src/core/hooks/hook-registry.js";

   describe("buildHuskyCommands tool guards", () => {
     it("generates command -v guard for a required hook", () => {
       const hooks: HookEntry[] = [
         {
           name: "tsc",
           command: "npx tsc --noEmit",
           stagedFilter: "**/*.{ts,tsx}",
           passFiles: false,
           category: "type-check",
           required: true,
           installHint: { command: "npm install -D typescript" },
         },
       ];
       const result = buildHuskyCommands(hooks);
       expect(result).toContain("command -v");
       expect(result).toContain("tsc");
       expect(result).toContain("BLOCKING");
     });

     it("does not add command -v guard for non-required hooks", () => {
       const hooks: HookEntry[] = [
         {
           name: "prettier",
           command: "npx prettier --write",
           stagedFilter: "**/*.{ts,tsx}",
           modifiesFiles: true,
           category: "format",
           required: false,
           installHint: { command: "npm install -D prettier" },
         },
       ];
       const result = buildHuskyCommands(hooks);
       // Non-required format tools use simple conditional, no exit 1
       expect(result).not.toContain("exit 1");
     });
   });
   ```

- [ ] 2. Export `buildHuskyCommands` from `src/core/hooks/hook-installer.ts` for testability — add `export` keyword to the function declaration:
   ```typescript
   // Change line: function buildHuskyCommands(hooks: HookEntry[]): string {
   // To:
   export function buildHuskyCommands(hooks: HookEntry[]): string {
   ```

- [ ] 3. In `src/core/hooks/hook-installer.ts`, update `buildHuskyCommands` to add tool-presence checks. Replace the section starting at the inner loop body (after the language comment insertion):

   For the `!h.stagedFilter` (global hook, no filter) case, add a tool guard:
   ```typescript
   if (!h.stagedFilter) {
     // Global hook (no filter) — always runs, but guard tool presence
     const tool = h.command.split(/\s+/)[0]!;
     if (h.required === true) {
       lines.push(
         `if ! command -v ${tool} > /dev/null 2>&1; then`,
         `  echo "  ✗ BLOCKING — install ${h.name} to commit: ${h.installHint?.command ?? `install ${tool}`}"`,
         `  exit 1`,
         `fi`,
         h.command,
       );
     } else {
       lines.push(
         `if command -v ${tool} > /dev/null 2>&1; then`,
         `  ${h.command}`,
         `else`,
         `  echo "  ⚠ WARNING — ${h.name} not installed (optional): ${h.installHint?.command ?? `install ${tool}`}"`,
         `fi`,
       );
     }
     continue;
   }
   ```

   For the normal `grepPattern` case (tool runs on filtered files), add guard around the `[ -n "$VARNAME" ] && ...` block:
   ```typescript
   // Replace the lines.push for passFiles=false case:
   if (h.passFiles === false) {
     if (h.required === true) {
       const tool = h.command.split(/\s+/).find((p) => p !== "npx") ?? h.name;
       lines.push(
         `if [ -n "$${varName}" ]; then`,
         `  if ! command -v ${tool} > /dev/null 2>&1 && ! [ -f "./node_modules/.bin/${tool}" ]; then`,
         `    echo "  ✗ BLOCKING — install ${h.name} to commit: ${h.installHint?.command ?? `install ${tool}`}"`,
         `    exit 1`,
         `  fi`,
         `  ${h.command}`,
         `fi`,
       );
     } else {
       lines.push(
         `[ -n "$${varName}" ] && ${h.command}`,
       );
     }
   } else {
     if (h.required === true) {
       const tool = h.command.split(/\s+/).find((p) => p !== "npx") ?? h.name;
       lines.push(
         `if [ -n "$${varName}" ]; then`,
         `  if ! command -v ${tool} > /dev/null 2>&1 && ! [ -f "./node_modules/.bin/${tool}" ]; then`,
         `    echo "  ✗ BLOCKING — install ${h.name} to commit: ${h.installHint?.command ?? `install ${tool}`}"`,
         `    exit 1`,
         `  fi`,
         `  printf '%s\\n' $${varName} | xargs ${h.command}`,
         `fi`,
       );
     } else {
       lines.push(
         `[ -n "$${varName}" ] && printf '%s\\n' $${varName} | xargs ${h.command}`,
       );
     }
   }
   ```

- [ ] 4. Verify test passes: `pnpm test tests/unit/hooks/hook-installer.test.ts` — expected: all passing

- [ ] 5. Verify full build: `pnpm build` — expected: 0 errors

- [ ] 6. Commit: `git add src/core/hooks/hook-installer.ts tests/unit/hooks/hook-installer.test.ts && git commit -m "feat(hooks): add bash command -v guards for required tools in husky hook generation"`

**Verification**: `pnpm build && pnpm test tests/unit/hooks/` — expected: build passes, all tests passing

---

### Task 4: Update hook-config-generator to include global hooks at Stage 2

**Files**: `src/core/hooks/hook-config-generator.ts`, `tests/unit/hooks/hook-config-generator.test.ts`
**Est**: 3 minutes

**Steps**:

- [ ] 1. Write failing test in `tests/unit/hooks/hook-config-generator.test.ts` (create if not present):
   ```typescript
   import { describe, it, expect } from "vitest";
   import { generateHooksConfig } from "#src/core/hooks/hook-config-generator.js";

   describe("generateHooksConfig", () => {
     it("includes gitleaks in the hook list when security_scan is enabled", () => {
       const config = generateHooksConfig({} as never, []);
       const gitleaks = config.hooks.find((h) => h.name === "gitleaks");
       expect(gitleaks).toBeDefined();
       expect(gitleaks!.category).toBe("security");
     });

     it("places gitleaks before language hooks", () => {
       const config = generateHooksConfig({} as never, ["typescript"]);
       const gitleaksIdx = config.hooks.findIndex((h) => h.name === "gitleaks");
       const eslintIdx = config.hooks.findIndex((h) => h.name === "eslint");
       expect(gitleaksIdx).toBeLessThan(eslintIdx);
     });

     it("does not include gitleaks when security_scan is disabled", () => {
       const flags = { security_scan: { value: false, mode: "disabled" } } as never;
       const config = generateHooksConfig(flags, []);
       const gitleaks = config.hooks.find((h) => h.name === "gitleaks");
       expect(gitleaks).toBeUndefined();
     });
   });
   ```

- [ ] 2. Verify test fails: `pnpm test tests/unit/hooks/hook-config-generator.test.ts` — expected: gitleaks not found

- [ ] 3. In `src/core/hooks/hook-config-generator.ts`, add the import for `getGlobalHooks`:
   ```typescript
   // Change this import:
   import { getHooksForLanguage, getDoctorHook } from "./hook-registry.js";
   // To:
   import { getHooksForLanguage, getDoctorHook, getGlobalHooks } from "./hook-registry.js";
   ```

- [ ] 4. In `generateHooksConfig`, add global hooks (gitleaks) at Stage 2, before the existing secret-scan block:
   ```typescript
   // ── Stage 2: Fast content checks ─────────────────────────────────────────
   // Read file contents but no compilation or external tool startup cost.

   // Add global hooks (gitleaks) — controlled by security_scan flag
   if (isSecurityScanEnabled(flags)) {
     for (const globalHook of getGlobalHooks()) {
       if (globalHook.name !== `${PROJECT_NAME}-doctor`) {
         allHooks.push(globalHook);
       }
     }
   }

   const secretScan = isSecurityScanEnabled(flags);
   // ... rest of Stage 2 unchanged
   ```

- [ ] 5. Add `"gitleaks"` to `FLAG_HOOK_MAPPINGS` security_scan entry:
   ```typescript
   const FLAG_HOOK_MAPPINGS: FlagHookMapping[] = [
     {
       flagName: "type_checking",
       hookNames: ["tsc", "pyright", "dotnet-build"],
       check: (flag) => flag.value !== "off" && flag.mode !== "disabled",
     },
     {
       flagName: "security_scan",
       hookNames: ["gitleaks", "bandit", "gosec", "brakeman", "phpcs-security"],
       check: (flag) => flag.value !== false && flag.mode !== "disabled",
     },
   ];
   ```

- [ ] 6. Verify test passes: `pnpm test tests/unit/hooks/hook-config-generator.test.ts` — expected: all 3 tests passing

- [ ] 7. Commit: `git add src/core/hooks/hook-config-generator.ts tests/unit/hooks/hook-config-generator.test.ts && git commit -m "feat(hooks): add gitleaks as global security hook at Stage 2 of hook config generation"`

**Verification**: `pnpm test tests/unit/hooks/` — expected: all passing

---

### Task 5: Update hook-dependency-checker to return all tools with DependencyDiagnostic

**Files**: `src/core/hooks/hook-dependency-checker.ts`, `tests/unit/hooks/hook-dependency-checker.test.ts`
**Est**: 3 minutes

**Steps**:

- [ ] 1. Write failing test in `tests/unit/hooks/hook-dependency-checker.test.ts`:
   ```typescript
   import { describe, it, expect } from "vitest";
   import {
     checkHookDependencies,
     DependencyDiagnostic,
   } from "#src/core/hooks/hook-dependency-checker.js";
   import type { HookEntry } from "#src/core/hooks/hook-registry.js";

   describe("checkHookDependencies", () => {
     it("returns all checked tools, not just missing ones", async () => {
       const hooks: HookEntry[] = [
         {
           name: "git",
           command: "git status",
           stagedFilter: "**/*",
           category: "lint",
           required: true,
         },
       ];
       // git is always available — if only missing tools returned, result would be empty
       const results = await checkHookDependencies(hooks, process.cwd());
       const git = results.find((r) => r.name === "git");
       expect(git).toBeDefined();
       expect(git!.found).toBe(true);
     });

     it("DependencyDiagnostic has severity field", async () => {
       const hooks: HookEntry[] = [
         {
           name: "git",
           command: "git status",
           stagedFilter: "**/*",
           required: true,
           category: "security",
         },
       ];
       const results = await checkHookDependencies(hooks, process.cwd());
       expect(results[0]).toHaveProperty("severity");
     });
   });
   ```

- [ ] 2. Verify test fails: `pnpm test tests/unit/hooks/hook-dependency-checker.test.ts` — expected: `DependencyDiagnostic` import error and `found` property missing

- [ ] 3. Replace the entire content of `src/core/hooks/hook-dependency-checker.ts`:
   ```typescript
   import { existsSync } from "node:fs";
   import { join } from "node:path";
   import { execFileAsync } from "#src/utils/exec.js";
   import type { HookEntry, InstallHint } from "./hook-registry.js";

   export interface DependencyDiagnostic {
     name: string;
     /** true when the tool was found on PATH or in node_modules/.bin */
     found: boolean;
     /** "error" when required=true and tool missing; "warning" when required=false and tool missing; "ok" when found */
     severity: "ok" | "warning" | "error";
     category: HookEntry["category"];
     installHint: InstallHint | undefined;
     /** Full path to the resolved binary, or undefined if not found */
     resolvedPath?: string;
     /** Whether this is an npm package resolvable via npx */
     isNodePackage: boolean;
   }

   /** @deprecated Use DependencyDiagnostic. Kept for backward-compat with callers that read only missing tools. */
   export interface DependencyCheck {
     name: string;
     available: boolean;
     installHint: string;
     isNodePackage: boolean;
   }

   const INSTALL_HINTS: Record<string, string> = {
     eslint: "npm install -D eslint",
     prettier: "npm install -D prettier",
     tsc: "npm install -D typescript",
     ruff: "pip install ruff",
     pyright: "npm install -D pyright",
     "golangci-lint": "go install github.com/golangci-lint/golangci-lint/cmd/golangci-lint@latest",
     gofmt: "(included with Go)",
     cargo: "(included with Rust)",
     "cargo-clippy": "rustup component add clippy",
     "cargo-fmt": "rustup component add rustfmt",
     "google-java-format": "brew install google-java-format",
     checkstyle: "brew install checkstyle",
     ktfmt: "brew install ktfmt",
     detekt: "brew install detekt",
     swiftformat: "brew install swiftformat",
     swiftlint: "brew install swiftlint",
     dotnet: "Install .NET SDK from https://dot.net",
     "clang-format": "brew install clang-format",
     "clang-tidy": "brew install llvm",
     "php-cs-fixer": "composer global require friendsofphp/php-cs-fixer",
     phpstan: "composer global require phpstan/phpstan",
     rubocop: "gem install rubocop",
     dart: "Install Dart SDK from https://dart.dev",
     bandit: "pip install bandit",
     gosec: "go install github.com/securego/gosec/v2/cmd/gosec@latest",
     brakeman: "gem install brakeman",
     "phpcs-security": "composer global require pheromone/phpcs-security-audit",
     gitleaks: "brew install gitleaks",
   };

   /** Tools that are npm packages and can be installed via npm/npx */
   const NODE_PACKAGES = new Set(["eslint", "prettier", "tsc", "pyright"]);

   function extractToolName(command: string): string {
     const parts = command.split(/\s+/);
     if (parts[0] === "npx" && parts[1]) {
       return parts[1];
     }
     return parts[0] ?? command;
   }

   async function resolveToolPath(tool: string): Promise<string | undefined> {
     try {
       const { stdout } = await execFileAsync("which", [tool]);
       return stdout.trim() || undefined;
     } catch {
       return undefined;
     }
   }

   function isToolInNodeModules(tool: string, projectRoot: string): boolean {
     return existsSync(join(projectRoot, "node_modules", ".bin", tool));
   }

   export async function checkHookDependencies(
     hooks: HookEntry[],
     projectRoot?: string,
   ): Promise<DependencyDiagnostic[]> {
     const seen = new Set<string>();
     const uniqueEntries: { tool: string; hook: HookEntry; isNodePkg: boolean }[] = [];

     for (const hook of hooks) {
       const tool = extractToolName(hook.command);
       if (seen.has(tool)) continue;
       seen.add(tool);
       uniqueEntries.push({ tool, hook, isNodePkg: NODE_PACKAGES.has(tool) });
     }

     const results = await Promise.all(
       uniqueEntries.map(async ({ tool, hook, isNodePkg }) => {
         let resolvedPath: string | undefined;
         if (isNodePkg && projectRoot && isToolInNodeModules(tool, projectRoot)) {
           resolvedPath = join(projectRoot, "node_modules", ".bin", tool);
         }
         if (!resolvedPath) {
           resolvedPath = await resolveToolPath(tool);
         }
         const found = resolvedPath !== undefined;

         // Build installHint: prefer hook's own installHint, fall back to INSTALL_HINTS record
         const installHint: InstallHint | undefined = hook.installHint ?? (
           INSTALL_HINTS[tool] ? { command: INSTALL_HINTS[tool]! } : undefined
         );

         let severity: DependencyDiagnostic["severity"] = "ok";
         if (!found) {
           severity = hook.required === true ? "error" : "warning";
         }

         return {
           name: tool,
           found,
           severity,
           category: hook.category,
           installHint,
           resolvedPath,
           isNodePackage: isNodePkg,
         } satisfies DependencyDiagnostic;
       }),
     );

     return results;
   }

   /** Convenience helper for callers that only need the missing tools (backward compat). */
   export function filterMissing(diagnostics: DependencyDiagnostic[]): DependencyCheck[] {
     return diagnostics
       .filter((d) => !d.found)
       .map((d) => ({
         name: d.name,
         available: false,
         installHint: d.installHint?.command ?? `Install ${d.name}`,
         isNodePackage: d.isNodePackage,
       }));
   }

   export { extractToolName, NODE_PACKAGES };
   ```

- [ ] 4. Update callers of `checkHookDependencies` that use `DependencyCheck[]` return type. Find callers:
   ```
   grep -rn "checkHookDependencies\|missingDeps\|DependencyCheck" src/ --include="*.ts"
   ```
   In `src/core/hooks/hook-installer.ts` line 27:
   ```typescript
   // Change:
   import type { DependencyCheck } from "./hook-dependency-checker.js";
   // To:
   import type { DependencyCheck, DependencyDiagnostic } from "./hook-dependency-checker.js";
   import { filterMissing } from "./hook-dependency-checker.js";
   ```
   In `installHooks()` where `missingDeps` is set, update to use `filterMissing`:
   ```typescript
   // Find the line that sets missingDeps: [] and replace with actual check
   // In the return statement of installHooks, change missingDeps: [] to:
   missingDeps: filterMissing(await checkHookDependencies(options.hooks, options.projectRoot)),
   ```
   Find and update `src/core/init.ts` and `src/cli/generate.ts` callers similarly:
   - They call `checkHookDependencies()` and iterate the result as `DependencyCheck[]`
   - Add `filterMissing()` wrapper around the result to maintain backward compat

- [ ] 5. Verify test passes: `pnpm test tests/unit/hooks/hook-dependency-checker.test.ts` — expected: all 2 new tests pass

- [ ] 6. Verify full build: `pnpm build` — expected: 0 type errors

- [ ] 7. Commit: `git add src/core/hooks/hook-dependency-checker.ts src/core/hooks/hook-installer.ts tests/unit/hooks/hook-dependency-checker.test.ts && git commit -m "feat(hooks): replace DependencyCheck with DependencyDiagnostic, return all tools with severity"`

**Verification**: `pnpm build && pnpm test tests/unit/hooks/` — expected: build passes, all tests passing

---

### Task 6: Create `codi hooks doctor [--fix]` and `codi hooks reinstall` CLI subcommands

**Files**: `src/cli/hooks.ts` (new file), `tests/unit/cli/hooks.test.ts` (new file)
**Est**: 5 minutes

**Steps**:

- [ ] 1. Write failing test in `tests/unit/cli/hooks.test.ts`:
   ```typescript
   import { describe, it, expect } from "vitest";
   import { Command } from "commander";
   import { registerHooksCommand } from "#src/cli/hooks.js";

   describe("registerHooksCommand", () => {
     it("registers a 'hooks' command on the program", () => {
       const program = new Command();
       registerHooksCommand(program);
       const hooksCmd = program.commands.find((c) => c.name() === "hooks");
       expect(hooksCmd).toBeDefined();
     });

     it("hooks command has 'doctor' subcommand", () => {
       const program = new Command();
       registerHooksCommand(program);
       const hooksCmd = program.commands.find((c) => c.name() === "hooks")!;
       const doctorSub = hooksCmd.commands.find((c) => c.name() === "doctor");
       expect(doctorSub).toBeDefined();
     });

     it("hooks doctor has --fix option", () => {
       const program = new Command();
       registerHooksCommand(program);
       const hooksCmd = program.commands.find((c) => c.name() === "hooks")!;
       const doctorSub = hooksCmd.commands.find((c) => c.name() === "doctor")!;
       const fixOpt = doctorSub.options.find((o) => o.long === "--fix");
       expect(fixOpt).toBeDefined();
     });

     it("hooks command has 'reinstall' subcommand", () => {
       const program = new Command();
       registerHooksCommand(program);
       const hooksCmd = program.commands.find((c) => c.name() === "hooks")!;
       const reinstallSub = hooksCmd.commands.find((c) => c.name() === "reinstall");
       expect(reinstallSub).toBeDefined();
     });
   });
   ```

- [ ] 2. Verify test fails: `pnpm test tests/unit/cli/hooks.test.ts` — expected: module not found error

- [ ] 3. Create `src/cli/hooks.ts`:
   ```typescript
   import { execFileSync } from "node:child_process";
   import type { Command } from "commander";
   import { detectStack } from "../core/hooks/stack-detector.js";
   import { generateHooksConfig } from "../core/hooks/hook-config-generator.js";
   import { checkHookDependencies } from "../core/hooks/hook-dependency-checker.js";
   import { resolveConfig } from "../core/config/resolver.js";
   import { Logger } from "../core/output/logger.js";
   import { initFromOptions } from "./shared.js";
   import type { GlobalOptions } from "./shared.js";
   import type { DependencyDiagnostic } from "../core/hooks/hook-dependency-checker.js";
   import { PROJECT_CLI } from "../constants.js";

   interface HooksDoctorOptions extends GlobalOptions {
     fix?: boolean;
   }

   async function hooksDoctorHandler(
     projectRoot: string,
     options: HooksDoctorOptions,
   ): Promise<void> {
     const logger = Logger.getInstance();

     const stackResult = await detectStack(projectRoot);
     const languages = stackResult.ok ? stackResult.data.languages : [];

     const configResult = await resolveConfig(projectRoot);
     const flags = configResult.ok ? configResult.data.flags : {};

     const config = generateHooksConfig(flags as never, languages);

     const diagnostics: DependencyDiagnostic[] = await checkHookDependencies(
       config.hooks,
       projectRoot,
     );

     const errors = diagnostics.filter((d) => d.severity === "error");
     const warnings = diagnostics.filter((d) => d.severity === "warning");
     const ok = diagnostics.filter((d) => d.severity === "ok");

     logger.info(`\ncodi hooks doctor — ${projectRoot}\n`);
     logger.info(`  Languages detected: ${languages.length > 0 ? languages.join(", ") : "(none)"}`);
     logger.info(`  Hooks checked: ${diagnostics.length}`);
     logger.info(`  ✓ Installed: ${ok.length}`);

     if (warnings.length > 0) {
       logger.info(`\n  Optional tools not installed (${warnings.length}):`);
       for (const w of warnings) {
         logger.warn(`    ⚠ ${w.name} [${w.category ?? "unknown"}]`);
         if (w.installHint) {
           logger.warn(`      Install: ${w.installHint.command}`);
         }
       }
     }

     if (errors.length > 0) {
       logger.info(`\n  Required tools not installed (${errors.length}) — commits will be BLOCKED:`);
       for (const e of errors) {
         logger.error(`    ✗ ${e.name} [${e.category ?? "unknown"}]`);
         if (e.installHint) {
           logger.error(`      Install: ${e.installHint.command}`);
           if (e.installHint.url) {
             logger.error(`      See:     ${e.installHint.url}`);
           }
         }
       }
       if (!options.fix) {
         process.exitCode = 1;
       }
     } else {
       logger.info(`\n  All required tools are installed.`);
     }

     // --fix: run all missing install commands (informational echo — does not auto-install)
     if (options.fix) {
       const allMissing = [...errors, ...warnings];
       if (allMissing.length === 0) {
         logger.info(`\n  Nothing to fix.`);
       } else {
         logger.info(`\n  Run these commands to install missing tools:`);
         for (const d of allMissing) {
           if (d.installHint) {
             logger.info(`    ${d.installHint.command}`);
           }
         }
       }
     }
   }

   async function hooksReinstallHandler(projectRoot: string): Promise<void> {
     const logger = Logger.getInstance();
     logger.info("Reinstalling codi pre-commit hooks...");
     try {
       execFileSync("node", [
         `${projectRoot}/node_modules/.bin/${PROJECT_CLI}`,
         "generate",
       ], { stdio: "inherit", cwd: projectRoot });
     } catch {
       // Fall back to npx if local binary not found
       execFileSync("npx", [PROJECT_CLI, "generate"], { stdio: "inherit", cwd: projectRoot });
     }
   }

   export function registerHooksCommand(program: Command): void {
     const hooksCmd = program
       .command("hooks")
       .description("Manage and diagnose pre-commit hooks");

     hooksCmd
       .command("doctor")
       .description("Check that all required hook tools are installed")
       .option("--fix", "Print install commands for all missing tools")
       .action(async (cmdOptions: Record<string, unknown>) => {
         const globalOptions = program.opts() as GlobalOptions;
         const options: HooksDoctorOptions = { ...globalOptions, ...cmdOptions };
         initFromOptions(options);
         await hooksDoctorHandler(process.cwd(), options);
       });

     hooksCmd
       .command("reinstall")
       .description("Re-run codi generate to reinstall pre-commit hooks")
       .action(async () => {
         const globalOptions = program.opts() as GlobalOptions;
         initFromOptions(globalOptions);
         await hooksReinstallHandler(process.cwd());
       });
   }
   ```

- [ ] 4. Verify test passes: `pnpm test tests/unit/cli/hooks.test.ts` — expected: all 3 tests passing

- [ ] 5. Commit: `git add src/cli/hooks.ts tests/unit/cli/hooks.test.ts && git commit -m "feat(hooks): add codi hooks doctor CLI command"`

**Verification**: `pnpm test tests/unit/cli/` — expected: all passing

---

### Task 7: Register hooks command in src/cli.ts

**Files**: `src/cli.ts`
**Est**: 2 minutes

**Steps**:

- [ ] 1. Write failing test in `tests/unit/cli/cli-registry.test.ts`:
   ```typescript
   import { describe, it, expect } from "vitest";
   import { execFileSync } from "node:child_process";
   import { join } from "node:path";

   describe("codi CLI hooks command registration", () => {
     it("codi --help includes 'hooks' command", () => {
       const output = execFileSync(
         "node",
         [join(process.cwd(), "dist/cli.js"), "--help"],
         { encoding: "utf-8" },
       );
       expect(output).toContain("hooks");
     });
   });
   ```

- [ ] 2. Verify test fails: `pnpm build && pnpm test tests/unit/cli/cli-registry.test.ts` — expected: "hooks" not in help output

- [ ] 3. In `src/cli.ts`, add the import and registration. After the `registerOnboardCommand` import line, add:
   ```typescript
   import { registerHooksCommand } from "./cli/hooks.js";
   ```
   After the `registerOnboardCommand(program);` call, add:
   ```typescript
   registerHooksCommand(program);
   ```

- [ ] 4. Rebuild and verify: `pnpm build && pnpm test tests/unit/cli/cli-registry.test.ts` — expected: "hooks" appears in help output

- [ ] 5. Commit: `git add src/cli.ts && git commit -m "feat(hooks): register hooks command in CLI"`

**Verification**: `pnpm build && node dist/cli.js hooks --help` — expected: shows `hooks doctor [options]` subcommand

---

### Task 8: Update tests — fix hook counts and add contract completeness assertions

**Files**: `tests/unit/hooks/hook-registry.test.ts`
**Est**: 3 minutes

**Steps**:

- [ ] 1. Run existing tests to see current failures: `pnpm test tests/unit/hooks/hook-registry.test.ts`
   Expected: rust count test fails (was 2, now 2 — no change; but order changed: cargo-fmt first now)

- [ ] 2. Update `tests/unit/hooks/hook-registry.test.ts` — fix rust hook order test and add contract completeness test:
   ```typescript
   import { describe, it, expect } from "vitest";
   import {
     getHooksForLanguage,
     getSupportedLanguages,
     getGlobalHooks,
   } from "#src/core/hooks/hook-registry.js";

   describe("getHooksForLanguage", () => {
     it("returns typescript hooks with npx prefix", () => {
       const hooks = getHooksForLanguage("typescript");
       expect(hooks).toHaveLength(3);
       expect(hooks.map((h) => h.name)).toEqual(["eslint", "prettier", "tsc"]);
       expect(hooks[0]!.command).toBe("npx eslint --fix");
       expect(hooks[1]!.command).toBe("npx prettier --write");
       expect(hooks[2]!.command).toBe("npx tsc --noEmit");
       expect(hooks[0]!.stagedFilter).toBe("**/*.{ts,tsx,js,jsx}");
     });

     it("returns javascript hooks", () => {
       const hooks = getHooksForLanguage("javascript");
       expect(hooks).toHaveLength(2);
       expect(hooks.map((h) => h.name)).toEqual(["eslint", "prettier"]);
     });

     it("returns python hooks", () => {
       const hooks = getHooksForLanguage("python");
       expect(hooks).toHaveLength(4);
       expect(hooks.map((h) => h.name)).toEqual([
         "ruff-check",
         "ruff-format",
         "pyright",
         "bandit",
       ]);
       expect(hooks[0]!.command).toBe("ruff check --fix");
       expect(hooks[2]!.command).toBe("npx pyright");
     });

     it("returns go hooks", () => {
       const hooks = getHooksForLanguage("go");
       expect(hooks).toHaveLength(3);
       expect(hooks.map((h) => h.name)).toEqual([
         "golangci-lint",
         "gofmt",
         "gosec",
       ]);
     });

     it("returns rust hooks with cargo-fmt before cargo-clippy", () => {
       const hooks = getHooksForLanguage("rust");
       expect(hooks).toHaveLength(2);
       expect(hooks.map((h) => h.name)).toEqual(["cargo-fmt", "cargo-clippy"]);
     });

     it("returns empty array for unknown language", () => {
       const hooks = getHooksForLanguage("cobol");
       expect(hooks).toEqual([]);
     });

     it("is case-insensitive", () => {
       const hooks = getHooksForLanguage("Python");
       expect(hooks).toHaveLength(4);
     });
   });

   describe("getSupportedLanguages", () => {
     it("returns all supported languages", () => {
       const languages = getSupportedLanguages();
       expect(languages).toContain("typescript");
       expect(languages).toContain("javascript");
       expect(languages).toContain("python");
       expect(languages).toContain("go");
       expect(languages).toContain("rust");
     });
   });

   describe("getGlobalHooks", () => {
     it("returns gitleaks as the first global hook", () => {
       const hooks = getGlobalHooks();
       expect(hooks.length).toBeGreaterThanOrEqual(1);
       const gitleaks = hooks.find((h) => h.name === "gitleaks");
       expect(gitleaks).toBeDefined();
       expect(gitleaks!.category).toBe("security");
       expect(gitleaks!.required).toBe(true);
       expect(gitleaks!.installHint).toBeDefined();
       expect(gitleaks!.installHint!.command).toContain("gitleaks");
     });
   });

   describe("HookEntry contract completeness", () => {
     const allLanguages = getSupportedLanguages();

     it("every hook in every language has category, required, and installHint", () => {
       for (const lang of allLanguages) {
         const hooks = getHooksForLanguage(lang);
         for (const h of hooks) {
           expect(h.category, `${lang}/${h.name} missing category`).toBeDefined();
           expect(h.required, `${lang}/${h.name} missing required`).toBeDefined();
           expect(h.installHint, `${lang}/${h.name} missing installHint`).toBeDefined();
           expect(
             h.installHint!.command,
             `${lang}/${h.name} installHint.command is empty`,
           ).toBeTruthy();
         }
       }
     });

     it("every language has at least one lint or format hook", () => {
       for (const lang of allLanguages) {
         const hooks = getHooksForLanguage(lang);
         const hasLintOrFormat = hooks.some(
           (h) => h.category === "lint" || h.category === "format",
         );
         expect(hasLintOrFormat, `${lang} has no lint or format hook`).toBe(true);
       }
     });
   });
   ```

- [ ] 3. Verify test passes: `pnpm test tests/unit/hooks/hook-registry.test.ts` — expected: all tests passing including new contract completeness tests

- [ ] 4. Run full test suite to confirm no regressions: `pnpm test` — expected: all tests passing

- [ ] 5. Commit: `git add tests/unit/hooks/hook-registry.test.ts && git commit -m "test(hooks): fix rust hook order + add contract completeness assertions for all 14 languages"`

**Verification**: `pnpm test` — expected: all tests passing, 0 failing

---

## Post-implementation checklist

- [ ] `pnpm build` — 0 type errors
- [ ] `pnpm test` — all tests passing
- [ ] `node dist/cli.js hooks doctor` — runs without crashing
- [ ] Gitleaks appears in generated hook config for a TypeScript project
- [ ] A commit with `tsc` not installed shows blocking message with install hint
