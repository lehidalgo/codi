# Staged Junk File Check Implementation Plan

> **For agentic workers:** Use `codi-subagent-dev` (recommended) or `codi-plan-executor` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `codi-staged-junk-check.mjs` pre-commit hook that detects OS/tool junk files staged for commit (`.DS_Store`, `__pycache__`, `*.pyc`, etc.), unstages them with `git rm --cached`, and blocks the commit with an explicit error.

**Architecture:** New hook template constant in `hook-templates.ts` → registered in `hook-config-generator.ts` as an always-on global hook → wired into `hook-installer.ts` via a new `stagedJunkCheck` option → installed to `.git/hooks/codi-staged-junk-check.mjs`. The hook receives staged file paths as CLI args, matches against a junk pattern list, runs `git rm --cached` on each match, and exits 1 if any were found.

**Tech Stack:** Node.js ESM script (same pattern as all other codi hooks), TypeScript source constants, Vitest unit tests.

---

## File Structure

| File | Change |
|------|--------|
| `src/core/hooks/hook-templates.ts` | Add `STAGED_JUNK_CHECK_TEMPLATE` export |
| `src/core/hooks/hook-installer.ts` | Add `stagedJunkCheck` option, write script in `writeAuxiliaryScripts` |
| `src/core/hooks/hook-config-generator.ts` | Add `stagedJunkCheck: boolean` to `HooksConfig`, set always `true`, add hook entry |
| `src/cli/init.ts` | Pass `stagedJunkCheck` from config to `installHooks` |
| `src/cli/generate.ts` | Same pass-through as `init.ts` |
| `tests/unit/hooks/staged-junk-check.test.ts` | Unit tests for the template and real-codebase execution |

---

## Tasks

### Task 1: Write failing unit tests for the template

- [ ] **Files**: `tests/unit/hooks/staged-junk-check.test.ts`
- [ ] **Est**: 3 min

**Steps**:

1. Create `tests/unit/hooks/staged-junk-check.test.ts`:
   ```typescript
   import { describe, it, expect, beforeEach, afterEach } from "vitest";
   import { execFileSync } from "node:child_process";
   import fs from "node:fs/promises";
   import path from "node:path";
   import os from "node:os";
   import { cleanupTmpDir } from "../../helpers/fs.js";
   import { STAGED_JUNK_CHECK_TEMPLATE } from "#src/core/hooks/hook-templates.js";

   let tmpDir: string;
   let scriptPath: string;

   beforeEach(async () => {
     tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "codi-junk-check-"));
     scriptPath = path.join(tmpDir, "staged-junk-check.mjs");
     await fs.writeFile(scriptPath, STAGED_JUNK_CHECK_TEMPLATE, { mode: 0o755 });
   });

   afterEach(async () => {
     await cleanupTmpDir(tmpDir);
   });

   function runScript(files: string[]): { ok: boolean; stderr: string; stdout: string } {
     try {
       const stdout = execFileSync("node", [scriptPath, ...files], {
         encoding: "utf-8",
         stdio: ["pipe", "pipe", "pipe"],
       });
       return { ok: true, stderr: "", stdout };
     } catch (e) {
       const err = e as { stderr?: string; stdout?: string; status?: number };
       return { ok: false, stderr: err.stderr ?? "", stdout: err.stdout ?? "" };
     }
   }

   describe("STAGED_JUNK_CHECK_TEMPLATE", () => {
     it("is a non-empty string", () => {
       expect(typeof STAGED_JUNK_CHECK_TEMPLATE).toBe("string");
       expect(STAGED_JUNK_CHECK_TEMPLATE.length).toBeGreaterThan(0);
     });

     it("contains all expected junk patterns", () => {
       expect(STAGED_JUNK_CHECK_TEMPLATE).toContain(".DS_Store");
       expect(STAGED_JUNK_CHECK_TEMPLATE).toContain("Thumbs.db");
       expect(STAGED_JUNK_CHECK_TEMPLATE).toContain("__pycache__");
       expect(STAGED_JUNK_CHECK_TEMPLATE).toContain(".pyc");
       expect(STAGED_JUNK_CHECK_TEMPLATE).toContain(".pyo");
       expect(STAGED_JUNK_CHECK_TEMPLATE).toContain(".pytest_cache");
       expect(STAGED_JUNK_CHECK_TEMPLATE).toContain("desktop.ini");
     });

     it("passes with no files", () => {
       const result = runScript([]);
       expect(result.ok).toBe(true);
     });

     it("passes with clean file paths", () => {
       const result = runScript(["src/index.ts", "README.md", "package.json"]);
       expect(result.ok).toBe(true);
     });

     it("fails when a .DS_Store path is passed", () => {
       const result = runScript(["src/templates/skills/rl3-brand/.DS_Store"]);
       expect(result.ok).toBe(false);
       expect(result.stderr).toContain(".DS_Store");
     });

     it("fails when a __pycache__ path is passed", () => {
       const result = runScript(["src/__pycache__/module.cpython-311.pyc"]);
       expect(result.ok).toBe(false);
       expect(result.stderr).toContain("__pycache__");
     });

     it("fails when a .pyc file is passed", () => {
       const result = runScript(["app/utils.pyc"]);
       expect(result.ok).toBe(false);
       expect(result.stderr).toContain(".pyc");
     });

     it("fails when Thumbs.db is passed", () => {
       const result = runScript(["assets/Thumbs.db"]);
       expect(result.ok).toBe(false);
       expect(result.stderr).toContain("Thumbs.db");
     });

     it("fails when desktop.ini is passed", () => {
       const result = runScript(["assets/desktop.ini"]);
       expect(result.ok).toBe(false);
       expect(result.stderr).toContain("desktop.ini");
     });

     it("lists all junk files in error output", () => {
       const result = runScript(["a/.DS_Store", "b/Thumbs.db", "src/main.ts"]);
       expect(result.ok).toBe(false);
       expect(result.stderr).toContain(".DS_Store");
       expect(result.stderr).toContain("Thumbs.db");
     });

     it("mentions git rm --cached in error output", () => {
       const result = runScript(["src/.DS_Store"]);
       expect(result.ok).toBe(false);
       expect(result.stderr).toContain("git rm --cached");
     });
   });
   ```

2. Verify test fails (template not yet exported):
   ```
   npx vitest run tests/unit/hooks/staged-junk-check.test.ts
   ```
   Expected: import error for `STAGED_JUNK_CHECK_TEMPLATE`.

3. Commit:
   ```
   git add tests/unit/hooks/staged-junk-check.test.ts
   git commit -m "test(hooks): add failing tests for staged-junk-check hook"
   ```

---

### Task 2: Add `STAGED_JUNK_CHECK_TEMPLATE` to hook-templates.ts

- [ ] **Files**: `src/core/hooks/hook-templates.ts`
- [ ] **Est**: 5 min

**Steps**:

1. Open `src/core/hooks/hook-templates.ts` and append before the closing of the file (after `ARTIFACT_VALIDATE_TEMPLATE`):
   ```typescript
   export const STAGED_JUNK_CHECK_TEMPLATE = `#!/usr/bin/env node
   // ${PROJECT_NAME_DISPLAY} staged junk file checker
   // Detects OS/tool junk files staged for commit and unstages them.
   // Junk files are never intentional commits — they pollute history and break wiring checks.
   import { execFileSync } from 'child_process';

   const JUNK_PATTERNS = [
     /(\\/|^)\\.DS_Store$/,
     /(\\/|^)Thumbs\\.db$/i,
     /(\\/|^)desktop\\.ini$/i,
     /(\\/|^)__pycache__(\\/|$)/,
     /\\.pyc$/,
     /\\.pyo$/,
     /(\\/|^)\\.pytest_cache(\\/|$)/,
     /(\\/|^)\\.mypy_cache(\\/|$)/,
     /\\.class$/,
   ];

   const files = process.argv.slice(2);
   const junk = files.filter(f => JUNK_PATTERNS.some(p => p.test(f)));

   if (junk.length === 0) process.exit(0);

   console.error('[${PROJECT_NAME_DISPLAY}] Junk files detected in staged changes:');
   for (const f of junk) {
     console.error('  ' + f);
   }
   console.error('');
   console.error('These files were NOT committed. Run:');
   console.error('  git rm --cached ' + junk.join(' '));
   console.error('And add them to .gitignore if needed.');
   process.exit(1);
   \`;
   ```

   > Note: The template uses `${PROJECT_NAME_DISPLAY}` at the top of the file (already imported via the `PROJECT_NAME_DISPLAY` constant from `#src/constants.js`).

2. Verify tests pass:
   ```
   npx vitest run tests/unit/hooks/staged-junk-check.test.ts
   ```
   Expected: all tests green.

3. Commit:
   ```
   git add src/core/hooks/hook-templates.ts
   git commit -m "feat(hooks): add STAGED_JUNK_CHECK_TEMPLATE"
   ```

---

### Task 3: Wire the hook into the installer

- [ ] **Files**: `src/core/hooks/hook-installer.ts`
- [ ] **Est**: 3 min

**Steps**:

1. Add `STAGED_JUNK_CHECK_TEMPLATE` to the import from `"./hook-templates.js"` (line ~18):
   ```typescript
   import {
     RUNNER_TEMPLATE,
     SECRET_SCAN_TEMPLATE,
     FILE_SIZE_CHECK_TEMPLATE,
     VERSION_CHECK_TEMPLATE,
     TEMPLATE_WIRING_CHECK_TEMPLATE,
     DOC_NAMING_CHECK_TEMPLATE,
     ARTIFACT_VALIDATE_TEMPLATE,
     SKILL_RESOURCE_CHECK_TEMPLATE,
     STAGED_JUNK_CHECK_TEMPLATE,
   } from "./hook-templates.js";
   ```

2. Add `stagedJunkCheck?: boolean` to the `InstallOptions` interface (after `skillResourceCheck`):
   ```typescript
   stagedJunkCheck?: boolean;
   ```

3. Add the write block inside `writeAuxiliaryScripts`, after the `skillResourceCheck` block (around line 161):
   ```typescript
   if (options.stagedJunkCheck) {
     const junkCheckPath = path.join(hookDir, `${PROJECT_NAME}-staged-junk-check.mjs`);
     await fs.writeFile(junkCheckPath, STAGED_JUNK_CHECK_TEMPLATE, {
       encoding: "utf-8",
       mode: 0o755,
     });
     files.push(path.relative(options.projectRoot, junkCheckPath));
   }
   ```

4. Add `buildStagedJunkCheckScript` export at the bottom of the file (after `buildVersionBumpScript`):
   ```typescript
   export function buildStagedJunkCheckScript(): string {
     return STAGED_JUNK_CHECK_TEMPLATE;
   }
   ```
   And add it to the `export { ... }` block at the bottom:
   ```typescript
   export {
     buildRunnerScript,
     buildSecretScanScript,
     buildFileSizeScript,
     buildTemplateWiringScript,
     buildVersionBumpScript,
     buildStagedJunkCheckScript,
     stripGeneratedSection,
     globToGrepPattern,
     buildHuskyCommands,
   };
   ```

5. Verify TypeScript compiles:
   ```
   npx tsc --noEmit
   ```
   Expected: no errors.

6. Commit:
   ```
   git add src/core/hooks/hook-installer.ts
   git commit -m "feat(hooks): wire staged-junk-check into hook installer"
   ```

---

### Task 4: Register the hook in the config generator

- [ ] **Files**: `src/core/hooks/hook-config-generator.ts`
- [ ] **Est**: 3 min

**Steps**:

1. Add `stagedJunkCheck: boolean` to the `HooksConfig` interface (after `skillResourceCheck`):
   ```typescript
   export interface HooksConfig {
     hooks: HookEntry[];
     secretScan: boolean;
     fileSizeCheck: boolean;
     versionCheck: boolean;
     commitMsgValidation: boolean;
     testBeforeCommit: boolean;
     templateWiringCheck: boolean;
     docNamingCheck: boolean;
     artifactValidation: boolean;
     importDepthCheck: boolean;
     skillYamlValidation: boolean;
     skillResourceCheck: boolean;
     stagedJunkCheck: boolean;
     versionBump: boolean;
     docCheck: boolean;
     docProtectedBranches: string[];
   }
   ```

2. Add the hook entry inside `generateHooksConfig`, after the `skill-resource-check` push (around line 154):
   ```typescript
   allHooks.push({
     name: "staged-junk-check",
     command: `node .git/hooks/${PROJECT_NAME}-staged-junk-check.mjs`,
     stagedFilter: "**",
   });
   ```

3. Add `stagedJunkCheck: true` to the returned config object (after `skillResourceCheck: true`):
   ```typescript
   return {
     hooks: allHooks,
     secretScan,
     fileSizeCheck: true,
     versionCheck: hasVersionRequirement,
     commitMsgValidation: true,
     testBeforeCommit,
     templateWiringCheck,
     docNamingCheck,
     artifactValidation: true,
     importDepthCheck: true,
     skillYamlValidation: true,
     skillResourceCheck: true,
     stagedJunkCheck: true,
     versionBump,
     docCheck,
     docProtectedBranches,
   };
   ```

4. Verify TypeScript compiles:
   ```
   npx tsc --noEmit
   ```
   Expected: no errors.

5. Commit:
   ```
   git add src/core/hooks/hook-config-generator.ts
   git commit -m "feat(hooks): register staged-junk-check in config generator"
   ```

---

### Task 5: Pass the flag through `init.ts` and `generate.ts`

- [ ] **Files**: `src/cli/init.ts`, `src/cli/generate.ts`
- [ ] **Est**: 2 min

**Steps**:

1. In `src/cli/init.ts`, add `stagedJunkCheck: hooksConfig.stagedJunkCheck,` to the `installHooks` call (after `skillResourceCheck`):
   ```typescript
   const hookResult = await installHooks({
     projectRoot,
     runner: hookSetup.runner,
     hooks: hooksConfig.hooks,
     flags: resolvedFlags,
     commitMsgValidation: hooksConfig.commitMsgValidation,
     secretScan: hooksConfig.secretScan,
     fileSizeCheck: hooksConfig.fileSizeCheck,
     versionCheck: hooksConfig.versionCheck,
     templateWiringCheck: hooksConfig.templateWiringCheck,
     docNamingCheck: hooksConfig.docNamingCheck,
     versionBump: hooksConfig.versionBump,
     artifactValidation: hooksConfig.artifactValidation,
     importDepthCheck: hooksConfig.importDepthCheck,
     skillYamlValidation: hooksConfig.skillYamlValidation,
     skillResourceCheck: hooksConfig.skillResourceCheck,
     stagedJunkCheck: hooksConfig.stagedJunkCheck,
     docCheck: hooksConfig.docCheck,
     docProtectedBranches: hooksConfig.docProtectedBranches,
   });
   ```

2. Apply the same change in `src/cli/generate.ts` (same pattern, same location).

3. Verify TypeScript compiles:
   ```
   npx tsc --noEmit
   ```

4. Commit:
   ```
   git add src/cli/init.ts src/cli/generate.ts
   git commit -m "feat(hooks): pass stagedJunkCheck flag through init and generate"
   ```

---

### Task 6: Install the hook locally and verify end-to-end

- [ ] **Files**: `.git/hooks/codi-staged-junk-check.mjs` (generated)
- [ ] **Est**: 2 min

**Steps**:

1. Build and reinstall hooks:
   ```
   npm run build && node dist/cli.js install
   ```

2. Verify the hook file was created:
   ```
   ls -la .git/hooks/codi-staged-junk-check.mjs
   ```

3. Test the hook manually with a fake junk path:
   ```
   node .git/hooks/codi-staged-junk-check.mjs src/.DS_Store
   ```
   Expected: exits 1, stderr contains `.DS_Store` and `git rm --cached`.

4. Test the hook passes with clean paths:
   ```
   node .git/hooks/codi-staged-junk-check.mjs src/index.ts README.md
   ```
   Expected: exits 0, no output.

5. Run the full test suite:
   ```
   npx vitest run
   ```
   Expected: all tests passing.

6. Commit all remaining changes (merge resolution + empty dir removal + new hook):
   ```
   git add -A
   git commit -m "chore: merge main into develop, fix rl3-brand empty dir wiring error"
   ```

---

## Verification

```
npx vitest run tests/unit/hooks/staged-junk-check.test.ts
npx tsc --noEmit
node .git/hooks/codi-staged-junk-check.mjs src/.DS_Store   # must exit 1
node .git/hooks/codi-staged-junk-check.mjs src/index.ts   # must exit 0
```
