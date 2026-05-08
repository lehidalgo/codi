# Backup Overhaul Implementation Plan

> **For agentic workers:** Use `codi-plan-execution` to implement this plan task-by-task.
>
> **CRITICAL deviation from default**: per the user's directive ("we commit at the end of the implementation of the plan"), each task verifies locally with `pnpm test` / `pnpm lint` but **does NOT commit**. The single commit happens in the final integration task (Task 30). Do NOT `git commit` between tasks.

**Goal:** Replace the single-shot `createBackup` model with a `openBackup → handle.append → handle.finalise` lifecycle that captures source + output + pre-existing files in a v2 manifest, wires it into every destructive operation, and unifies restore with the existing import flow.

**Architecture:** Backup files are organised under `.codi/backups/<ISO-timestamp>/` with `manifest.json` written LAST as a commit marker. A `BackupHandle` returned by `openBackup` lets callers append additional paths (e.g. orphans discovered mid-operation) before finalising. Restore re-uses `runArtifactSelectionFromSource` by adapting a backup directory into the existing `ExternalSource` shape.

**Tech Stack:** TypeScript strict, vitest, `@clack/prompts` for TUI, pnpm workspace, Node fs/promises.

**Spec:** `docs/20260430_193109_[PLAN]_backup-overhaul.md` (read this first if context is missing).

---

## Pre-flight

Before starting Task 1, verify clean baseline:

```bash
git status -sb           # On develop, no uncommitted changes (or only the spec file)
pnpm install --frozen-lockfile
pnpm test:coverage       # Must exit 0 — current baseline
```

Record the current coverage baseline (lines 88.04, statements 86.25, functions 90.11, branches 74.91). This must not regress on Task 30.

---

## Phase 1 — Foundation: constants + types

### Task 1: Update constants and create the types module

**Files**: `src/constants.ts`, `src/core/backup/types.ts` (NEW)
**Est**: 5 minutes

**Steps**:

1. Edit `src/constants.ts`:
   - Change line 98: `export const MAX_BACKUPS = 5;` → `export const MAX_BACKUPS = 50;`
   - Append after `BACKUPS_DIR`:

     ```typescript
     /** Directories under .codi/ that are NEVER walked by the backup snapshotter.
      *  Exact-prefix match: a path is excluded iff it equals an entry exactly OR
      *  begins with `<entry>/`. Single source of truth — every walker that
      *  recurses .codi/ MUST import this list. */
     export const BACKUP_EXCLUDE_DIRS: readonly string[] = [
       ".codi/backups",
       ".codi/.session",
       ".codi/feedback",
     ] as const;

     /** Standardised abort message when a destructive op cannot proceed because
      *  retention is full and the user declined to delete any backup. Callers
      *  emit this verbatim so log scrapers and tests can match it reliably. */
     export const RETENTION_CANCELLED_ERROR =
       "Backup retention is full and no backups were deleted.\n" +
       "Cannot proceed without a recoverable snapshot.\n" +
       "Run `codi backup --list` to inspect existing backups, or run\n" +
       "`codi backup --prune` to interactively delete some, then retry.";
     ```

2. Create `src/core/backup/types.ts`:

   ```typescript
   import type { Result } from "#src/types/result.js";

   export type BackupTrigger =
     | "init-first-time"
     | "init-customize"
     | "generate"
     | "update"
     | "preset-install"
     | "clean-reset"
     | "pre-revert";

   export type BackupScope = "source" | "output";

   export type RetentionStrategy = "auto" | "interactive" | "evict-oldest";

   export interface SnapshotOptions {
     trigger: BackupTrigger;
     /** Capture generated agent files (default: true). */
     includeOutput?: boolean;
     /** Capture .codi/ source dir (default: false). */
     includeSource?: boolean;
     /** Probe ALL_ADAPTERS target paths for files NOT in state.json (default: false). */
     includePreExisting?: boolean;
     /** Retention strategy when at MAX_BACKUPS. Default: "auto". */
     retention?: RetentionStrategy;
   }

   export interface BackupManifestEntry {
     /** Path relative to projectRoot. Mirrored into <backupDir>/<path> on disk. */
     path: string;
     scope: BackupScope;
     /** True when the file existed at an adapter target path BEFORE codi tracked it. */
     preExisting?: boolean;
     /** True when this file was about to be deleted by orphan logic in the same operation. */
     deleted?: boolean;
   }

   export interface BackupManifestV2 {
     version: 2;
     /** ISO 8601 with `.toISOString().replace(/[:.]/g, "-")`: e.g. "2026-04-30T19-20-15-123Z". */
     timestamp: string;
     trigger: BackupTrigger;
     codiVersion: string;
     files: BackupManifestEntry[];
   }

   /** Returned from openBackup so callers can append additional files mid-operation. */
   export interface BackupHandle {
     /** Absolute path to the backup directory under .codi/backups/. */
     readonly dir: string;
     /** Backup timestamp / ID. */
     readonly timestamp: string;
     /** Append additional files to this open backup. Idempotent on duplicate paths. */
     append(
       paths: readonly string[],
       scope: BackupScope,
       opts?: { deleted?: boolean; preExisting?: boolean },
     ): Promise<void>;
     /** Finalise: write manifest.json LAST as commit marker. After this the backup is sealed. */
     finalise(): Promise<void>;
     /** Abort: remove the partial backup directory. Used in finally blocks on error. */
     abort(): Promise<void>;
   }

   /** Result error variants returned by openBackup. */
   export type OpenBackupError = "retention-cancelled" | "no-files-to-snapshot" | "io-error";

   export type OpenBackupResult = Result<BackupHandle, OpenBackupError>;
   ```

**Verification**:

```bash
pnpm lint                # tsc --noEmit must pass — types must be valid
```

**Do NOT commit. Continue to Task 2.**

---

## Phase 2 — Backup helpers

### Task 2: Backup file collectors (source + pre-existing)

**Files**: `src/core/backup/backup-collectors.ts` (NEW), `tests/unit/core/backup/backup-collectors.test.ts` (NEW)
**Est**: 10 minutes

**Steps**:

1. Write failing test in `tests/unit/core/backup/backup-collectors.test.ts`:

   ```typescript
   import { describe, it, expect, beforeEach, afterEach } from "vitest";
   import fs from "node:fs/promises";
   import path from "node:path";
   import os from "node:os";
   import { cleanupTmpDir } from "#tests/helpers/fs.js";
   import {
     collectSourceFiles,
     collectPreExistingFiles,
   } from "#src/core/backup/backup-collectors.js";
   import { PROJECT_NAME, PROJECT_DIR } from "#src/constants.js";

   describe("collectSourceFiles", () => {
     let tmp: string;
     beforeEach(async () => {
       tmp = await fs.mkdtemp(path.join(os.tmpdir(), `${PROJECT_NAME}-bc-`));
     });
     afterEach(() => cleanupTmpDir(tmp));

     it("walks .codi/ recursively and returns relative paths", async () => {
       const cfg = path.join(tmp, PROJECT_DIR);
       await fs.mkdir(path.join(cfg, "rules"), { recursive: true });
       await fs.writeFile(path.join(cfg, "codi.yaml"), "name: t\n");
       await fs.writeFile(path.join(cfg, "rules", "a.md"), "# a\n");
       const files = await collectSourceFiles(tmp);
       expect(files.sort()).toEqual([".codi/codi.yaml", ".codi/rules/a.md"]);
     });

     it("excludes .codi/backups/, .codi/.session/, .codi/feedback/ recursively", async () => {
       const cfg = path.join(tmp, PROJECT_DIR);
       await fs.mkdir(path.join(cfg, "backups", "old"), { recursive: true });
       await fs.mkdir(path.join(cfg, ".session"), { recursive: true });
       await fs.mkdir(path.join(cfg, "feedback", "deep"), { recursive: true });
       await fs.writeFile(path.join(cfg, "codi.yaml"), "name: t\n");
       await fs.writeFile(path.join(cfg, "backups", "old", "x.md"), "x");
       await fs.writeFile(path.join(cfg, ".session", "active.json"), "{}");
       await fs.writeFile(path.join(cfg, "feedback", "deep", "f.json"), "{}");
       const files = await collectSourceFiles(tmp);
       expect(files).toEqual([".codi/codi.yaml"]);
     });

     it("does NOT exclude similarly-named dirs (.codi/feedback-archive/)", async () => {
       const cfg = path.join(tmp, PROJECT_DIR);
       await fs.mkdir(path.join(cfg, "feedback-archive"), { recursive: true });
       await fs.writeFile(path.join(cfg, "feedback-archive", "x.md"), "x");
       const files = await collectSourceFiles(tmp);
       expect(files).toContain(".codi/feedback-archive/x.md");
     });
   });

   describe("collectPreExistingFiles", () => {
     let tmp: string;
     beforeEach(async () => {
       tmp = await fs.mkdtemp(path.join(os.tmpdir(), `${PROJECT_NAME}-bp-`));
     });
     afterEach(() => cleanupTmpDir(tmp));

     it("returns CLAUDE.md and AGENTS.md at the repo root when present and not in state", async () => {
       await fs.writeFile(path.join(tmp, "CLAUDE.md"), "# user-written\n");
       await fs.writeFile(path.join(tmp, "AGENTS.md"), "# user-written\n");
       const files = await collectPreExistingFiles(tmp, {});
       expect(files.sort()).toContain("CLAUDE.md");
       expect(files).toContain("AGENTS.md");
     });

     it("excludes files already tracked in state.agents", async () => {
       await fs.writeFile(path.join(tmp, "CLAUDE.md"), "# tracked\n");
       const files = await collectPreExistingFiles(tmp, {
         "claude-code": [{ path: "CLAUDE.md" }],
       });
       expect(files).not.toContain("CLAUDE.md");
     });
   });
   ```

2. Verify tests fail: `pnpm test tests/unit/core/backup/backup-collectors` — expect "Cannot find module".

3. Implement `src/core/backup/backup-collectors.ts`:

   ```typescript
   import fs from "node:fs/promises";
   import path from "node:path";
   import { PROJECT_DIR, BACKUP_EXCLUDE_DIRS } from "#src/constants.js";
   import { ALL_ADAPTERS } from "#src/core/generator/adapter-registry.js";

   /** True iff the given relative path is inside an excluded directory. */
   function isExcluded(relPath: string): boolean {
     for (const dir of BACKUP_EXCLUDE_DIRS) {
       if (relPath === dir || relPath.startsWith(`${dir}/`)) return true;
     }
     return false;
   }

   /** Walk .codi/ recursively, returning relative paths (POSIX-style) of every
    *  file that should be captured under the "source" scope. */
   export async function collectSourceFiles(projectRoot: string): Promise<string[]> {
     const out: string[] = [];
     const cfgRoot = path.join(projectRoot, PROJECT_DIR);

     async function walk(dirAbs: string): Promise<void> {
       const rel = path.relative(projectRoot, dirAbs).split(path.sep).join("/");
       if (isExcluded(rel)) return;
       let entries;
       try {
         entries = await fs.readdir(dirAbs, { withFileTypes: true });
       } catch {
         return;
       }
       for (const entry of entries) {
         const childAbs = path.join(dirAbs, entry.name);
         const childRel = path.relative(projectRoot, childAbs).split(path.sep).join("/");
         if (isExcluded(childRel)) continue;
         if (entry.isDirectory()) {
           await walk(childAbs);
         } else if (entry.isFile()) {
           out.push(childRel);
         }
       }
     }

     await walk(cfgRoot);
     return out;
   }

   interface StateAgents {
     [agentId: string]: ReadonlyArray<{ path: string }>;
   }

   /** Probe ALL_ADAPTERS target paths for files that exist on disk but are NOT
    *  recorded in state.agents. These are user-written files codi never tracked
    *  (e.g. a hand-written CLAUDE.md before first init).
    *
    *  Walked paths per adapter:
    *    - paths.instructionFile (top-level file)
    *    - paths.mcpConfig       (top-level file)
    *    - paths.configRoot, paths.rules, paths.skills, paths.agents
    *      (directories — files at one level deep, no recursion)
    */
   export async function collectPreExistingFiles(
     projectRoot: string,
     stateAgents: StateAgents,
   ): Promise<string[]> {
     const trackedPaths = new Set<string>();
     for (const files of Object.values(stateAgents)) {
       for (const f of files) trackedPaths.add(f.path);
     }

     const candidates = new Set<string>();

     for (const adapter of ALL_ADAPTERS) {
       const p = adapter.paths;
       const fileFields = [p.instructionFile, p.mcpConfig].filter((x): x is string => Boolean(x));
       for (const f of fileFields) candidates.add(f);

       const dirFields = [p.configRoot, p.rules, p.skills, p.agents].filter(
         (x): x is string => Boolean(x) && x !== ".",
       );
       for (const d of dirFields) {
         const dirAbs = path.resolve(projectRoot, d);
         try {
           const entries = await fs.readdir(dirAbs, { withFileTypes: true });
           for (const entry of entries) {
             if (!entry.isFile()) continue;
             const rel = path.posix.join(d, entry.name);
             candidates.add(rel);
           }
         } catch {
           // dir doesn't exist — nothing to capture
         }
       }
     }

     const present: string[] = [];
     for (const candidate of candidates) {
       if (trackedPaths.has(candidate)) continue;
       const abs = path.resolve(projectRoot, candidate);
       try {
         const stat = await fs.stat(abs);
         if (stat.isFile()) present.push(candidate);
       } catch {
         // not on disk — skip
       }
     }

     return present.sort();
   }
   ```

4. Verify tests pass: `pnpm test tests/unit/core/backup/backup-collectors` — expect "6 passing".

**Do NOT commit. Continue to Task 3.**

---

### Task 3: Manifest reader (v1 + v2 shim) and writer

**Files**: `src/core/backup/backup-manifest.ts` (NEW), `tests/unit/core/backup/backup-manifest.test.ts` (NEW)
**Est**: 10 minutes

**Steps**:

1. Write failing test:

   ```typescript
   import { describe, it, expect, beforeEach, afterEach } from "vitest";
   import fs from "node:fs/promises";
   import path from "node:path";
   import os from "node:os";
   import { cleanupTmpDir } from "#tests/helpers/fs.js";
   import { readManifest, writeManifest } from "#src/core/backup/backup-manifest.js";

   describe("manifest read/write", () => {
     let tmp: string;
     beforeEach(async () => {
       tmp = await fs.mkdtemp(path.join(os.tmpdir(), "codi-bm-"));
     });
     afterEach(() => cleanupTmpDir(tmp));

     it("writes a v2 manifest with all required fields", async () => {
       await writeManifest(tmp, {
         version: 2,
         timestamp: "2026-04-30T19-20-15-123Z",
         trigger: "init-customize",
         codiVersion: "2.14.2",
         files: [
           { path: ".codi/rules/x.md", scope: "source" },
           { path: "CLAUDE.md", scope: "output", preExisting: true },
         ],
       });
       const m = await readManifest(tmp);
       expect(m.ok).toBe(true);
       if (!m.ok) return;
       expect(m.data.version).toBe(2);
       expect(m.data.trigger).toBe("init-customize");
       expect(m.data.files).toHaveLength(2);
     });

     it("reads a legacy v1 manifest as v2 with scope=output, trigger=generate", async () => {
       await fs.writeFile(
         path.join(tmp, "backup-manifest.json"),
         JSON.stringify({
           timestamp: "2026-04-29T10-00-00-000Z",
           files: ["CLAUDE.md", ".cursor/rules/a.md"],
         }),
       );
       const m = await readManifest(tmp);
       expect(m.ok).toBe(true);
       if (!m.ok) return;
       expect(m.data.version).toBe(2);
       expect(m.data.trigger).toBe("generate");
       expect(m.data.codiVersion).toBe("<unknown>");
       expect(m.data.files).toEqual([
         { path: "CLAUDE.md", scope: "output" },
         { path: ".cursor/rules/a.md", scope: "output" },
       ]);
     });

     it("returns Err when manifest is missing", async () => {
       const m = await readManifest(tmp);
       expect(m.ok).toBe(false);
       if (m.ok) return;
       expect(m.error).toBe("incomplete");
     });

     it("returns Err when manifest JSON is malformed", async () => {
       await fs.writeFile(path.join(tmp, "backup-manifest.json"), "not json");
       const m = await readManifest(tmp);
       expect(m.ok).toBe(false);
     });
   });
   ```

2. Verify tests fail: `pnpm test tests/unit/core/backup/backup-manifest` — expect "Cannot find module".

3. Implement `src/core/backup/backup-manifest.ts`:

   ```typescript
   import fs from "node:fs/promises";
   import path from "node:path";
   import { BACKUP_MANIFEST_FILENAME } from "#src/constants.js";
   import type { Result } from "#src/types/result.js";
   import { ok, err } from "#src/types/result.js";
   import type { BackupManifestV2, BackupManifestEntry } from "#src/core/backup/types.js";

   export type ManifestReadError = "incomplete" | "malformed";

   /** Read a backup manifest, transparently upgrading v1 manifests on the fly.
    *  Never mutates the on-disk file. */
   export async function readManifest(
     backupDir: string,
   ): Promise<Result<BackupManifestV2, ManifestReadError>> {
     const manifestPath = path.join(backupDir, BACKUP_MANIFEST_FILENAME);
     let raw: string;
     try {
       raw = await fs.readFile(manifestPath, "utf8");
     } catch {
       return err("incomplete");
     }
     let parsed: unknown;
     try {
       parsed = JSON.parse(raw);
     } catch {
       return err("malformed");
     }
     if (!parsed || typeof parsed !== "object") return err("malformed");

     const candidate = parsed as Record<string, unknown>;
     if (candidate.version === 2) {
       // Trust the on-disk shape; downstream type-checking handles invalid entries.
       return ok(candidate as unknown as BackupManifestV2);
     }

     // Legacy v1: { timestamp, files: string[] }
     if (typeof candidate.timestamp !== "string" || !Array.isArray(candidate.files)) {
       return err("malformed");
     }
     const files: BackupManifestEntry[] = candidate.files
       .filter((p): p is string => typeof p === "string")
       .map((p) => ({ path: p, scope: "output" as const }));

     return ok({
       version: 2,
       timestamp: candidate.timestamp,
       trigger: "generate",
       codiVersion: "<unknown>",
       files,
     });
   }

   /** Write a v2 manifest. Caller is responsible for ordering — manifest should
    *  be the LAST file written so its presence acts as a commit marker. */
   export async function writeManifest(
     backupDir: string,
     manifest: BackupManifestV2,
   ): Promise<void> {
     const manifestPath = path.join(backupDir, BACKUP_MANIFEST_FILENAME);
     await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
   }
   ```

4. Verify tests pass: `pnpm test tests/unit/core/backup/backup-manifest` — expect "4 passing".

**Do NOT commit.**

---

### Task 4: Retention helpers (pruneIncompleteBackups + evictOldest)

**Files**: `src/core/backup/backup-retention.ts` (NEW), `tests/unit/core/backup/backup-retention.test.ts` (NEW)
**Est**: 8 minutes

**Steps**:

1. Write failing test:

   ```typescript
   import { describe, it, expect, beforeEach, afterEach } from "vitest";
   import fs from "node:fs/promises";
   import path from "node:path";
   import os from "node:os";
   import { cleanupTmpDir } from "#tests/helpers/fs.js";
   import {
     listSealedBackups,
     pruneIncompleteBackups,
     evictOldest,
   } from "#src/core/backup/backup-retention.js";
   import { BACKUP_MANIFEST_FILENAME } from "#src/constants.js";

   async function mkBackup(root: string, ts: string, sealed: boolean): Promise<void> {
     const dir = path.join(root, ts);
     await fs.mkdir(dir, { recursive: true });
     await fs.writeFile(path.join(dir, "CLAUDE.md"), "test\n");
     if (sealed) {
       await fs.writeFile(
         path.join(dir, BACKUP_MANIFEST_FILENAME),
         JSON.stringify({
           version: 2,
           timestamp: ts,
           trigger: "generate",
           codiVersion: "x",
           files: [],
         }),
       );
     }
   }

   describe("backup-retention", () => {
     let tmp: string;
     beforeEach(async () => {
       tmp = await fs.mkdtemp(path.join(os.tmpdir(), "codi-br-"));
     });
     afterEach(() => cleanupTmpDir(tmp));

     it("listSealedBackups returns only directories with manifest.json, sorted oldest-first", async () => {
       await mkBackup(tmp, "2026-04-30T10-00-00-000Z", true);
       await mkBackup(tmp, "2026-04-30T11-00-00-000Z", false); // unsealed
       await mkBackup(tmp, "2026-04-30T09-00-00-000Z", true);
       const backups = await listSealedBackups(tmp);
       expect(backups.map((b) => b.timestamp)).toEqual([
         "2026-04-30T09-00-00-000Z",
         "2026-04-30T10-00-00-000Z",
       ]);
     });

     it("pruneIncompleteBackups removes unsealed backup directories", async () => {
       await mkBackup(tmp, "2026-04-30T10-00-00-000Z", true);
       await mkBackup(tmp, "2026-04-30T11-00-00-000Z", false);
       await pruneIncompleteBackups(tmp);
       const remaining = await fs.readdir(tmp);
       expect(remaining).toEqual(["2026-04-30T10-00-00-000Z"]);
     });

     it("evictOldest removes the oldest sealed backup and returns its timestamp", async () => {
       await mkBackup(tmp, "2026-04-30T10-00-00-000Z", true);
       await mkBackup(tmp, "2026-04-30T11-00-00-000Z", true);
       await mkBackup(tmp, "2026-04-30T09-00-00-000Z", true);
       const evicted = await evictOldest(tmp);
       expect(evicted).toBe("2026-04-30T09-00-00-000Z");
       const remaining = await fs.readdir(tmp);
       expect(remaining.sort()).toEqual(["2026-04-30T10-00-00-000Z", "2026-04-30T11-00-00-000Z"]);
     });

     it("evictOldest returns null when there are no sealed backups", async () => {
       expect(await evictOldest(tmp)).toBeNull();
     });
   });
   ```

2. Verify failing: `pnpm test tests/unit/core/backup/backup-retention` — expect import error.

3. Implement `src/core/backup/backup-retention.ts`:

   ```typescript
   import fs from "node:fs/promises";
   import path from "node:path";
   import { BACKUP_MANIFEST_FILENAME } from "#src/constants.js";
   import { safeRm } from "#src/utils/fs.js";
   import { readManifest } from "#src/core/backup/backup-manifest.js";
   import type { BackupManifestV2 } from "#src/core/backup/types.js";

   export interface SealedBackup {
     timestamp: string;
     dir: string;
     manifest: BackupManifestV2;
   }

   /** Lists backup directories that have a finalised manifest.json.
    *  Sorted oldest-first by timestamp. Skips unsealed dirs silently. */
   export async function listSealedBackups(backupsRoot: string): Promise<SealedBackup[]> {
     let entries;
     try {
       entries = await fs.readdir(backupsRoot, { withFileTypes: true });
     } catch {
       return [];
     }
     const out: SealedBackup[] = [];
     for (const entry of entries) {
       if (!entry.isDirectory()) continue;
       const dir = path.join(backupsRoot, entry.name);
       const m = await readManifest(dir);
       if (!m.ok) continue;
       out.push({ timestamp: entry.name, dir, manifest: m.data });
     }
     out.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
     return out;
   }

   /** Removes any backup directory that lacks a finalised manifest.json.
    *  Idempotent. Safe to call at the start of every openBackup. */
   export async function pruneIncompleteBackups(backupsRoot: string): Promise<string[]> {
     let entries;
     try {
       entries = await fs.readdir(backupsRoot, { withFileTypes: true });
     } catch {
       return [];
     }
     const removed: string[] = [];
     for (const entry of entries) {
       if (!entry.isDirectory()) continue;
       const dir = path.join(backupsRoot, entry.name);
       const manifestExists = await fs
         .stat(path.join(dir, BACKUP_MANIFEST_FILENAME))
         .then(() => true)
         .catch(() => false);
       if (!manifestExists) {
         await safeRm(dir);
         removed.push(entry.name);
       }
     }
     return removed;
   }

   /** Removes the oldest sealed backup. Returns its timestamp, or null if none. */
   export async function evictOldest(backupsRoot: string): Promise<string | null> {
     const sealed = await listSealedBackups(backupsRoot);
     if (sealed.length === 0) return null;
     const oldest = sealed[0]!;
     await safeRm(oldest.dir);
     return oldest.timestamp;
   }
   ```

4. Verify passing: `pnpm test tests/unit/core/backup/backup-retention` — expect "4 passing".

**Do NOT commit.**

---

### Task 5: Interactive eviction TUI

**Files**: `src/core/backup/backup-retention.ts` (extend)
**Est**: 8 minutes

**Steps**:

1. Append to `src/core/backup/backup-retention.ts`:

   ```typescript
   import * as p from "@clack/prompts";

   /** Returns true if the user deleted ≥1 backup. False on cancel / 0-selected.
    *  When false, callers MUST abort the destructive operation. */
   export async function interactiveEvict(backupsRoot: string): Promise<boolean> {
     const sealed = await listSealedBackups(backupsRoot);
     if (sealed.length === 0) return true; // Nothing to evict, somehow under cap

     const options = sealed
       .slice()
       .reverse() // newest-first in the picker
       .map((b) => {
         const sizeKB = backupSizeApprox(b.manifest.files.length);
         const label = `${b.timestamp}  ·  ${b.manifest.trigger}  ·  ~${sizeKB} KB`;
         return { value: b.timestamp, label };
       });

     const selected = await p.multiselect({
       message: `You have ${sealed.length} backups (the maximum). ` + `Select which to delete:`,
       options,
       required: false,
     });

     if (p.isCancel(selected) || !Array.isArray(selected) || selected.length === 0) {
       return false;
     }

     const confirmFirst = await p.confirm({
       message: `Delete ${selected.length} backup(s)?`,
       initialValue: false,
     });
     if (p.isCancel(confirmFirst) || !confirmFirst) return false;

     const confirmFinal = await p.confirm({
       message: `This permanently removes the selected backups. Continue?`,
       initialValue: false,
     });
     if (p.isCancel(confirmFinal) || !confirmFinal) return false;

     for (const ts of selected as string[]) {
       await safeRm(path.join(backupsRoot, ts));
     }
     return true;
   }

   /** Rough size estimate: each manifest entry ~= 4 KB on average.
    *  Used only for display in the TUI. */
   function backupSizeApprox(fileCount: number): number {
     return Math.max(1, Math.round(fileCount * 4));
   }
   ```

2. Add a unit test for the cancellation contract (mocking `@clack/prompts`):

   ```typescript
   // Append to tests/unit/core/backup/backup-retention.test.ts
   import { vi } from "vitest";
   vi.mock("@clack/prompts", () => ({
     multiselect: vi.fn(),
     confirm: vi.fn(),
     isCancel: (v: unknown) => v === Symbol.for("clack:cancel"),
   }));

   describe("interactiveEvict", () => {
     it("returns false when user cancels at the multiselect", async () => {
       const { interactiveEvict } = await import("#src/core/backup/backup-retention.js");
       const p = await import("@clack/prompts");
       (p.multiselect as ReturnType<typeof vi.fn>).mockResolvedValue(Symbol.for("clack:cancel"));
       const tmp2 = await fs.mkdtemp(path.join(os.tmpdir(), "codi-iv-"));
       await mkBackup(tmp2, "2026-04-30T10-00-00-000Z", true);
       const result = await interactiveEvict(tmp2);
       expect(result).toBe(false);
       await cleanupTmpDir(tmp2);
     });

     it("returns false when user picks 0 backups", async () => {
       const { interactiveEvict } = await import("#src/core/backup/backup-retention.js");
       const p = await import("@clack/prompts");
       (p.multiselect as ReturnType<typeof vi.fn>).mockResolvedValue([]);
       const tmp2 = await fs.mkdtemp(path.join(os.tmpdir(), "codi-iv-"));
       await mkBackup(tmp2, "2026-04-30T10-00-00-000Z", true);
       expect(await interactiveEvict(tmp2)).toBe(false);
       await cleanupTmpDir(tmp2);
     });
   });
   ```

3. Verify: `pnpm test tests/unit/core/backup/backup-retention` — all passing.

**Do NOT commit.**

---

## Phase 3 — Lifecycle: openBackup + BackupHandle

### Task 6: Refactor backup-manager.ts to expose openBackup + BackupHandle

**Files**: `src/core/backup/backup-manager.ts` (refactor), `tests/unit/core/backup/backup-manager.test.ts` (extend)
**Est**: 15 minutes

**Steps**:

1. Read the existing `backup-manager.ts` (165 LOC). Note that `createBackup` returns `Promise<string | null>` and `listBackups` / `restoreBackup` use the v1 manifest shape. We'll keep these for backwards compat but add new lifecycle.

2. Add failing tests at the bottom of `tests/unit/core/backup/backup-manager.test.ts`:

   ```typescript
   import { openBackup } from "#src/core/backup/backup-manager.js";

   describe("openBackup → BackupHandle lifecycle", () => {
     let projectRoot: string;
     let configDir: string;
     beforeEach(async () => {
       projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codi-ob-"));
       configDir = path.join(projectRoot, ".codi");
       await fs.mkdir(configDir, { recursive: true });
       await fs.writeFile(path.join(configDir, "codi.yaml"), "name: t\nversion: '1'\nagents: []\n");
       Logger.init({ level: "error", mode: "human", noColor: true });
     });
     afterEach(() => cleanupTmpDir(projectRoot));

     it("openBackup with includeSource captures .codi/ files", async () => {
       const r = await openBackup(projectRoot, configDir, {
         trigger: "init-customize",
         includeSource: true,
       });
       expect(r.ok).toBe(true);
       if (!r.ok) return;
       const handle = r.data;
       expect(await fs.stat(path.join(handle.dir, ".codi", "codi.yaml"))).toBeDefined();
       await handle.finalise();
       const manifest = JSON.parse(
         await fs.readFile(path.join(handle.dir, BACKUP_MANIFEST_FILENAME), "utf8"),
       );
       expect(manifest.version).toBe(2);
       expect(manifest.trigger).toBe("init-customize");
       expect(
         manifest.files.some((f: any) => f.path === ".codi/codi.yaml" && f.scope === "source"),
       ).toBe(true);
     });

     it("handle.append adds files mid-operation", async () => {
       await fs.writeFile(path.join(projectRoot, "CLAUDE.md"), "stale\n");
       const r = await openBackup(projectRoot, configDir, {
         trigger: "init-customize",
         includeSource: true,
       });
       expect(r.ok).toBe(true);
       if (!r.ok) return;
       const handle = r.data;
       await handle.append(["CLAUDE.md"], "output", { deleted: true });
       await handle.finalise();
       const manifest = JSON.parse(
         await fs.readFile(path.join(handle.dir, BACKUP_MANIFEST_FILENAME), "utf8"),
       );
       const claudeEntry = manifest.files.find((f: any) => f.path === "CLAUDE.md");
       expect(claudeEntry).toEqual({
         path: "CLAUDE.md",
         scope: "output",
         deleted: true,
       });
       expect(await fs.stat(path.join(handle.dir, "CLAUDE.md"))).toBeDefined();
     });

     it("handle.abort removes the partial backup", async () => {
       const r = await openBackup(projectRoot, configDir, {
         trigger: "init-customize",
         includeSource: true,
       });
       expect(r.ok).toBe(true);
       if (!r.ok) return;
       const handle = r.data;
       const dir = handle.dir;
       await handle.abort();
       const exists = await fs.stat(dir).catch(() => null);
       expect(exists).toBeNull();
     });

     it("manifest is NOT present until finalise is called", async () => {
       const r = await openBackup(projectRoot, configDir, {
         trigger: "init-customize",
         includeSource: true,
       });
       expect(r.ok).toBe(true);
       if (!r.ok) return;
       const handle = r.data;
       const before = await fs
         .stat(path.join(handle.dir, BACKUP_MANIFEST_FILENAME))
         .catch(() => null);
       expect(before).toBeNull();
       await handle.finalise();
       const after = await fs
         .stat(path.join(handle.dir, BACKUP_MANIFEST_FILENAME))
         .catch(() => null);
       expect(after).not.toBeNull();
     });

     it("retention: evict-oldest deletes oldest when at MAX_BACKUPS", async () => {
       // Create MAX_BACKUPS sealed backups manually
       const backupsRoot = path.join(configDir, "backups");
       await fs.mkdir(backupsRoot, { recursive: true });
       const { MAX_BACKUPS } = await import("#src/constants.js");
       for (let i = 0; i < MAX_BACKUPS; i++) {
         const ts = `2026-04-${String(i + 1).padStart(2, "0")}T00-00-00-000Z`;
         await fs.mkdir(path.join(backupsRoot, ts));
         await fs.writeFile(
           path.join(backupsRoot, ts, BACKUP_MANIFEST_FILENAME),
           JSON.stringify({
             version: 2,
             timestamp: ts,
             trigger: "generate",
             codiVersion: "x",
             files: [],
           }),
         );
       }
       const r = await openBackup(projectRoot, configDir, {
         trigger: "generate",
         includeSource: true,
         retention: "evict-oldest",
       });
       expect(r.ok).toBe(true);
       if (!r.ok) return;
       await r.data.finalise();
       const remaining = await fs.readdir(backupsRoot);
       expect(remaining.length).toBe(MAX_BACKUPS); // one evicted, one new
       expect(remaining).not.toContain("2026-04-01T00-00-00-000Z");
     });
   });
   ```

3. Verify failing: `pnpm test tests/unit/core/backup/backup-manager` — `openBackup` is not yet exported.

4. Refactor `src/core/backup/backup-manager.ts`. Replace the file contents with:

   ```typescript
   import fs from "node:fs/promises";
   import path from "node:path";
   import { isPathSafe } from "#src/utils/path-guard.js";
   import { fileExists, safeRm } from "#src/utils/fs.js";
   import {
     STATE_FILENAME,
     BACKUPS_DIR,
     BACKUP_MANIFEST_FILENAME,
     MAX_BACKUPS,
   } from "#src/constants.js";
   import { VERSION } from "#src/index.js";
   import { readManifest, writeManifest } from "#src/core/backup/backup-manifest.js";
   import {
     listSealedBackups,
     pruneIncompleteBackups,
     evictOldest,
     interactiveEvict,
   } from "#src/core/backup/backup-retention.js";
   import {
     collectSourceFiles,
     collectPreExistingFiles,
   } from "#src/core/backup/backup-collectors.js";
   import type { Result } from "#src/types/result.js";
   import { ok, err } from "#src/types/result.js";
   import type {
     SnapshotOptions,
     BackupHandle,
     BackupManifestEntry,
     BackupManifestV2,
     BackupScope,
     RetentionStrategy,
     OpenBackupResult,
   } from "#src/core/backup/types.js";

   /** ── Public lifecycle API ─────────────────────────────────────────── */

   export async function openBackup(
     projectRoot: string,
     configDir: string,
     opts: SnapshotOptions,
   ): Promise<OpenBackupResult> {
     const includeOutput = opts.includeOutput ?? true;
     const includeSource = opts.includeSource ?? false;
     const includePreExisting = opts.includePreExisting ?? false;
     const retention = opts.retention ?? "auto";

     const backupsRoot = path.join(configDir, BACKUPS_DIR);
     await fs.mkdir(backupsRoot, { recursive: true });

     // Always sweep partial backups before counting against the cap.
     await pruneIncompleteBackups(backupsRoot);

     // Resolve retention: evict if at cap.
     const evicted = await applyRetention(backupsRoot, retention);
     if (evicted === "cancelled") return err("retention-cancelled");

     // Compute initial file set.
     const initialFiles = await computeInitialFiles(projectRoot, configDir, {
       includeOutput,
       includeSource,
       includePreExisting,
     });

     if (initialFiles.length === 0 && !includePreExisting) {
       // No existing files to capture and no pre-existing probe — skip.
       return err("no-files-to-snapshot");
     }

     // Create the timestamped directory.
     const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
     const dir = path.join(backupsRoot, timestamp);
     await fs.mkdir(dir, { recursive: true });

     // Copy initial files. NO manifest yet.
     const entries: BackupManifestEntry[] = [];
     try {
       for (const f of initialFiles) {
         await copyOne(projectRoot, dir, f.path);
         entries.push(f);
       }
     } catch (cause) {
       await safeRm(dir);
       return err("io-error");
     }

     // Build the handle.
     const seenPaths = new Set(entries.map((e) => e.path));
     const handle: BackupHandle = {
       dir,
       timestamp,
       async append(paths, scope, flags) {
         for (const p of paths) {
           if (seenPaths.has(p)) continue;
           if (!isPathSafe(projectRoot, p)) continue;
           const exists = await fileExists(path.resolve(projectRoot, p));
           if (!exists) continue;
           await copyOne(projectRoot, dir, p);
           const entry: BackupManifestEntry = { path: p, scope };
           if (flags?.deleted) entry.deleted = true;
           if (flags?.preExisting) entry.preExisting = true;
           entries.push(entry);
           seenPaths.add(p);
         }
       },
       async finalise() {
         const manifest: BackupManifestV2 = {
           version: 2,
           timestamp,
           trigger: opts.trigger,
           codiVersion: VERSION,
           files: entries,
         };
         await writeManifest(dir, manifest);
       },
       async abort() {
         await safeRm(dir);
       },
     };
     return ok(handle);
   }

   /** ── Legacy single-shot API (kept for backwards compat) ────────────── */

   export async function createBackup(
     projectRoot: string,
     configDir: string,
   ): Promise<string | null> {
     const r = await openBackup(projectRoot, configDir, {
       trigger: "generate",
       includeOutput: true,
     });
     if (!r.ok) return null;
     await r.data.finalise();
     return r.data.timestamp;
   }

   /** ── Listing + restore (read paths) ────────────────────────────────── */

   export interface BackupInfo {
     timestamp: string;
     fileCount: number;
   }

   export async function listBackups(configDir: string): Promise<BackupInfo[]> {
     const backupsRoot = path.join(configDir, BACKUPS_DIR);
     const sealed = await listSealedBackups(backupsRoot);
     return sealed
       .map((b) => ({ timestamp: b.timestamp, fileCount: b.manifest.files.length }))
       .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
   }

   export async function restoreBackup(
     projectRoot: string,
     configDir: string,
     timestamp: string,
   ): Promise<string[]> {
     const backupDir = path.join(configDir, BACKUPS_DIR, timestamp);
     const m = await readManifest(backupDir);
     if (!m.ok) return [];
     const restored: string[] = [];
     for (const entry of m.data.files) {
       if (!isPathSafe(projectRoot, entry.path)) continue;
       const sourcePath = path.join(backupDir, entry.path);
       const destPath = path.resolve(projectRoot, entry.path);
       await fs.mkdir(path.dirname(destPath), { recursive: true });
       try {
         await fs.copyFile(sourcePath, destPath);
         restored.push(entry.path);
       } catch {
         // skip files that didn't make it into the backup (e.g. orphan-deleted)
       }
     }
     return restored;
   }

   /** ── Internal helpers ─────────────────────────────────────────────── */

   interface InitialFilesOpts {
     includeOutput: boolean;
     includeSource: boolean;
     includePreExisting: boolean;
   }

   async function computeInitialFiles(
     projectRoot: string,
     configDir: string,
     opts: InitialFilesOpts,
   ): Promise<BackupManifestEntry[]> {
     const out: BackupManifestEntry[] = [];

     // Output scope: read state.json
     let stateData: { agents: Record<string, Array<{ path: string }>> } = { agents: {} };
     const statePath = path.join(configDir, STATE_FILENAME);
     if (await fileExists(statePath)) {
       try {
         const raw = await fs.readFile(statePath, "utf8");
         stateData = JSON.parse(raw) as typeof stateData;
       } catch {
         stateData = { agents: {} };
       }
     }
     if (opts.includeOutput) {
       const seen = new Set<string>();
       for (const files of Object.values(stateData.agents)) {
         for (const file of files) {
           if (seen.has(file.path)) continue;
           seen.add(file.path);
           if (!isPathSafe(projectRoot, file.path)) continue;
           if (await fileExists(path.resolve(projectRoot, file.path))) {
             out.push({ path: file.path, scope: "output" });
           }
         }
       }
     }

     // Source scope: walk .codi/
     if (opts.includeSource) {
       const sourceFiles = await collectSourceFiles(projectRoot);
       for (const p of sourceFiles) {
         out.push({ path: p, scope: "source" });
       }
     }

     // Pre-existing scope: probe adapter target paths
     if (opts.includePreExisting) {
       const pre = await collectPreExistingFiles(projectRoot, stateData.agents);
       for (const p of pre) {
         // Don't double-count if already in output scope (state-tracked).
         if (out.some((e) => e.path === p && e.scope === "output")) continue;
         out.push({ path: p, scope: "output", preExisting: true });
       }
     }

     return out;
   }

   async function copyOne(projectRoot: string, backupDir: string, relPath: string): Promise<void> {
     const src = path.resolve(projectRoot, relPath);
     const dest = path.join(backupDir, relPath);
     await fs.mkdir(path.dirname(dest), { recursive: true });
     await fs.copyFile(src, dest);
   }

   async function applyRetention(
     backupsRoot: string,
     strategy: RetentionStrategy,
   ): Promise<"ok" | "cancelled"> {
     const sealed = await listSealedBackups(backupsRoot);
     if (sealed.length < MAX_BACKUPS) return "ok";

     const resolved =
       strategy === "auto" ? (process.stdout.isTTY ? "interactive" : "evict-oldest") : strategy;

     if (resolved === "evict-oldest") {
       await evictOldest(backupsRoot);
       return "ok";
     }
     // interactive
     const ok = await interactiveEvict(backupsRoot);
     return ok ? "ok" : "cancelled";
   }
   ```

5. Verify all backup-manager tests pass: `pnpm test tests/unit/core/backup` — expect "all passing".

**Do NOT commit.**

---

## Phase 4 — apply.ts integration

### Task 7: pruneEmptyAdapterDirs helper

**Files**: `src/core/generator/prune-empty-adapter-dirs.ts` (NEW), `tests/unit/core/generator/prune-empty-adapter-dirs.test.ts` (NEW)
**Est**: 8 minutes

**Steps**:

1. Write failing test:

   ```typescript
   import { describe, it, expect, beforeEach, afterEach } from "vitest";
   import fs from "node:fs/promises";
   import path from "node:path";
   import os from "node:os";
   import { cleanupTmpDir } from "#tests/helpers/fs.js";
   import { pruneEmptyAdapterDirs } from "#src/core/generator/prune-empty-adapter-dirs.js";

   describe("pruneEmptyAdapterDirs", () => {
     let projectRoot: string;
     beforeEach(async () => {
       projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codi-prune-"));
     });
     afterEach(() => cleanupTmpDir(projectRoot));

     it("removes empty .cursor/rules/ then .cursor/ when cursor is unselected", async () => {
       await fs.mkdir(path.join(projectRoot, ".cursor", "rules"), { recursive: true });
       await fs.mkdir(path.join(projectRoot, ".cursor", "skills"), { recursive: true });
       const removed = await pruneEmptyAdapterDirs(projectRoot, [], ["cursor"]);
       expect(removed).toContain(".cursor/rules");
       expect(removed).toContain(".cursor/skills");
       expect(removed).toContain(".cursor");
       const exists = await fs.stat(path.join(projectRoot, ".cursor")).catch(() => null);
       expect(exists).toBeNull();
     });

     it("leaves .cursor/ alone when a user file sits inside", async () => {
       await fs.mkdir(path.join(projectRoot, ".cursor", "rules"), { recursive: true });
       await fs.writeFile(path.join(projectRoot, ".cursor", "notes.md"), "user\n");
       const removed = await pruneEmptyAdapterDirs(projectRoot, [], ["cursor"]);
       expect(removed).toContain(".cursor/rules");
       expect(removed).not.toContain(".cursor");
       const exists = await fs.stat(path.join(projectRoot, ".cursor")).catch(() => null);
       expect(exists).not.toBeNull();
     });

     it("walks parents of deleted file paths", async () => {
       await fs.mkdir(path.join(projectRoot, ".claude", "rules"), { recursive: true });
       const removed = await pruneEmptyAdapterDirs(projectRoot, [".claude/rules/foo.md"], []);
       expect(removed).toContain(".claude/rules");
       expect(removed).toContain(".claude");
     });

     it("refuses to remove paths outside projectRoot", async () => {
       const removed = await pruneEmptyAdapterDirs(projectRoot, ["../escape.md"], []);
       expect(removed).toEqual([]);
     });
   });
   ```

2. Verify failing: `pnpm test tests/unit/core/generator/prune-empty-adapter-dirs` — expect import error.

3. Implement `src/core/generator/prune-empty-adapter-dirs.ts`:

   ```typescript
   import fs from "node:fs/promises";
   import path from "node:path";
   import { ALL_ADAPTERS } from "#src/core/generator/adapter-registry.js";
   import { isPathSafe } from "#src/utils/path-guard.js";

   /** Removes empty directories left behind after orphan deletion / agent unselect.
    *
    *  Candidates come from:
    *    1. Parent directories of every entry in `deletedPaths`, walking up.
    *    2. Adapter root dirs (configRoot, rules, skills, agents) for every
    *       agentId in `removedAgentIds`.
    *
    *  Sort deepest-first, then `fs.rmdir` each. Non-empty dirs fail harmlessly
    *  (ENOTEMPTY) — user content always wins.
    *
    *  Returns the relative paths that were actually removed. */
   export async function pruneEmptyAdapterDirs(
     projectRoot: string,
     deletedPaths: readonly string[],
     removedAgentIds: readonly string[],
   ): Promise<string[]> {
     const candidates = new Set<string>();

     // 1. Walk parents of every deleted path.
     for (const rel of deletedPaths) {
       if (!isPathSafe(projectRoot, rel)) continue;
       let current = path.posix.dirname(rel.split(path.sep).join("/"));
       while (current && current !== "." && current !== "/") {
         candidates.add(current);
         const parent = path.posix.dirname(current);
         if (parent === current) break;
         current = parent;
       }
     }

     // 2. Add adapter root dirs for removed agents.
     const adaptersById = new Map(ALL_ADAPTERS.map((a) => [a.id, a]));
     for (const agentId of removedAgentIds) {
       const adapter = adaptersById.get(agentId);
       if (!adapter) continue;
       for (const p of [
         adapter.paths.rules,
         adapter.paths.skills,
         adapter.paths.agents,
         adapter.paths.configRoot,
       ]) {
         if (!p || p === "." || p === "/") continue;
         if (!isPathSafe(projectRoot, p)) continue;
         candidates.add(p);
       }
     }

     // 3. Sort deepest-first.
     const sorted = [...candidates].sort((a, b) => b.length - a.length);

     // 4. Try to remove each. ENOTEMPTY = stop, user content present.
     const removed: string[] = [];
     for (const rel of sorted) {
       const abs = path.resolve(projectRoot, rel);
       try {
         await fs.rmdir(abs);
         removed.push(rel);
       } catch (cause: unknown) {
         const code = (cause as NodeJS.ErrnoException | undefined)?.code;
         if (code === "ENOTEMPTY" || code === "ENOENT") continue;
         // Any other error: log and continue, don't crash the whole operation.
       }
     }
     return removed;
   }
   ```

4. Verify passing: `pnpm test tests/unit/core/generator/prune-empty-adapter-dirs` — expect "4 passing".

**Do NOT commit.**

---

### Task 8: Thread BackupHandle through applyConfiguration

**Files**: `src/core/generator/apply.ts`, `tests/unit/core/generator/apply.test.ts` (or integration test if no unit test exists for apply)
**Est**: 10 minutes

**Steps**:

1. Read `src/core/generator/apply.ts` to confirm current structure.

2. Modify `applyConfiguration` signature to accept an optional `BackupHandle`:

   ```typescript
   import type { BackupHandle } from "#src/core/backup/types.js";
   import { pruneEmptyAdapterDirs } from "#src/core/generator/prune-empty-adapter-dirs.js";

   export async function applyConfiguration(
     config: NormalizedConfig,
     projectRoot: string,
     options: ApplyOptions,
     backupHandle?: BackupHandle, // NEW: optional, threaded from caller
   ): Promise<Result<ApplyResult>> {
     // ... existing code through detectOrphans
   }
   ```

3. Inside the function, after `detectOrphans` returns `orphanResult.data` and `toDelete` is computed, BEFORE calling `deleteOrphans`, append:

   ```typescript
   if (backupHandle && toDelete.length > 0) {
     await backupHandle.append(
       toDelete.map((o) => o.path),
       "output",
       { deleted: true },
     );
   }
   ```

4. After `deleteOrphans` and the `pruned` array is populated, also compute `removedAgentIds` and call `pruneEmptyAdapterDirs`:

   ```typescript
   // Detect agents that were in prevState but not in nextAgents.
   const stateResult = await stateManager.read();
   const prevAgentIds = stateResult.ok ? Object.keys(stateResult.data.agents) : [];
   const nextAgentIds = new Set(genResult.data.agents);
   const removedAgentIds = prevAgentIds.filter((id) => !nextAgentIds.has(id));

   const prunedDirs = await pruneEmptyAdapterDirs(projectRoot, pruned, removedAgentIds);
   ```

   NOTE: `stateResult` should come from BEFORE `updateAgentsBatch` runs, because that mutates state. The simplest fix: capture `prevAgentIds` near the top of the function (before orphan detection), reuse the stateResult call.

5. Add `prunedDirs` to the `reconciliation` field:

   ```typescript
   return ok({
     generation: genResult.data,
     reconciliation: { pruned, preservedDrifted, prunedDirs, stateUpdated },
   });
   ```

6. Update the `ApplyResult` interface in the same file (or wherever defined) to include `prunedDirs: string[]`.

7. Update existing tests for `apply.ts` if any reference `reconciliation` shape (they may need the new `prunedDirs` field, defaulting to `[]`).

8. Run: `pnpm lint && pnpm test tests/integration/full-pipeline tests/integration/adapter-generation` — must still pass.

**Do NOT commit.**

---

## Phase 5 — backup-source.ts adapter

### Task 9: connectBackup → ExternalSource

**Files**: `src/core/backup/backup-source.ts` (NEW), `tests/unit/core/backup/backup-source.test.ts` (NEW)
**Est**: 5 minutes

**Steps**:

1. First find the existing `ExternalSource` type:

   ```bash
   grep -n "interface ExternalSource\|type ExternalSource" src/core/external-source/types.ts
   ```

   It's at `src/core/external-source/types.ts`. The shape is `{ id, rootPath, cleanup: () => Promise<void> }`.

2. Write failing test:

   ```typescript
   import { describe, it, expect, beforeEach, afterEach } from "vitest";
   import fs from "node:fs/promises";
   import path from "node:path";
   import os from "node:os";
   import { cleanupTmpDir } from "#tests/helpers/fs.js";
   import { connectBackup } from "#src/core/backup/backup-source.js";
   import { BACKUPS_DIR } from "#src/constants.js";

   describe("connectBackup", () => {
     let configDir: string;
     beforeEach(async () => {
       const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "codi-bs-"));
       configDir = path.join(tmp, ".codi");
       await fs.mkdir(configDir, { recursive: true });
     });
     afterEach(() => cleanupTmpDir(path.dirname(configDir)));

     it("returns ExternalSource pointing at backup .codi/", async () => {
       const ts = "2026-04-30T19-20-15-123Z";
       const backupCodi = path.join(configDir, BACKUPS_DIR, ts, ".codi");
       await fs.mkdir(backupCodi, { recursive: true });
       const src = await connectBackup(configDir, ts);
       expect(src.id).toBe(`backup:${ts}`);
       expect(src.rootPath).toBe(backupCodi);
       await src.cleanup(); // noop
     });

     it("throws when backup has no .codi/ subdirectory", async () => {
       const ts = "2026-04-30T19-20-15-123Z";
       await fs.mkdir(path.join(configDir, BACKUPS_DIR, ts), { recursive: true });
       await expect(connectBackup(configDir, ts)).rejects.toThrow(/no \.codi\/ source/);
     });
   });
   ```

3. Verify failing: `pnpm test tests/unit/core/backup/backup-source` — expect import error.

4. Implement `src/core/backup/backup-source.ts`:

   ```typescript
   import fs from "node:fs/promises";
   import path from "node:path";
   import { BACKUPS_DIR } from "#src/constants.js";
   import type { ExternalSource } from "#src/core/external-source/types.js";

   const NOOP_CLEANUP = async (): Promise<void> => {};

   /** Adapts a backup directory into an ExternalSource so the existing
    *  runArtifactSelectionFromSource wizard can consume it as a preset.
    *  The backup's `.codi/` subtree IS the preset root. */
   export async function connectBackup(
     configDir: string,
     timestamp: string,
   ): Promise<ExternalSource> {
     const backupDir = path.join(configDir, BACKUPS_DIR, timestamp);
     const rootPath = path.join(backupDir, ".codi");
     const stat = await fs.stat(rootPath).catch(() => null);
     if (!stat || !stat.isDirectory()) {
       throw new Error(
         `Backup ${timestamp} has no .codi/ source — output-only backups can't be ` +
           `restored via the artifact-selection flow.`,
       );
     }
     return {
       id: `backup:${timestamp}`,
       rootPath,
       cleanup: NOOP_CLEANUP,
     };
   }
   ```

5. Verify: `pnpm test tests/unit/core/backup/backup-source` — expect "2 passing".

**Do NOT commit.**

---

## Phase 6 — CLI wiring (5 callsites)

### Task 10: Wire openBackup into init.ts

**Files**: `src/cli/init.ts`, `src/cli/init-helpers.ts` (extract helper to keep init.ts under 800 LOC)
**Est**: 10 minutes

**Steps**:

1. `init.ts` is at 801 lines. Adding ~40 LOC inline would push it over the 800 cap. Extract the backup wiring into a new helper `setupBackupForInit` in `init-helpers.ts`:

   In `src/cli/init-helpers.ts`, add at the bottom:

   ```typescript
   import { openBackup } from "#src/core/backup/backup-manager.js";
   import type { BackupHandle, BackupTrigger } from "#src/core/backup/types.js";
   import { Logger } from "#src/core/output/logger.js";
   import { RETENTION_CANCELLED_ERROR } from "#src/constants.js";

   export interface SetupBackupResult {
     handle: BackupHandle | null;
     /** True when the user cancelled retention eviction — caller MUST abort. */
     cancelled: boolean;
   }

   export async function setupBackupForInit(
     projectRoot: string,
     configDir: string,
     trigger: BackupTrigger,
     isFirstTime: boolean,
   ): Promise<SetupBackupResult> {
     const log = Logger.getInstance();
     const r = await openBackup(projectRoot, configDir, {
       trigger,
       includeSource: !isFirstTime,
       includeOutput: true,
       includePreExisting: isFirstTime,
     });
     if (r.ok) {
       return { handle: r.data, cancelled: false };
     }
     if (r.error === "retention-cancelled") {
       log.error(RETENTION_CANCELLED_ERROR);
       return { handle: null, cancelled: true };
     }
     // "no-files-to-snapshot" or "io-error" — proceed without backup.
     return { handle: null, cancelled: false };
   }
   ```

2. In `src/cli/init.ts`, just before the existing `applyConfiguration` call (around line 582):

   ```typescript
   import { setupBackupForInit } from "./init-helpers.js";

   // ... inside initHandler, before applyConfiguration:
   const trigger: BackupTrigger = isUpdate ? "init-customize" : "init-first-time";
   const { handle: backupHandle, cancelled } = await setupBackupForInit(
     projectRoot,
     configDir,
     trigger,
     !isUpdate,
   );
   if (cancelled) {
     return createCommandResult({
       success: false,
       command: "init",
       data: {
         /* ... existing shape ... */
       },
       errors: [createError("E_BACKUP_CANCELLED", { message: RETENTION_CANCELLED_ERROR })],
       exitCode: EXIT_CODES.GENERAL_ERROR,
     });
   }

   try {
     const applyResult = await applyConfiguration(
       configResult.data,
       projectRoot,
       {
         /* ... existing options ... */
       },
       backupHandle ?? undefined,
     );
     // ...
     if (backupHandle) await backupHandle.finalise();
     // surface backup timestamp:
     // result.data.backup = backupHandle?.timestamp ?? null;
   } catch (cause) {
     if (backupHandle) await backupHandle.abort();
     throw cause;
   }
   ```

3. Update the `InitData` interface in `init.ts` to include `backup?: string`:

   ```typescript
   interface InitData {
     // ... existing fields ...
     backup?: string;
   }
   ```

4. Verify init.ts is still under 800 LOC: `wc -l src/cli/init.ts` — expect ≤ 800.

5. Run: `pnpm lint && pnpm test tests/unit/cli/init tests/integration/full-pipeline` — must pass.

**Do NOT commit.**

---

### Task 11: Wire openBackup into update.ts, preset-handlers.ts, clean.ts

**Files**: `src/cli/update.ts`, `src/cli/preset-handlers.ts`, `src/cli/clean.ts`
**Est**: 8 minutes

**Steps**:

1. **`src/cli/update.ts`** (currently 758 LOC). Add at the start of the update handler (just before any mutations):

   ```typescript
   import { openBackup } from "#src/core/backup/backup-manager.js";
   import { RETENTION_CANCELLED_ERROR } from "#src/constants.js";

   const backupResult = await openBackup(projectRoot, configDir, {
     trigger: "update",
     includeSource: true,
     includeOutput: true,
   });
   if (!backupResult.ok && backupResult.error === "retention-cancelled") {
     // surface error and abort
     return createCommandResult({
       success: false,
       command: "update",
       data: {
         /* default shape */
       },
       errors: [createError("E_BACKUP_CANCELLED", { message: RETENTION_CANCELLED_ERROR })],
       exitCode: EXIT_CODES.GENERAL_ERROR,
     });
   }
   const updateBackupHandle = backupResult.ok ? backupResult.data : null;

   try {
     // ... existing update logic, threading updateBackupHandle into apply calls ...
     if (updateBackupHandle) await updateBackupHandle.finalise();
   } catch (cause) {
     if (updateBackupHandle) await updateBackupHandle.abort();
     throw cause;
   }
   ```

2. **`src/cli/preset-handlers.ts`** (excluded from coverage, but still wire it). Same pattern, with `trigger: "preset-install"`. Apply only on preset-replace flows (not on read-only preset commands like `list`, `search`).

3. **`src/cli/clean.ts`** — only when `--reset` is passed (full reset). Pattern same with `trigger: "clean-reset"`.

4. Verify: `pnpm lint && pnpm test:coverage` — full suite must still pass with thresholds intact.

**Do NOT commit.**

---

### Task 12: Wire openBackup into init-wizard-modify-add.ts

**Files**: `src/cli/init-wizard-modify-add.ts`
**Est**: 5 minutes

**Steps**:

1. The "Add from external source" flow is a separate entry point that mutates `.codi/`. Wire openBackup at the top of `runAddFromExternal` and `runArtifactSelectionFromSource`:

   ```typescript
   const r = await openBackup(projectRoot, configDir, {
     trigger: "init-customize", // semantically same: user is modifying installed preset
     includeSource: true,
     includeOutput: true,
   });
   // same retention-cancelled handling as Task 10/11
   ```

2. Thread the handle into `regenerateConfigs` (which calls applyConfiguration internally).

3. Verify: `pnpm test tests/integration/preset-workflow tests/integration/external-source` — must pass.

**Do NOT commit.**

---

## Phase 7 — revert.ts overhaul

### Task 13: Add TUI listing + selection for `codi revert`

**Files**: `src/cli/revert.ts`, `tests/unit/cli/revert.test.ts`
**Est**: 12 minutes

**Steps**:

1. Read current `src/cli/revert.ts` (135 LOC). Note the existing `--list` and `--last` flags.

2. Refactor to use the new lifecycle. The new shape:

   ```typescript
   import * as p from "@clack/prompts";
   import { openBackup, listBackups } from "#src/core/backup/backup-manager.js";
   import { connectBackup } from "#src/core/backup/backup-source.js";
   import { runArtifactSelectionFromSource } from "./init-wizard-modify-add.js";
   import { regenerateConfigs } from "./init-helpers.js"; // existing helper
   import { restoreBackup } from "#src/core/backup/backup-manager.js"; // existing
   import { listSealedBackups } from "#src/core/backup/backup-retention.js";

   export interface RevertOptions extends GlobalOptions {
     last?: boolean;
     list?: boolean;
     dryRun?: boolean;
   }

   export async function revertHandler(
     projectRoot: string,
     timestamp: string | undefined,
     options: RevertOptions,
   ): Promise<CommandResult<RevertData>> {
     const log = Logger.getInstance();
     const configDir = resolveProjectDir(projectRoot);

     const backups = await listBackups(configDir);
     if (backups.length === 0) {
       return createCommandResult({
         success: false,
         command: "revert",
         data: { restored: [], backup: null },
         errors: [
           createError("E_NO_BACKUPS", {
             message:
               "No backups available. Backups are created automatically before destructive operations.",
           }),
         ],
         exitCode: EXIT_CODES.GENERAL_ERROR,
       });
     }

     if (options.list) {
       return printBackupList(backups);
     }

     // Pick the timestamp.
     let selectedTs: string;
     if (timestamp) {
       selectedTs = timestamp;
     } else if (options.last) {
       selectedTs = backups[0]!.timestamp; // backups is newest-first
     } else {
       const picked = await p.select({
         message: "Select a backup to restore:",
         options: backups.map((b) => ({
           value: b.timestamp,
           label: `${b.timestamp}  ·  ${b.fileCount} files`,
         })),
       });
       if (p.isCancel(picked)) {
         return createCommandResult({
           success: false,
           command: "revert",
           data: { restored: [], backup: null },
           errors: [],
           exitCode: EXIT_CODES.SUCCESS, // user-cancelled is not an error
         });
       }
       selectedTs = picked as string;
     }

     // ... rest in next task
   }

   async function printBackupList(backups: BackupInfo[]): Promise<CommandResult<RevertData>> {
     // Pretty-print and exit
     // ...
   }
   ```

3. Add tests for `--list` and the no-backups case (existing test patterns work).

4. Verify: `pnpm test tests/unit/cli/revert` — passing.

**Do NOT commit.**

---

### Task 14: Pre-revert snapshot + unified restore via artifact-selection

**Files**: `src/cli/revert.ts` (continue)
**Est**: 12 minutes

**Steps**:

1. Continue building the body of `revertHandler` after `selectedTs` is chosen:

   ```typescript
   // Step 1: pre-revert snapshot of CURRENT state.
   const preRevert = await openBackup(projectRoot, configDir, {
     trigger: "pre-revert",
     includeSource: true,
     includeOutput: true,
     includePreExisting: true,
   });
   if (!preRevert.ok && preRevert.error === "retention-cancelled") {
     return createCommandResult({
       success: false,
       command: "revert",
       data: { restored: [], backup: null },
       errors: [createError("E_BACKUP_CANCELLED", { message: RETENTION_CANCELLED_ERROR })],
       exitCode: EXIT_CODES.GENERAL_ERROR,
     });
   }
   const preRevertHandle = preRevert.ok ? preRevert.data : null;

   try {
     // Step 2: route through the import flow.
     const source = await connectBackup(configDir, selectedTs);
     try {
       await runArtifactSelectionFromSource(configDir, source);
     } finally {
       await source.cleanup();
     }

     // Step 3: prompt for pre-existing files.
     const targetBackupDir = path.join(configDir, BACKUPS_DIR, selectedTs);
     const targetManifest = await readManifest(targetBackupDir);
     if (targetManifest.ok) {
       const preExisting = targetManifest.data.files.filter((f) => f.preExisting);
       if (preExisting.length > 0 && process.stdout.isTTY) {
         const answer = await p.confirm({
           message:
             `This backup also captured ${preExisting.length} pre-existing files ` +
             `from before codi was first installed. Restore them too?`,
           initialValue: false,
         });
         if (!p.isCancel(answer) && answer) {
           for (const entry of preExisting) {
             // Direct copy from backup → projectRoot (these aren't artifacts)
             const src = path.join(targetBackupDir, entry.path);
             const dest = path.resolve(projectRoot, entry.path);
             await fs.mkdir(path.dirname(dest), { recursive: true });
             await fs.copyFile(src, dest).catch(() => {
               /* skip missing */
             });
           }
         }
       }
     }

     // Step 4: auto-regenerate output (matches existing import-flow behavior).
     await regenerateConfigs(projectRoot);

     // Step 5: finalise the pre-revert snapshot.
     if (preRevertHandle) await preRevertHandle.finalise();

     return createCommandResult({
       success: true,
       command: "revert",
       data: {
         restored: [selectedTs],
         backup: preRevertHandle?.timestamp ?? null,
       },
       exitCode: EXIT_CODES.SUCCESS,
     });
   } catch (cause) {
     if (preRevertHandle) await preRevertHandle.abort();
     throw cause;
   }
   ```

2. Add an integration-style test (mocking @clack/prompts as in existing tests):

   ```typescript
   it("revert creates a pre-revert backup before restoring", async () => {
     // ... setup project with a customized .codi/, create one backup,
     // call revertHandler with options.last: true, assert that
     // listBackups now contains TWO backups (the original + the pre-revert).
   });
   ```

3. Verify: `pnpm test tests/unit/cli/revert tests/integration` — passing.

**Do NOT commit.**

---

### Task 15: Add `--dry-run` to revert

**Files**: `src/cli/revert.ts` (continue)
**Est**: 5 minutes

**Steps**:

1. At the top of `revertHandler`, after picking the timestamp but before doing anything destructive:

   ```typescript
   if (options.dryRun) {
     const targetBackupDir = path.join(configDir, BACKUPS_DIR, selectedTs);
     const m = await readManifest(targetBackupDir);
     if (!m.ok) {
       // surface error
     }
     const sourceCount = m.data.files.filter((f) => f.scope === "source").length;
     const outputCount = m.data.files.filter((f) => f.scope === "output").length;
     const preExistingCount = m.data.files.filter((f) => f.preExisting).length;
     const deletedCount = m.data.files.filter((f) => f.deleted).length;

     log.info(`Dry-run for backup ${selectedTs}:`);
     log.info(`  Would create pre-revert snapshot of current state`);
     log.info(`  Would offer ${sourceCount} source artifacts via artifact-selection wizard`);
     log.info(`  Would auto-regenerate ${outputCount} output files via codi generate`);
     if (preExistingCount > 0) {
       log.info(`  Would prompt to also restore ${preExistingCount} pre-existing files`);
     }
     if (deletedCount > 0) {
       log.info(
         `  Note: ${deletedCount} files in this backup were tagged 'deleted'; ` +
           `they'll be restored only if user re-selects their parent artifacts in the wizard`,
       );
     }
     return createCommandResult({
       success: true,
       command: "revert",
       data: { restored: [], backup: null, dryRun: true },
       exitCode: EXIT_CODES.SUCCESS,
     });
   }
   ```

2. Add the `--dry-run` option to the Commander wiring at the bottom of `revert.ts`.

3. Test: `pnpm test tests/unit/cli/revert` — passing.

**Do NOT commit.**

---

## Phase 8 — codi backup command (NEW)

### Task 16: src/cli/backup.ts — `codi backup --list` / `--delete` / `--prune`

**Files**: `src/cli/backup.ts` (NEW), `src/cli.ts` (register), `tests/unit/cli/backup.test.ts` (NEW)
**Est**: 10 minutes

**Steps**:

1. Create `src/cli/backup.ts`:

   ```typescript
   import type { Command } from "commander";
   import { listBackups } from "#src/core/backup/backup-manager.js";
   import { interactiveEvict, listSealedBackups } from "#src/core/backup/backup-retention.js";
   import { resolveProjectDir } from "#src/utils/paths.js";
   import { createCommandResult } from "#src/core/output/formatter.js";
   import { EXIT_CODES } from "#src/core/output/exit-codes.js";
   import { initFromOptions, handleOutput } from "./shared.js";
   import { Logger } from "#src/core/output/logger.js";
   import { safeRm } from "#src/utils/fs.js";
   import path from "node:path";
   import { BACKUPS_DIR } from "#src/constants.js";
   import type { GlobalOptions } from "./shared.js";
   import type { CommandResult } from "#src/core/output/types.js";

   interface BackupListData {
     backups: Array<{ timestamp: string; fileCount: number }>;
   }

   export async function backupListHandler(
     projectRoot: string,
   ): Promise<CommandResult<BackupListData>> {
     const configDir = resolveProjectDir(projectRoot);
     const backups = await listBackups(configDir);
     return createCommandResult({
       success: true,
       command: "backup --list",
       data: { backups },
       exitCode: EXIT_CODES.SUCCESS,
     });
   }

   export async function backupDeleteHandler(
     projectRoot: string,
     timestamps: string[],
   ): Promise<CommandResult<{ deleted: string[] }>> {
     const log = Logger.getInstance();
     const configDir = resolveProjectDir(projectRoot);
     const backupsRoot = path.join(configDir, BACKUPS_DIR);
     const deleted: string[] = [];
     for (const ts of timestamps) {
       const dir = path.join(backupsRoot, ts);
       const removedOk = await safeRm(dir);
       if (removedOk) deleted.push(ts);
       else log.warn(`Backup ${ts} not found or could not be removed`);
     }
     return createCommandResult({
       success: true,
       command: "backup --delete",
       data: { deleted },
       exitCode: EXIT_CODES.SUCCESS,
     });
   }

   export async function backupPruneHandler(
     projectRoot: string,
   ): Promise<CommandResult<{ deleted: number }>> {
     const configDir = resolveProjectDir(projectRoot);
     const backupsRoot = path.join(configDir, BACKUPS_DIR);
     const before = (await listSealedBackups(backupsRoot)).length;
     await interactiveEvict(backupsRoot);
     const after = (await listSealedBackups(backupsRoot)).length;
     return createCommandResult({
       success: true,
       command: "backup --prune",
       data: { deleted: before - after },
       exitCode: EXIT_CODES.SUCCESS,
     });
   }

   export function registerBackupCommand(program: Command): void {
     program
       .command("backup")
       .description("Manage codi backups (list, delete, prune)")
       .option("--list", "List existing backups")
       .option("--delete <ts...>", "Delete one or more backups by timestamp")
       .option("--prune", "Interactively select backups to delete")
       .action(async (cmdOptions: { list?: boolean; delete?: string[]; prune?: boolean }) => {
         const globalOptions = program.opts() as GlobalOptions;
         initFromOptions(globalOptions);
         let result;
         if (cmdOptions.delete && cmdOptions.delete.length > 0) {
           result = await backupDeleteHandler(process.cwd(), cmdOptions.delete);
         } else if (cmdOptions.prune) {
           result = await backupPruneHandler(process.cwd());
         } else {
           result = await backupListHandler(process.cwd());
         }
         handleOutput(result, globalOptions);
         process.exit(result.exitCode);
       });
   }
   ```

2. Register in `src/cli.ts` (one line):

   ```typescript
   import { registerBackupCommand } from "./cli/backup.js";
   registerBackupCommand(program);
   ```

3. Register-command smoke test in `tests/unit/cli/register-commands.test.ts`:

   ```typescript
   { commandName: "backup", load: async () => (await import("../../../src/cli/backup.js")).registerBackupCommand },
   ```

4. Tests for the handlers:

   ```typescript
   describe("codi backup", () => {
     it("backupListHandler returns sealed backups", async () => {
       /* ... */
     });
     it("backupDeleteHandler removes specified timestamps", async () => {
       /* ... */
     });
   });
   ```

5. Verify: `pnpm test tests/unit/cli/backup tests/unit/cli/register-commands` — passing.

**Do NOT commit.**

---

## Phase 9 — Integration tests

### Task 17: Integration test — full backup-overhaul end-to-end

**Files**: `tests/integration/backup-overhaul.test.ts` (NEW)
**Est**: 15 minutes

**Steps**:

1. Create the test file with cases mirroring the spec test plan:

   ```typescript
   import { describe, it, expect, beforeEach, afterEach } from "vitest";
   import fs from "node:fs/promises";
   import path from "node:path";
   import os from "node:os";
   import { cleanupTmpDir } from "#tests/helpers/fs.js";
   import { initHandler } from "#src/cli/init.js";
   import { Logger } from "#src/core/output/logger.js";
   import { clearAdapters } from "#src/core/generator/adapter-registry.js";
   import { listBackups } from "#src/core/backup/backup-manager.js";
   import { listSealedBackups } from "#src/core/backup/backup-retention.js";
   import { PROJECT_NAME, BACKUPS_DIR, PROJECT_DIR } from "#src/constants.js";

   let projectRoot: string;
   beforeEach(async () => {
     const base = await fs.mkdtemp(path.join(os.tmpdir(), `${PROJECT_NAME}-bo-`));
     projectRoot = path.join(base, "project");
     await fs.mkdir(projectRoot, { recursive: true });
     await fs.writeFile(
       path.join(projectRoot, "package.json"),
       JSON.stringify({ name: "p", version: "1.0.0" }),
     );
     clearAdapters();
     Logger.init({ level: "error", mode: "human", noColor: true });
   });
   afterEach(async () => {
     await cleanupTmpDir(path.dirname(projectRoot));
     clearAdapters();
   });

   describe("codi init: backup safety", () => {
     it("first-time init with hand-written CLAUDE.md captures it as preExisting", async () => {
       await fs.writeFile(path.join(projectRoot, "CLAUDE.md"), "# user-written\n");
       await initHandler(projectRoot, { agents: ["claude-code"], json: true });
       const backups = await listBackups(path.join(projectRoot, PROJECT_DIR));
       expect(backups.length).toBeGreaterThanOrEqual(1);
       const backup = backups[0]!;
       const manifestPath = path.join(
         projectRoot,
         PROJECT_DIR,
         BACKUPS_DIR,
         backup.timestamp,
         "backup-manifest.json",
       );
       const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
       const claudeEntry = manifest.files.find((f: any) => f.path === "CLAUDE.md");
       expect(claudeEntry).toBeDefined();
       expect(claudeEntry.preExisting).toBe(true);
     });

     it("init --customize removing claude-code prunes empty .claude/ directory", async () => {
       // Step 1: install with claude-code
       await initHandler(projectRoot, { agents: ["claude-code"], json: true });
       const claudeExists1 = await fs.stat(path.join(projectRoot, ".claude")).catch(() => null);
       expect(claudeExists1).not.toBeNull();

       // Step 2: re-init with no agents (mimics customize unselecting claude-code)
       // ... call initHandler again with options.force + agents: [] to trigger
       // the orphan-deletion + prune-empty flow ...
       // (exact options may need to mimic the customize path)
     });
   });

   describe("retention", () => {
     it("backups beyond MAX_BACKUPS evict oldest in non-interactive mode", async () => {
       // Stub stdout.isTTY = false; make MAX_BACKUPS+1 backups; verify oldest is gone
     });
   });

   describe("excludes", () => {
     it("backup does not recurse into .codi/backups/", async () => {
       await initHandler(projectRoot, { agents: ["claude-code"], json: true });
       const backups = await listBackups(path.join(projectRoot, PROJECT_DIR));
       const backupDir = path.join(projectRoot, PROJECT_DIR, BACKUPS_DIR, backups[0]!.timestamp);
       const inner = await fs.stat(path.join(backupDir, ".codi/backups")).catch(() => null);
       expect(inner).toBeNull();
     });
   });

   describe("crash recovery", () => {
     it("partial backup with no manifest is pruned on next openBackup call", async () => {
       const backupsRoot = path.join(projectRoot, PROJECT_DIR, BACKUPS_DIR);
       await fs.mkdir(backupsRoot, { recursive: true });
       const partialDir = path.join(backupsRoot, "2026-04-30T00-00-00-000Z");
       await fs.mkdir(partialDir);
       await fs.writeFile(path.join(partialDir, "x.md"), "stale");
       // No manifest written → considered partial.

       // Trigger any openBackup
       await initHandler(projectRoot, { agents: ["claude-code"], json: true });

       const remaining = await fs.readdir(backupsRoot);
       expect(remaining).not.toContain("2026-04-30T00-00-00-000Z");
     });
   });
   ```

2. Verify: `pnpm test tests/integration/backup-overhaul` — passing.

**Do NOT commit.**

---

## Phase 10 — Documentation

### Task 18: CHANGELOG entry under [Unreleased]

**Files**: `CHANGELOG.md`
**Est**: 5 minutes

**Steps**:

1. Add to `[Unreleased]` `### Added`:

   ```markdown
   - **Backup overhaul** — every destructive operation (`codi init`, `codi init --customize`, `codi update`, `codi preset install`, `codi clean --reset`, `codi generate`, `codi revert`) now creates a versioned snapshot in `.codi/backups/<ISO-timestamp>/` before mutating disk. The new lifecycle (`openBackup` → `handle.append` → `handle.finalise`) lets a single backup capture pre-existing user files (e.g. a hand-written `CLAUDE.md` from before `codi init`), source artifacts (`.codi/rules/`, `.codi/skills/`, etc.), generated output (`CLAUDE.md`, `.cursor/`, etc.), AND files about to be deleted by orphan logic — all in one atomic snapshot. Manifest is written LAST as a commit marker; partial backups are pruned automatically. Retention cap raised from 5 → 50 with an interactive TUI for selective eviction.
   - **`codi revert` symmetry rule** — restoring a backup ALWAYS creates a pre-revert snapshot of the current state first. This makes every revert reversible: if you change your mind, run `codi revert` again to pick the pre-revert backup. The restore flow itself is unified with the existing "import preset from external source" wizard via a new `connectBackup` adapter, so per-collision prompts (keep current / overwrite / rename) behave consistently.
   - **`codi backup` command** — `codi backup --list` (alias for `codi revert --list`), `codi backup --delete <ts...>` (explicit deletion), `codi backup --prune` (interactive eviction TUI on demand).
   - **Empty agent-folder cleanup** — when `codi init --customize` unselects an agent, the empty `.cursor/`, `.claude/`, etc. directories are pruned recursively. User content inside those folders blocks removal — codi never touches files it didn't generate.
   ```

2. Add to `### Fixed`:
   ```markdown
   - **Pre-existing user files were silently overwritten on first `codi init`** — a hand-written `CLAUDE.md` or `AGENTS.md` had no recovery path. They are now captured in the first backup with `preExisting: true` and can be restored via `codi revert`.
   - **Empty agent folders were left on disk after unselecting agents** — `.cursor/`, `.cursor/rules/`, `.cursor/skills/` etc. remained as empty husks even though codi had deleted all their contents. The new `pruneEmptyAdapterDirs` helper walks parent directories deepest-first after orphan deletion and removes them when empty. User content blocks removal as a safety net.
   ```

**Do NOT commit.**

---

### Task 19: User-facing guide — backups-and-recovery.md

**Files**: `docs/src/content/docs/guides/backups-and-recovery.md` (NEW)
**Est**: 8 minutes

**Steps**:

1. Create the guide:

   ````markdown
   ---
   title: Backups and recovery
   description: How codi captures snapshots before destructive operations, and how to restore from them
   sidebar:
     label: "Backups & recovery"
     order: 5
   ---

   Codi automatically creates a backup before every destructive operation — `codi init`, `codi init --customize`, `codi update`, `codi preset install`, `codi clean --reset`, `codi generate`, and even `codi revert` itself. Backups live under `.codi/backups/<ISO-timestamp>/` and are gitignored by default.

   ## What gets captured

   Each backup contains up to four kinds of files:

   - **source** — files inside `.codi/` (rules, skills, agents, mcp-servers, codi.yaml, flags.yaml, state.json, operations.json). Captured for `init --customize`, `update`, `preset install`, `clean --reset`, and `pre-revert` triggers.
   - **output** — generated agent files (`CLAUDE.md`, `.cursor/`, `.codex/`, `.windsurf/`, `.cline/`, `.github/copilot-instructions.md`). Captured for every backup.
   - **pre-existing** — user-written files at adapter target paths that codi never tracked (e.g. a `CLAUDE.md` you wrote before `codi init`). Captured on first-time init only.
   - **deleted** — files codi was about to delete in the same operation (e.g. orphans after unselecting an agent). Tagged so you can see them, but restoring them requires re-selecting the parent artifact.

   The full manifest is written to `backup-manifest.json` at the END of the backup operation, as a commit marker. Codi auto-prunes any backup directory missing this marker on the next run.

   ## Listing backups

   ```bash
   codi backup --list
   # or
   codi revert --list
   ```
   ````

   ## Restoring

   ```bash
   codi revert                        # interactive: picker TUI
   codi revert <timestamp>            # restore a specific backup
   codi revert --last                 # restore the most recent backup
   codi revert --dry-run [<ts>]       # show what would happen, change nothing
   ```

   When you restore, codi:
   1. Creates a `pre-revert` backup of your current state (so you can undo the revert).
   2. Treats the chosen backup's `.codi/` as a preset source.
   3. Walks you through the same artifact-selection wizard as "Import from local directory" — pick which rules/skills/agents/mcp-servers to restore.
   4. Per-collision prompts: keep current, overwrite, or rename with a `-from-backup` suffix.
   5. Auto-regenerates output files (`CLAUDE.md`, `.cursor/`, etc.) from the restored source.
   6. If the backup contains pre-existing files, prompts whether to also restore those.

   ## Retention

   Codi keeps the most recent **50** backups. When you create a 51st:
   - **In an interactive shell**: a TUI lists the existing 50 by timestamp + trigger label + size; you multi-select which to delete with double confirmation. If you cancel or delete 0, the destructive operation aborts — codi never mutates state without a snapshot.
   - **In a non-interactive shell** (CI, `--json` mode): the oldest backup is silently evicted.

   You can also prune manually at any time:

   ```bash
   codi backup --prune                # interactive TUI
   codi backup --delete <ts1> <ts2>   # explicit deletion
   ```

   ## Restore from a backup the wizard doesn't show

   Some backups (e.g. `generate` triggers) only contain output files, not source. If `codi revert` reports "no .codi/ source", the artifact-selection wizard can't be used. Inspect the raw files manually:

   ```bash
   ls -la .codi/backups/<timestamp>/
   ```

   Copy whatever you need back into place, then run `codi generate` to refresh derived files.

   ```

   ```

2. No tests for this file — markdown only.

**Do NOT commit.**

---

### Task 20: Update hooks-reference + architecture docs

**Files**: `docs/src/content/docs/guides/hooks-reference.md`, `docs/project/architecture.md`
**Est**: 5 minutes

**Steps**:

1. Append to `docs/src/content/docs/guides/hooks-reference.md`:

   ```markdown
   ## Backups (related, not a hook)

   Codi creates a snapshot in `.codi/backups/` before every destructive operation. This isn't a git hook — it's a runtime safety net inside codi itself. See [Backups and recovery](../backups-and-recovery/) for full details. The relevant CLI commands are `codi backup --list`, `codi backup --prune`, and `codi revert`.
   ```

2. In `docs/project/architecture.md`, find the existing "Backup System" section (if any) and update it to reflect the v2 manifest, the `openBackup → handle → finalise` lifecycle, and the four scopes (source / output / pre-existing / deleted). If no section exists, add one after the Hook System section:

   ```markdown
   ## Backup System

   Every destructive operation in codi creates a versioned snapshot under `.codi/backups/<ISO-timestamp>/` before mutating disk. The lifecycle is:

   1. Caller invokes `openBackup(projectRoot, configDir, opts)` returning a `BackupHandle`.
   2. Handle's `dir`, `timestamp` are immediately usable; files are copied per `opts.{includeSource,includeOutput,includePreExisting}` scopes.
   3. During the destructive operation, caller may call `handle.append(paths, scope, flags)` to add additional files (e.g. orphans discovered mid-operation).
   4. On success, caller calls `handle.finalise()` to write `backup-manifest.json` LAST as a commit marker.
   5. On error, caller calls `handle.abort()` in a finally block to remove the partial directory.

   **Manifest schema** is v2 (`{ version, timestamp, trigger, codiVersion, files: [{ path, scope, preExisting?, deleted? }] }`). v1 manifests (current users with existing backups) are read-only via a shim that maps each entry to `scope: "output"`.

   **Module map**:

   - `src/core/backup/backup-manager.ts` — public API (`openBackup`, `createBackup` legacy, `listBackups`, `restoreBackup`)
   - `src/core/backup/types.ts` — `BackupTrigger`, `BackupScope`, `SnapshotOptions`, `BackupHandle`, manifest types
   - `src/core/backup/backup-collectors.ts` — `collectSourceFiles`, `collectPreExistingFiles`
   - `src/core/backup/backup-retention.ts` — `listSealedBackups`, `pruneIncompleteBackups`, `evictOldest`, `interactiveEvict`
   - `src/core/backup/backup-manifest.ts` — `readManifest` (v1+v2), `writeManifest` (v2)
   - `src/core/backup/backup-source.ts` — `connectBackup` adapter for the unified restore flow

   **Restore unification**: `codi revert` routes through the same `runArtifactSelectionFromSource(configDir, source)` machinery used by "Import from local directory", with the backup directory exposed as an `ExternalSource` via `connectBackup`. Pre-revert snapshot is mandatory — every revert is itself reversible.
   ```

**Do NOT commit.**

---

## Phase 11 — Final verification + single commit

### Task 21: Coverage + lint + manual smoke + single commit

**Files**: ALL changes from Tasks 1-20
**Est**: 10 minutes

**Steps**:

1. Run the full gate locally:

   ```bash
   pnpm install --frozen-lockfile
   pnpm lint                       # tsc --noEmit, expect 0 errors
   pnpm build                      # tsup, expect success
   pnpm test:coverage              # vitest with thresholds, expect exit 0
   ```

2. Manual smoke against a clean tmp project:

   ```bash
   TMP=$(mktemp -d)
   cd "$TMP"
   echo '# user-written' > CLAUDE.md
   codi init --agents claude-code --json | jq .
   # Expect data.backup to be a timestamp string
   ls -la .codi/backups/    # one backup directory exists
   cat .codi/backups/*/backup-manifest.json
   # Expect version: 2, files contains CLAUDE.md with preExisting: true
   codi backup --list       # lists the backup
   codi revert --list       # same listing
   cd / && rm -rf "$TMP"
   ```

3. Confirm coverage didn't regress. Compare against baseline (88.04 lines, 86.25 statements, 90.11 functions, 74.91 branches). New code must keep these AT OR ABOVE.

4. Stage all changes:

   ```bash
   git add CHANGELOG.md \
     src/constants.ts \
     src/core/backup/types.ts \
     src/core/backup/backup-manifest.ts \
     src/core/backup/backup-collectors.ts \
     src/core/backup/backup-retention.ts \
     src/core/backup/backup-manager.ts \
     src/core/backup/backup-source.ts \
     src/core/generator/prune-empty-adapter-dirs.ts \
     src/core/generator/apply.ts \
     src/cli/init.ts \
     src/cli/init-helpers.ts \
     src/cli/init-wizard-modify-add.ts \
     src/cli/update.ts \
     src/cli/preset-handlers.ts \
     src/cli/clean.ts \
     src/cli/revert.ts \
     src/cli/backup.ts \
     src/cli.ts \
     tests/unit/core/backup/backup-collectors.test.ts \
     tests/unit/core/backup/backup-manifest.test.ts \
     tests/unit/core/backup/backup-retention.test.ts \
     tests/unit/core/backup/backup-manager.test.ts \
     tests/unit/core/backup/backup-source.test.ts \
     tests/unit/core/generator/prune-empty-adapter-dirs.test.ts \
     tests/unit/cli/revert.test.ts \
     tests/unit/cli/backup.test.ts \
     tests/unit/cli/register-commands.test.ts \
     tests/integration/backup-overhaul.test.ts \
     "docs/20260430_193109_[PLAN]_backup-overhaul.md" \
     "docs/20260430_194259_[PLAN]_backup-overhaul-impl.md" \
     docs/src/content/docs/guides/backups-and-recovery.md \
     docs/src/content/docs/guides/hooks-reference.md \
     docs/project/architecture.md
   ```

5. Single commit with conventional format:

   ```bash
   git commit -m "$(cat <<'EOF'
   feat(backup): full lifecycle, retention, unified restore

   Replaces the single-shot createBackup with an openBackup → append →
   finalise lifecycle that captures source + output + pre-existing files
   in a v2 manifest. Wires backups into every destructive operation
   (init, customize, update, preset install, clean --reset, generate,
   revert), prunes empty agent directories after orphan deletion, and
   unifies restore with the existing import-from-source flow via a
   backup-source adapter. New `codi backup` command for explicit
   management. Retention raised to 50 with an interactive TUI eviction
   prompt.

   Spec: docs/20260430_193109_[PLAN]_backup-overhaul.md
   Plan: docs/20260430_194259_[PLAN]_backup-overhaul-impl.md
   EOF
   )"
   ```

6. Verify pre-push gate runs and passes:
   ```bash
   git push origin develop
   # Pre-push hook runs pnpm test:coverage; must exit 0.
   ```

**This IS the only commit. After push, PR #93 picks up the change automatically.**

**Verification (final)**: `gh pr view 93 --json mergeable,mergeStateStatus` — expect `MERGEABLE`. CI must turn green within ~2 minutes.

---

## Summary

**Total estimated time**: ~135-160 minutes of focused work (≈2.5 hours).

**Total LOC delta**: ~700 source + ~530 tests + ~250 doc = ~1480 LOC.

**Files touched**: 33 (12 new, 21 modified).

**Risk**: Medium. Touches a critical safety mechanism (backups) but every change is additive — legacy `createBackup` + v1 manifest reader preserve backwards compat. Pre-push + CI gate prevents regressions in coverage or behavior.

**Rollback**: single commit, single revert if needed.
