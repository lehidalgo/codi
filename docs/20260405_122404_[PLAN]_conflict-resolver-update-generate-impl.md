# Conflict Resolver for All Update/Generate Operations - Implementation Plan

> **For agentic workers:** Use `codi-subagent-dev` (recommended) or `codi-plan-executor` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route all artifact update and generate operations through the conflict resolver so no file is silently overwritten or silently skipped; change the non-TTY default from auto-accept to auto-merge-or-fail.

**Architecture:** Add `UnresolvableConflictError` to `conflict-resolver.ts`; fix the non-TTY block to attempt auto-merge and throw on true conflicts; refactor `refreshManagedArtifacts()` and `pullFromSource()` in `update.ts` to collect diffs and call `resolveConflicts()` instead of writing directly. `generator.ts` and `preset-applier.ts` need no changes - they already use the conflict resolver and inherit the non-TTY fix automatically.

**Tech Stack:** TypeScript, Vitest, gray-matter, Node.js fs/promises

---

### Task 1: Add `UnresolvableConflictError` class and its unit tests

**Files**: `src/utils/conflict-resolver.ts`, `tests/unit/utils/conflict-resolver.test.ts`
**Est**: 3 minutes

**Steps**:

- [ ] 1. Write failing test in `tests/unit/utils/conflict-resolver.test.ts` (new file):
   ```typescript
   import { describe, it, expect } from "vitest";
   import { UnresolvableConflictError } from "#src/utils/conflict-resolver.js";

   describe("UnresolvableConflictError", () => {
     it("stores file list on .files", () => {
       const err = new UnresolvableConflictError(["rules/foo", "rules/bar"]);
       expect(err.files).toEqual(["rules/foo", "rules/bar"]);
     });

     it("includes all file names in message", () => {
       const err = new UnresolvableConflictError(["rules/foo", "rules/bar"]);
       expect(err.message).toContain("rules/foo");
       expect(err.message).toContain("rules/bar");
     });

     it("sets name to UnresolvableConflictError", () => {
       const err = new UnresolvableConflictError([]);
       expect(err.name).toBe("UnresolvableConflictError");
     });

     it("is an instance of Error", () => {
       const err = new UnresolvableConflictError(["rules/x"]);
       expect(err).toBeInstanceOf(Error);
     });

     it("includes --force and --json hints in message", () => {
       const err = new UnresolvableConflictError(["rules/x"]);
       expect(err.message).toContain("--force");
       expect(err.message).toContain("--json");
     });
   });
   ```

- [ ] 2. Verify test fails: `pnpm test tests/unit/utils/conflict-resolver.test.ts` — expected: "UnresolvableConflictError is not exported"

- [ ] 3. Add the class to `src/utils/conflict-resolver.ts` after the `ConflictResolution` interface (after line 40):
   ```typescript
   /**
    * Thrown in non-interactive environments when two sides change the same
    * lines and auto-merge cannot resolve the conflict automatically.
    * Use --force to accept all incoming or --json to keep all current.
    */
   export class UnresolvableConflictError extends Error {
     public readonly files: string[];

     constructor(files: string[]) {
       super(
         `${files.length} file(s) have unresolvable conflicts and require manual resolution.\n` +
           `Files: ${files.join(", ")}\n` +
           `Run the command interactively to resolve, or use --force to accept all incoming, --json to keep all current.`,
       );
       this.name = "UnresolvableConflictError";
       this.files = files;
     }
   }
   ```

- [ ] 4. Verify test passes: `pnpm test tests/unit/utils/conflict-resolver.test.ts` — expected: "5 passing"

- [ ] 5. Commit: `git add src/utils/conflict-resolver.ts tests/unit/utils/conflict-resolver.test.ts && git commit -m "feat(conflict-resolver): add UnresolvableConflictError class"`

**Verification**: `pnpm test tests/unit/utils/conflict-resolver.test.ts` — expected: all passing

---

### Task 2: Change non-TTY default in `resolveConflicts()` to auto-merge or fail

**Files**: `src/utils/conflict-resolver.ts`, `tests/unit/utils/conflict-resolver.test.ts`
**Est**: 5 minutes

**Steps**:

- [ ] 1. Append the following `describe` block to `tests/unit/utils/conflict-resolver.test.ts` (do not add a second import - `resolveConflicts`, `makeConflictEntry`, and `UnresolvableConflictError` are already imported from Task 1; add `beforeEach` and `afterEach` to the existing vitest import):
   ```typescript
   describe("resolveConflicts - non-TTY", () => {
     beforeEach(() => {
       Object.defineProperty(process.stdout, "isTTY", {
         value: false,
         writable: true,
         configurable: true,
       });
     });

     afterEach(() => {
       Object.defineProperty(process.stdout, "isTTY", {
         value: true,
         writable: true,
         configurable: true,
       });
     });

     it("auto-merges when changes are on different lines", async () => {
       // user changed line 2, upstream changed line 5 — non-overlapping
       const current =
         "line1\nUSER-CHANGE\nline3\nline4\nline5\n";
       const incoming =
         "line1\nline2\nline3\nline4\nUPSTREAM-CHANGE\n";
       const conflict = makeConflictEntry(
         "rules/foo",
         "/tmp/foo.md",
         current,
         incoming,
       );

       const resolution = await resolveConflicts([conflict]);

       expect(resolution.merged).toHaveLength(1);
       expect(resolution.accepted).toHaveLength(0);
       expect(resolution.skipped).toHaveLength(0);
       expect(resolution.merged[0]!.incomingContent).toContain("USER-CHANGE");
       expect(resolution.merged[0]!.incomingContent).toContain("UPSTREAM-CHANGE");
     });

     it("throws UnresolvableConflictError when both sides change the same line", async () => {
       // both changed line2 differently — true conflict
       const current = "line1\nUSER-VERSION\nline3\n";
       const incoming = "line1\nUPSTREAM-VERSION\nline3\n";
       const conflict = makeConflictEntry(
         "rules/foo",
         "/tmp/foo.md",
         current,
         incoming,
       );

       await expect(resolveConflicts([conflict])).rejects.toThrow(
         UnresolvableConflictError,
       );
     });

     it("thrown error lists all unresolvable files", async () => {
       const current = "line1\nUSER\nline3\n";
       const incoming = "line1\nUPSTREAM\nline3\n";
       const c1 = makeConflictEntry("rules/foo", "/tmp/foo.md", current, incoming);
       const c2 = makeConflictEntry("rules/bar", "/tmp/bar.md", current, incoming);

       const err = await resolveConflicts([c1, c2]).catch((e: unknown) => e);
       expect(err).toBeInstanceOf(UnresolvableConflictError);
       expect((err as UnresolvableConflictError).files).toContain("rules/foo");
       expect((err as UnresolvableConflictError).files).toContain("rules/bar");
     });

     it("auto-merges some and throws for unresolvable in same batch", async () => {
       // c1: non-overlapping (should merge)
       const c1 = makeConflictEntry(
         "rules/safe",
         "/tmp/safe.md",
         "line1\nUSER\nline3\nline4\nline5\n",
         "line1\nline2\nline3\nline4\nUPSTREAM\n",
       );
       // c2: true conflict (should fail)
       const c2 = makeConflictEntry(
         "rules/conflict",
         "/tmp/conflict.md",
         "line1\nUSER-VERSION\nline3\n",
         "line1\nUPSTREAM-VERSION\nline3\n",
       );

       const err = await resolveConflicts([c1, c2]).catch((e: unknown) => e);
       expect(err).toBeInstanceOf(UnresolvableConflictError);
       expect((err as UnresolvableConflictError).files).toEqual(["rules/conflict"]);
     });

     it("returns merged entries and logs count when all conflicts auto-merge", async () => {
       const c1 = makeConflictEntry(
         "rules/foo",
         "/tmp/foo.md",
         "line1\nUSER\nline3\nline4\nline5\n",
         "line1\nline2\nline3\nline4\nUPSTREAM\n",
       );
       const c2 = makeConflictEntry(
         "rules/bar",
         "/tmp/bar.md",
         "AAA\nUSER\nCCC\nDDD\nEEE\n",
         "AAA\nBBB\nCCC\nDDD\nUPSTREAM\n",
       );

       const resolution = await resolveConflicts([c1, c2]);
       expect(resolution.merged).toHaveLength(2);
       expect(resolution.accepted).toHaveLength(0);
     });
   });
   ```

- [ ] 2. Verify tests fail: `pnpm test tests/unit/utils/conflict-resolver.test.ts` — expected: non-TTY tests failing (current behavior auto-accepts)

- [ ] 3. Replace the non-TTY block in `src/utils/conflict-resolver.ts` at lines 238-244. Replace:
   ```typescript
   // Non-TTY: CI, git hooks, watch mode — auto-accept without prompting
   if (!process.stdout.isTTY) {
     Logger.getInstance().warn(
       `Non-interactive environment detected: auto-accepting ${conflicts.length} conflict(s). Use --json to keep existing files instead.`,
     );
     return { accepted: conflicts, skipped: [], merged: [] };
   }
   ```
   With:
   ```typescript
   // Non-TTY: CI, git hooks, watch mode — auto-merge non-overlapping, fail on true conflicts
   if (!process.stdout.isTTY) {
     const mergedEntries: ConflictEntry[] = [];
     const failed: ConflictEntry[] = [];

     for (const conflict of conflicts) {
       const { content, hasConflicts } = buildConflictMarkers(
         conflict.currentContent,
         conflict.incomingContent,
       );
       if (!hasConflicts) {
         conflict.incomingContent = content;
         mergedEntries.push(conflict);
       } else {
         failed.push(conflict);
       }
     }

     if (failed.length > 0) {
       throw new UnresolvableConflictError(failed.map((f) => f.label));
     }

     if (mergedEntries.length > 0) {
       Logger.getInstance().info(
         `${mergedEntries.length} file(s) auto-merged in non-interactive mode`,
       );
     }

     return { accepted: [], skipped: [], merged: mergedEntries };
   }
   ```

- [ ] 4. Verify tests pass: `pnpm test tests/unit/utils/conflict-resolver.test.ts` — expected: all passing

- [ ] 5. Commit: `git add src/utils/conflict-resolver.ts tests/unit/utils/conflict-resolver.test.ts && git commit -m "feat(conflict-resolver): auto-merge non-overlapping in non-TTY, throw on unresolvable conflicts"`

**Verification**: `pnpm test tests/unit/utils/conflict-resolver.test.ts` — expected: all passing

---

### Task 3: Refactor `refreshManagedArtifacts()` to use conflict resolver

**Files**: `src/cli/update.ts`, `tests/unit/cli/update.test.ts`
**Est**: 5 minutes

**Steps**:

- [ ] 1. Add new tests and update the broken test in `tests/unit/cli/update.test.ts`.

   Replace the existing test at line 117 (`"refreshes managed rules with --rules"`) — it used `json: true` to avoid TTY prompts, but with the new behavior `json: true` means "keep all existing" so the rule would be skipped, not updated. Change it to use `force: true`:
   ```typescript
   it("refreshes managed rules with --rules using --force", async () => {
     const configDir = path.join(tmpDir, PROJECT_DIR);
     await fs.writeFile(
       path.join(configDir, "flags.yaml"),
       stringifyYaml({ auto_commit: { mode: "enabled", value: false } }),
       "utf-8",
     );

     const ruleName = prefixedName("security");
     await fs.writeFile(
       path.join(configDir, "rules", `${ruleName}.md`),
       `---\nname: ${ruleName}\nmanaged_by: ${PROJECT_NAME}\n---\nold content`,
       "utf-8",
     );

     const result = await updateHandler(tmpDir, { force: true, rules: true });
     expect(result.success).toBe(true);
     expect(result.data.rulesUpdated).toContain(ruleName);
   });
   ```

   Add tests for the new conflict-resolver behavior:
   ```typescript
   it("routes managed_by:codi rule change through conflict resolver with json:true => skipped", async () => {
     const configDir = path.join(tmpDir, PROJECT_DIR);
     await fs.writeFile(
       path.join(configDir, "flags.yaml"),
       stringifyYaml({ auto_commit: { mode: "enabled", value: false } }),
       "utf-8",
     );

     const ruleName = prefixedName("security");
     await fs.writeFile(
       path.join(configDir, "rules", `${ruleName}.md`),
       `---\nname: ${ruleName}\nmanaged_by: ${PROJECT_NAME}\n---\nold content`,
       "utf-8",
     );

     // json:true = keep existing (skip all conflicts)
     const result = await updateHandler(tmpDir, { json: true, rules: true });
     expect(result.success).toBe(true);
     expect(result.data.rulesSkipped).toContain(ruleName);
     expect(result.data.rulesUpdated).not.toContain(ruleName);

     // file on disk must remain unchanged
     const onDisk = await fs.readFile(
       path.join(configDir, "rules", `${ruleName}.md`),
       "utf-8",
     );
     expect(onDisk).toContain("old content");
   });

   it("routes managed_by:user rule change through conflict resolver with json:true => skipped", async () => {
     const configDir = path.join(tmpDir, PROJECT_DIR);
     await fs.writeFile(
       path.join(configDir, "flags.yaml"),
       stringifyYaml({ auto_commit: { mode: "enabled", value: false } }),
       "utf-8",
     );

     // User modified a built-in rule but kept the template name
     const ruleName = prefixedName("security");
     const originalContent = `---\nname: ${ruleName}\nmanaged_by: user\n---\nmy custom content`;
     await fs.writeFile(
       path.join(configDir, "rules", `${ruleName}.md`),
       originalContent,
       "utf-8",
     );

     // json:true = keep existing
     const result = await updateHandler(tmpDir, { json: true, rules: true });
     expect(result.success).toBe(true);
     expect(result.data.rulesSkipped).toContain(ruleName);
     expect(result.data.rulesUpdated).not.toContain(ruleName);

     // file must be preserved
     const onDisk = await fs.readFile(
       path.join(configDir, "rules", `${ruleName}.md`),
       "utf-8",
     );
     expect(onDisk).toContain("my custom content");
   });

   it("force-updates both managed_by:codi and managed_by:user rules when --force", async () => {
     const configDir = path.join(tmpDir, PROJECT_DIR);
     await fs.writeFile(
       path.join(configDir, "flags.yaml"),
       stringifyYaml({ auto_commit: { mode: "enabled", value: false } }),
       "utf-8",
     );

     const ruleName = prefixedName("security");
     await fs.writeFile(
       path.join(configDir, "rules", `${ruleName}.md`),
       `---\nname: ${ruleName}\nmanaged_by: user\n---\nmy custom content`,
       "utf-8",
     );

     const result = await updateHandler(tmpDir, { force: true, rules: true });
     expect(result.success).toBe(true);
     expect(result.data.rulesUpdated).toContain(ruleName);

     const onDisk = await fs.readFile(
       path.join(configDir, "rules", `${ruleName}.md`),
       "utf-8",
     );
     // must not contain the user's custom content anymore
     expect(onDisk).not.toContain("my custom content");
   });
   ```

- [ ] 2. Verify new tests fail and updated test fails: `pnpm test tests/unit/cli/update.test.ts` — expected: new tests failing

- [ ] 3. Add `force?: boolean` to `UpdateOptions` interface in `src/cli/update.ts` (after line 67 `dryRun?: boolean;`):
   ```typescript
   interface UpdateOptions extends GlobalOptions {
     preset?: string;
     from?: string;
     rules?: boolean;
     skills?: boolean;
     agents?: boolean;
     mcpServers?: boolean;
     dryRun?: boolean;
     force?: boolean;
   }
   ```

- [ ] 4. Add `force?: boolean` and `json?: boolean` to `RefreshArtifactOptions` interface in `src/cli/update.ts` (after line 95 `log: Logger;`):
   ```typescript
   interface RefreshArtifactOptions {
     configDir: string;
     subDir: string;
     label: string;
     availableTemplates: string[];
     loadTemplate: (name: string) => Result<string>;
     getTemplateVersion: (name: string) => number | undefined;
     nameMappings?: Record<string, string>;
     dryRun: boolean;
     force?: boolean;
     json?: boolean;
     log: Logger;
   }
   ```

- [ ] 5. Add the import for `resolveConflicts` and `makeConflictEntry` to `src/cli/update.ts` (after the existing imports, before line 59):
   ```typescript
   import {
     resolveConflicts,
     makeConflictEntry,
     type ConflictEntry,
   } from "../utils/conflict-resolver.js";
   ```

- [ ] 6. Replace the entire `refreshManagedArtifacts` function body in `src/cli/update.ts` (lines 98-149). Replace the whole function with:
   ```typescript
   async function refreshManagedArtifacts(
     opts: RefreshArtifactOptions,
   ): Promise<{ updated: string[]; skipped: string[] }> {
     const dir = path.join(opts.configDir, opts.subDir);
     const updated: string[] = [];
     const skipped: string[] = [];

     let entries: string[];
     try {
       entries = await fs.readdir(dir);
     } catch {
       return { updated, skipped };
     }

     const conflicts: ConflictEntry[] = [];

     for (const entry of entries) {
       if (!entry.endsWith(".md")) continue;
       const filePath = path.join(dir, entry);
       const raw = await fs.readFile(filePath, "utf8");
       const parsed = matter(raw);
       const name =
         (parsed.data["name"] as string) ?? entry.replace(".md", "");
       const templateName = findMatchingTemplate(
         name,
         opts.availableTemplates,
         opts.nameMappings,
       );

       if (!templateName) {
         skipped.push(name);
         continue;
       }

       const templateResult = opts.loadTemplate(templateName);
       if (!templateResult.ok) continue;
       const version = opts.getTemplateVersion(templateName);
       const newContent = (
         version !== undefined
           ? injectFrontmatterVersion(templateResult.data, version)
           : templateResult.data
       ).replace(/\{\{name\}\}/g, name);

       const normalized = newContent.endsWith("\n") ? newContent : newContent + "\n";

       if (raw.trim() === normalized.trim()) {
         // identical — nothing to do
         continue;
       }

       const label = `${opts.subDir}/${name}`;
       conflicts.push(makeConflictEntry(label, filePath, raw, normalized));
     }

     if (opts.dryRun) {
       for (const c of conflicts) {
         const name = c.label.split("/")[1] ?? c.label;
         opts.log.info(`Would update ${opts.label}: ${name}`);
         updated.push(name);
       }
       return { updated, skipped };
     }

     if (conflicts.length > 0) {
       const resolution = await resolveConflicts(conflicts, {
         force: opts.force,
         json: opts.json,
       });

       for (const entry of [...resolution.accepted, ...resolution.merged]) {
         await fs.writeFile(entry.fullPath, entry.incomingContent, "utf-8");
         const name = entry.label.split("/")[1] ?? entry.label;
         opts.log.info(`Updated ${opts.label}: ${name}`);
         updated.push(name);
       }

       for (const entry of resolution.skipped) {
         const name = entry.label.split("/")[1] ?? entry.label;
         skipped.push(name);
       }
     }

     return { updated, skipped };
   }
   ```

- [ ] 7. Update all three `refreshManagedArtifacts` call sites in `updateHandler` to pass `force` and `json`. In the rules call (around line 478), skills call (around line 496), and agents call (around line 512), add `force: options.force, json: options.json` to each options object:
   ```typescript
   // rules call
   const result = await refreshManagedArtifacts({
     configDir,
     subDir: "rules",
     label: "rule",
     dryRun,
     log,
     force: options.force,
     json: options.json,
     availableTemplates: AVAILABLE_TEMPLATES,
     loadTemplate,
     getTemplateVersion,
     nameMappings: RULE_NAME_MAPPINGS,
   });

   // skills call
   const result = await refreshManagedArtifacts({
     configDir,
     subDir: "skills",
     label: "skill",
     dryRun,
     log,
     force: options.force,
     json: options.json,
     availableTemplates: AVAILABLE_SKILL_TEMPLATES,
     loadTemplate: loadSkillTemplateContent,
     getTemplateVersion: getSkillTemplateVersion,
   });

   // agents call
   const result = await refreshManagedArtifacts({
     configDir,
     subDir: "agents",
     label: "agent",
     dryRun,
     log,
     force: options.force,
     json: options.json,
     availableTemplates: AVAILABLE_AGENT_TEMPLATES,
     loadTemplate: loadAgentTemplate,
     getTemplateVersion: getAgentTemplateVersion,
   });
   ```

- [ ] 8. Add `--force` option to `registerUpdateCommand` in `src/cli/update.ts` (after the `--dry-run` option):
   ```typescript
   .option("--force", "Accept all incoming changes without prompting (overwrites local)")
   ```

- [ ] 9. Verify tests pass: `pnpm test tests/unit/cli/update.test.ts` — expected: all passing

- [ ] 10. Commit: `git add src/cli/update.ts tests/unit/cli/update.test.ts && git commit -m "feat(update): route all artifacts through conflict resolver, add --force flag"`

**Verification**: `pnpm test tests/unit/cli/update.test.ts` — expected: all passing

---

### Task 4: Refactor `pullFromSource()` to use conflict resolver

**Files**: `src/cli/update.ts`, `tests/unit/cli/update.test.ts`
**Est**: 4 minutes

**Steps**:

- [ ] 1. Add a test for `--from` conflict behavior in `tests/unit/cli/update.test.ts`. This test uses a local directory as the "source" by directly calling `pullFromSource` is not exported, so we test via `updateHandler` with a local git repo stub. Instead, add a test that verifies `sourceUpdated` is returned correctly. Since `pullFromSource` clones a real repo, test the integration by mocking with a pre-populated temp dir:

   > Note: `pullFromSource` is not exported. Test indirectly via the handler's `sourceUpdated` field. Since this requires a git clone, this path is tested in integration tests. Add a unit-level test verifying the `--from` option is wired through to `updateHandler` result shape:

   ```typescript
   it("returns empty sourceUpdated when --from fails to clone invalid repo", async () => {
     const configDir = path.join(tmpDir, PROJECT_DIR);
     await fs.writeFile(
       path.join(configDir, "flags.yaml"),
       stringifyYaml({ auto_commit: { mode: "enabled", value: false } }),
       "utf-8",
     );

     const result = await updateHandler(tmpDir, {
       json: true,
       from: "this-org/this-repo-does-not-exist-xyz",
     });
     // clone fails gracefully — no crash, empty list
     expect(result.success).toBe(true);
     expect(result.data.sourceUpdated).toEqual([]);
   });
   ```

- [ ] 2. Verify test passes as-is (it tests existing graceful-failure behavior): `pnpm test tests/unit/cli/update.test.ts` — expected: passing

- [ ] 3. Replace the `pullFromSource` function in `src/cli/update.ts` (lines 225-291) with:
   ```typescript
   async function pullFromSource(
     repo: string,
     configDir: string,
     dryRun: boolean,
     log: Logger,
     options: { force?: boolean; json?: boolean } = {},
   ): Promise<string[]> {
     const updated: string[] = [];
     const tmpDir = path.join(
       os.tmpdir(),
       `${PROJECT_NAME}-pull-${Date.now()}`,
     );

     try {
       const repoUrl = `https://github.com/${repo}.git`;
       await execFileAsync("git", [
         "clone",
         "--depth",
         GIT_CLONE_DEPTH,
         repoUrl,
         tmpDir,
       ]);
     } catch (cause) {
       log.warn(`Failed to clone source repo: ${repo}`, cause);
       return updated;
     }

     const sourcePaths = ["rules", "skills", "agents"];
     const conflicts: ConflictEntry[] = [];
     const directWrites: Array<{
       localFile: string;
       content: string;
       label: string;
     }> = [];

     for (const syncPath of sourcePaths) {
       const sourceDir = path.join(tmpDir, PROJECT_DIR, syncPath);
       const localDir = path.join(configDir, syncPath);

       let entries: string[];
       try {
         entries = await fs.readdir(sourceDir);
       } catch {
         continue;
       }

       await fs.mkdir(localDir, { recursive: true });

       for (const entry of entries) {
         if (!entry.endsWith(".md")) continue;
         const sourceFile = path.join(sourceDir, entry);
         const localFile = path.join(localDir, entry);

         const sourceContent = await fs.readFile(sourceFile, "utf8");
         const sourceParsed = matter(sourceContent);
         if (sourceParsed.data["managed_by"] !== PROJECT_NAME) continue;

         const label = `${syncPath}/${entry}`;

         let localContent: string | null = null;
         try {
           localContent = await fs.readFile(localFile, "utf8");
         } catch {
           // new file — direct write
         }

         if (localContent === null) {
           directWrites.push({ localFile, content: sourceContent, label });
         } else if (localContent.trim() === sourceContent.trim()) {
           // identical — no-op
         } else {
           conflicts.push(
             makeConflictEntry(label, localFile, localContent, sourceContent),
           );
         }
       }
     }

     await safeRm(tmpDir);

     if (dryRun) {
       for (const { label } of [...directWrites, ...conflicts]) {
         log.info(`Would pull: ${label}`);
         updated.push(label);
       }
       return updated;
     }

     for (const { localFile, content, label } of directWrites) {
       await fs.writeFile(localFile, content, "utf-8");
       log.info(`Pulled: ${label}`);
       updated.push(label);
     }

     if (conflicts.length > 0) {
       const resolution = await resolveConflicts(conflicts, options);
       for (const entry of [...resolution.accepted, ...resolution.merged]) {
         await fs.writeFile(entry.fullPath, entry.incomingContent, "utf-8");
         log.info(`Pulled: ${entry.label}`);
         updated.push(entry.label);
       }
     }

     return updated;
   }
   ```

- [ ] 4. Update the `pullFromSource` call site in `updateHandler` (around line 537) to pass `options`:
   ```typescript
   sourceUpdated = await pullFromSource(
     options.from,
     configDir,
     options.dryRun ?? false,
     log,
     { force: options.force, json: options.json },
   );
   ```

- [ ] 5. Verify all update tests still pass: `pnpm test tests/unit/cli/update.test.ts` — expected: all passing

- [ ] 6. Run the full test suite: `pnpm test:unit` — expected: all passing

- [ ] 7. Commit: `git add src/cli/update.ts tests/unit/cli/update.test.ts && git commit -m "feat(update): route pullFromSource through conflict resolver for all artifacts"`

**Verification**: `pnpm test:unit` — expected: all passing

---

## Summary of Changed Behavior

| Scenario | Before | After |
|---|---|---|
| `codi update --rules` — `managed_by:codi` file changed | Silent overwrite | Conflict resolver (interactive / auto-merge / fail) |
| `codi update --rules` — `managed_by:user` file differs from template | Silent skip | Conflict resolver (user can accept / merge / skip) |
| `codi update --rules --force` | N/A (flag did not exist) | Overwrite all without prompt |
| `codi update --rules --json` | `managed_by:codi` silently overwritten; `managed_by:user` silently skipped | All conflicts skipped (existing files preserved) |
| Non-TTY, auto-mergeable | Auto-accept (overwrites) | Auto-merge combined content |
| Non-TTY, true conflict | Auto-accept (overwrites, data loss) | Throws `UnresolvableConflictError` with file list |
