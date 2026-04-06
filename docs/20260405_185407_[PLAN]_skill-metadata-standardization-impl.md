# Skill Metadata Standardization Implementation Plan

> **For agentic workers:** Use `codi-subagent-dev` (recommended) or `codi-plan-executor` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all hardcoded `category` strings in skill templates with a `SKILL_CATEGORY` constant object, and replace inline `${PROJECT_NAME_DISPLAY} Platform` category expressions with `${PLATFORM_CATEGORY}`, so all metadata fields derive from a single source of truth in `constants.ts`.

**Architecture:** Add a `SKILL_CATEGORY` object to `src/constants.ts` typed with `satisfies Record<string, SkillCategory>` to guarantee compile-time safety. Update every skill template to import and use the appropriate key. Templates using `${PROJECT_NAME_DISPLAY} Platform` switch to `${PLATFORM_CATEGORY}` and drop the now-unused `PROJECT_NAME_DISPLAY` import where applicable.

**Tech Stack:** TypeScript, Vitest, pnpm

---

## File Structure

| File | Change |
|------|--------|
| `src/constants.ts` | Add `SKILL_CATEGORY` object export (~15 lines) |
| `tests/unit/schemas.test.ts` | Add one test asserting `SKILL_CATEGORY` covers all `SKILL_CATEGORIES` values |
| 56 skill templates with hardcoded category | Replace string literal with `${SKILL_CATEGORY.X}`, add import |
| 11 skill templates using `${PROJECT_NAME_DISPLAY} Platform` | Replace with `${PLATFORM_CATEGORY}`, add/swap import |

**Templates using `${PROJECT_NAME_DISPLAY} Platform` (→ `${PLATFORM_CATEGORY}`):**
`agent-creator`, `artifact-contributor`, `compare-preset`, `dev-docs-manager`, `dev-operations`, `preset-creator`, `refine-rules`, `rule-creator`, `rule-feedback`, `skill-creator`, `skill-feedback-reporter`

**Category → constant key mapping:**
| String | Key |
|--------|-----|
| `Brand Identity` | `SKILL_CATEGORY.BRAND_IDENTITY` |
| `Code Quality` | `SKILL_CATEGORY.CODE_QUALITY` |
| `Content Creation` | `SKILL_CATEGORY.CONTENT_CREATION` |
| `Content Refinement` | `SKILL_CATEGORY.CONTENT_REFINEMENT` |
| `Creative and Design` | `SKILL_CATEGORY.CREATIVE_AND_DESIGN` |
| `Developer Tools` | `SKILL_CATEGORY.DEVELOPER_TOOLS` |
| `Developer Workflow` | `SKILL_CATEGORY.DEVELOPER_WORKFLOW` |
| `Document Generation` | `SKILL_CATEGORY.DOCUMENT_GENERATION` |
| `File Format Tools` | `SKILL_CATEGORY.FILE_FORMAT_TOOLS` |
| `Planning` | `SKILL_CATEGORY.PLANNING` |
| `Productivity` | `SKILL_CATEGORY.PRODUCTIVITY` |
| `Testing` | `SKILL_CATEGORY.TESTING` |
| `Workflow` | `SKILL_CATEGORY.WORKFLOW` |

---

### Task 1: Add `SKILL_CATEGORY` constant and test coverage

- [ ] **Files**: `src/constants.ts`, `tests/unit/schemas.test.ts`
- [ ] **Est**: 3 minutes

**Steps**:

1. Write failing test in `tests/unit/schemas.test.ts`. Locate the `describe("category field — SkillFrontmatterSchema"` block and append after it:
   ```typescript
   describe("SKILL_CATEGORY constant", () => {
     it("covers every value in SKILL_CATEGORIES", () => {
       const values = Object.values(SKILL_CATEGORY);
       for (const cat of SKILL_CATEGORIES) {
         expect(values).toContain(cat);
       }
     });

     it("has no extra values outside SKILL_CATEGORIES", () => {
       for (const val of Object.values(SKILL_CATEGORY)) {
         expect(isKnownSkillCategory(val)).toBe(true);
       }
     });
   });
   ```
   Add `SKILL_CATEGORIES` and `SKILL_CATEGORY` to the import from `#src/constants.js`:
   ```typescript
   import {
     PROJECT_NAME,
     ALL_SKILL_CATEGORIES,
     SKILL_CATEGORIES,
     SKILL_CATEGORY,
     isKnownSkillCategory,
   } from "#src/constants.js";
   ```

2. Verify test fails: `pnpm test tests/unit/schemas.test.ts` — expected: `SKILL_CATEGORY` is not exported, test fails.

3. Add `SKILL_CATEGORY` to `src/constants.ts`. Insert after the `SKILL_CATEGORIES` block (after `export type SkillCategory = (typeof SKILL_CATEGORIES)[number];`). Note: `SkillCategory` is already defined in this file — no new import needed:
   ```typescript
   /**
    * Named constants for each skill category — use in template interpolation instead of
    * hardcoding strings. Typed with `satisfies` to guarantee every key is a valid SkillCategory.
    */
   export const SKILL_CATEGORY = {
     BRAND_IDENTITY: "Brand Identity",
     CODE_QUALITY: "Code Quality",
     CONTENT_CREATION: "Content Creation",
     CONTENT_REFINEMENT: "Content Refinement",
     CREATIVE_AND_DESIGN: "Creative and Design",
     DEVELOPER_TOOLS: "Developer Tools",
     DEVELOPER_WORKFLOW: "Developer Workflow",
     DOCUMENT_GENERATION: "Document Generation",
     FILE_FORMAT_TOOLS: "File Format Tools",
     PLANNING: "Planning",
     PRODUCTIVITY: "Productivity",
     TESTING: "Testing",
     WORKFLOW: "Workflow",
   } as const satisfies Record<string, SkillCategory>;
   ```

4. Verify tests pass: `pnpm test tests/unit/schemas.test.ts` — expected: all passing.

5. Commit: `git add src/constants.ts tests/unit/schemas.test.ts && git commit -m "feat(constants): add SKILL_CATEGORY named constants for template interpolation"`

**Verification**: `pnpm test:unit` — expected: all passing.

---

### Task 2: Update Platform category templates (11 templates)

- [ ] **Files**:
  - `src/templates/skills/agent-creator/template.ts`
  - `src/templates/skills/artifact-contributor/template.ts`
  - `src/templates/skills/compare-preset/template.ts`
  - `src/templates/skills/dev-docs-manager/template.ts`
  - `src/templates/skills/dev-operations/template.ts`
  - `src/templates/skills/preset-creator/template.ts`
  - `src/templates/skills/refine-rules/template.ts`
  - `src/templates/skills/rule-creator/template.ts`
  - `src/templates/skills/rule-feedback/template.ts`
  - `src/templates/skills/skill-creator/template.ts`
  - `src/templates/skills/skill-feedback-reporter/template.ts`
- [ ] **Est**: 5 minutes

**Steps**:

1. In each of the 11 files:
   - Add `PLATFORM_CATEGORY` to the import from `#src/constants.js`
   - Replace `` category: ${PROJECT_NAME_DISPLAY} Platform `` with `` category: ${PLATFORM_CATEGORY} ``
   - Remove `PROJECT_NAME_DISPLAY` from the import **only if it is no longer used elsewhere** in that file

   Example diff for `agent-creator/template.ts`:
   ```typescript
   // BEFORE import:
   import {
     MAX_NAME_LENGTH,
     MAX_DESCRIPTION_LENGTH,
     MAX_ARTIFACT_CHARS,
     PROJECT_CLI,
     PROJECT_DIR,
     PROJECT_NAME,
     PROJECT_NAME_DISPLAY,
     SUPPORTED_PLATFORMS_YAML,
   } from "#src/constants.js";

   // AFTER import (PROJECT_NAME_DISPLAY still used in body — keep it):
   import {
     MAX_NAME_LENGTH,
     MAX_DESCRIPTION_LENGTH,
     MAX_ARTIFACT_CHARS,
     PROJECT_CLI,
     PROJECT_DIR,
     PROJECT_NAME,
     PROJECT_NAME_DISPLAY,
     PLATFORM_CATEGORY,
     SUPPORTED_PLATFORMS_YAML,
   } from "#src/constants.js";
   ```
   ```
   // BEFORE in template string:
   category: ${PROJECT_NAME_DISPLAY} Platform

   // AFTER:
   category: ${PLATFORM_CATEGORY}
   ```

2. Verify: `pnpm build && pnpm test:unit` — expected: all passing, no TypeScript errors.

3. Commit: `git add src/templates/skills/agent-creator/template.ts src/templates/skills/artifact-contributor/template.ts src/templates/skills/compare-preset/template.ts src/templates/skills/dev-docs-manager/template.ts src/templates/skills/dev-operations/template.ts src/templates/skills/preset-creator/template.ts src/templates/skills/refine-rules/template.ts src/templates/skills/rule-creator/template.ts src/templates/skills/rule-feedback/template.ts src/templates/skills/skill-creator/template.ts src/templates/skills/skill-feedback-reporter/template.ts && git commit -m "refactor(templates): replace inline platform category expression with PLATFORM_CATEGORY constant"`

**Verification**: `pnpm test:unit` — expected: all passing.

---

### Task 3: Update Brand Identity + Content templates (6 templates)

- [ ] **Files**:
  - `src/templates/skills/bbva-brand/template.ts` — `Brand Identity`
  - `src/templates/skills/brand-identity/template.ts` — `Brand Identity`
  - `src/templates/skills/codi-brand/template.ts` — `Brand Identity`
  - `src/templates/skills/rl3-brand/template.ts` — `Brand Identity`
  - `src/templates/skills/content-factory/template.ts` — `Content Creation`
  - `src/templates/skills/humanizer/template.ts` — `Content Refinement`
- [ ] **Est**: 4 minutes

**Steps**:

1. For each file, add `SKILL_CATEGORY` to the import and replace the hardcoded category string:

   `bbva-brand/template.ts`:
   ```typescript
   import { PROJECT_NAME, SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";
   // In template string:
   category: ${SKILL_CATEGORY.BRAND_IDENTITY}
   ```

   `brand-identity/template.ts`:
   ```typescript
   import { PROJECT_NAME, SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";
   category: ${SKILL_CATEGORY.BRAND_IDENTITY}
   ```

   `codi-brand/template.ts`:
   ```typescript
   import { PROJECT_NAME, SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";
   category: ${SKILL_CATEGORY.BRAND_IDENTITY}
   ```

   `rl3-brand/template.ts`:
   ```typescript
   import { PROJECT_NAME, SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";
   category: ${SKILL_CATEGORY.BRAND_IDENTITY}
   ```

   `content-factory/template.ts`:
   ```typescript
   import { PROJECT_NAME, SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";
   category: ${SKILL_CATEGORY.CONTENT_CREATION}
   ```

   `humanizer/template.ts`:
   ```typescript
   import { PROJECT_NAME, SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";
   category: ${SKILL_CATEGORY.CONTENT_REFINEMENT}
   ```

2. Verify: `pnpm test:unit` — expected: "every built-in skill template has a known category" test still passing.

3. Commit: `git add src/templates/skills/bbva-brand/template.ts src/templates/skills/brand-identity/template.ts src/templates/skills/codi-brand/template.ts src/templates/skills/rl3-brand/template.ts src/templates/skills/content-factory/template.ts src/templates/skills/humanizer/template.ts && git commit -m "refactor(templates): use SKILL_CATEGORY constant in brand and content templates"`

**Verification**: `pnpm test:unit` — expected: all passing.

---

### Task 4: Update Code Quality + Testing templates (10 templates)

- [ ] **Files**:
  - `src/templates/skills/code-review/template.ts` — `Code Quality`
  - `src/templates/skills/dev-e2e-testing/template.ts` — `Code Quality`
  - `src/templates/skills/guided-qa-testing/template.ts` — `Code Quality`
  - `src/templates/skills/project-quality-guard/template.ts` — `Code Quality`
  - `src/templates/skills/refactoring/template.ts` — `Code Quality`
  - `src/templates/skills/security-scan/template.ts` — `Code Quality`
  - `src/templates/skills/session-recovery/template.ts` — `Code Quality`
  - `src/templates/skills/test-coverage/template.ts` — `Code Quality`
  - `src/templates/skills/webapp-testing/template.ts` — `Code Quality`
  - `src/templates/skills/test-run/template.ts` — `Testing`
- [ ] **Est**: 5 minutes

**Steps**:

1. For each file, add `SKILL_CATEGORY` to the import and replace the hardcoded category string.

   Files using `Code Quality`:
   ```typescript
   // add SKILL_CATEGORY to existing import from "#src/constants.js"
   category: ${SKILL_CATEGORY.CODE_QUALITY}
   ```

   `test-run/template.ts` (uses `Testing`):
   ```typescript
   // add SKILL_CATEGORY to existing import from "#src/constants.js"
   category: ${SKILL_CATEGORY.TESTING}
   ```

2. Verify: `pnpm test:unit` — expected: all passing.

3. Commit: `git add src/templates/skills/code-review/template.ts src/templates/skills/dev-e2e-testing/template.ts src/templates/skills/guided-qa-testing/template.ts src/templates/skills/project-quality-guard/template.ts src/templates/skills/refactoring/template.ts src/templates/skills/security-scan/template.ts src/templates/skills/session-recovery/template.ts src/templates/skills/test-coverage/template.ts src/templates/skills/webapp-testing/template.ts src/templates/skills/test-run/template.ts && git commit -m "refactor(templates): use SKILL_CATEGORY constant in code quality and testing templates"`

**Verification**: `pnpm test:unit` — expected: all passing.

---

### Task 5: Update Creative and Design templates (6 templates)

- [ ] **Files**:
  - `src/templates/skills/algorithmic-art/template.ts` — `Creative and Design`
  - `src/templates/skills/canvas-design/template.ts` — `Creative and Design`
  - `src/templates/skills/claude-artifacts-builder/template.ts` — `Creative and Design`
  - `src/templates/skills/frontend-design/template.ts` — `Creative and Design`
  - `src/templates/skills/slack-gif-creator/template.ts` — `Creative and Design`
  - `src/templates/skills/theme-factory/template.ts` — `Creative and Design`
- [ ] **Est**: 3 minutes

**Steps**:

1. For each file, add `SKILL_CATEGORY` to the import and replace:
   ```typescript
   // add SKILL_CATEGORY to existing import from "#src/constants.js"
   category: ${SKILL_CATEGORY.CREATIVE_AND_DESIGN}
   ```

2. Verify: `pnpm test:unit` — expected: all passing.

3. Commit: `git add src/templates/skills/algorithmic-art/template.ts src/templates/skills/canvas-design/template.ts src/templates/skills/claude-artifacts-builder/template.ts src/templates/skills/frontend-design/template.ts src/templates/skills/slack-gif-creator/template.ts src/templates/skills/theme-factory/template.ts && git commit -m "refactor(templates): use SKILL_CATEGORY constant in creative and design templates"`

**Verification**: `pnpm test:unit` — expected: all passing.

---

### Task 6: Update Developer Tools templates (10 templates)

- [ ] **Files**:
  - `src/templates/skills/claude-api/template.ts`
  - `src/templates/skills/codebase-explore/template.ts`
  - `src/templates/skills/codebase-onboarding/template.ts`
  - `src/templates/skills/commit/template.ts`
  - `src/templates/skills/diagnostics/template.ts`
  - `src/templates/skills/graph-sync/template.ts`
  - `src/templates/skills/internal-comms/template.ts`
  - `src/templates/skills/mcp-ops/template.ts`
  - `src/templates/skills/mobile-development/template.ts`
  - `src/templates/skills/project-documentation/template.ts`
- [ ] **Est**: 4 minutes

**Steps**:

1. For each file, add `SKILL_CATEGORY` to the import and replace:
   ```typescript
   // add SKILL_CATEGORY to existing import from "#src/constants.js"
   category: ${SKILL_CATEGORY.DEVELOPER_TOOLS}
   ```

2. Verify: `pnpm test:unit` — expected: all passing.

3. Commit: `git add src/templates/skills/claude-api/template.ts src/templates/skills/codebase-explore/template.ts src/templates/skills/codebase-onboarding/template.ts src/templates/skills/commit/template.ts src/templates/skills/diagnostics/template.ts src/templates/skills/graph-sync/template.ts src/templates/skills/internal-comms/template.ts src/templates/skills/mcp-ops/template.ts src/templates/skills/mobile-development/template.ts src/templates/skills/project-documentation/template.ts && git commit -m "refactor(templates): use SKILL_CATEGORY constant in developer tools templates"`

**Verification**: `pnpm test:unit` — expected: all passing.

---

### Task 7: Update Developer Workflow templates (13 templates)

- [ ] **Files**:
  - `src/templates/skills/audit-fix/template.ts`
  - `src/templates/skills/brainstorming/template.ts`
  - `src/templates/skills/branch-finish/template.ts`
  - `src/templates/skills/debugging/template.ts`
  - `src/templates/skills/evidence-gathering/template.ts`
  - `src/templates/skills/guided-execution/template.ts`
  - `src/templates/skills/plan-executor/template.ts`
  - `src/templates/skills/plan-writer/template.ts`
  - `src/templates/skills/step-documenter/template.ts`
  - `src/templates/skills/subagent-dev/template.ts`
  - `src/templates/skills/tdd/template.ts`
  - `src/templates/skills/verification/template.ts`
  - `src/templates/skills/worktrees/template.ts`
- [ ] **Est**: 5 minutes

**Steps**:

1. For each file, add `SKILL_CATEGORY` to the import and replace:
   ```typescript
   // add SKILL_CATEGORY to existing import from "#src/constants.js"
   category: ${SKILL_CATEGORY.DEVELOPER_WORKFLOW}
   ```

2. Verify: `pnpm test:unit` — expected: all passing.

3. Commit: `git add src/templates/skills/audit-fix/template.ts src/templates/skills/brainstorming/template.ts src/templates/skills/branch-finish/template.ts src/templates/skills/debugging/template.ts src/templates/skills/evidence-gathering/template.ts src/templates/skills/guided-execution/template.ts src/templates/skills/plan-executor/template.ts src/templates/skills/plan-writer/template.ts src/templates/skills/step-documenter/template.ts src/templates/skills/subagent-dev/template.ts src/templates/skills/tdd/template.ts src/templates/skills/verification/template.ts src/templates/skills/worktrees/template.ts && git commit -m "refactor(templates): use SKILL_CATEGORY constant in developer workflow templates"`

**Verification**: `pnpm test:unit` — expected: all passing.

---

### Task 8: Update remaining templates (Document Generation + File Format + Planning + Productivity + Workflow, 11 templates)

- [ ] **Files**:
  - `src/templates/skills/deck-engine/template.ts` — `Document Generation`
  - `src/templates/skills/doc-engine/template.ts` — `Document Generation`
  - `src/templates/skills/docx/template.ts` — `File Format Tools`
  - `src/templates/skills/pdf/template.ts` — `File Format Tools`
  - `src/templates/skills/pptx/template.ts` — `File Format Tools`
  - `src/templates/skills/xlsx/template.ts` — `File Format Tools`
  - `src/templates/skills/roadmap/template.ts` — `Planning`
  - `src/templates/skills/audio-transcriber/template.ts` — `Productivity`
  - `src/templates/skills/notebooklm/template.ts` — `Productivity`
  - `src/templates/skills/daily-log/template.ts` — `Workflow`
  - `src/templates/skills/session-handoff/template.ts` — `Workflow`
- [ ] **Est**: 5 minutes

**Steps**:

1. For each file, add `SKILL_CATEGORY` to the import and replace the category string with the appropriate constant:

   Document Generation (`deck-engine`, `doc-engine`):
   ```typescript
   category: ${SKILL_CATEGORY.DOCUMENT_GENERATION}
   ```

   File Format Tools (`docx`, `pdf`, `pptx`, `xlsx`):
   ```typescript
   category: ${SKILL_CATEGORY.FILE_FORMAT_TOOLS}
   ```

   Planning (`roadmap`):
   ```typescript
   category: ${SKILL_CATEGORY.PLANNING}
   ```

   Productivity (`audio-transcriber`, `notebooklm`):
   ```typescript
   category: ${SKILL_CATEGORY.PRODUCTIVITY}
   ```

   Workflow (`daily-log`, `session-handoff`):
   ```typescript
   category: ${SKILL_CATEGORY.WORKFLOW}
   ```

2. Verify: `pnpm test:unit` — expected: all passing.

3. Commit: `git add src/templates/skills/deck-engine/template.ts src/templates/skills/doc-engine/template.ts src/templates/skills/docx/template.ts src/templates/skills/pdf/template.ts src/templates/skills/pptx/template.ts src/templates/skills/xlsx/template.ts src/templates/skills/roadmap/template.ts src/templates/skills/audio-transcriber/template.ts src/templates/skills/notebooklm/template.ts src/templates/skills/daily-log/template.ts src/templates/skills/session-handoff/template.ts && git commit -m "refactor(templates): use SKILL_CATEGORY constant in remaining templates"`

**Verification**: `pnpm test:unit` — expected: all passing.

---

### Task 9: Final validation

- [ ] **Files**: none (verification only)
- [ ] **Est**: 2 minutes

**Steps**:

1. Run full test suite: `pnpm test:unit`

2. Verify no hardcoded category strings remain in templates:
   ```bash
   grep -rn "^category: [A-Z][a-z]" src/templates/skills/ --include="*.ts"
   ```
   Expected: no output (zero matches — all remaining category lines use template interpolation `${...}`).

3. Verify build passes: `pnpm build`

4. Run pre-commit suite: `pnpm test:pre-commit`

**Verification**: `pnpm test:pre-commit` — expected: all passing, zero hardcoded category strings.
