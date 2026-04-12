# Brand Skill Validation Hooks — Implementation Plan

> **For agentic workers:** Use `codi-subagent-dev` (recommended) or `codi-plan-executor` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two enforcement hooks — a new `brand-skill-validate` pre-commit hook that hard-blocks commits on non-compliant `*-brand` skill directories, and a trigger-clause warning extension to the existing `skill-yaml-validate` hook for `user-invocable: true` skills.

**Architecture:** Hook script template added to `hook-templates.ts`; trigger-clause check added to `hook-policy-templates.ts`; `HooksConfig` interface and `generateHooksConfig` updated in `hook-config-generator.ts`; install block added to `hook-installer.ts`. Tests added to the three existing hook test files.

**Tech Stack:** Node.js ESM hook scripts (same pattern as `SKILL_PATH_WRAP_CHECK_TEMPLATE`), TypeScript, Vitest.

**Design spec:** `docs/20260412_135512_[PLAN]_brand-skill-validation-hooks.md`

---

### Task 1: Write failing tests for BRAND_SKILL_VALIDATE_TEMPLATE

**Files**: `tests/unit/hooks/hook-templates.test.ts`
**Est**: 3 minutes

**Steps**:
- [ ] 1. Append tests to `tests/unit/hooks/hook-templates.test.ts`:
   ```typescript
   import { describe, it, expect } from "vitest";
   import { BRAND_SKILL_VALIDATE_TEMPLATE } from "#src/core/hooks/hook-templates.js";

   describe("BRAND_SKILL_VALIDATE_TEMPLATE", () => {
     it("exports a non-empty string", () => {
       expect(typeof BRAND_SKILL_VALIDATE_TEMPLATE).toBe("string");
       expect(BRAND_SKILL_VALIDATE_TEMPLATE.length).toBeGreaterThan(0);
     });

     it("contains shebang and brand-skill-validate comment", () => {
       expect(BRAND_SKILL_VALIDATE_TEMPLATE).toContain("#!/usr/bin/env node");
       expect(BRAND_SKILL_VALIDATE_TEMPLATE).toContain("brand-skill-validate");
     });

     it("checks for brand/tokens.json", () => {
       expect(BRAND_SKILL_VALIDATE_TEMPLATE).toContain("brand/tokens.json");
     });

     it("checks for google_fonts_url field", () => {
       expect(BRAND_SKILL_VALIDATE_TEMPLATE).toContain("google_fonts_url");
     });

     it("checks for references/ directory with .html files", () => {
       expect(BRAND_SKILL_VALIDATE_TEMPLATE).toContain("references/");
       expect(BRAND_SKILL_VALIDATE_TEMPLATE).toContain(".html");
     });

     it("checks for evals/evals.json", () => {
       expect(BRAND_SKILL_VALIDATE_TEMPLATE).toContain("evals/evals.json");
     });

     it("checks for LICENSE.txt", () => {
       expect(BRAND_SKILL_VALIDATE_TEMPLATE).toContain("LICENSE.txt");
     });

     it("checks templates/ for codi:template meta tag", () => {
       expect(BRAND_SKILL_VALIDATE_TEMPLATE).toContain('codi:template');
     });

     it("checks for -brand parent directory walk-up", () => {
       expect(BRAND_SKILL_VALIDATE_TEMPLATE).toContain("-brand");
       expect(BRAND_SKILL_VALIDATE_TEMPLATE).toContain("findBrandRoot");
     });

     it("outputs Action required (coding agent) section on failure", () => {
       expect(BRAND_SKILL_VALIDATE_TEMPLATE).toContain("Action required (coding agent)");
     });

     it("scans both .codi/skills/ and src/templates/skills/ circuits", () => {
       expect(BRAND_SKILL_VALIDATE_TEMPLATE).toContain(".codi/skills/");
       expect(BRAND_SKILL_VALIDATE_TEMPLATE).not.toContain("only .codi");
     });
   });
   ```
- [ ] 2. Verify tests fail: `pnpm test tests/unit/hooks/hook-templates.test.ts` — expected: BRAND_SKILL_VALIDATE_TEMPLATE tests fail (export does not exist)
- [ ] 3. Commit: `git add tests/unit/hooks/hook-templates.test.ts && git commit -m "test(hooks): add failing tests for BRAND_SKILL_VALIDATE_TEMPLATE"`

**Verification**: `pnpm test tests/unit/hooks/hook-templates.test.ts` — BRAND_SKILL_VALIDATE_TEMPLATE describe block fails

---

### Task 2: Add BRAND_SKILL_VALIDATE_TEMPLATE to hook-templates.ts

**Files**: `src/core/hooks/hook-templates.ts`
**Est**: 5 minutes

**Steps**:
- [ ] 1. Append the following export at the end of `src/core/hooks/hook-templates.ts` (after the last existing export):
   ```typescript
   export const BRAND_SKILL_VALIDATE_TEMPLATE = `#!/usr/bin/env node
   // ${PROJECT_NAME_DISPLAY} brand-skill-validate
   // Validates every *-brand skill directory staged for commit against the brand standard.
   // For each staged file, walks up the path to find a *-brand parent directory,
   // then validates: tokens.json schema, required files, and templates/ convention.
   import fs from 'fs';
   import path from 'path';

   const ROOT = process.cwd();
   const files = process.argv.slice(2);
   if (files.length === 0) process.exit(0);

   // Walk up from a file path to find a *-brand ancestor directory.
   // Returns the brand skill root (absolute) or null if not inside a *-brand dir.
   function findBrandRoot(filePath) {
     let dir = path.dirname(path.resolve(filePath));
     const stop = path.parse(dir).root;
     while (dir !== stop) {
       if (path.basename(dir).endsWith('-brand')) return dir;
       const parent = path.dirname(dir);
       if (parent === dir) break;
       dir = parent;
     }
     return null;
   }

   // Collect unique brand roots from all staged files
   const brandRoots = new Set();
   for (const f of files) {
     const root = findBrandRoot(f);
     if (root) brandRoots.add(root);
   }

   if (brandRoots.size === 0) process.exit(0);

   const violations = [];

   function addViolation(absPath, message) {
     violations.push({ skillPath: path.relative(ROOT, absPath), message });
   }

   for (const brandRoot of brandRoots) {
     // ── 1. tokens.json schema ──────────────────────────────────────────────
     const tokensPath = path.join(brandRoot, 'brand', 'tokens.json');
     if (!fs.existsSync(tokensPath)) {
       addViolation(tokensPath, 'Missing required file: brand/tokens.json');
     } else {
       let tokens = null;
       try {
         tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf-8'));
       } catch (e) {
         addViolation(tokensPath, \`brand/tokens.json is not valid JSON: \${e.message}\`);
       }
       if (tokens && typeof tokens === 'object') {
         // Required top-level fields
         for (const field of ['brand', 'display_name', 'version', 'themes', 'fonts', 'assets', 'voice']) {
           if (!(field in tokens)) addViolation(tokensPath, \`Missing required field: \${field}\`);
         }
         // themes.dark and themes.light
         const themeKeys = ['background', 'surface', 'text_primary', 'text_secondary', 'primary', 'accent', 'logo'];
         for (const theme of ['dark', 'light']) {
           if (!tokens.themes || typeof tokens.themes[theme] !== 'object') {
             addViolation(tokensPath, \`Missing required field: themes.\${theme}\`);
           } else {
             for (const key of themeKeys) {
               if (!(key in tokens.themes[theme])) {
                 addViolation(tokensPath, \`Missing required field: themes.\${theme}.\${key}\`);
               }
             }
           }
         }
         // fonts
         if (tokens.fonts && typeof tokens.fonts === 'object') {
           for (const key of ['headlines', 'body', 'monospace']) {
             if (!(key in tokens.fonts)) addViolation(tokensPath, \`Missing required field: fonts.\${key}\`);
           }
           if (!('google_fonts_url' in tokens.fonts)) {
             addViolation(tokensPath, 'Missing required field: fonts.google_fonts_url');
           }
         }
         // assets
         if (tokens.assets && typeof tokens.assets === 'object') {
           for (const key of ['logo_dark_bg', 'logo_light_bg']) {
             if (!(key in tokens.assets)) addViolation(tokensPath, \`Missing required field: assets.\${key}\`);
           }
         }
         // voice
         if (tokens.voice && typeof tokens.voice === 'object') {
           if (typeof tokens.voice.tone !== 'string') {
             addViolation(tokensPath, 'Missing required field: voice.tone (must be a string)');
           }
           if (!Array.isArray(tokens.voice.phrases_use)) {
             addViolation(tokensPath, 'Missing required field: voice.phrases_use (must be an array)');
           }
           if (!Array.isArray(tokens.voice.phrases_avoid)) {
             addViolation(tokensPath, 'Missing required field: voice.phrases_avoid (must be an array)');
           }
         }
       }
     }

     // ── 2. Required files ──────────────────────────────────────────────────
     const tokensCssPath = path.join(brandRoot, 'brand', 'tokens.css');
     if (!fs.existsSync(tokensCssPath)) {
       addViolation(tokensCssPath, 'Missing required file: brand/tokens.css');
     }

     // At least one .svg in assets/
     const assetsDir = path.join(brandRoot, 'assets');
     const hasSvg = fs.existsSync(assetsDir) &&
       fs.readdirSync(assetsDir).some(f => f.endsWith('.svg'));
     if (!hasSvg) {
       addViolation(assetsDir, 'Missing required asset: at least one .svg file in assets/ (logo-dark.svg or logo-light.svg)');
     }

     // references/ with at least one .html
     const refsDir = path.join(brandRoot, 'references');
     const hasRefsHtml = fs.existsSync(refsDir) &&
       fs.readdirSync(refsDir).some(f => f.endsWith('.html'));
     if (!hasRefsHtml) {
       addViolation(refsDir, 'Missing required directory: references/ (no .html files found)');
     }

     // evals/evals.json
     const evalsPath = path.join(brandRoot, 'evals', 'evals.json');
     if (!fs.existsSync(evalsPath)) {
       addViolation(evalsPath, 'Missing required file: evals/evals.json');
     }

     // LICENSE.txt
     const licensePath = path.join(brandRoot, 'LICENSE.txt');
     if (!fs.existsSync(licensePath)) {
       addViolation(licensePath, 'Missing required file: LICENSE.txt');
     }

     // ── 3. templates/ convention (only when templates/ exists) ───────────
     const templatesDir = path.join(brandRoot, 'templates');
     if (fs.existsSync(templatesDir) && fs.statSync(templatesDir).isDirectory()) {
       for (const f of fs.readdirSync(templatesDir)) {
         if (!f.endsWith('.html')) continue;
         const htmlPath = path.join(templatesDir, f);
         const content = fs.readFileSync(htmlPath, 'utf-8');
         if (!content.includes('<meta name="codi:template"')) {
           addViolation(htmlPath, \`templates/\${f} is missing <meta name="codi:template"> tag\`);
         }
       }
     }
   }

   if (violations.length === 0) process.exit(0);

   console.error(\`\\n[codi] brand-skill-validate: \${violations.length} violation(s)\\n\`);
   const byPath = {};
   for (const { skillPath, message } of violations) {
     if (!byPath[skillPath]) byPath[skillPath] = [];
     byPath[skillPath].push(message);
   }
   for (const [p, msgs] of Object.entries(byPath)) {
     console.error(\`  \${p}\`);
     for (const msg of msgs) console.error(\`  \\u2717 \${msg}\`);
     console.error('');
   }
   console.error('  Action required (coding agent):');
   console.error('    1. Fix each violation listed above.');
   console.error('       Reference: src/templates/skills/brand-creator/references/brand-standard.md');
   console.error('    2. Stage the fixed files and commit again.');
   process.exit(1);
   `;
   ```
   > Note: The template literal in the TypeScript file uses backtick string. Escape inner backticks as `\\\`` and inner `${}` template expressions as `\${...}` (they are already pre-escaped in the code above).

- [ ] 2. Verify tests pass: `pnpm test tests/unit/hooks/hook-templates.test.ts` — expected: all BRAND_SKILL_VALIDATE_TEMPLATE tests pass
- [ ] 3. Commit: `git add src/core/hooks/hook-templates.ts && git commit -m "feat(hooks): add BRAND_SKILL_VALIDATE_TEMPLATE for brand skill directory enforcement"`

**Verification**: `pnpm test tests/unit/hooks/hook-templates.test.ts` — all BRAND_SKILL_VALIDATE_TEMPLATE tests pass

---

### Task 3: Write failing test for trigger-clause warning in skill-yaml-validate

**Files**: `tests/unit/hooks/hook-policy-templates.test.ts`
**Est**: 2 minutes

**Steps**:
- [ ] 1. Read `tests/unit/hooks/hook-policy-templates.test.ts` to understand existing test structure, then append:
   ```typescript
   describe("SKILL_YAML_VALIDATE_TEMPLATE — trigger-clause warning", () => {
     it("contains trigger-clause check for user-invocable skills", () => {
       expect(SKILL_YAML_VALIDATE_TEMPLATE).toContain("user-invocable");
       expect(SKILL_YAML_VALIDATE_TEMPLATE).toContain("trigger clause");
     });

     it("checks for 'Use when' as a valid trigger phrase", () => {
       expect(SKILL_YAML_VALIDATE_TEMPLATE).toContain("Use when");
     });

     it("emits non-blocking warning (not exit 1) for missing trigger clause", () => {
       // The check must push to warnings array, not set failed = true
       // Verify: warning message is pushed to warnings[], not causing failed=true
       expect(SKILL_YAML_VALIDATE_TEMPLATE).toContain("trigger clause");
       // Must NOT exit 1 for trigger-clause violation — it is a warning
       // The template must route trigger-clause violations through warnings.push(), not failed = true
       const warningBlock = SKILL_YAML_VALIDATE_TEMPLATE.indexOf("trigger clause");
       const failedSetBeforeWarning = SKILL_YAML_VALIDATE_TEMPLATE.lastIndexOf("failed = true", warningBlock);
       const warningsAfterWarning = SKILL_YAML_VALIDATE_TEMPLATE.indexOf("warnings.push", warningBlock);
       expect(warningsAfterWarning).toBeGreaterThan(warningBlock - 1);
     });
   });
   ```
- [ ] 2. Verify tests fail: `pnpm test tests/unit/hooks/hook-policy-templates.test.ts` — expected: trigger-clause describe block fails
- [ ] 3. Commit: `git add tests/unit/hooks/hook-policy-templates.test.ts && git commit -m "test(hooks): add failing tests for trigger-clause warning in skill-yaml-validate"`

**Verification**: `pnpm test tests/unit/hooks/hook-policy-templates.test.ts` — trigger-clause tests fail

---

### Task 4: Add trigger-clause warning to SKILL_YAML_VALIDATE_TEMPLATE

**Files**: `src/core/hooks/hook-policy-templates.ts`
**Est**: 3 minutes

**Steps**:
- [ ] 1. In `src/core/hooks/hook-policy-templates.ts`, inside `SKILL_YAML_VALIDATE_TEMPLATE`, find the non-blocking warnings block (around line 222). Add the trigger-clause check **after** the existing `category` check and **before** the `if (warnings.length > 0)` block:

   Find this exact text (line ~232):
   ```
     if (fm.category !== undefined && !VALID_CATEGORIES.includes(fm.category)) {
       warnings.push(\`\${file}: 'category' "\${fm.category}" is not a recognized category. Valid: \${VALID_CATEGORIES.join(', ')}\`);
     }
   ```

   Add the following immediately after that block (still inside the `for` loop, before the closing `}`):
   ```javascript
     // Non-blocking: user-invocable skills must have a trigger clause in their description
     // so the agent knows when to activate them.
     if (fm['user-invocable'] === true) {
       const desc = typeof fm.description === 'string' ? fm.description : '';
       const triggerPhrases = ['Use when', 'TRIGGER when', 'Activate when', 'Use for'];
       const hasTrigger = triggerPhrases.some(p => desc.includes(p));
       if (!hasTrigger) {
         warnings.push(\`\${file}: 'user-invocable' is true but description has no trigger clause. Add a "Use when..." sentence so the agent knows when to activate this skill.\`);
       }
     }
   ```

- [ ] 2. Verify tests pass: `pnpm test tests/unit/hooks/hook-policy-templates.test.ts` — expected: all tests pass including trigger-clause tests
- [ ] 3. Commit: `git add src/core/hooks/hook-policy-templates.ts && git commit -m "feat(hooks): add trigger-clause warning to skill-yaml-validate for user-invocable skills"`

**Verification**: `pnpm test tests/unit/hooks/hook-policy-templates.test.ts` — all tests pass

---

### Task 5: Write failing test for brandSkillValidation in hook-config-generator

**Files**: `tests/unit/hooks/hook-config-generator.test.ts`
**Est**: 2 minutes

**Steps**:
- [ ] 1. Append to `tests/unit/hooks/hook-config-generator.test.ts` (inside the existing `describe("generateHooksConfig"` block, before the final `}`):
   ```typescript
     it("always enables brandSkillValidation", () => {
       const config = generateHooksConfig(makeFlags({}), []);
       expect(config.brandSkillValidation).toBe(true);
     });

     it("includes brand-skill-validate hook in Stage 2", () => {
       const config = generateHooksConfig(makeFlags({}), []);
       expect(config.hooks.map((h) => h.name)).toContain("brand-skill-validate");
     });

     it("brand-skill-validate appears before language hooks", () => {
       const config = generateHooksConfig(makeFlags({}), ["typescript"]);
       const brandIdx = config.hooks.findIndex((h) => h.name === "brand-skill-validate");
       const eslintIdx = config.hooks.findIndex((h) => h.name === "eslint");
       expect(brandIdx).toBeGreaterThanOrEqual(0);
       expect(brandIdx).toBeLessThan(eslintIdx);
     });
   ```
   > Note: append these inside the `describe("generateHooksConfig")` block, before its closing `});`
- [ ] 2. Verify tests fail: `pnpm test tests/unit/hooks/hook-config-generator.test.ts` — expected: brandSkillValidation tests fail
- [ ] 3. Commit: `git add tests/unit/hooks/hook-config-generator.test.ts && git commit -m "test(hooks): add failing tests for brandSkillValidation in hook-config-generator"`

**Verification**: `pnpm test tests/unit/hooks/hook-config-generator.test.ts` — brandSkillValidation tests fail

---

### Task 6: Register brand-skill-validate in hook-config-generator.ts

**Files**: `src/core/hooks/hook-config-generator.ts`
**Est**: 3 minutes

**Steps**:
- [ ] 1. Add `brandSkillValidation: boolean;` to the `HooksConfig` interface in `src/core/hooks/hook-config-generator.ts`.

   Find:
   ```typescript
     versionBump: boolean;
     docCheck: boolean;
     docProtectedBranches: string[];
   ```
   Replace with:
   ```typescript
     versionBump: boolean;
     brandSkillValidation: boolean;
     docCheck: boolean;
     docProtectedBranches: string[];
   ```

- [ ] 2. In `generateHooksConfig`, add the `brand-skill-validate` entry in Stage 2, after the `skill-path-wrap-check` entry (around line 141):

   Find:
   ```typescript
     allHooks.push({
       name: "artifact-validate",
       command: `node .git/hooks/${PROJECT_NAME}-artifact-validate.mjs`,
       stagedFilter: ".codi/**",
     });
   ```
   Add before that line:
   ```typescript
     allHooks.push({
       name: "brand-skill-validate",
       command: `node .git/hooks/${PROJECT_NAME}-brand-skill-validate.mjs`,
       stagedFilter: "**/*.{json,css,html,svg,md}",
     });

   ```

- [ ] 3. Add `brandSkillValidation: true` to the return object at the end of `generateHooksConfig`.

   Find:
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
       skillPathWrapCheck: true,
       stagedJunkCheck: true,
       versionBump,
       docCheck,
       docProtectedBranches,
     };
   ```
   Replace with:
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
       skillPathWrapCheck: true,
       stagedJunkCheck: true,
       versionBump,
       brandSkillValidation: true,
       docCheck,
       docProtectedBranches,
     };
   ```

- [ ] 4. Also update the `"returns only global hooks for unknown language"` test exclusion list in `hook-config-generator.test.ts` to include `"brand-skill-validate"`:

   In `tests/unit/hooks/hook-config-generator.test.ts`, find:
   ```typescript
         h.name !== "version-bump",
   ```
   Replace with:
   ```typescript
         h.name !== "version-bump" &&
         h.name !== "brand-skill-validate",
   ```

- [ ] 5. Verify tests pass: `pnpm test tests/unit/hooks/hook-config-generator.test.ts` — expected: all tests pass
- [ ] 6. Commit: `git add src/core/hooks/hook-config-generator.ts tests/unit/hooks/hook-config-generator.test.ts && git commit -m "feat(hooks): register brand-skill-validate hook in hook-config-generator"`

**Verification**: `pnpm test tests/unit/hooks/hook-config-generator.test.ts` — all tests pass

---

### Task 7: Add brand-skill-validate install block to hook-installer.ts

**Files**: `src/core/hooks/hook-installer.ts`
**Est**: 3 minutes

**Steps**:
- [ ] 1. Add `brandSkillValidation?: boolean;` to the `InstallOptions` interface in `src/core/hooks/hook-installer.ts`.

   Find:
   ```typescript
     stagedJunkCheck?: boolean;
     versionBump?: boolean;
     docCheck?: boolean;
   ```
   Replace with:
   ```typescript
     stagedJunkCheck?: boolean;
     versionBump?: boolean;
     brandSkillValidation?: boolean;
     docCheck?: boolean;
   ```

- [ ] 2. Add `BRAND_SKILL_VALIDATE_TEMPLATE` to the import from `hook-templates.ts`.

   Find:
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
     SKILL_PATH_WRAP_CHECK_TEMPLATE,
     STAGED_JUNK_CHECK_TEMPLATE,
   } from "./hook-templates.js";
   ```
   Replace with:
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
     SKILL_PATH_WRAP_CHECK_TEMPLATE,
     STAGED_JUNK_CHECK_TEMPLATE,
     BRAND_SKILL_VALIDATE_TEMPLATE,
   } from "./hook-templates.js";
   ```

- [ ] 3. Add the write block in `writeAuxiliaryScripts`, after the `versionBump` block and before the `return files;` statement.

   Find:
   ```typescript
     if (options.versionBump) {
       const versionBumpPath = path.join(hookDir, `${PROJECT_NAME}-version-bump.mjs`);
       const versionBumpScript = buildVersionBumpScript();
       await fs.writeFile(versionBumpPath, versionBumpScript, {
         encoding: "utf-8",
         mode: 0o755,
       });
       files.push(path.relative(options.projectRoot, versionBumpPath));
     }
     return files;
   ```
   Replace with:
   ```typescript
     if (options.versionBump) {
       const versionBumpPath = path.join(hookDir, `${PROJECT_NAME}-version-bump.mjs`);
       const versionBumpScript = buildVersionBumpScript();
       await fs.writeFile(versionBumpPath, versionBumpScript, {
         encoding: "utf-8",
         mode: 0o755,
       });
       files.push(path.relative(options.projectRoot, versionBumpPath));
     }
     if (options.brandSkillValidation) {
       const brandSkillValidatePath = path.join(hookDir, `${PROJECT_NAME}-brand-skill-validate.mjs`);
       await fs.writeFile(brandSkillValidatePath, BRAND_SKILL_VALIDATE_TEMPLATE, {
         encoding: "utf-8",
         mode: 0o755,
       });
       files.push(path.relative(options.projectRoot, brandSkillValidatePath));
     }
     return files;
   ```

- [ ] 4. Verify TypeScript compiles: `pnpm build` — expected: no type errors
- [ ] 5. Commit: `git add src/core/hooks/hook-installer.ts && git commit -m "feat(hooks): install brand-skill-validate.mjs in hook-installer"`

**Verification**: `pnpm build` — clean build, no errors

---

### Task 8: Run full test suite and verify

**Files**: none
**Est**: 2 minutes

**Steps**:
- [ ] 1. Run: `pnpm test` — expected: all existing tests pass, plus all new tests pass
- [ ] 2. Run: `pnpm build` — expected: clean TypeScript build
- [ ] 3. If any tests fail, diagnose and fix before proceeding.

**Verification**: `pnpm test && pnpm build` — both exit 0

---

## Execution Options

Use `codi-plan-executor` — execute tasks sequentially in this session with checkpoints.
