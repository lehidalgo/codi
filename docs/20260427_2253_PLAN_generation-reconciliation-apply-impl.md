# Generation Reconciliation (applyConfiguration) Implementation Plan

> **For agentic workers:** Use `codi-plan-execution` to implement this plan task-by-task. That skill asks the user to pick INLINE (sequential) or SUBAGENT (fresh subagent per task with two-stage review) mode. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce `applyConfiguration()` as the single render+reconcile+state façade so every CLI entry point that "applies a configuration" is structurally guaranteed to prune orphaned per-agent files.

**Architecture:** New file `src/core/generator/apply.ts` wraps `generate()` with `StateManager.detectOrphans/deleteOrphans/updateAgentsBatch`. The five CLI sites that today call `generate()` directly are migrated to call `applyConfiguration()`. Pure-render callers (tests, dry-run) keep using `generate()` unchanged.

**Tech Stack:** TypeScript (NodeNext), Vitest, existing `StateManager` and `generate()` primitives.

**Spec:** `docs/20260427_2253_SPEC_generation-reconciliation-apply-configuration.md`

**Branch:** `hotfix/v2.13.1` — apply on top of the in-progress codex-bug fix already staged in the working tree.

**Commit cadence note:** Per project convention "commit at end of multi-step work", the natural landing is **one commit at the end** wrapping all five tasks. The spec lists five commits as a *risk-management option* (each independently reviewable). Execution-mode user can choose: collapse into one commit (preferred default) or split per-task. The commit step in each task below is therefore optional — run the final consolidated commit at the end if collapsing.

---

### Task 1: Create `apply.ts` with full unit-test coverage

**Files**: `src/core/generator/apply.ts`, `tests/unit/core/generator/apply.test.ts`
**Est**: 5 minutes

**Steps**:

1. Create the test file `tests/unit/core/generator/apply.test.ts` with the six failing scenarios from the spec:

   ```typescript
   import { describe, it, expect, beforeEach, afterEach } from "vitest";
   import { mkdir, readFile, writeFile, rm, access } from "node:fs/promises";
   import { join } from "node:path";
   import { tmpdir } from "node:os";
   import {
     registerAdapter,
     clearAdapters,
   } from "#src/core/generator/adapter-registry.js";
   import { applyConfiguration } from "#src/core/generator/apply.js";
   import { claudeCodeAdapter } from "#src/adapters/claude-code.js";
   import { StateManager } from "#src/core/config/state.js";
   import type { GeneratedFileState } from "#src/core/config/state.js";
   import { hashContent } from "#src/utils/hash.js";
   import { createMockConfig } from "#tests/unit/adapters/mock-config.js";
   import { PROJECT_NAME } from "#src/constants.js";

   describe("applyConfiguration", () => {
     let projectRoot: string;
     let configDir: string;

     beforeEach(async () => {
       clearAdapters();
       registerAdapter(claudeCodeAdapter);
       projectRoot = join(tmpdir(), `${PROJECT_NAME}-apply-${Date.now()}-${Math.random()}`);
       configDir = join(projectRoot, ".codi");
       await mkdir(configDir, { recursive: true });
     });

     afterEach(async () => {
       clearAdapters();
       await rm(projectRoot, { recursive: true, force: true });
     });

     async function fileExists(p: string): Promise<boolean> {
       return access(p).then(() => true).catch(() => false);
     }

     async function seedOrphanInState(
       agentId: string,
       relPath: string,
       fileContent: string,
       opts: { drift?: boolean } = {},
     ): Promise<void> {
       const sm = new StateManager(configDir, projectRoot);
       const recordedContent = opts.drift ? "original-pre-edit" : fileContent;
       const orphan: GeneratedFileState = {
         path: relPath,
         sourceHash: hashContent("orphan-source"),
         generatedHash: hashContent(recordedContent),
         sources: ["orphan-source"],
         timestamp: new Date().toISOString(),
       };
       await sm.updateAgentsBatch({ [agentId]: [orphan] });
       await mkdir(join(projectRoot, relPath, ".."), { recursive: true });
       await writeFile(join(projectRoot, relPath), fileContent, "utf-8");
     }

     it("dryRun: true skips reconcile and returns stateUpdated: false", async () => {
       const config = createMockConfig({
         manifest: { name: "t", version: "1", agents: ["claude-code"] },
       });
       await seedOrphanInState("claude-code", ".claude/rules/orphan.md", "x");

       const result = await applyConfiguration(config, projectRoot, { dryRun: true });

       expect(result.ok).toBe(true);
       if (!result.ok) return;
       expect(result.data.reconciliation.stateUpdated).toBe(false);
       expect(result.data.reconciliation.pruned).toEqual([]);
       expect(await fileExists(join(projectRoot, ".claude/rules/orphan.md"))).toBe(true);
     });

     it("pure-additive run: pruned is empty, state is updated", async () => {
       const config = createMockConfig({
         manifest: { name: "t", version: "1", agents: ["claude-code"] },
       });

       const result = await applyConfiguration(config, projectRoot, {});

       expect(result.ok).toBe(true);
       if (!result.ok) return;
       expect(result.data.reconciliation.pruned).toEqual([]);
       expect(result.data.reconciliation.preservedDrifted).toEqual([]);
       expect(result.data.reconciliation.stateUpdated).toBe(true);
     });

     it("deselect path: clean orphan is pruned and removed from disk", async () => {
       const config = createMockConfig({
         manifest: { name: "t", version: "1", agents: ["claude-code"] },
       });
       await seedOrphanInState("claude-code", ".claude/rules/orphan.md", "matching-content");

       const result = await applyConfiguration(config, projectRoot, {});

       expect(result.ok).toBe(true);
       if (!result.ok) return;
       expect(result.data.reconciliation.pruned).toContain(".claude/rules/orphan.md");
       expect(await fileExists(join(projectRoot, ".claude/rules/orphan.md"))).toBe(false);
     });

     it("drifted orphan + forceDeleteDriftedOrphans:false → preserved", async () => {
       const config = createMockConfig({
         manifest: { name: "t", version: "1", agents: ["claude-code"] },
       });
       await seedOrphanInState(
         "claude-code",
         ".claude/rules/edited.md",
         "user-edited-content",
         { drift: true },
       );

       const result = await applyConfiguration(config, projectRoot, {
         forceDeleteDriftedOrphans: false,
       });

       expect(result.ok).toBe(true);
       if (!result.ok) return;
       expect(result.data.reconciliation.preservedDrifted).toContain(".claude/rules/edited.md");
       expect(result.data.reconciliation.pruned).not.toContain(".claude/rules/edited.md");
       expect(await fileExists(join(projectRoot, ".claude/rules/edited.md"))).toBe(true);
     });

     it("drifted orphan + forceDeleteDriftedOrphans:true → pruned", async () => {
       const config = createMockConfig({
         manifest: { name: "t", version: "1", agents: ["claude-code"] },
       });
       await seedOrphanInState(
         "claude-code",
         ".claude/rules/edited.md",
         "user-edited-content",
         { drift: true },
       );

       const result = await applyConfiguration(config, projectRoot, {
         forceDeleteDriftedOrphans: true,
       });

       expect(result.ok).toBe(true);
       if (!result.ok) return;
       expect(result.data.reconciliation.pruned).toContain(".claude/rules/edited.md");
       expect(await fileExists(join(projectRoot, ".claude/rules/edited.md"))).toBe(false);
     });

     it("generate() failure propagates and leaves state untouched", async () => {
       const config = createMockConfig({
         manifest: { name: "t", version: "1", agents: ["nonexistent-adapter"] },
       });
       await seedOrphanInState("claude-code", ".claude/rules/orphan.md", "x");

       const result = await applyConfiguration(config, projectRoot, {});

       expect(result.ok).toBe(false);
       expect(await fileExists(join(projectRoot, ".claude/rules/orphan.md"))).toBe(true);
     });
   });
   ```

2. Verify tests fail (apply.ts doesn't exist yet):
   ```
   pnpm exec vitest run tests/unit/core/generator/apply.test.ts
   ```
   Expected: all 6 tests failing with "Cannot find module" or similar.

3. Implement `src/core/generator/apply.ts`:

   ```typescript
   import { unlink } from "node:fs/promises";
   import { join } from "node:path";
   import { generate, type GenerationResult } from "./generator.js";
   import { StateManager, type GeneratedFileState } from "#src/core/config/state.js";
   import { resolveProjectDir } from "#src/utils/paths.js";
   import { hashContent } from "#src/utils/hash.js";
   import { Logger } from "#src/core/output/logger.js";
   import type { NormalizedConfig } from "#src/types/config.js";
   import type { Result } from "#src/types/result.js";
   import { ok } from "#src/types/result.js";

   /**
    * Options for {@link applyConfiguration}. Render options are forwarded to
    * {@link generate}; reconcile options control orphan handling.
    */
   export interface ApplyOptions {
     /** Override the agents from `config.manifest.agents`. */
     agents?: string[];
     /** Render only — no FS writes, no state writes, no reconcile. */
     dryRun?: boolean;
     /** Accept-incoming on conflict during render. */
     force?: boolean;
     /** Reject-incoming on conflict during render. */
     keepCurrent?: boolean;
     /** Append-merge on conflict during render. */
     unionMerge?: boolean;
     /**
      * Force-delete drifted orphans (user-edited generated files).
      * Default: `options.force`. The CLI layer composes whatever expression it
      * wants (e.g. `force || onConflict === "keep-incoming"`); apply.ts itself
      * does not know about CLI option vocabulary.
      */
     forceDeleteDriftedOrphans?: boolean;
   }

   /**
    * Outcome of an {@link applyConfiguration} call.
    */
   export interface ApplyResult {
     /** The underlying {@link generate} result. */
     generation: GenerationResult;
     reconciliation: {
       /** Relative paths of files actually pruned from disk. */
       pruned: string[];
       /** Relative paths of drifted orphans kept (user-edited, not force-deleted). */
       preservedDrifted: string[];
       /** False on dryRun or if the state-write step failed (non-fatal). */
       stateUpdated: boolean;
     };
   }

   /**
    * Render a configuration, write its files, prune orphans, and persist state.
    *
    * This is the single public entry point for "apply this configuration to the
    * filesystem". CLI handlers should call this rather than {@link generate}
    * directly. {@link generate} remains available for pure-render use cases
    * (tests, dry-run reporting) that must not touch state.
    *
    * Order of operations: render → write → detect-orphans → delete-orphans →
    * update-state. If any step before update-state fails, state is not updated,
    * so the next successful run re-detects and prunes the same orphans.
    * Reconciliation is idempotent and self-healing.
    */
   export async function applyConfiguration(
     config: NormalizedConfig,
     projectRoot: string,
     options: ApplyOptions = {},
   ): Promise<Result<ApplyResult>> {
     const log = Logger.getInstance();
     const genResult = await generate(config, projectRoot, {
       agents: options.agents,
       dryRun: options.dryRun,
       force: options.force,
       keepCurrent: options.keepCurrent,
       unionMerge: options.unionMerge,
     });
     if (!genResult.ok) return genResult;

     const empty = { pruned: [] as string[], preservedDrifted: [] as string[] };

     if (options.dryRun) {
       return ok({
         generation: genResult.data,
         reconciliation: { ...empty, stateUpdated: false },
       });
     }

     const configDir = resolveProjectDir(projectRoot);
     const stateManager = new StateManager(configDir, projectRoot);

     const agentUpdates: Record<string, GeneratedFileState[]> = {};
     for (const agentId of genResult.data.agents) {
       agentUpdates[agentId] = (genResult.data.filesByAgent[agentId] ?? []).map(
         (f): GeneratedFileState => ({
           path: f.path,
           sourceHash: hashContent(f.sources.join(",")),
           generatedHash: f.hash,
           sources: f.sources,
           timestamp: new Date().toISOString(),
         }),
       );
     }

     const pruned: string[] = [];
     const preservedDrifted: string[] = [];

     const orphanResult = await stateManager.detectOrphans(agentUpdates);
     if (orphanResult.ok) {
       const { clean, drifted } = orphanResult.data;
       const forceDelete = options.forceDeleteDriftedOrphans ?? options.force ?? false;
       const toDelete = forceDelete ? [...clean, ...drifted] : clean;
       if (toDelete.length > 0) {
         const deleted = await stateManager.deleteOrphans(toDelete);
         pruned.push(...deleted);
       }
       if (!forceDelete) {
         preservedDrifted.push(...drifted.map((d) => d.path));
       }
     }

     let stateUpdated = false;
     try {
       const updateResult = await stateManager.updateAgentsBatch(agentUpdates);
       stateUpdated = updateResult.ok;
       if (!updateResult.ok) {
         log.warn("State update failed; orphan detection may be incomplete on next run.");
       }
     } catch {
       log.warn("State update failed; orphan detection may be incomplete on next run.");
     }

     return ok({
       generation: genResult.data,
       reconciliation: { pruned, preservedDrifted, stateUpdated },
     });
   }
   ```

4. Verify all 6 tests pass:
   ```
   pnpm exec vitest run tests/unit/core/generator/apply.test.ts
   ```
   Expected: 6 passing.

5. Type-check the whole project:
   ```
   pnpm exec tsc --noEmit
   ```
   Expected: zero errors.

**Verification**: `pnpm exec vitest run` — all tests still passing.

**Optional commit**: `git add src/core/generator/apply.ts tests/unit/core/generator/apply.test.ts && git commit -m "feat(generator): add applyConfiguration façade with orphan reconciliation"`

---

### Task 2: Refactor `cli/generate.ts` to use `applyConfiguration`

**Files**: `src/cli/generate.ts`
**Est**: 4 minutes

**Steps**:

1. Replace the entire orphan/state block in `src/cli/generate.ts` (lines 76-143 today). The exact replacement — leave imports of `StateManager`, `GeneratedFileState`, `hashContent` in place if they are still used by the hooks block below; if the hooks block at line 196-215 still uses them, keep the imports.

   Open `src/cli/generate.ts` and replace from the `const genResult = await generate(...)` call through the end of the `if (!options.dryRun) { … writeAuditEntry(...) }` block (lines 76-143) with:

   ```typescript
   const result = await applyConfiguration(configResult.data, projectRoot, {
     agents: options.agent,
     dryRun: options.dryRun,
     force: options.force || options.onConflict === "keep-incoming",
     keepCurrent: options.onConflict === "keep-current",
     unionMerge,
     forceDeleteDriftedOrphans: options.force || options.onConflict === "keep-incoming",
   });

   if (!result.ok) {
     return createCommandResult({
       success: false,
       command: "generate",
       data: { agents: [], filesGenerated: 0, files: [] },
       errors: result.errors,
       exitCode: EXIT_CODES.GENERATION_FAILED,
     });
   }

   const { generation, reconciliation } = result.data;

   if (!options.dryRun) {
     if (reconciliation.pruned.length > 0) {
       log.info(
         `Pruned ${reconciliation.pruned.length} orphaned file(s) removed from source templates`,
       );
     }
     if (reconciliation.preservedDrifted.length > 0) {
       log.warn(
         `${reconciliation.preservedDrifted.length} orphaned file(s) have local edits — preserved. ` +
           `Use --on-conflict keep-incoming to force delete.`,
       );
     }

     const configDir = resolveProjectDir(projectRoot);
     await writeAuditEntry(configDir, {
       type: "generate",
       timestamp: new Date().toISOString(),
       details: {
         agents: generation.agents,
         filesGenerated: generation.files.length,
       },
     });
   }
   ```

2. Update imports at the top of the same file. Remove the now-unused imports if no other code in the file references them:
   - Remove `import { generate } from "../core/generator/generator.js";`
   - Remove `import { StateManager } from "../core/config/state.js";` if not used by the hooks block (re-grep within the file).
   - Remove `import type { GeneratedFileState } from "../core/config/state.js";` if not used by the hooks block.
   - Remove `import { hashContent } from "../utils/hash.js";` if not used by the hooks block.
   - Add `import { applyConfiguration } from "../core/generator/apply.js";`.

   Check usage with: `grep -n "StateManager\|GeneratedFileState\|hashContent\|generate(" src/cli/generate.ts` — if matches remain inside the hooks-install block (around line 196-215), keep those imports.

3. Update the variable references in the rest of the file: any later code that referenced `genResult.data.filesByAgent` etc. now uses `generation.filesByAgent`, etc. Find with: `grep -n "genResult" src/cli/generate.ts` and rename each surviving reference to `generation`.

4. Type-check:
   ```
   pnpm exec tsc --noEmit
   ```
   Expected: zero errors.

5. Run all CLI tests to verify behavior preserved:
   ```
   pnpm exec vitest run tests/unit/cli/
   ```
   Expected: all passing.

**Verification**: `pnpm exec vitest run` — all tests passing.

**Optional commit**: `git add src/cli/generate.ts && git commit -m "refactor(cli): use applyConfiguration in generate command"`

---

### Task 3: Wire `cli/init.ts` post-init regen + integration regression test

**Files**: `src/cli/init.ts`, `tests/unit/cli/init.test.ts`
**Est**: 4 minutes

**Steps**:

1. First write the failing integration regression test by appending to `tests/unit/cli/init.test.ts` inside the `describe("init command handler", () => { ... })` block (before its closing `});`):

   ```typescript
     // Regression: removing an artifact from .codi/ then re-running init must
     // prune the corresponding file from per-agent dirs (.claude/, .codex/, etc.).
     // Prior to the applyConfiguration façade, init.ts called generate() directly,
     // bypassing StateManager.detectOrphans/deleteOrphans entirely — so deselected
     // artifacts were stranded in agent dirs forever.
     it("update mode prunes orphaned per-agent files when an artifact is deselected", async () => {
       await initHandler(tmpDir, {
         json: true,
         preset: prefixedName("balanced"),
         agents: ["claude-code"],
       });

       // Pick a rule we know is in the balanced preset and was generated.
       const claudeRulesDir = path.join(tmpDir, ".claude", "rules");
       const beforeFiles = await fs.readdir(claudeRulesDir);
       expect(beforeFiles.length).toBeGreaterThan(0);
       const sacrificialRule = beforeFiles.find((f) => f.endsWith(".md"));
       expect(sacrificialRule).toBeDefined();
       const ruleName = sacrificialRule!.replace(/\.md$/, "");

       // Remove the artifact from .codi/ — equivalent to the wizard deselecting it.
       await fs.unlink(path.join(tmpDir, PROJECT_DIR, "rules", `${ruleName}.md`));

       // Re-run init. Without the fix, the orphan stays in .claude/rules/.
       const result = await initHandler(tmpDir, {
         json: true,
         preset: prefixedName("balanced"),
         agents: ["claude-code"],
       });
       expect(result.success).toBe(true);

       const orphanPath = path.join(claudeRulesDir, `${ruleName}.md`);
       const orphanGone = await fs
         .access(orphanPath)
         .then(() => false)
         .catch(() => true);
       expect(orphanGone).toBe(true);
     });

     // Spec second integration test: orphan pruning must work across every
     // configured agent's output dir, not just claude-code's. Removing a skill
     // from .codi/skills/ should drop it from .claude/skills/ AND .agents/skills/
     // (the directory codex reads). Single-agent coverage above does not catch
     // adapter-specific bugs in the per-agent file mapping.
     it("update mode prunes orphan from multiple per-agent dirs (claude-code + codex)", async () => {
       await initHandler(tmpDir, {
         json: true,
         preset: prefixedName("balanced"),
         agents: ["claude-code", "codex"],
       });

       const claudeSkillsDir = path.join(tmpDir, ".claude", "skills");
       const codexSkillsDir = path.join(tmpDir, ".agents", "skills");

       const skillEntries = await fs.readdir(claudeSkillsDir);
       expect(skillEntries.length).toBeGreaterThan(0);
       const sacrificialSkill = skillEntries[0]!;

       // Confirm the same skill exists in both per-agent dirs before deselect.
       const claudeBefore = await fs
         .access(path.join(claudeSkillsDir, sacrificialSkill))
         .then(() => true)
         .catch(() => false);
       const codexBefore = await fs
         .access(path.join(codexSkillsDir, sacrificialSkill))
         .then(() => true)
         .catch(() => false);
       expect(claudeBefore).toBe(true);
       expect(codexBefore).toBe(true);

       // Deselect the skill from .codi/ — equivalent to wizard unchecking it.
       await fs.rm(path.join(tmpDir, PROJECT_DIR, "skills", sacrificialSkill), {
         recursive: true,
         force: true,
       });

       const result = await initHandler(tmpDir, {
         json: true,
         preset: prefixedName("balanced"),
         agents: ["claude-code", "codex"],
       });
       expect(result.success).toBe(true);

       const claudeAfter = await fs
         .access(path.join(claudeSkillsDir, sacrificialSkill))
         .then(() => true)
         .catch(() => false);
       const codexAfter = await fs
         .access(path.join(codexSkillsDir, sacrificialSkill))
         .then(() => true)
         .catch(() => false);
       expect(claudeAfter).toBe(false);
       expect(codexAfter).toBe(false);
     });
   ```

2. Verify the test fails (proves the bug exists before the wiring change):
   ```
   pnpm exec vitest run tests/unit/cli/init.test.ts -t "update mode prunes orphaned per-agent"
   ```
   Expected: 1 failing.

3. Open `src/cli/init.ts` and replace the post-init generate block (currently at lines 585-598). Find:

   ```typescript
   let generated = importRegenerated;
   const configResult = await resolveConfig(projectRoot);
   if (!importRegenerated && configResult.ok) {
     const genResult = await generate(configResult.data, projectRoot, {
       force: options.force || options.onConflict === "keep-incoming",
       keepCurrent: options.onConflict === "keep-current",
     });
     generated = genResult.ok;
     if (!genResult.ok) {
       log.warn(`Generation after init failed; you can run \`${PROJECT_CLI} generate\` later.`);
     }
   }
   ```

   Replace with:

   ```typescript
   let generated = importRegenerated;
   const configResult = await resolveConfig(projectRoot);
   if (!importRegenerated && configResult.ok) {
     const applyResult = await applyConfiguration(configResult.data, projectRoot, {
       force: options.force || options.onConflict === "keep-incoming",
       keepCurrent: options.onConflict === "keep-current",
       forceDeleteDriftedOrphans: options.force || options.onConflict === "keep-incoming",
     });
     generated = applyResult.ok;
     if (!applyResult.ok) {
       log.warn(`Generation after init failed; you can run \`${PROJECT_CLI} generate\` later.`);
     } else {
       const { reconciliation } = applyResult.data;
       if (reconciliation.pruned.length > 0) {
         log.info(
           `Pruned ${reconciliation.pruned.length} orphaned file(s) removed from source templates`,
         );
       }
     }
   }
   ```

4. Update imports at the top of `src/cli/init.ts`:
   - Remove `import { generate } from "../core/generator/generator.js";`
   - Add `import { applyConfiguration } from "../core/generator/apply.js";`

5. Type-check:
   ```
   pnpm exec tsc --noEmit
   ```
   Expected: zero errors.

6. Verify the new regression test passes and all init tests stay green:
   ```
   pnpm exec vitest run tests/unit/cli/init.test.ts
   ```
   Expected: all init tests passing (originals + the codex-fix tests already added + this new orphan test).

**Verification**: `pnpm exec vitest run` — all tests passing.

**Optional commit**: `git add src/cli/init.ts tests/unit/cli/init.test.ts && git commit -m "fix(init): prune orphaned per-agent files on post-init regen"`

---

### Task 4: Wire `cli/shared.ts:regenerateConfigs`

**Files**: `src/cli/shared.ts`
**Est**: 2 minutes

**Steps**:

1. Open `src/cli/shared.ts` and replace the body of `regenerateConfigs` (lines 46-61). Find:

   ```typescript
   export async function regenerateConfigs(projectRoot: string): Promise<boolean> {
     const log = Logger.getInstance();
     try {
       registerAllAdapters();
       const configResult = await resolveConfig(projectRoot);
       if (!configResult.ok) {
         log.warn("Auto-generate skipped: config resolution failed.");
         return false;
       }
       const genResult = await generate(configResult.data, projectRoot, { force: true });
       return genResult.ok;
     } catch {
       log.warn(`Auto-generate failed. Run \`${PROJECT_CLI} generate\` manually.`);
       return false;
     }
   }
   ```

   Replace with:

   ```typescript
   export async function regenerateConfigs(projectRoot: string): Promise<boolean> {
     const log = Logger.getInstance();
     try {
       registerAllAdapters();
       const configResult = await resolveConfig(projectRoot);
       if (!configResult.ok) {
         log.warn("Auto-generate skipped: config resolution failed.");
         return false;
       }
       const applyResult = await applyConfiguration(configResult.data, projectRoot, {
         force: true,
         forceDeleteDriftedOrphans: true,
       });
       if (!applyResult.ok) return false;
       const { reconciliation } = applyResult.data;
       if (reconciliation.pruned.length > 0) {
         log.info(
           `Pruned ${reconciliation.pruned.length} orphaned file(s) removed from source templates`,
         );
       }
       return true;
     } catch {
       log.warn(`Auto-generate failed. Run \`${PROJECT_CLI} generate\` manually.`);
       return false;
     }
   }
   ```

   *Why `forceDeleteDriftedOrphans: true` here*: `regenerateConfigs` is called immediately after the user has explicitly added/removed artifacts via the wizard or hub. They have already confirmed the intent; preserving "drifted" orphans (which in this context means user-edited generated files that no longer have a source) would surprise them. This matches the existing `force: true` semantic.

2. Update imports at the top of `src/cli/shared.ts`:
   - Remove `import { generate } from "../core/generator/generator.js";`
   - Add `import { applyConfiguration } from "../core/generator/apply.js";`

3. Type-check:
   ```
   pnpm exec tsc --noEmit
   ```
   Expected: zero errors.

4. Run shared.ts tests + the consumers (hub-handlers, init-wizard-modify-add):
   ```
   pnpm exec vitest run tests/unit/cli/shared.test.ts tests/unit/cli/hub-handlers.test.ts
   ```
   Expected: all passing.

**Verification**: `pnpm exec vitest run` — all tests passing.

**Optional commit**: `git add src/cli/shared.ts && git commit -m "fix(shared): prune orphans in regenerateConfigs (hub + customize-add paths)"`

---

### Task 5: Wire `cli/watch.ts` and `cli/update.ts`

**Files**: `src/cli/watch.ts`, `src/cli/update.ts`
**Est**: 4 minutes

**Steps**:

1. Open `src/cli/watch.ts` and replace the body of `runGenerate` (lines 26-64) — note this also removes the now-redundant per-agent state-update loop and the audit entry, both of which `applyConfiguration` handles internally (state) or which we keep at this call site (audit). Find:

   ```typescript
   async function runGenerate(projectRoot: string, log: Logger): Promise<boolean> {
     registerAllAdapters();
     const configResult = await resolveConfig(projectRoot);
     if (!configResult.ok) {
       log.warn("Config resolution failed during watch — skipping generation.");
       return false;
     }

     const genResult = await generate(configResult.data, projectRoot, { force: true });
     if (!genResult.ok) {
       log.warn("Generation failed during watch.");
       return false;
     }

     const configDir = resolveProjectDir(projectRoot);
     const stateManager = new StateManager(configDir, projectRoot);
     for (const agentId of genResult.data.agents) {
       const agentFiles = (
         genResult.data.filesByAgent?.[agentId] ?? genResult.data.files
       ).map(
         (f): GeneratedFileState => ({
           path: f.path,
           sourceHash: hashContent(f.sources.join(",")),
           generatedHash: f.hash,
           sources: f.sources,
           timestamp: new Date().toISOString(),
         }),
       );
       await stateManager.updateAgent(agentId, agentFiles);
     }

     await writeAuditEntry(configDir, {
       type: "generate",
       timestamp: new Date().toISOString(),
       details: { trigger: "watch", agents: genResult.data.agents },
     });

     return true;
   }
   ```

   Replace with:

   ```typescript
   async function runGenerate(projectRoot: string, log: Logger): Promise<boolean> {
     registerAllAdapters();
     const configResult = await resolveConfig(projectRoot);
     if (!configResult.ok) {
       log.warn("Config resolution failed during watch — skipping generation.");
       return false;
     }

     const applyResult = await applyConfiguration(configResult.data, projectRoot, {
       force: true,
       forceDeleteDriftedOrphans: true,
     });
     if (!applyResult.ok) {
       log.warn("Generation failed during watch.");
       return false;
     }

     const { generation, reconciliation } = applyResult.data;
     if (reconciliation.pruned.length > 0) {
       log.debug(`Watch: pruned ${reconciliation.pruned.length} orphaned file(s).`);
     }

     const configDir = resolveProjectDir(projectRoot);
     await writeAuditEntry(configDir, {
       type: "generate",
       timestamp: new Date().toISOString(),
       details: { trigger: "watch", agents: generation.agents },
     });

     return true;
   }
   ```

   *Why `forceDeleteDriftedOrphans: true` here*: watch mode runs continuously with `force: true` already (matches the existing literal). Drift-preservation in a hot loop would accumulate ghost files indefinitely.

2. Update imports at the top of `src/cli/watch.ts`:
   - Remove `import { generate } from "../core/generator/generator.js";`
   - Remove `import { StateManager } from "..." ;` if only used by the deleted block (re-grep `grep -n "StateManager" src/cli/watch.ts`).
   - Remove `import type { GeneratedFileState } ...;` if only used by the deleted block.
   - Remove `import { hashContent } ...;` if only used by the deleted block.
   - Add `import { applyConfiguration } from "../core/generator/apply.js";`

3. Open `src/cli/update.ts` and replace the post-update regen block at lines 642-653. Find:

   ```typescript
     let regenerated = false;
     if (!options.dryRun) {
       registerAllAdapters();
       const configResult = await resolveConfig(projectRoot);
       if (configResult.ok) {
         const genResult = await generate(configResult.data, projectRoot, {
           keepCurrent: options.onConflict === "keep-current",
           force: options.force || options.onConflict === "keep-incoming",
           unionMerge,
         });
         regenerated = genResult.ok;
       }
     }
   ```

   Replace with:

   ```typescript
     let regenerated = false;
     if (!options.dryRun) {
       registerAllAdapters();
       const configResult = await resolveConfig(projectRoot);
       if (configResult.ok) {
         const applyResult = await applyConfiguration(configResult.data, projectRoot, {
           keepCurrent: options.onConflict === "keep-current",
           force: options.force || options.onConflict === "keep-incoming",
           unionMerge,
           forceDeleteDriftedOrphans: options.force || options.onConflict === "keep-incoming",
         });
         regenerated = applyResult.ok;
         if (applyResult.ok && applyResult.data.reconciliation.pruned.length > 0) {
           log.info(
             `Pruned ${applyResult.data.reconciliation.pruned.length} orphaned file(s) removed from source templates`,
           );
         }
       }
     }
   ```

4. Update imports at the top of `src/cli/update.ts`:
   - Remove `import { generate } from "../core/generator/generator.js";`
   - Add `import { applyConfiguration } from "../core/generator/apply.js";`

5. Type-check:
   ```
   pnpm exec tsc --noEmit
   ```
   Expected: zero errors.

6. Final full-suite run:
   ```
   pnpm exec vitest run
   ```
   Expected: all tests passing.

7. End-to-end smoke verification (manual):
   ```
   SMOKE=$(mktemp -d -t codi-orphan-final-XXX) && cd "$SMOKE" && \
     codi init --json --preset codi-balanced --agents claude-code > /dev/null && \
     SACRIFICE=$(ls .claude/rules/ | head -1 | sed 's/\.md$//') && \
     rm -f ".codi/rules/${SACRIFICE}.md" && \
     codi init --preset codi-balanced --agents claude-code > /dev/null && \
     ls ".claude/rules/${SACRIFICE}.md" 2>/dev/null && echo "STILL STRANDED" || echo "PRUNED OK" && \
     cd / && rm -rf "$SMOKE"
   ```
   Expected output: `PRUNED OK`.

**Verification**: All vitest passing + manual smoke prints `PRUNED OK`.

**Optional commit**: `git add src/cli/watch.ts src/cli/update.ts && git commit -m "fix(cli): prune orphans in watch and update commands"`

---

## Final Consolidation (if landing as a single commit)

If using a single commit per the user's "commit at end" preference, run after all five tasks complete:

```
pnpm exec tsc --noEmit && pnpm exec vitest run && \
git add src/core/generator/apply.ts \
        tests/unit/core/generator/apply.test.ts \
        src/cli/generate.ts \
        src/cli/init.ts \
        src/cli/shared.ts \
        src/cli/watch.ts \
        src/cli/update.ts \
        tests/unit/cli/init.test.ts \
        docs/20260427_2253_SPEC_generation-reconciliation-apply-configuration.md \
        docs/20260427_2253_PLAN_generation-reconciliation-apply-impl.md && \
git commit -m "$(cat <<'EOF'
fix(generator): introduce applyConfiguration façade to prune orphan files

Adds src/core/generator/apply.ts as the single render+reconcile+state entry
point. Migrates 5 CLI sites (generate, init, shared.regenerateConfigs, watch,
update) to use it. Eliminates the bug class where deselecting an artifact from
.codi/ left stranded files in .claude/, .codex/, .cursor/, .agents/, etc.

generate() remains a pure render+write primitive for tests and dry-run callers.
The orphan-detection mechanism (StateManager.detectOrphans/deleteOrphans) is
unchanged — only the orchestration moves into a shared, structurally-mandatory
helper.

Includes 6 unit tests for apply.ts and 1 integration regression test in
init.test.ts proving the user-reported bug stays fixed.
EOF
)"
```
