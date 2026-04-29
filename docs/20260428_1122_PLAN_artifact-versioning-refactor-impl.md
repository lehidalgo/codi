# Artifact Versioning Refactor — Implementation Plan

> **For agentic workers:** Use `codi-plan-execution` to implement this plan task-by-task. That skill asks the user to pick INLINE (sequential) or SUBAGENT (fresh subagent per task with two-stage review) mode. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the runtime template registry integrity check that punishes end users for contributor-side process violations, replace the parallel hash baseline file with git-history-based comparison, and add a dual-mode (source + `.codi/` user-managed + `.codi/` codi-managed) pre-commit and pre-push enforcement model with a CI gate as final safety net.

**Architecture:** Three local-first enforcement layers. Pre-commit auto-bumps version + updates manifest (frictionless). Pre-push verifies all artifact changes in the push range have version bumps (catches `--no-verify` bypasses). CI runs the same verification on PRs (server-side, can't be bypassed). All three layers share their core logic via a new `src/core/hooks/hook-logic/` TypeScript module that's unit-testable in isolation. Hook scripts (`.mjs`) inline equivalent JS and are pinned via snapshot tests to prevent drift between the testable TS implementation and the generated hook bytes.

**Tech Stack:** TypeScript 5.9, Vitest 4.1, tsup 8.5, Node 24+, Husky 9, GitHub Actions.

**Source spec:** `docs/20260428_1107_PLAN_artifact-versioning-refactor.md`

> **Execution mode — single commit per session:** Per project preference, **do NOT execute the per-task `git commit` steps below as separate commits**. Each task's `git commit -m "..."` line documents the *intent and scope* of that task's changes for the executor's reference, but during real execution: only `git add` the listed files at each step, and produce **one final consolidated commit + PR** at Task 31 (final consolidation). The per-task commit messages can be re-used as bullet points in the final commit body.

---

## Section A — Foundation: hook-logic pure module

### Task 1: Create hook-logic types module

**Files**: `src/core/hooks/hook-logic/types.ts`
**Est**: 2 min

**Steps**:
- [ ] Create `src/core/hooks/hook-logic/types.ts`:
  ```typescript
  /** Path-derived layer the hook is operating on. */
  export type HookMode = "source" | "user-managed" | "codi-managed" | "skip";

  /** Result of inspecting a single staged file. */
  export interface ArtifactInspection {
    path: string;
    mode: HookMode;
    artifactName: string | null;
    artifactType: "rule" | "skill" | "agent" | null;
  }

  /** Decision returned by bumpVersion(). */
  export interface BumpDecision {
    action: "no-op" | "bumped" | "rejected";
    fromVersion: number | null;
    toVersion: number | null;
    rejectReason?: string;
    rewrittenContent?: string;
  }

  /** A single offender returned by verifyRange(). */
  export interface VerifyOffender {
    path: string;
    headVersion: number;
    pushVersion: number;
    reason: "content-changed-without-bump" | "version-regression";
  }

  /** Manifest entry shape that the hook updates. */
  export interface ManifestArtifactEntry {
    name: string;
    type: "rule" | "skill" | "agent" | "mcp-server";
    contentHash: string;
    installedArtifactVersion: number | "unknown";
    installedAt: string;
    managedBy: "codi" | "user";
  }
  ```
- [ ] Verify TypeScript compiles: `pnpm tsc --noEmit` — expected: 0 errors
- [ ] Commit: `git add src/core/hooks/hook-logic/types.ts && git commit -m "feat(hooks): add hook-logic shared types"`

**Verification**: `pnpm tsc --noEmit` — expected: passes

---

### Task 2: Add detectMode test and implementation

**Files**: `src/core/hooks/hook-logic/detect-mode.ts`, `tests/unit/core/hooks/hook-logic/detect-mode.test.ts`
**Est**: 4 min

**Steps**:
- [ ] Create `tests/unit/core/hooks/hook-logic/detect-mode.test.ts`:
  ```typescript
  import { describe, it, expect } from "vitest";
  import { detectMode } from "#src/core/hooks/hook-logic/detect-mode.js";

  describe("detectMode", () => {
    it("classifies source skill template paths", () => {
      const r = detectMode("src/templates/skills/codi-debugging/template.ts", "");
      expect(r.mode).toBe("source");
      expect(r.artifactName).toBe("codi-debugging");
      expect(r.artifactType).toBe("skill");
    });

    it("classifies source agent template paths", () => {
      const r = detectMode("src/templates/agents/codi-reviewer/template.ts", "");
      expect(r.mode).toBe("source");
      expect(r.artifactType).toBe("agent");
    });

    it("classifies source rule template paths", () => {
      const r = detectMode("src/templates/rules/codi-security.ts", "");
      expect(r.mode).toBe("source");
      expect(r.artifactName).toBe("codi-security");
      expect(r.artifactType).toBe("rule");
    });

    it("rejects rules/index.ts as not an artifact", () => {
      const r = detectMode("src/templates/rules/index.ts", "");
      expect(r.mode).toBe("skip");
    });

    it("classifies .codi user-managed artifact", () => {
      const content = "---\nname: my-rule\nmanaged_by: user\nversion: 1\n---\nbody";
      const r = detectMode(".codi/rules/my-rule.md", content);
      expect(r.mode).toBe("user-managed");
      expect(r.artifactName).toBe("my-rule");
    });

    it("classifies .codi codi-managed artifact", () => {
      const content = "---\nname: codi-debugging\nmanaged_by: codi\nversion: 11\n---\nbody";
      const r = detectMode(".codi/skills/codi-debugging/SKILL.md", content);
      expect(r.mode).toBe("codi-managed");
    });

    it("treats missing managed_by as user-managed (default)", () => {
      const content = "---\nname: my-rule\nversion: 1\n---\nbody";
      const r = detectMode(".codi/rules/my-rule.md", content);
      expect(r.mode).toBe("user-managed");
    });

    it("skips .codi/artifact-manifest.json itself", () => {
      const r = detectMode(".codi/artifact-manifest.json", "{}");
      expect(r.mode).toBe("skip");
    });

    it("skips unrelated paths", () => {
      const r = detectMode("README.md", "");
      expect(r.mode).toBe("skip");
    });
  });
  ```
- [ ] Verify test fails: `pnpm test detect-mode.test.ts` — expected: cannot find module
- [ ] Create `src/core/hooks/hook-logic/detect-mode.ts`:
  ```typescript
  import type { ArtifactInspection } from "./types.js";

  const SOURCE_SKILL = /^src\/templates\/skills\/([^/]+)\/template\.ts$/;
  const SOURCE_AGENT = /^src\/templates\/agents\/([^/]+)\/template\.ts$/;
  const SOURCE_RULE = /^src\/templates\/rules\/([^/]+)\.ts$/;
  const CODI_RULE = /^\.codi\/rules\/([^/]+)\.md$/;
  const CODI_SKILL = /^\.codi\/skills\/([^/]+)\/SKILL\.md$/;
  const CODI_AGENT = /^\.codi\/agents\/([^/]+)\.md$/;

  function parseManagedBy(content: string): "codi" | "user" {
    const match = content.match(/^managed_by:\s*(codi|user)\s*$/m);
    return match ? (match[1] as "codi" | "user") : "user";
  }

  export function detectMode(path: string, content: string): ArtifactInspection {
    const result: ArtifactInspection = {
      path,
      mode: "skip",
      artifactName: null,
      artifactType: null,
    };

    let m = path.match(SOURCE_SKILL);
    if (m) {
      result.mode = "source";
      result.artifactName = m[1];
      result.artifactType = "skill";
      return result;
    }

    m = path.match(SOURCE_AGENT);
    if (m) {
      result.mode = "source";
      result.artifactName = m[1];
      result.artifactType = "agent";
      return result;
    }

    m = path.match(SOURCE_RULE);
    if (m && m[1] !== "index") {
      result.mode = "source";
      result.artifactName = m[1];
      result.artifactType = "rule";
      return result;
    }

    m = path.match(CODI_RULE);
    if (m) {
      result.mode = parseManagedBy(content) === "codi" ? "codi-managed" : "user-managed";
      result.artifactName = m[1];
      result.artifactType = "rule";
      return result;
    }

    m = path.match(CODI_SKILL);
    if (m) {
      result.mode = parseManagedBy(content) === "codi" ? "codi-managed" : "user-managed";
      result.artifactName = m[1];
      result.artifactType = "skill";
      return result;
    }

    m = path.match(CODI_AGENT);
    if (m) {
      result.mode = parseManagedBy(content) === "codi" ? "codi-managed" : "user-managed";
      result.artifactName = m[1];
      result.artifactType = "agent";
      return result;
    }

    return result;
  }
  ```
- [ ] Verify test passes: `pnpm test detect-mode.test.ts` — expected: 9 passing
- [ ] Commit: `git add src/core/hooks/hook-logic/detect-mode.ts tests/unit/core/hooks/hook-logic/detect-mode.test.ts && git commit -m "feat(hooks): add detectMode pure function"`

**Verification**: `pnpm test detect-mode.test.ts` — expected: 9 passing

---

### Task 3: Add getPreviousVersion test and implementation

**Files**: `src/core/hooks/hook-logic/get-previous-version.ts`, `tests/unit/core/hooks/hook-logic/get-previous-version.test.ts`
**Est**: 5 min

**Steps**:
- [ ] Create `tests/unit/core/hooks/hook-logic/get-previous-version.test.ts`:
  ```typescript
  import { describe, it, expect, vi, beforeEach } from "vitest";
  import { getPreviousVersion } from "#src/core/hooks/hook-logic/get-previous-version.js";

  vi.mock("node:child_process", () => ({
    execFileSync: vi.fn(),
  }));
  const { execFileSync } = await import("node:child_process");

  describe("getPreviousVersion", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("returns parsed version from HEAD content", () => {
      vi.mocked(execFileSync).mockReturnValueOnce(
        "---\nname: test\nversion: 7\n---\nbody",
      );
      const result = getPreviousVersion("HEAD", "src/templates/rules/test.ts");
      expect(result).toEqual({ kind: "found", version: 7 });
    });

    it("returns 'no-head' when HEAD does not exist", () => {
      vi.mocked(execFileSync).mockImplementationOnce(() => {
        const e: Error & { status?: number } = new Error("HEAD not found");
        e.status = 128;
        throw e;
      });
      const result = getPreviousVersion("HEAD", "src/templates/rules/new.ts");
      expect(result).toEqual({ kind: "no-head" });
    });

    it("returns 'new-file' when path doesn't exist at HEAD", () => {
      vi.mocked(execFileSync).mockImplementationOnce(() => {
        const e: Error & { status?: number; stderr?: Buffer } = new Error("path not found");
        e.status = 128;
        e.stderr = Buffer.from("fatal: path 'foo' does not exist in 'HEAD'");
        throw e;
      });
      const result = getPreviousVersion("HEAD", "src/templates/rules/foo.ts");
      expect(result).toEqual({ kind: "new-file" });
    });

    it("returns version 1 when frontmatter has no version field", () => {
      vi.mocked(execFileSync).mockReturnValueOnce("---\nname: test\n---\nbody");
      const result = getPreviousVersion("HEAD", "src/templates/rules/test.ts");
      expect(result).toEqual({ kind: "found", version: 1 });
    });
  });
  ```
- [ ] Verify test fails: `pnpm test get-previous-version.test.ts` — expected: cannot find module
- [ ] Create `src/core/hooks/hook-logic/get-previous-version.ts`:
  ```typescript
  import { execFileSync } from "node:child_process";

  export type PreviousVersionResult =
    | { kind: "found"; version: number }
    | { kind: "new-file" }
    | { kind: "no-head" };

  export function getPreviousVersion(ref: string, path: string): PreviousVersionResult {
    let content: string;
    try {
      content = execFileSync("git", ["show", `${ref}:${path}`], {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (err) {
      const e = err as { status?: number; stderr?: Buffer | string };
      const stderr = e.stderr ? e.stderr.toString() : "";
      if (stderr.includes("does not exist") || stderr.includes("exists on disk, but not in")) {
        return { kind: "new-file" };
      }
      if (
        stderr.includes("unknown revision") ||
        stderr.includes("ambiguous argument 'HEAD'") ||
        stderr.includes("bad revision 'HEAD'")
      ) {
        return { kind: "no-head" };
      }
      return { kind: "no-head" };
    }

    const match = content.match(/^version:\s*(\d+)\s*$/m);
    return match ? { kind: "found", version: Number(match[1]) } : { kind: "found", version: 1 };
  }
  ```
- [ ] Verify test passes: `pnpm test get-previous-version.test.ts` — expected: 4 passing
- [ ] Commit: `git add src/core/hooks/hook-logic/get-previous-version.ts tests/unit/core/hooks/hook-logic/get-previous-version.test.ts && git commit -m "feat(hooks): add getPreviousVersion git-based reader"`

**Verification**: `pnpm test get-previous-version.test.ts` — expected: 4 passing

---

### Task 4: Add bumpVersion test and implementation

**Files**: `src/core/hooks/hook-logic/bump-version.ts`, `tests/unit/core/hooks/hook-logic/bump-version.test.ts`
**Est**: 5 min

**Steps**:
- [ ] Create `tests/unit/core/hooks/hook-logic/bump-version.test.ts`:
  ```typescript
  import { describe, it, expect } from "vitest";
  import { bumpVersion } from "#src/core/hooks/hook-logic/bump-version.js";

  const headContent = "---\nname: x\nversion: 5\n---\nbody-original";
  const stagedSame = "---\nname: x\nversion: 5\n---\nbody-original";
  const stagedDiff = "---\nname: x\nversion: 5\n---\nbody-CHANGED";
  const stagedBumped = "---\nname: x\nversion: 6\n---\nbody-CHANGED";
  const stagedRegressed = "---\nname: x\nversion: 3\n---\nbody-CHANGED";

  describe("bumpVersion", () => {
    it("no-op when content matches HEAD", () => {
      const r = bumpVersion(stagedSame, { kind: "found", version: 5 });
      expect(r.action).toBe("no-op");
    });

    it("bumps when content differs and version not increased", () => {
      const r = bumpVersion(stagedDiff, { kind: "found", version: 5 });
      expect(r.action).toBe("bumped");
      expect(r.fromVersion).toBe(5);
      expect(r.toVersion).toBe(6);
      expect(r.rewrittenContent).toContain("version: 6");
      expect(r.rewrittenContent).toContain("body-CHANGED");
    });

    it("no-op when content differs but user already bumped", () => {
      const r = bumpVersion(stagedBumped, { kind: "found", version: 5 });
      expect(r.action).toBe("no-op");
    });

    it("rejects version regression", () => {
      const r = bumpVersion(stagedRegressed, { kind: "found", version: 5 });
      expect(r.action).toBe("rejected");
      expect(r.rejectReason).toMatch(/regression/);
    });

    it("treats new file as version 1 when no version field", () => {
      const r = bumpVersion("---\nname: x\n---\nbody", { kind: "new-file" });
      expect(r.action).toBe("bumped");
      expect(r.fromVersion).toBe(null);
      expect(r.toVersion).toBe(1);
      expect(r.rewrittenContent).toContain("version: 1");
    });

    it("preserves explicit version on new file", () => {
      const r = bumpVersion("---\nname: x\nversion: 3\n---\nbody", { kind: "new-file" });
      expect(r.action).toBe("no-op");
      expect(r.toVersion).toBe(3);
    });

    it("rejects malformed frontmatter", () => {
      const r = bumpVersion("not a yaml frontmatter", { kind: "found", version: 1 });
      expect(r.action).toBe("rejected");
      expect(r.rejectReason).toMatch(/frontmatter/);
    });
  });
  ```
- [ ] Verify test fails: `pnpm test bump-version.test.ts` — expected: cannot find module
- [ ] Create `src/core/hooks/hook-logic/bump-version.ts`:
  ```typescript
  import type { BumpDecision } from "./types.js";
  import type { PreviousVersionResult } from "./get-previous-version.js";

  function parseStagedVersion(content: string): number | null {
    const match = content.match(/^version:\s*(\d+)\s*$/m);
    return match ? Number(match[1]) : null;
  }

  function hasFrontmatter(content: string): boolean {
    return /^---\s*$/m.test(content) && /^---\s*$/m.test(content.split("---").slice(2).join("---"));
  }

  function injectVersion(content: string, version: number): string {
    const trimmed = content.trimStart();
    if (!trimmed.startsWith("---")) {
      return content;
    }
    if (/^version:\s*\d+\s*$/m.test(content)) {
      return content.replace(/^version:\s*\d+\s*$/m, `version: ${version}`);
    }
    return content.replace(/^---$/m, `---\nversion: ${version}`);
  }

  function contentEqualsIgnoringVersion(a: string, b: string): boolean {
    const strip = (s: string) => s.replace(/^version:\s*\d+\s*$/m, "version: 0");
    return strip(a) === strip(b);
  }

  export function bumpVersion(
    stagedContent: string,
    previous: PreviousVersionResult,
    headContent?: string,
  ): BumpDecision {
    if (!hasFrontmatter(stagedContent)) {
      return {
        action: "rejected",
        fromVersion: null,
        toVersion: null,
        rejectReason: "missing or malformed frontmatter",
      };
    }

    const stagedVersion = parseStagedVersion(stagedContent);

    if (previous.kind === "new-file" || previous.kind === "no-head") {
      if (stagedVersion === null) {
        return {
          action: "bumped",
          fromVersion: null,
          toVersion: 1,
          rewrittenContent: injectVersion(stagedContent, 1),
        };
      }
      return {
        action: "no-op",
        fromVersion: null,
        toVersion: stagedVersion,
      };
    }

    const headVersion = previous.version;

    if (stagedVersion !== null && stagedVersion < headVersion) {
      return {
        action: "rejected",
        fromVersion: headVersion,
        toVersion: stagedVersion,
        rejectReason: `version regression: ${headVersion} -> ${stagedVersion}`,
      };
    }

    if (stagedVersion !== null && stagedVersion > headVersion) {
      return {
        action: "no-op",
        fromVersion: headVersion,
        toVersion: stagedVersion,
      };
    }

    if (headContent !== undefined && contentEqualsIgnoringVersion(stagedContent, headContent)) {
      return { action: "no-op", fromVersion: headVersion, toVersion: stagedVersion };
    }

    const newVersion = headVersion + 1;
    return {
      action: "bumped",
      fromVersion: headVersion,
      toVersion: newVersion,
      rewrittenContent: injectVersion(stagedContent, newVersion),
    };
  }
  ```
- [ ] Verify test passes: `pnpm test bump-version.test.ts` — expected: 7 passing
- [ ] Commit: `git add src/core/hooks/hook-logic/bump-version.ts tests/unit/core/hooks/hook-logic/bump-version.test.ts && git commit -m "feat(hooks): add bumpVersion decision function"`

**Verification**: `pnpm test bump-version.test.ts` — expected: 7 passing

---

### Task 5: Add updateManifest test and implementation

**Files**: `src/core/hooks/hook-logic/update-manifest.ts`, `tests/unit/core/hooks/hook-logic/update-manifest.test.ts`
**Est**: 4 min

**Steps**:
- [ ] Create `tests/unit/core/hooks/hook-logic/update-manifest.test.ts`:
  ```typescript
  import { describe, it, expect } from "vitest";
  import { updateManifestEntry, type ManifestShape } from "#src/core/hooks/hook-logic/update-manifest.js";

  function makeManifest(): ManifestShape {
    return {
      version: "1",
      artifacts: {
        "my-rule": {
          name: "my-rule",
          type: "rule",
          contentHash: "old-hash",
          installedArtifactVersion: 1,
          installedAt: "2026-04-01T00:00:00.000Z",
          managedBy: "user",
        },
      },
    };
  }

  describe("updateManifestEntry", () => {
    it("updates existing entry hash + version", () => {
      const m = makeManifest();
      const result = updateManifestEntry(m, {
        name: "my-rule",
        type: "rule",
        contentHash: "new-hash",
        installedArtifactVersion: 2,
        installedAt: "2026-04-28T11:30:00.000Z",
        managedBy: "user",
      });
      expect(result.artifacts["my-rule"].contentHash).toBe("new-hash");
      expect(result.artifacts["my-rule"].installedArtifactVersion).toBe(2);
    });

    it("adds new entry when missing", () => {
      const m = makeManifest();
      const result = updateManifestEntry(m, {
        name: "new-rule",
        type: "rule",
        contentHash: "hash-x",
        installedArtifactVersion: 1,
        installedAt: "2026-04-28T11:30:00.000Z",
        managedBy: "user",
      });
      expect(result.artifacts["new-rule"]).toBeDefined();
      expect(result.artifacts["new-rule"].contentHash).toBe("hash-x");
    });

    it("removes entry when null hash signals deletion", () => {
      const m = makeManifest();
      const result = updateManifestEntry(m, {
        name: "my-rule",
        delete: true,
      });
      expect(result.artifacts["my-rule"]).toBeUndefined();
    });

    it("preserves other entries", () => {
      const m = makeManifest();
      m.artifacts["other"] = {
        name: "other",
        type: "skill",
        contentHash: "h",
        installedArtifactVersion: 1,
        installedAt: "2026-04-01T00:00:00.000Z",
        managedBy: "user",
      };
      const result = updateManifestEntry(m, {
        name: "my-rule",
        type: "rule",
        contentHash: "new",
        installedArtifactVersion: 2,
        installedAt: "2026-04-28T11:30:00.000Z",
        managedBy: "user",
      });
      expect(result.artifacts["other"]).toBeDefined();
    });
  });
  ```
- [ ] Verify test fails: `pnpm test update-manifest.test.ts` — expected: cannot find module
- [ ] Create `src/core/hooks/hook-logic/update-manifest.ts`:
  ```typescript
  import type { ManifestArtifactEntry } from "./types.js";

  export interface ManifestShape {
    version: string;
    artifacts: Record<string, ManifestArtifactEntry>;
  }

  export type ManifestUpdate =
    | (ManifestArtifactEntry & { delete?: false })
    | { name: string; delete: true };

  export function updateManifestEntry(
    manifest: ManifestShape,
    update: ManifestUpdate,
  ): ManifestShape {
    const next: ManifestShape = {
      version: manifest.version,
      artifacts: { ...manifest.artifacts },
    };

    if ("delete" in update && update.delete) {
      delete next.artifacts[update.name];
      return next;
    }

    const entry = update as ManifestArtifactEntry;
    next.artifacts[entry.name] = {
      name: entry.name,
      type: entry.type,
      contentHash: entry.contentHash,
      installedArtifactVersion: entry.installedArtifactVersion,
      installedAt: entry.installedAt,
      managedBy: entry.managedBy,
    };
    return next;
  }
  ```
- [ ] Verify test passes: `pnpm test update-manifest.test.ts` — expected: 4 passing
- [ ] Commit: `git add src/core/hooks/hook-logic/update-manifest.ts tests/unit/core/hooks/hook-logic/update-manifest.test.ts && git commit -m "feat(hooks): add updateManifestEntry helper"`

**Verification**: `pnpm test update-manifest.test.ts` — expected: 4 passing

---

### Task 6: Add verifyRange test and implementation

**Files**: `src/core/hooks/hook-logic/verify-range.ts`, `tests/unit/core/hooks/hook-logic/verify-range.test.ts`
**Est**: 5 min

**Steps**:
- [ ] Create `tests/unit/core/hooks/hook-logic/verify-range.test.ts`:
  ```typescript
  import { describe, it, expect, vi, beforeEach } from "vitest";

  vi.mock("node:child_process", () => ({
    execFileSync: vi.fn(),
  }));
  const { execFileSync } = await import("node:child_process");
  const { verifyRange } = await import("#src/core/hooks/hook-logic/verify-range.js");

  describe("verifyRange", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("returns no offenders when version increased on every change", () => {
      vi.mocked(execFileSync)
        .mockReturnValueOnce("src/templates/rules/x.ts\n") // diff --name-only
        .mockReturnValueOnce("---\nversion: 5\n---\nold")  // git show base:path
        .mockReturnValueOnce("---\nversion: 6\n---\nnew"); // git show head:path
      const offenders = verifyRange("base-oid", "head-oid");
      expect(offenders).toEqual([]);
    });

    it("flags content change without version bump", () => {
      vi.mocked(execFileSync)
        .mockReturnValueOnce("src/templates/rules/x.ts\n")
        .mockReturnValueOnce("---\nversion: 5\n---\nold")
        .mockReturnValueOnce("---\nversion: 5\n---\nNEW");
      const offenders = verifyRange("base-oid", "head-oid");
      expect(offenders).toHaveLength(1);
      expect(offenders[0].path).toBe("src/templates/rules/x.ts");
      expect(offenders[0].reason).toBe("content-changed-without-bump");
    });

    it("flags version regression", () => {
      vi.mocked(execFileSync)
        .mockReturnValueOnce("src/templates/rules/x.ts\n")
        .mockReturnValueOnce("---\nversion: 5\n---\nold")
        .mockReturnValueOnce("---\nversion: 3\n---\nNEW");
      const offenders = verifyRange("base-oid", "head-oid");
      expect(offenders).toHaveLength(1);
      expect(offenders[0].reason).toBe("version-regression");
    });

    it("ignores non-artifact files in the diff", () => {
      vi.mocked(execFileSync).mockReturnValueOnce("README.md\nsrc/cli.ts\n");
      const offenders = verifyRange("base-oid", "head-oid");
      expect(offenders).toEqual([]);
    });

    it("returns empty when range is empty", () => {
      vi.mocked(execFileSync).mockReturnValueOnce("");
      const offenders = verifyRange("base-oid", "head-oid");
      expect(offenders).toEqual([]);
    });
  });
  ```
- [ ] Verify test fails: `pnpm test verify-range.test.ts` — expected: cannot find module
- [ ] Create `src/core/hooks/hook-logic/verify-range.ts`:
  ```typescript
  import { execFileSync } from "node:child_process";
  import type { VerifyOffender } from "./types.js";
  import { detectMode } from "./detect-mode.js";

  function gitShow(ref: string, path: string): string | null {
    try {
      return execFileSync("git", ["show", `${ref}:${path}`], {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch {
      return null;
    }
  }

  function parseVersion(content: string): number {
    const match = content.match(/^version:\s*(\d+)\s*$/m);
    return match ? Number(match[1]) : 1;
  }

  function contentChanged(a: string, b: string): boolean {
    const strip = (s: string) => s.replace(/^version:\s*\d+\s*$/m, "version: 0");
    return strip(a) !== strip(b);
  }

  export function verifyRange(baseOid: string, headOid: string): VerifyOffender[] {
    const diffOut = execFileSync(
      "git",
      ["diff", "--name-only", "--diff-filter=ACMR", `${baseOid}..${headOid}`],
      { encoding: "utf-8" },
    );
    const files = diffOut.trim().split("\n").filter(Boolean);

    const offenders: VerifyOffender[] = [];
    for (const path of files) {
      const baseContent = gitShow(baseOid, path);
      const headContent = gitShow(headOid, path);
      if (!baseContent || !headContent) continue;

      const inspection = detectMode(path, headContent);
      if (inspection.mode === "skip") continue;

      const baseVersion = parseVersion(baseContent);
      const headVersion = parseVersion(headContent);

      if (!contentChanged(baseContent, headContent)) continue;

      if (headVersion < baseVersion) {
        offenders.push({
          path,
          headVersion: baseVersion,
          pushVersion: headVersion,
          reason: "version-regression",
        });
        continue;
      }

      if (headVersion === baseVersion) {
        offenders.push({
          path,
          headVersion: baseVersion,
          pushVersion: headVersion,
          reason: "content-changed-without-bump",
        });
      }
    }
    return offenders;
  }
  ```
- [ ] Verify test passes: `pnpm test verify-range.test.ts` — expected: 5 passing
- [ ] Commit: `git add src/core/hooks/hook-logic/verify-range.ts tests/unit/core/hooks/hook-logic/verify-range.test.ts && git commit -m "feat(hooks): add verifyRange function for pre-push and CI"`

**Verification**: `pnpm test verify-range.test.ts` — expected: 5 passing

---

### Task 7: Create hook-logic barrel re-export

**Files**: `src/core/hooks/hook-logic/index.ts`
**Est**: 2 min

**Steps**:
- [ ] Create `src/core/hooks/hook-logic/index.ts`:
  ```typescript
  export { detectMode } from "./detect-mode.js";
  export { getPreviousVersion } from "./get-previous-version.js";
  export { bumpVersion } from "./bump-version.js";
  export { verifyRange } from "./verify-range.js";
  export { updateManifestEntry } from "./update-manifest.js";
  export type {
    HookMode,
    ArtifactInspection,
    BumpDecision,
    VerifyOffender,
    ManifestArtifactEntry,
  } from "./types.js";
  export type { PreviousVersionResult } from "./get-previous-version.js";
  export type { ManifestShape, ManifestUpdate } from "./update-manifest.js";
  ```
- [ ] Verify TypeScript compiles: `pnpm tsc --noEmit` — expected: 0 errors
- [ ] Verify all hook-logic tests pass: `pnpm test src/core/hooks/hook-logic` — expected: 25+ passing
- [ ] Commit: `git add src/core/hooks/hook-logic/index.ts && git commit -m "feat(hooks): expose hook-logic barrel"`

**Verification**: `pnpm test src/core/hooks/hook-logic` — expected: all hook-logic tests passing

---

## Section B — Pre-push hook template

### Task 8: Add pre-push template generator (snapshot-based)

**Files**: `src/core/hooks/version-verify-pre-push-template.ts`, `tests/unit/core/hooks/version-verify-pre-push-template.test.ts`
**Est**: 4 min

**Steps**:
- [ ] Create `tests/unit/core/hooks/version-verify-pre-push-template.test.ts`:
  ```typescript
  import { describe, it, expect } from "vitest";
  import { VERSION_VERIFY_PRE_PUSH_TEMPLATE } from "#src/core/hooks/version-verify-pre-push-template.js";

  describe("VERSION_VERIFY_PRE_PUSH_TEMPLATE", () => {
    it("starts with the node shebang", () => {
      expect(VERSION_VERIFY_PRE_PUSH_TEMPLATE.startsWith("#!/usr/bin/env node")).toBe(true);
    });

    it("reads pre-push args from stdin", () => {
      expect(VERSION_VERIFY_PRE_PUSH_TEMPLATE).toContain("process.stdin");
    });

    it("declares ZERO_OID for new-branch detection", () => {
      expect(VERSION_VERIFY_PRE_PUSH_TEMPLATE).toContain("0000000000000000000000000000000000000000");
      expect(VERSION_VERIFY_PRE_PUSH_TEMPLATE).toMatch(/ZERO_OID/);
    });

    it("handles branch deletion (skips when localOid is zero)", () => {
      expect(VERSION_VERIFY_PRE_PUSH_TEMPLATE).toMatch(/localOid === ZERO_OID/);
    });

    it("snapshot matches", () => {
      expect(VERSION_VERIFY_PRE_PUSH_TEMPLATE).toMatchSnapshot();
    });
  });
  ```
- [ ] Verify test fails: `pnpm test version-verify-pre-push-template.test.ts` — expected: cannot find module
- [ ] Create `src/core/hooks/version-verify-pre-push-template.ts`:
  ```typescript
  import { PROJECT_NAME, PROJECT_NAME_DISPLAY, PROJECT_CLI } from "#src/constants.js";

  /**
   * Pre-push hook that verifies every artifact change in the push range
   * has a version bump. Read-only — never mutates files. Catches commits
   * that bypassed the pre-commit auto-bump (--no-verify, missing hook).
   *
   * Reads pre-push args from stdin per git protocol:
   *   <local_ref> <local_oid> <remote_ref> <remote_oid>
   * one line per ref.
   */
  export const VERSION_VERIFY_PRE_PUSH_TEMPLATE = `#!/usr/bin/env node
  // ${PROJECT_NAME_DISPLAY} pre-push artifact version verifier
  // Auto-generated by ${PROJECT_CLI} init
  import { execFileSync } from 'child_process';

  const ZERO_OID = '0000000000000000000000000000000000000000';
  const PREFIX = '${PROJECT_NAME}';

  function isArtifactPath(p) {
    return (
      /^src\\/templates\\/(skills|agents)\\/[^/]+\\/template\\.ts$/.test(p) ||
      (/^src\\/templates\\/rules\\/[^/]+\\.ts$/.test(p) && !p.endsWith('/index.ts')) ||
      /^\\.codi\\/(rules|agents)\\/[^/]+\\.md$/.test(p) ||
      /^\\.codi\\/skills\\/[^/]+\\/SKILL\\.md$/.test(p)
    );
  }

  function gitShow(ref, path) {
    try {
      return execFileSync('git', ['show', ref + ':' + path], {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch { return null; }
  }

  function parseVersion(content) {
    const m = content.match(/^version:\\s*(\\d+)\\s*$/m);
    return m ? Number(m[1]) : 1;
  }

  function stripVersion(s) {
    return s.replace(/^version:\\s*\\d+\\s*$/m, 'version: 0');
  }

  function defaultBranchTip() {
    try {
      const ref = execFileSync('git', ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'], {
        encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'],
      }).trim();
      return execFileSync('git', ['rev-parse', ref], { encoding: 'utf-8' }).trim();
    } catch { return null; }
  }

  function resolveBase(localOid, remoteOid) {
    if (remoteOid !== ZERO_OID) return remoteOid;
    const tip = defaultBranchTip();
    if (!tip) return localOid;
    try {
      return execFileSync('git', ['merge-base', localOid, tip], { encoding: 'utf-8' }).trim();
    } catch { return localOid; }
  }

  function verifyRef(localOid, remoteOid) {
    if (localOid === ZERO_OID) return [];

    const baseOid = resolveBase(localOid, remoteOid);
    let diffOut = '';
    try {
      diffOut = execFileSync('git', ['diff', '--name-only', '--diff-filter=ACMR', baseOid + '..' + localOid], {
        encoding: 'utf-8',
      });
    } catch { return []; }

    const files = diffOut.trim().split('\\n').filter(Boolean).filter(isArtifactPath);
    const offenders = [];

    for (const path of files) {
      const baseContent = gitShow(baseOid, path);
      const headContent = gitShow(localOid, path);
      if (!baseContent || !headContent) continue;
      if (stripVersion(baseContent) === stripVersion(headContent)) continue;

      const baseVer = parseVersion(baseContent);
      const headVer = parseVersion(headContent);

      if (headVer < baseVer) {
        offenders.push({ path, base: baseVer, head: headVer, reason: 'regression' });
      } else if (headVer === baseVer) {
        offenders.push({ path, base: baseVer, head: headVer, reason: 'no-bump' });
      }
    }
    return offenders;
  }

  async function readStdin() {
    let buf = '';
    for await (const chunk of process.stdin) buf += chunk;
    return buf;
  }

  const stdin = await readStdin();
  const lines = stdin.trim().split('\\n').filter(Boolean);

  const allOffenders = [];
  for (const line of lines) {
    const parts = line.split(/\\s+/);
    if (parts.length < 4) continue;
    const localOid = parts[1];
    const remoteOid = parts[3];
    allOffenders.push(...verifyRef(localOid, remoteOid));
  }

  if (allOffenders.length === 0) process.exit(0);

  console.error('');
  console.error('\\u2717 [version-verify] ' + allOffenders.length + ' artifact(s) need version bumps before push');
  console.error('  files:');
  for (const o of allOffenders) {
    const tag = o.reason === 'regression'
      ? '(v' + o.base + ' -> v' + o.head + ', version regression)'
      : '(v' + o.base + ' -> v' + o.head + ', content changed)';
    console.error('    - ' + o.path + ' ' + tag);
  }
  console.error('  reason: pre-commit hook did not run or was bypassed');
  console.error('  fix: git add <files> && git commit --amend --no-edit');
  console.error('       (or re-install the hook: ${PROJECT_CLI} init --reinstall-hooks)');
  console.error('');
  process.exit(1);
  `;
  ```
- [ ] Verify test passes (snapshot is created): `pnpm test version-verify-pre-push-template.test.ts -u` — expected: 5 passing, snapshot written
- [ ] Commit: `git add src/core/hooks/version-verify-pre-push-template.ts tests/unit/core/hooks/version-verify-pre-push-template.test.ts tests/unit/core/hooks/__snapshots__ && git commit -m "feat(hooks): add pre-push version-verify template"`

**Verification**: `pnpm test version-verify-pre-push-template.test.ts` — expected: 5 passing

---

### Task 9: Wire pre-push template into hook-installer

**Files**: `src/core/hooks/hook-installer.ts`, `tests/unit/core/hooks/hook-installer.test.ts`
**Est**: 5 min

**Steps**:
- [ ] In `src/core/hooks/hook-installer.ts`, extend `InstallOptions` interface (around line 52) by adding a new optional flag `versionVerify?: boolean;` next to `versionBump?: boolean;` (the analogous existing flag — confirm spelling by reading line 52-90).
- [ ] At the top of the file, add the import next to the existing `VERSION_BUMP_TEMPLATE` import (around line 28):
  ```typescript
  import { VERSION_VERIFY_PRE_PUSH_TEMPLATE } from "./version-verify-pre-push-template.js";
  ```
- [ ] Inside `writeAuxiliaryScripts(hookDir, options)`, after the existing `if (options.versionBump) { ... }` block, add:
  ```typescript
  if (options.versionVerify) {
    const versionVerifyPath = path.join(hookDir, `${PROJECT_NAME}-version-verify.mjs`);
    await fs.writeFile(versionVerifyPath, VERSION_VERIFY_PRE_PUSH_TEMPLATE, {
      encoding: "utf-8",
      mode: 0o755,
    });
    files.push(path.relative(options.projectRoot, versionVerifyPath));
  }
  ```
- [ ] Find every call site that constructs `InstallOptions` (search: `grep -n "versionBump:" src/`) and add `versionVerify: <same-value-as-versionBump>` next to it — keeping the two flags symmetric for the initial rollout.
- [ ] Add test in `tests/unit/core/hooks/hook-installer.test.ts`:
  ```typescript
  import { describe, it, expect, beforeEach, afterEach } from "vitest";
  import fs from "node:fs/promises";
  import path from "node:path";
  import { mkdtemp, rm } from "node:fs/promises";
  import { tmpdir } from "node:os";
  import { installHooks } from "#src/core/hooks/hook-installer.js";

  describe("installHooks — version-verify (pre-push)", () => {
    let dir: string;
    beforeEach(async () => {
      dir = await mkdtemp(path.join(tmpdir(), "codi-hooks-"));
      await fs.mkdir(path.join(dir, ".git", "hooks"), { recursive: true });
    });
    afterEach(async () => {
      await rm(dir, { recursive: true, force: true });
    });

    it("writes codi-version-verify.mjs as executable when versionVerify=true", async () => {
      const result = await installHooks({
        projectRoot: dir,
        adapters: ["claude-code"],
        languages: ["typescript"],
        versionBump: true,
        versionVerify: true,
        // (any other required InstallOptions fields — fill in by reading the InstallOptions interface around line 52)
      } as Parameters<typeof installHooks>[0]);
      expect(result.ok).toBe(true);
      const target = path.join(dir, ".git", "hooks", "codi-version-verify.mjs");
      const stat = await fs.stat(target);
      expect(stat.isFile()).toBe(true);
      expect(stat.mode & 0o111).toBeTruthy();
      const content = await fs.readFile(target, "utf-8");
      expect(content).toContain("[version-verify]");
    });
  });
  ```
- [ ] Verify test passes: `pnpm test hook-installer.test.ts` — expected: passes
- [ ] Commit: `git add src/core/hooks/hook-installer.ts tests/unit/core/hooks/hook-installer.test.ts && git commit -m "feat(hooks): install pre-push version-verify hook (gated by versionVerify option)"`

**Verification**: `pnpm test hook-installer.test.ts` — expected: passes

---

### Task 10: Wire pre-push hook into hook-config-generator

**Files**: `src/core/hooks/hook-config-generator.ts`, `tests/unit/core/hooks/hook-config-generator.test.ts`
**Est**: 5 min

**Steps**:
- [ ] In `src/core/hooks/hook-config-generator.ts`, extend the existing `metaHook()` factory (around lines 17-50) to accept an optional `stages` parameter. Update its options type to include `stages?: HookStage[]`, default to `["pre-commit"]`. Inside the function body, replace the hardcoded `stages: ["pre-commit"]` (line 28) with `stages: opts.stages ?? ["pre-commit"]`. Same for the `preCommit` field if needed (preCommit is pre-commit-specific; for pre-push entries, set `preCommit: { kind: "local", entry: opts.entry, language: "system", passFilenames: false }` as a no-op — the pre-push entry won't be invoked from pre-commit anyway).
- [ ] Find the existing `version-bump` `metaHook` registration (per audit: line 198+ in `hook-config-generator.ts` near the codi-dev block, or wherever the search `grep -n "version-bump" src/core/hooks/hook-config-generator.ts` lands). Right after that registration, add the pre-push sibling:
  ```typescript
  allHooks.push(
    metaHook({
      name: "version-verify",
      entry: `node .git/hooks/${PROJECT_NAME}-version-verify.mjs`,
      files: "**/*",
      stages: ["pre-push"],
      passFiles: false,
    }),
  );
  ```
  (`passFiles: false` because pre-push runs once per push and gets push refs from stdin, not file lists.)
- [ ] Add test in `tests/unit/core/hooks/hook-config-generator.test.ts`:
  ```typescript
  import { describe, it, expect } from "vitest";
  import { generateHooksConfig } from "#src/core/hooks/hook-config-generator.js";
  import type { ResolvedFlags } from "#src/types/flags.js";

  function flags(): ResolvedFlags {
    // Minimal ResolvedFlags shape — confirm fields by reading
    // src/types/flags.ts; default to empty/false where possible
    return {} as ResolvedFlags;
  }

  describe("generateHooksConfig — pre-push wiring", () => {
    it("includes version-verify with stages=['pre-push']", () => {
      const config = generateHooksConfig(flags(), ["typescript"]);
      const verify = config.hooks.find((h) => h.name === "version-verify");
      expect(verify).toBeDefined();
      expect(verify?.stages).toEqual(["pre-push"]);
      expect(verify?.shell.command).toContain("codi-version-verify.mjs");
    });
  });
  ```
- [ ] Verify test passes: `pnpm test hook-config-generator.test.ts` — expected: passes
- [ ] Commit: `git add src/core/hooks/hook-config-generator.ts tests/unit/core/hooks/hook-config-generator.test.ts && git commit -m "feat(hooks): register pre-push version-verify (extends metaHook with stages)"`

**Verification**: `pnpm test hook-config-generator.test.ts` — expected: passes

---

## Section C — CI verification script

### Task 11: Add scripts/verify-artifact-versions.mjs

**Files**: `scripts/verify-artifact-versions.mjs`, `tests/integration/scripts/verify-artifact-versions.test.ts`
**Est**: 5 min

**Steps**:
- [ ] Create `scripts/verify-artifact-versions.mjs`:
  ```javascript
  #!/usr/bin/env node
  // Verify every artifact change between two refs has a version bump.
  // Used by pre-push hook (indirectly via the .mjs template) and by CI
  // workflow as a server-side gate.
  //
  // Usage:
  //   node scripts/verify-artifact-versions.mjs --base <ref> --head <ref>
  //
  // Exit codes:
  //   0 = no offenders
  //   1 = one or more artifact changes without version bump
  //   2 = invocation error (bad args, git error)
  import { execFileSync } from "child_process";

  function arg(name) {
    const i = process.argv.indexOf(name);
    return i >= 0 ? process.argv[i + 1] : null;
  }

  const base = arg("--base");
  const head = arg("--head");
  if (!base || !head) {
    console.error("usage: verify-artifact-versions --base <ref> --head <ref>");
    process.exit(2);
  }

  function isArtifactPath(p) {
    return (
      /^src\/templates\/(skills|agents)\/[^/]+\/template\.ts$/.test(p) ||
      (/^src\/templates\/rules\/[^/]+\.ts$/.test(p) && !p.endsWith("/index.ts")) ||
      /^\.codi\/(rules|agents)\/[^/]+\.md$/.test(p) ||
      /^\.codi\/skills\/[^/]+\/SKILL\.md$/.test(p)
    );
  }

  function gitShow(ref, path) {
    try {
      return execFileSync("git", ["show", `${ref}:${path}`], {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch {
      return null;
    }
  }

  function parseVersion(c) {
    const m = c.match(/^version:\s*(\d+)\s*$/m);
    return m ? Number(m[1]) : 1;
  }

  function stripVersion(s) {
    return s.replace(/^version:\s*\d+\s*$/m, "version: 0");
  }

  let diffOut = "";
  try {
    diffOut = execFileSync(
      "git",
      ["diff", "--name-only", "--diff-filter=ACMR", `${base}..${head}`],
      { encoding: "utf-8" },
    );
  } catch (e) {
    console.error("git diff failed:", String(e));
    process.exit(2);
  }

  const files = diffOut.trim().split("\n").filter(Boolean).filter(isArtifactPath);
  const offenders = [];

  for (const path of files) {
    const baseContent = gitShow(base, path);
    const headContent = gitShow(head, path);
    if (!baseContent || !headContent) continue;
    if (stripVersion(baseContent) === stripVersion(headContent)) continue;

    const baseVer = parseVersion(baseContent);
    const headVer = parseVersion(headContent);

    if (headVer < baseVer) {
      offenders.push({ path, base: baseVer, head: headVer, reason: "regression" });
    } else if (headVer === baseVer) {
      offenders.push({ path, base: baseVer, head: headVer, reason: "no-bump" });
    }
  }

  if (offenders.length === 0) {
    console.log(`[verify-artifact-versions] OK — ${files.length} artifact path(s) inspected, all bumped`);
    process.exit(0);
  }

  console.error("");
  console.error(`✗ [verify-artifact-versions] ${offenders.length} artifact(s) need version bumps`);
  console.error("  files:");
  for (const o of offenders) {
    const tag = o.reason === "regression"
      ? `(v${o.base} -> v${o.head}, version regression)`
      : `(v${o.base} -> v${o.head}, content changed)`;
    console.error(`    - ${o.path} ${tag}`);
  }
  console.error("  reason: artifact content changed without a corresponding version bump");
  console.error("  fix: bump the version: field in the frontmatter of each listed file");
  process.exit(1);
  ```
- [ ] Make executable: `chmod +x scripts/verify-artifact-versions.mjs`
- [ ] Quick smoke test: `node scripts/verify-artifact-versions.mjs --base HEAD --head HEAD` — expected: exit 0, "0 artifact path(s) inspected"
- [ ] Commit: `git add scripts/verify-artifact-versions.mjs && git commit -m "feat(ci): add verify-artifact-versions standalone script"`

**Verification**: `node scripts/verify-artifact-versions.mjs --base HEAD --head HEAD` — expected: exits 0

---

### Task 12: Add integration test for verify-artifact-versions script

**Files**: `tests/integration/scripts/verify-artifact-versions.test.ts`
**Est**: 5 min

**Steps**:
- [ ] Create `tests/integration/scripts/verify-artifact-versions.test.ts`:
  ```typescript
  import { describe, it, expect, beforeEach, afterEach } from "vitest";
  import { execFileSync } from "node:child_process";
  import fs from "node:fs/promises";
  import path from "node:path";
  import { mkdtemp, rm } from "node:fs/promises";
  import { tmpdir } from "node:os";
  import { fileURLToPath } from "node:url";

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const SCRIPT = path.resolve(__dirname, "../../../scripts/verify-artifact-versions.mjs");

  function git(cwd: string, args: string[]): string {
    return execFileSync("git", args, { cwd, encoding: "utf-8" });
  }

  function setupRepo(): string {
    const dir = mkdtemp(path.join(tmpdir(), "codi-verify-"));
    return dir as unknown as string;
  }

  describe("verify-artifact-versions.mjs", () => {
    let dir: string;
    beforeEach(async () => {
      dir = await mkdtemp(path.join(tmpdir(), "codi-verify-"));
      git(dir, ["init", "-q", "-b", "main"]);
      git(dir, ["config", "user.email", "test@example.com"]);
      git(dir, ["config", "user.name", "Test"]);
      await fs.mkdir(path.join(dir, "src", "templates", "rules"), { recursive: true });
    });

    afterEach(async () => {
      await rm(dir, { recursive: true, force: true });
    });

    it("exits 0 when artifact bumps are present", async () => {
      const file = path.join(dir, "src/templates/rules/test.ts");
      await fs.writeFile(file, "---\nname: test\nversion: 1\n---\noriginal", "utf-8");
      git(dir, ["add", "."]);
      git(dir, ["commit", "-q", "-m", "init"]);

      await fs.writeFile(file, "---\nname: test\nversion: 2\n---\nchanged", "utf-8");
      git(dir, ["add", "."]);
      git(dir, ["commit", "-q", "-m", "bump"]);

      const result = execFileSync(
        "node",
        [SCRIPT, "--base", "HEAD~1", "--head", "HEAD"],
        { cwd: dir, encoding: "utf-8" },
      );
      expect(result).toContain("OK");
    });

    it("exits 1 when artifact changed without version bump", async () => {
      const file = path.join(dir, "src/templates/rules/test.ts");
      await fs.writeFile(file, "---\nname: test\nversion: 1\n---\noriginal", "utf-8");
      git(dir, ["add", "."]);
      git(dir, ["commit", "-q", "-m", "init"]);

      await fs.writeFile(file, "---\nname: test\nversion: 1\n---\nchanged", "utf-8");
      git(dir, ["add", "."]);
      git(dir, ["commit", "-q", "-m", "no bump"]);

      let exitCode = 0;
      try {
        execFileSync("node", [SCRIPT, "--base", "HEAD~1", "--head", "HEAD"], {
          cwd: dir,
          encoding: "utf-8",
          stdio: "pipe",
        });
      } catch (e) {
        exitCode = (e as { status: number }).status;
      }
      expect(exitCode).toBe(1);
    });

    it("exits 0 when no artifact paths in diff", async () => {
      await fs.writeFile(path.join(dir, "README.md"), "v1", "utf-8");
      git(dir, ["add", "."]);
      git(dir, ["commit", "-q", "-m", "init"]);
      await fs.writeFile(path.join(dir, "README.md"), "v2", "utf-8");
      git(dir, ["add", "."]);
      git(dir, ["commit", "-q", "-m", "readme"]);

      const result = execFileSync(
        "node",
        [SCRIPT, "--base", "HEAD~1", "--head", "HEAD"],
        { cwd: dir, encoding: "utf-8" },
      );
      expect(result).toContain("0 artifact path(s) inspected");
    });
  });
  ```
- [ ] Verify test passes: `pnpm test tests/integration/scripts/verify-artifact-versions.test.ts` — expected: 3 passing
- [ ] Commit: `git add tests/integration/scripts/verify-artifact-versions.test.ts && git commit -m "test(ci): integration tests for verify-artifact-versions script"`

**Verification**: `pnpm test tests/integration/scripts/verify-artifact-versions.test.ts` — expected: 3 passing

---

### Task 13: Add CI workflow step

**Files**: `.github/workflows/ci.yml`
**Est**: 3 min

**Steps**:
- [ ] Read `.github/workflows/ci.yml` to find existing job structure
- [ ] Add a new step in the existing test job (or a new job called `verify-artifacts`) that runs after checkout:
  ```yaml
  - name: Verify artifact version bumps
    if: github.event_name == 'pull_request'
    run: |
      git fetch origin ${{ github.base_ref }} --depth=50
      node scripts/verify-artifact-versions.mjs \
        --base origin/${{ github.base_ref }} \
        --head HEAD
  ```
- [ ] Verify YAML syntax: `node -e "const yaml = require('yaml'); yaml.parse(require('fs').readFileSync('.github/workflows/ci.yml','utf-8'))"` — expected: no error
- [ ] Commit: `git add .github/workflows/ci.yml && git commit -m "ci: gate PRs on artifact version bumps via verify-artifact-versions"`

**Verification**: YAML parses; the step is visible in `.github/workflows/ci.yml`

---

## Section D — Doctor health checks

### Task 14: Add hook-installed checks to codi doctor

**Files**: `src/core/version/version-checker.ts`, `tests/unit/core/version/version-checker.test.ts`
**Est**: 5 min

**Steps**:
- [ ] Read `src/core/version/version-checker.ts` to confirm the actual return type is `Promise<Result<DoctorReport>>` where `DoctorReport.results: VersionCheckResult[]`. The check shape is `VersionCheckResult` (defined at line 10), NOT `DoctorCheck`.
- [ ] Add new check function inside `version-checker.ts`:
  ```typescript
  import fs from "node:fs/promises";
  import path from "node:path";
  import { PROJECT_NAME } from "#src/constants.js";

  async function checkHookInstalled(
    projectRoot: string,
    hookFileName: string,
    checkName: string,
  ): Promise<VersionCheckResult> {
    const hookPath = path.join(projectRoot, ".git", "hooks", hookFileName);
    try {
      const stat = await fs.stat(hookPath);
      const isExec = (stat.mode & 0o111) !== 0;
      return {
        check: checkName,
        passed: isExec,
        message: isExec
          ? `${hookFileName} installed and executable`
          : `${hookFileName} present but not executable — run: codi init --reinstall-hooks`,
      };
    } catch {
      return {
        check: checkName,
        passed: false,
        message: `${hookFileName} not installed — run: codi init --reinstall-hooks`,
      };
    }
  }
  ```
- [ ] Inside `runAllChecks(projectRoot, driftMode)`, push the new checks into the existing `results: VersionCheckResult[]` array (look for the line that initializes `const results: VersionCheckResult[] = []` and add after the existing pushes):
  ```typescript
  results.push(await checkHookInstalled(projectRoot, `${PROJECT_NAME}-version-bump.mjs`, "pre-commit-hook-installed"));
  results.push(await checkHookInstalled(projectRoot, `${PROJECT_NAME}-version-verify.mjs`, "pre-push-hook-installed"));
  ```
- [ ] Add test:
  ```typescript
  // tests/unit/core/version/version-checker.test.ts — extend existing file or create
  import { describe, it, expect, beforeEach, afterEach } from "vitest";
  import fs from "node:fs/promises";
  import path from "node:path";
  import { mkdtemp, rm } from "node:fs/promises";
  import { tmpdir } from "node:os";
  import { runAllChecks } from "#src/core/version/version-checker.js";

  describe("runAllChecks — hook installation", () => {
    let dir: string;
    beforeEach(async () => {
      dir = await mkdtemp(path.join(tmpdir(), "codi-doctor-"));
      await fs.mkdir(path.join(dir, ".git", "hooks"), { recursive: true });
    });
    afterEach(async () => {
      await rm(dir, { recursive: true, force: true });
    });

    it("flags pre-commit hook as missing when not installed", async () => {
      const r = await runAllChecks(dir, "warn");
      expect(r.ok).toBe(true);
      const check = r.ok ? r.data.results.find((c) => c.check === "pre-commit-hook-installed") : undefined;
      expect(check).toBeDefined();
      expect(check?.passed).toBe(false);
    });

    it("passes when pre-commit hook is installed and executable", async () => {
      const file = path.join(dir, ".git", "hooks", "codi-version-bump.mjs");
      await fs.writeFile(file, "#!/usr/bin/env node\n");
      await fs.chmod(file, 0o755);
      const r = await runAllChecks(dir, "warn");
      const check = r.ok ? r.data.results.find((c) => c.check === "pre-commit-hook-installed") : undefined;
      expect(check?.passed).toBe(true);
    });
  });
  ```
- [ ] Verify test passes: `pnpm test version-checker.test.ts` — expected: new tests pass
- [ ] Commit: `git add src/core/version/version-checker.ts tests/unit/core/version/version-checker.test.ts && git commit -m "feat(doctor): add pre-commit + pre-push hook installed checks"`

**Verification**: `pnpm test version-checker.test.ts` — expected: passes

---

### Task 15: Add templates-loadable check to doctor (extracted from template-registry-check)

**Files**: `src/core/version/version-checker.ts`, `tests/unit/core/version/version-checker.test.ts`
**Est**: 4 min

**Steps**:
- [ ] Add to `src/core/version/version-checker.ts`:
  ```typescript
  import { AVAILABLE_TEMPLATES, loadTemplate } from "#src/core/scaffolder/template-loader.js";
  import {
    AVAILABLE_SKILL_TEMPLATES,
    loadSkillTemplateContent,
  } from "#src/core/scaffolder/skill-template-loader.js";
  import {
    AVAILABLE_AGENT_TEMPLATES,
    loadAgentTemplate,
  } from "#src/core/scaffolder/agent-template-loader.js";

  function checkTemplatesLoadable(): VersionCheckResult {
    const errors: string[] = [];

    for (const name of AVAILABLE_TEMPLATES) {
      const r = loadTemplate(name);
      if (!r.ok || !r.data.trim()) errors.push(`rule "${name}": failed to load or empty`);
    }
    for (const name of AVAILABLE_SKILL_TEMPLATES) {
      const r = loadSkillTemplateContent(name);
      if (!r.ok || !r.data.trim()) errors.push(`skill "${name}": failed to load or empty`);
    }
    for (const name of AVAILABLE_AGENT_TEMPLATES) {
      const r = loadAgentTemplate(name);
      if (!r.ok || !r.data.trim()) errors.push(`agent "${name}": failed to load or empty`);
    }

    return {
      check: "templates-loadable",
      passed: errors.length === 0,
      message: errors.length === 0
        ? "all bundled templates load with non-empty content"
        : `${errors.length} template(s) failed to load:\n  ${errors.join("\n  ")}`,
    };
  }

  // In runAllChecks(), inside the existing function, push synchronously:
  results.push(checkTemplatesLoadable());
  ```
- [ ] Add test:
  ```typescript
  it("includes templates-loadable check that passes for current bundle", async () => {
    const r = await runAllChecks(process.cwd(), "warn");
    expect(r.ok).toBe(true);
    const check = r.ok ? r.data.results.find((c) => c.check === "templates-loadable") : undefined;
    expect(check).toBeDefined();
    expect(check?.passed).toBe(true);
  });
  ```
- [ ] Verify test passes: `pnpm test version-checker.test.ts` — expected: passes
- [ ] Commit: `git add src/core/version/version-checker.ts tests/unit/core/version/version-checker.test.ts && git commit -m "feat(doctor): add templates-loadable check (extracted from registry check)"`

**Verification**: `pnpm test version-checker.test.ts` — expected: passes

---

## Section E — Rewrite the version-bump pre-commit template

### Task 16: Snapshot test for current version-bump-template (lock current behavior before rewrite)

**Files**: `tests/unit/core/hooks/version-bump-template.test.ts`
**Est**: 2 min

**Steps**:
- [ ] Create `tests/unit/core/hooks/version-bump-template.test.ts`:
  ```typescript
  import { describe, it, expect } from "vitest";
  import { VERSION_BUMP_TEMPLATE } from "#src/core/hooks/version-bump-template.js";

  describe("VERSION_BUMP_TEMPLATE", () => {
    it("starts with the node shebang", () => {
      expect(VERSION_BUMP_TEMPLATE.startsWith("#!/usr/bin/env node")).toBe(true);
    });
    it("snapshot pins script bytes", () => {
      expect(VERSION_BUMP_TEMPLATE).toMatchSnapshot();
    });
  });
  ```
- [ ] Run with `-u` to seed initial snapshot of CURRENT (pre-rewrite) state: `pnpm test version-bump-template.test.ts -u`
- [ ] Commit: `git add tests/unit/core/hooks/version-bump-template.test.ts tests/unit/core/hooks/__snapshots__/ && git commit -m "test(hooks): add snapshot for version-bump-template (pre-rewrite baseline)"`

**Verification**: `pnpm test version-bump-template.test.ts` — expected: 2 passing

---

### Task 17: Rewrite version-bump-template to dual-mode + git-history-based

**Files**: `src/core/hooks/version-bump-template.ts`
**Est**: 5 min

**Steps**:
- [ ] Replace the entire content of `src/core/hooks/version-bump-template.ts` with:
  ```typescript
  import { PROJECT_NAME, PROJECT_NAME_DISPLAY, PROJECT_CLI } from "#src/constants.js";

  /**
   * Pre-commit hook that auto-bumps artifact version when content changed.
   * Works on both layers:
   *   - source: src/templates/{rules,skills,agents}/...
   *   - .codi/: user-managed → auto-bump + update artifact-manifest.json
   *             codi-managed → REJECT with fork-instead message
   * Uses `git show HEAD:path` as the source of "previous version" — no
   * baseline file is read or written.
   */
  export const VERSION_BUMP_TEMPLATE = `#!/usr/bin/env node
  // ${PROJECT_NAME_DISPLAY} artifact version auto-bump
  // Auto-generated by ${PROJECT_CLI} init
  import fs from 'fs';
  import path from 'path';
  import { execFileSync } from 'child_process';
  import { createHash } from 'crypto';

  const PREFIX = '${PROJECT_NAME}';
  const MANIFEST = '.codi/artifact-manifest.json';
  const ZERO = '0000000000000000000000000000000000000000';

  function staged() {
    try {
      return execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], { encoding: 'utf-8' })
        .trim().split('\\n').filter(Boolean);
    } catch { return []; }
  }

  function detect(p, content) {
    let m;
    if ((m = p.match(/^src\\/templates\\/skills\\/([^/]+)\\/template\\.ts$/))) return { mode: 'source', name: PREFIX + '-' + m[1], type: 'skill' };
    if ((m = p.match(/^src\\/templates\\/agents\\/([^/]+)\\/template\\.ts$/))) return { mode: 'source', name: PREFIX + '-' + m[1], type: 'agent' };
    if ((m = p.match(/^src\\/templates\\/rules\\/([^/]+)\\.ts$/)) && m[1] !== 'index') return { mode: 'source', name: PREFIX + '-' + m[1], type: 'rule' };

    let codiMatch;
    let type = null;
    if ((codiMatch = p.match(/^\\.codi\\/rules\\/([^/]+)\\.md$/))) type = 'rule';
    else if ((codiMatch = p.match(/^\\.codi\\/skills\\/([^/]+)\\/SKILL\\.md$/))) type = 'skill';
    else if ((codiMatch = p.match(/^\\.codi\\/agents\\/([^/]+)\\.md$/))) type = 'agent';
    if (codiMatch && type) {
      const mb = (content.match(/^managed_by:\\s*(codi|user)\\s*$/m) || [, 'user'])[1];
      return { mode: mb === 'codi' ? 'codi-managed' : 'user-managed', name: codiMatch[1], type };
    }
    return { mode: 'skip' };
  }

  function gitShow(ref, p) {
    try {
      return execFileSync('git', ['show', ref + ':' + p], { encoding: 'utf-8', stdio: ['ignore','pipe','pipe'] });
    } catch (e) {
      const stderr = e.stderr ? e.stderr.toString() : '';
      if (stderr.includes('does not exist')) return { kind: 'new-file' };
      return { kind: 'no-head' };
    }
  }

  function parseVersion(c) {
    const m = c.match(/^version:\\s*(\\d+)\\s*$/m);
    return m ? Number(m[1]) : null;
  }

  function injectVersion(c, v) {
    if (/^version:\\s*\\d+\\s*$/m.test(c)) return c.replace(/^version:\\s*\\d+\\s*$/m, 'version: ' + v);
    return c.replace(/^---$/m, '---\\nversion: ' + v);
  }

  function strip(c) { return c.replace(/^version:\\s*\\d+\\s*$/m, 'version: 0'); }

  function readManifest() {
    try { return JSON.parse(fs.readFileSync(MANIFEST, 'utf-8')); }
    catch { return null; }
  }

  function writeManifest(m) {
    fs.writeFileSync(MANIFEST, JSON.stringify(m, null, 2) + '\\n', 'utf-8');
  }

  function hash(c) { return createHash('sha256').update(c, 'utf-8').digest('hex'); }

  // --- Main ---
  const files = staged();
  if (files.length === 0) process.exit(0);

  const bumped = [];
  const restage = [];
  let manifest = readManifest();
  let manifestDirty = false;

  for (const file of files) {
    let stagedContent;
    try { stagedContent = fs.readFileSync(file, 'utf-8'); } catch { continue; }
    const det = detect(file, stagedContent);
    if (det.mode === 'skip') continue;

    if (det.mode === 'codi-managed') {
      console.error('');
      console.error('\\u2717 [version-bump] managed-by-codi artifact cannot be edited directly');
      console.error('  file: ' + file);
      console.error('  reason: managed_by: codi means this gets overwritten on \`${PROJECT_CLI} update\`');
      console.error('  fix: ${PROJECT_CLI} add ' + det.type + ' codi-' + det.name + ' --as my-' + det.name);
      console.error('');
      process.exit(1);
    }

    let prev;
    try {
      const headShow = execFileSync('git', ['show', 'HEAD:' + file], { encoding: 'utf-8', stdio: ['ignore','pipe','pipe'] });
      prev = { kind: 'found', content: headShow, version: parseVersion(headShow) || 1 };
    } catch (e) {
      const stderr = e.stderr ? e.stderr.toString() : '';
      if (stderr.includes('does not exist')) prev = { kind: 'new-file' };
      else prev = { kind: 'no-head' };
    }

    const stagedVer = parseVersion(stagedContent);

    if (prev.kind !== 'found') {
      if (stagedVer === null) {
        const updated = injectVersion(stagedContent, 1);
        fs.writeFileSync(file, updated, 'utf-8');
        bumped.push({ name: det.name, file, from: null, to: 1 });
        restage.push(file);
        if (det.mode === 'user-managed' && manifest) {
          manifest.artifacts[det.name] = {
            name: det.name, type: det.type,
            contentHash: hash(updated),
            installedArtifactVersion: 1,
            installedAt: new Date().toISOString(),
            managedBy: 'user',
          };
          manifestDirty = true;
        }
      }
      continue;
    }

    if (stagedVer !== null && stagedVer < prev.version) {
      console.error('\\u2717 [version-bump] version regression on ' + file + ': ' + prev.version + ' -> ' + stagedVer);
      console.error('  reason: artifact versions must monotonically increase');
      console.error('  fix: edit version: line to a value > ' + prev.version);
      process.exit(1);
    }

    if (stagedVer !== null && stagedVer > prev.version) continue; // user already bumped
    if (strip(stagedContent) === strip(prev.content)) continue; // content unchanged

    const newVer = prev.version + 1;
    const updated = injectVersion(stagedContent, newVer);
    fs.writeFileSync(file, updated, 'utf-8');
    bumped.push({ name: det.name, file, from: prev.version, to: newVer });
    restage.push(file);
    if (det.mode === 'user-managed' && manifest) {
      const existing = manifest.artifacts[det.name] || {};
      manifest.artifacts[det.name] = {
        name: det.name,
        type: det.type,
        contentHash: hash(updated),
        installedArtifactVersion: newVer,
        installedAt: existing.installedAt || new Date().toISOString(),
        managedBy: 'user',
      };
      manifestDirty = true;
    }
  }

  if (bumped.length === 0) process.exit(0);

  if (manifestDirty) {
    writeManifest(manifest);
    restage.push(MANIFEST);
  }

  execFileSync('git', ['add', ...restage], { stdio: 'inherit' });

  for (const b of bumped) {
    console.log('  [version-bump] ' + b.name + ': ' + (b.from === null ? 'new' : b.from) + ' \\u2192 ' + b.to);
  }
  console.log('  [version-bump] ' + bumped.length + ' artifact(s) bumped');
  `;
  ```
- [ ] Re-run snapshot test with `-u` to update: `pnpm test version-bump-template.test.ts -u` — expected: snapshot updated to dual-mode template
- [ ] Commit: `git add src/core/hooks/version-bump-template.ts tests/unit/core/hooks/__snapshots__/ && git commit -m "feat(hooks): rewrite version-bump as dual-mode + git-history-based"`

**Verification**: `pnpm test version-bump-template.test.ts` — expected: 2 passing (with new snapshot)

---

### Task 18: Integration test — pre-commit auto-bump on source

**Files**: `tests/integration/hooks/version-bump-source.test.ts`
**Est**: 5 min

**Steps**:
- [ ] Create `tests/integration/hooks/version-bump-source.test.ts`:
  ```typescript
  import { describe, it, expect, beforeEach, afterEach } from "vitest";
  import { execFileSync } from "node:child_process";
  import fs from "node:fs/promises";
  import { writeFileSync } from "node:fs";
  import path from "node:path";
  import { mkdtemp, rm } from "node:fs/promises";
  import { tmpdir } from "node:os";
  import { VERSION_BUMP_TEMPLATE } from "#src/core/hooks/version-bump-template.js";

  function git(cwd: string, args: string[]) {
    return execFileSync("git", args, { cwd, encoding: "utf-8" });
  }

  async function setupRepo(): Promise<string> {
    const dir = await mkdtemp(path.join(tmpdir(), "codi-bump-src-"));
    git(dir, ["init", "-q", "-b", "main"]);
    git(dir, ["config", "user.email", "test@example.com"]);
    git(dir, ["config", "user.name", "Test"]);
    await fs.mkdir(path.join(dir, "src", "templates", "rules"), { recursive: true });
    await fs.mkdir(path.join(dir, ".git", "hooks"), { recursive: true });
    const hookPath = path.join(dir, ".git", "hooks", "codi-version-bump.mjs");
    writeFileSync(hookPath, VERSION_BUMP_TEMPLATE, { encoding: "utf-8", mode: 0o755 });
    return dir;
  }

  describe("version-bump pre-commit (source layer)", () => {
    let dir: string;
    beforeEach(async () => { dir = await setupRepo(); });
    afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

    it("auto-bumps version when source template content changed", async () => {
      const file = path.join(dir, "src/templates/rules/test.ts");
      await fs.writeFile(file, "---\nname: test\nversion: 1\n---\noriginal");
      git(dir, ["add", "."]);
      git(dir, ["commit", "-q", "-m", "init"]);

      await fs.writeFile(file, "---\nname: test\nversion: 1\n---\nCHANGED");
      git(dir, ["add", "."]);

      // Run hook
      execFileSync("node", [path.join(dir, ".git/hooks/codi-version-bump.mjs")], { cwd: dir });

      const after = await fs.readFile(file, "utf-8");
      expect(after).toContain("version: 2");
      expect(after).toContain("CHANGED");
    });

    it("no-op when content matches HEAD", async () => {
      const file = path.join(dir, "src/templates/rules/test.ts");
      await fs.writeFile(file, "---\nname: test\nversion: 1\n---\nbody");
      git(dir, ["add", "."]);
      git(dir, ["commit", "-q", "-m", "init"]);
      git(dir, ["add", "."]);

      execFileSync("node", [path.join(dir, ".git/hooks/codi-version-bump.mjs")], { cwd: dir });

      const after = await fs.readFile(file, "utf-8");
      expect(after).toContain("version: 1");
    });

    it("rejects version regression", async () => {
      const file = path.join(dir, "src/templates/rules/test.ts");
      await fs.writeFile(file, "---\nname: test\nversion: 5\n---\nbody");
      git(dir, ["add", "."]);
      git(dir, ["commit", "-q", "-m", "init"]);

      await fs.writeFile(file, "---\nname: test\nversion: 3\n---\nCHANGED");
      git(dir, ["add", "."]);

      let err = "";
      let exitCode = 0;
      try {
        execFileSync("node", [path.join(dir, ".git/hooks/codi-version-bump.mjs")], {
          cwd: dir, encoding: "utf-8", stdio: "pipe",
        });
      } catch (e) {
        err = (e as { stderr: Buffer }).stderr.toString();
        exitCode = (e as { status: number }).status;
      }
      expect(exitCode).toBe(1);
      expect(err).toContain("regression");
    });
  });
  ```
- [ ] Verify test passes: `pnpm test version-bump-source.test.ts` — expected: 3 passing
- [ ] Commit: `git add tests/integration/hooks/version-bump-source.test.ts && git commit -m "test(hooks): integration tests for source-layer auto-bump"`

**Verification**: `pnpm test version-bump-source.test.ts` — expected: 3 passing

---

### Task 19: Integration test — pre-commit on `.codi/` user-managed

**Files**: `tests/integration/hooks/version-bump-user-managed.test.ts`
**Est**: 5 min

**Steps**:
- [ ] Create `tests/integration/hooks/version-bump-user-managed.test.ts`:
  ```typescript
  import { describe, it, expect, beforeEach, afterEach } from "vitest";
  import { execFileSync } from "node:child_process";
  import fs from "node:fs/promises";
  import { writeFileSync } from "node:fs";
  import path from "node:path";
  import { mkdtemp, rm } from "node:fs/promises";
  import { tmpdir } from "node:os";
  import { VERSION_BUMP_TEMPLATE } from "#src/core/hooks/version-bump-template.js";

  function git(cwd: string, args: string[]) {
    return execFileSync("git", args, { cwd, encoding: "utf-8" });
  }

  async function setupRepo(): Promise<string> {
    const dir = await mkdtemp(path.join(tmpdir(), "codi-bump-user-"));
    git(dir, ["init", "-q", "-b", "main"]);
    git(dir, ["config", "user.email", "test@example.com"]);
    git(dir, ["config", "user.name", "Test"]);
    await fs.mkdir(path.join(dir, ".codi", "rules"), { recursive: true });
    await fs.mkdir(path.join(dir, ".git", "hooks"), { recursive: true });
    writeFileSync(path.join(dir, ".git/hooks/codi-version-bump.mjs"), VERSION_BUMP_TEMPLATE, { mode: 0o755 });
    await fs.writeFile(
      path.join(dir, ".codi/artifact-manifest.json"),
      JSON.stringify({ version: "1", artifacts: {} }, null, 2),
    );
    return dir;
  }

  describe("version-bump pre-commit (.codi user-managed)", () => {
    let dir: string;
    beforeEach(async () => { dir = await setupRepo(); });
    afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

    it("auto-bumps + updates manifest on user-managed edit", async () => {
      const file = path.join(dir, ".codi/rules/my-rule.md");
      await fs.writeFile(file, "---\nname: my-rule\nmanaged_by: user\nversion: 1\n---\noriginal");
      git(dir, ["add", "."]);
      git(dir, ["commit", "-q", "-m", "init"]);

      await fs.writeFile(file, "---\nname: my-rule\nmanaged_by: user\nversion: 1\n---\nCHANGED");
      git(dir, ["add", "."]);
      execFileSync("node", [path.join(dir, ".git/hooks/codi-version-bump.mjs")], { cwd: dir });

      const after = await fs.readFile(file, "utf-8");
      expect(after).toContain("version: 2");

      const manifest = JSON.parse(await fs.readFile(path.join(dir, ".codi/artifact-manifest.json"), "utf-8"));
      expect(manifest.artifacts["my-rule"].installedArtifactVersion).toBe(2);
    });

    it("rejects edits to managed_by: codi artifacts with fork message", async () => {
      const file = path.join(dir, ".codi/rules/codi-debugging.md");
      await fs.writeFile(file, "---\nname: codi-debugging\nmanaged_by: codi\nversion: 11\n---\noriginal");
      git(dir, ["add", "."]);
      git(dir, ["commit", "-q", "-m", "init"]);

      await fs.writeFile(file, "---\nname: codi-debugging\nmanaged_by: codi\nversion: 11\n---\nCHANGED");
      git(dir, ["add", "."]);

      let err = "";
      let exitCode = 0;
      try {
        execFileSync("node", [path.join(dir, ".git/hooks/codi-version-bump.mjs")], {
          cwd: dir, encoding: "utf-8", stdio: "pipe",
        });
      } catch (e) {
        err = (e as { stderr: Buffer }).stderr.toString();
        exitCode = (e as { status: number }).status;
      }
      expect(exitCode).toBe(1);
      expect(err).toContain("managed-by-codi");
      expect(err).toMatch(/--as/);
    });

    it("creates new manifest entry for newly-added user-managed artifact", async () => {
      const file = path.join(dir, ".codi/rules/brand-new.md");
      await fs.writeFile(file, "---\nname: brand-new\nmanaged_by: user\n---\nbody");
      git(dir, ["add", "."]);
      execFileSync("node", [path.join(dir, ".git/hooks/codi-version-bump.mjs")], { cwd: dir });

      const after = await fs.readFile(file, "utf-8");
      expect(after).toContain("version: 1");

      const manifest = JSON.parse(await fs.readFile(path.join(dir, ".codi/artifact-manifest.json"), "utf-8"));
      expect(manifest.artifacts["brand-new"]).toBeDefined();
    });
  });
  ```
- [ ] Verify test passes: `pnpm test version-bump-user-managed.test.ts` — expected: 3 passing
- [ ] Commit: `git add tests/integration/hooks/version-bump-user-managed.test.ts && git commit -m "test(hooks): integration tests for .codi/ user-managed auto-bump"`

**Verification**: `pnpm test version-bump-user-managed.test.ts` — expected: 3 passing

---

### Task 20: Integration test — pre-push catches --no-verify bypass

**Files**: `tests/integration/hooks/version-verify-pre-push.test.ts`
**Est**: 5 min

**Steps**:
- [ ] Create `tests/integration/hooks/version-verify-pre-push.test.ts`:
  ```typescript
  import { describe, it, expect, beforeEach, afterEach } from "vitest";
  import { execFileSync, spawnSync } from "node:child_process";
  import fs from "node:fs/promises";
  import { writeFileSync } from "node:fs";
  import path from "node:path";
  import { mkdtemp, rm } from "node:fs/promises";
  import { tmpdir } from "node:os";
  import { VERSION_VERIFY_PRE_PUSH_TEMPLATE } from "#src/core/hooks/version-verify-pre-push-template.js";

  function git(cwd: string, args: string[]) {
    return execFileSync("git", args, { cwd, encoding: "utf-8" });
  }

  async function setupRepo(): Promise<string> {
    const dir = await mkdtemp(path.join(tmpdir(), "codi-prepush-"));
    git(dir, ["init", "-q", "-b", "main"]);
    git(dir, ["config", "user.email", "test@example.com"]);
    git(dir, ["config", "user.name", "Test"]);
    await fs.mkdir(path.join(dir, "src", "templates", "rules"), { recursive: true });
    await fs.mkdir(path.join(dir, ".git", "hooks"), { recursive: true });
    writeFileSync(path.join(dir, ".git/hooks/codi-version-verify.mjs"), VERSION_VERIFY_PRE_PUSH_TEMPLATE, { mode: 0o755 });
    return dir;
  }

  function runHook(dir: string, stdin: string) {
    return spawnSync("node", [path.join(dir, ".git/hooks/codi-version-verify.mjs")], {
      cwd: dir, input: stdin, encoding: "utf-8",
    });
  }

  describe("version-verify pre-push", () => {
    let dir: string;
    beforeEach(async () => { dir = await setupRepo(); });
    afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

    it("rejects push range with unbumped artifact change", async () => {
      const file = path.join(dir, "src/templates/rules/x.ts");
      await fs.writeFile(file, "---\nname: x\nversion: 1\n---\nbody");
      git(dir, ["add", "."]);
      git(dir, ["commit", "-q", "-m", "init"]);
      const baseOid = git(dir, ["rev-parse", "HEAD"]).trim();

      await fs.writeFile(file, "---\nname: x\nversion: 1\n---\nCHANGED");
      git(dir, ["add", "."]);
      git(dir, ["commit", "-q", "-m", "skip bump"]);
      const headOid = git(dir, ["rev-parse", "HEAD"]).trim();

      const stdin = `refs/heads/main ${headOid} refs/heads/main ${baseOid}\n`;
      const r = runHook(dir, stdin);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain("[version-verify]");
      expect(r.stderr).toContain("content changed");
    });

    it("allows push range with proper version bumps", async () => {
      const file = path.join(dir, "src/templates/rules/x.ts");
      await fs.writeFile(file, "---\nname: x\nversion: 1\n---\nbody");
      git(dir, ["add", "."]);
      git(dir, ["commit", "-q", "-m", "init"]);
      const baseOid = git(dir, ["rev-parse", "HEAD"]).trim();

      await fs.writeFile(file, "---\nname: x\nversion: 2\n---\nCHANGED");
      git(dir, ["add", "."]);
      git(dir, ["commit", "-q", "-m", "bumped"]);
      const headOid = git(dir, ["rev-parse", "HEAD"]).trim();

      const stdin = `refs/heads/main ${headOid} refs/heads/main ${baseOid}\n`;
      const r = runHook(dir, stdin);
      expect(r.status).toBe(0);
    });

    it("allows branch deletion (zero local_oid)", async () => {
      const stdin = `(delete) 0000000000000000000000000000000000000000 refs/heads/foo abcdef\n`;
      const r = runHook(dir, stdin);
      expect(r.status).toBe(0);
    });
  });
  ```
- [ ] Verify test passes: `pnpm test version-verify-pre-push.test.ts` — expected: 3 passing
- [ ] Commit: `git add tests/integration/hooks/version-verify-pre-push.test.ts && git commit -m "test(hooks): integration tests for pre-push verification"`

**Verification**: `pnpm test version-verify-pre-push.test.ts` — expected: 3 passing

---

## Section F — Wire up the new system

### Task 21: Reorder .husky/pre-commit so version-bump runs first

**Files**: `.husky/pre-commit`
**Est**: 2 min

**Steps**:
- [ ] Open `.husky/pre-commit`. The current order is: `STAGED=...` (line 2-3) → ~60 lines of lint/tsc/ruff/pyright/shellcheck blocks → near-end `[ -n "$STAGED" ] && node .git/hooks/codi-version-bump.mjs` line.
- [ ] Cut the `node .git/hooks/codi-version-bump.mjs` invocation line and paste it RIGHT AFTER the `STAGED=$(git diff --cached --name-only --diff-filter=ACMR)` line, BEFORE the `[ -n "$STAGED" ] && printf '%s\n' $STAGED | xargs node .git/hooks/codi-staged-junk-check.mjs` line.
- [ ] Verify bash syntax: `bash -n .husky/pre-commit` — expected: no errors
- [ ] Manual smoke: stage a no-op change and commit, observe the version-bump line in the pre-commit output appearing FIRST. Then `git reset --hard HEAD~1` to clean up.
- [ ] Commit the reorder: `git add .husky/pre-commit && git commit -m "chore(hooks): run version-bump first in pre-commit chain"`

**Verification**: `bash -n .husky/pre-commit` — expected: no syntax errors

---

### Task 22: Reorder version-bump to FIRST stage in generated user pre-commit

**Files**: `src/core/hooks/hook-config-generator.ts`, `tests/unit/core/hooks/hook-config-generator.test.ts`
**Est**: 4 min

**Steps**:
- [ ] In `src/core/hooks/hook-config-generator.ts`, locate the existing `version-bump` `metaHook()` registration. The audit shows it lives in the codi-dev hooks block (Stage 5, around line 270+); it currently runs near the end of the hooks list. Move that `allHooks.push(metaHook({ name: "version-bump", ... }))` call to BEFORE Stage 1's first push (currently `staged-junk-check`).
- [ ] Reuse the existing `metaHook()` arguments verbatim (just relocate the push call) so behavior is identical except for ordering.
- [ ] Note: this affects both the codi self-hosting context AND the user-project context (the same generator function serves both via `isCodiAuthoringContext()`). Confirm the moved registration is unconditional or stays inside the existing condition — match the original.
- [ ] Add test in `tests/unit/core/hooks/hook-config-generator.test.ts`:
  ```typescript
  it("places version-bump first in pre-commit hook order (codi authoring context)", () => {
    // Run inside the codi repo so isCodiAuthoringContext() returns true; the
    // version-bump hook is registered and should be first.
    const config = generateHooksConfig(flags(), ["typescript"]);
    const preCommit = config.hooks.filter((h) => h.stages.includes("pre-commit"));
    expect(preCommit[0].name).toBe("version-bump");
  });
  ```
  (Reuse the `flags()` helper from Task 10's test file, or copy it.)
- [ ] Verify test passes: `pnpm test hook-config-generator.test.ts` — expected: passes
- [ ] Commit: `git add src/core/hooks/hook-config-generator.ts tests/unit/core/hooks/hook-config-generator.test.ts && git commit -m "fix(hooks): version-bump runs first in generated pre-commit chain"`

**Verification**: `pnpm test hook-config-generator.test.ts` — expected: passes

---

### Task 23: Self-hosting validation — full test suite + manual check

**Files**: (none — runs the existing suite)
**Est**: 3 min

**Steps**:
- [ ] Run full test suite: `pnpm test` — expected: all tests passing
- [ ] Manual check: edit `src/templates/rules/codi-security.ts` (just add a trailing newline), `git add`, `git commit -m "test: trigger version-bump"` — expected: hook auto-bumps version, commit succeeds, log shows `[version-bump] codi-security: N -> N+1`
- [ ] Reset that test commit: `git reset --hard HEAD~1`
- [ ] Manual check on `.codi/` user-managed: pick a `managed_by: user` file, edit, stage, commit — expected: hook bumps, manifest updates
- [ ] Manual check on `.codi/` codi-managed: edit any `.codi/skills/codi-X/SKILL.md`, stage, attempt commit — expected: hook rejects with fork message
- [ ] Reset the failed staging: `git restore --staged .codi/skills/codi-X/SKILL.md && git checkout .codi/skills/codi-X/SKILL.md`
- [ ] No commit needed for this validation task

**Verification**: All three manual checks behave as expected; full test suite green

---

## Section G — Remove the legacy runtime check

### Task 24: Remove runtime check from src/cli.ts

**Files**: `src/cli.ts`, `tests/unit/cli/init-registry-guard.test.ts` (if any other test asserts on the runtime check), `tests/integration/full-pipeline.test.ts` (update if it references)
**Est**: 3 min

**Steps**:
- [ ] Edit `src/cli.ts`: delete line 33 (`import { checkTemplateRegistry } from "./core/scaffolder/template-registry-check.js";`) and the block at lines 79-89 (the `const registryErrors = checkTemplateRegistry();` call and the if-block). The `program.action(async () => { ... })` becomes:
  ```typescript
  program.action(async () => {
    const opts = program.opts() as GlobalOptions;
    if (opts.json || opts.quiet) {
      program.help();
      return;
    }
    Logger.init({ level: "info", mode: "human", noColor: opts.noColor ?? false });
    await checkForUpdate(pkg.version);
    await runCommandCenter(process.cwd());
  });
  ```
- [ ] Verify no broken imports: `pnpm tsc --noEmit` — expected: 0 errors
- [ ] Run integration tests: `pnpm test tests/integration` — expected: passes (any test that depended on the runtime check firing is updated in Task 26)
- [ ] Commit: `git add src/cli.ts && git commit -m "refactor(cli): remove runtime template registry integrity check"`

**Verification**: `pnpm tsc --noEmit` — expected: 0 errors

---

### Task 25: Remove runtime check from src/cli/init.ts

**Files**: `src/cli/init.ts`
**Est**: 3 min

**Steps**:
- [ ] Edit `src/cli/init.ts`: locate the `checkTemplateRegistry` import (currently at line 50, may drift) via `grep -n "checkTemplateRegistry" src/cli/init.ts` and delete it. Then locate the call site (`const registryErrors = checkTemplateRegistry();` — currently around line 137) and delete the entire if-block that follows (typically 7-8 lines through the closing brace)
- [ ] Verify TypeScript: `pnpm tsc --noEmit` — expected: 0 errors
- [ ] Run init tests: `pnpm test tests/unit/cli/init.test.ts` — expected: passes (broken cases removed in Task 26)
- [ ] Commit: `git add src/cli/init.ts && git commit -m "refactor(init): remove runtime template registry integrity check"`

**Verification**: `pnpm tsc --noEmit` — expected: 0 errors

---

### Task 26: Update tests that imported the deleted symbols

**Files**: `tests/unit/cli/init.test.ts`, `tests/integration/full-pipeline.test.ts`, `tests/integration/self-introspection.test.ts`, `tests/integration/skill-management.test.ts`
**Est**: 5 min

**Steps**:
- [ ] In each file, search for `checkTemplateRegistry` and `checkArtifactVersionBaseline` imports/uses
- [ ] Remove the import line(s)
- [ ] Remove or update test cases that asserted on the runtime check firing
- [ ] For cases that asserted "happy path completes despite registry being valid", remove the assertion (the registry check no longer runs)
- [ ] Verify tests pass: `pnpm test tests/unit/cli/init.test.ts tests/integration` — expected: all passing
- [ ] Commit: `git add tests/unit/cli/init.test.ts tests/integration/ && git commit -m "test: remove references to deleted runtime registry check"`

**Verification**: `pnpm test tests/unit/cli/init.test.ts tests/integration` — expected: all passing

---

### Task 27: Delete artifact-version-baseline files and template-registry-check.ts

**Files**: deletes `src/core/version/artifact-version-baseline.json`, `src/core/version/artifact-version-baseline.ts`, `src/core/scaffolder/template-registry-check.ts`
**Est**: 3 min

**Steps**:
- [ ] `git rm src/core/version/artifact-version-baseline.json`
- [ ] `git rm src/core/version/artifact-version-baseline.ts`
- [ ] `git rm src/core/scaffolder/template-registry-check.ts`
- [ ] Search for any remaining references: `grep -rn "artifact-version-baseline\|template-registry-check\|checkArtifactVersionBaseline\|checkTemplateRegistry" src/`
- [ ] If references found, remove or replace them (most should already be gone after Tasks 24-25; the doctor check from Task 15 covered the surviving load checks)
- [ ] Verify TypeScript: `pnpm tsc --noEmit` — expected: 0 errors
- [ ] Verify full suite: `pnpm test` — expected: all passing
- [ ] Commit: `git add -A && git commit -m "refactor(version): delete artifact-version-baseline and template-registry-check"`

**Verification**: `pnpm tsc --noEmit && pnpm test` — expected: clean

---

### Task 28: Delete obsolete tests

**Files**: deletes `tests/release/generate-baseline.test.ts`, `tests/release/artifact-version-baseline.test.ts`, `tests/unit/core/version/artifact-version-baseline.test.ts`, `tests/unit/core/scaffolder/template-registry-check.test.ts`, `tests/unit/cli/init-registry-guard.test.ts`
**Est**: 2 min

**Steps**:
- [ ] `git rm tests/release/generate-baseline.test.ts tests/release/artifact-version-baseline.test.ts tests/unit/core/version/artifact-version-baseline.test.ts tests/unit/core/scaffolder/template-registry-check.test.ts tests/unit/cli/init-registry-guard.test.ts`
- [ ] Verify suite: `pnpm test` — expected: all passing, fewer tests
- [ ] Commit: `git add -A && git commit -m "test: remove obsolete tests for deleted runtime check"`

**Verification**: `pnpm test` — expected: passes

---

### Task 29: Remove baseline:update from package.json

**Files**: `package.json`
**Est**: 2 min

**Steps**:
- [ ] Edit `package.json`: delete the `"baseline:update": "vitest run tests/release/generate-baseline.test.ts"` line from `scripts`
- [ ] Verify scripts list: `node -e "console.log(Object.keys(require('./package.json').scripts).join('\n'))"` — expected: `baseline:update` absent
- [ ] Run full suite once more: `pnpm test` — expected: clean
- [ ] Run lint: `pnpm lint` — expected: clean
- [ ] Commit: `git add package.json && git commit -m "chore: remove baseline:update script (no baseline file remains)"`

**Verification**: `pnpm test && pnpm lint` — expected: clean

---

## Section H — Final validation

### Task 30: Full suite + bundle smoke test

**Files**: (none — verification only)
**Est**: 3 min

**Steps**:
- [ ] `pnpm install` — expected: no warnings about missing scripts
- [ ] `pnpm lint` — expected: 0 errors
- [ ] `pnpm test` — expected: all green
- [ ] `pnpm build` — expected: dist rebuilt successfully
- [ ] Bundle smoke: `node -e "
  const {spawn} = require('child_process');
  const child = spawn('node', ['dist/cli.js'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  child.stdout.on('data', d => out += d.toString());
  child.stderr.on('data', d => out += d.toString());
  setTimeout(() => child.kill('SIGTERM'), 1500);
  child.on('close', code => {
    if (out.includes('integrity check failed')) { console.error('FAIL: integrity error appeared'); process.exit(1); }
    console.log('OK: hub launches without integrity check');
  });
  "` — expected: "OK: hub launches without integrity check"
- [ ] No commit needed (verification only)

**Verification**: All above commands succeed; smoke test prints "OK"

---

## Plan-Document-Reviewer Issues Addressed (2026-04-28)

Six concrete API / signature mismatches surfaced by the reviewer subagent and corrected inline:

1. **Task 8** — replaced `local_oid`/`deletion` regex with `ZERO_OID` + `localOid === ZERO_OID` matchers that match the actual camelCase identifiers in the template.
2. **Task 9** — uses real exported function `installHooks` (not `installCodiHooks`); follows the existing `writeAuxiliaryScripts` pattern with a new `versionVerify` flag added to `InstallOptions`.
3. **Task 10** — extends `metaHook()` to accept `stages?: HookStage[]`; uses real `metaHook()` factory shape (`shell.command`, `stages: HookStage[]`, no `trigger` field); test calls `generateHooksConfig(flags, languages)` with the real signature.
4. **Tasks 14, 15** — uses real return type `Promise<Result<DoctorReport>>` and traverses `r.data.results` instead of fictional `r.checks`. The check shape is `VersionCheckResult` (real type at line 10), not `DoctorCheck` (which doesn't exist).
5. **Task 21** — replaced relative phrasing with the exact insertion location (after the `STAGED=...` line, before `staged-junk-check`).
6. **Task 22** — clarified that "first position" means moving the existing `metaHook` registration before Stage 1's first push, not adding a new entry.

### Task 31: Final consolidation — single commit + PR

**Files**: (none — git operations only)
**Est**: 4 min

**Steps**:
- [ ] Confirm working tree contains all the staged-throughout-tasks changes: `git status` — expected: many files modified/added/deleted, none uncommitted leftovers from unrelated work
- [ ] Run final pre-flight: `pnpm lint && pnpm test && pnpm build` — expected: all green
- [ ] Single commit with consolidated body summarizing every task's intent:
  ```
  refactor(artifacts): eliminate baseline file, three-layer enforcement model

  Implements docs/20260428_1107_PLAN_artifact-versioning-refactor.md.

  Removed:
  - src/core/version/artifact-version-baseline.json
  - src/core/version/artifact-version-baseline.ts
  - src/core/scaffolder/template-registry-check.ts
  - tests/release/generate-baseline.test.ts (+ 4 sibling tests)
  - Runtime registry check at cli.ts:79 and init.ts:135
  - package.json scripts.baseline:update

  Added:
  - src/core/hooks/hook-logic/ — pure functions for hook scripts (5 modules + barrel)
  - src/core/hooks/version-verify-pre-push-template.ts — pre-push verification hook
  - scripts/verify-artifact-versions.mjs — shared CI/local verification CLI
  - .github/workflows/ci.yml step — server-side gate on PRs

  Changed:
  - src/core/hooks/version-bump-template.ts — dual-mode (source + .codi/),
    managed_by-aware, git-history-based (no baseline file read or written)
  - src/core/hooks/hook-config-generator.ts — pre-push wiring, version-bump
    moved to first stage of pre-commit chain
  - src/core/hooks/hook-installer.ts — installs version-verify hook gated by
    new versionVerify InstallOption
  - src/core/version/version-checker.ts — adds pre-commit-hook-installed,
    pre-push-hook-installed, templates-loadable doctor checks
  - .husky/pre-commit — version-bump runs first

  Net effect:
  - End users no longer see "Template registry integrity check failed" — that
    runtime check is removed.
  - The .codi/ second-layer enforcement that previously shipped as dead code
    (regex never matched user paths) now actually works — auto-bump on
    user-managed edits, reject on codi-managed edits with fork command.
  - The drift-between-stored-and-computed-hash bug class behind the v2.13.0
    incident is structurally impossible (no parallel hash cache exists).
  ```
- [ ] `git push` — expected: pre-push hook (now installed) runs and passes (since all artifact changes were properly bumped via the pre-commit hook earlier)
- [ ] Open PR: `gh pr create --base develop --title "refactor(artifacts): eliminate baseline, three-layer enforcement" --body-file <(cat <<'EOF'
  ## Summary

  Implements docs/20260428_1107_PLAN_artifact-versioning-refactor.md.

  Three-layer enforcement (pre-commit auto-bump + pre-push verify + CI gate)
  replaces the runtime check that bricked end users. Eliminates
  artifact-version-baseline.json — git history replaces it.

  ## Test plan
  - [x] Full unit + integration suite passes
  - [x] Bundle smoke test confirms hub launches without integrity check
  - [x] Self-hosting check: editing source template auto-bumps; editing
        managed_by:user .codi/ artifact auto-bumps + manifest updates;
        editing managed_by:codi .codi/ artifact rejects with fork message
  EOF
  )`

**Verification**: PR opens, CI passes, no per-task commits in the branch — single consolidated commit on top of the branch base

---

## Pre-Write Self-Review (run before presenting plan)

1. **Spec coverage**: Each spec section has a corresponding task or set of tasks?
   - §4.1 (pillars) — implicit in the design; no code task needed.
   - §4.2 (3-layer enforcement) — Tasks 17 (pre-commit), 8 (pre-push), 13 (CI). ✓
   - §4.3 (dual-mode hook) — Tasks 2-7 (logic), 17 (template). ✓
   - §4.3.1 (edge cases) — Covered in unit tests (Tasks 3, 4) and integration tests (Tasks 18-20). ✓
   - §4.4 (component inventory) — Tasks 1-22 add new files; Tasks 24-29 delete old ones. ✓
   - §4.5-4.7 (data flows) — Validated by integration tests in Tasks 18-20 and self-hosting check in Task 23. ✓
   - §4.8 (error model) — Locked reject-message templates appear verbatim in Task 17 hook code and Task 8 pre-push code. ✓
   - §5 (testing) — Tasks 2-6 (unit), 18-20 (integration), 8 (snapshot). ✓
   - §6 (rollout) — Task ordering matches §6.2 step sequence. ✓

2. **Placeholder scan**: No `TBD`, `TODO`, `[fill in]`, "similar to" without explicit code, or "add error handling" hand-waves remain.

3. **Type consistency**: `HookMode`, `ArtifactInspection`, `BumpDecision`, `VerifyOffender`, `ManifestArtifactEntry`, `ManifestShape`, `ManifestUpdate`, `PreviousVersionResult` — all defined in Task 1 or 3 or 5, used consistently in later tasks.

4. **Task quality**: Each task has a real test (or is verification-only with no test scope), exact files, runnable commands, TDD order where applicable, conventional commit message.

## Post-Plan Subagent Review

After writing this plan, dispatch the plan-document-reviewer subagent for an independent check before presenting to the user.

## Hand-off

This is an implementation plan. After approval, invoke `codi-plan-execution` to begin executing tasks. That skill prompts for INLINE (sequential, watch-along) or SUBAGENT (fresh subagent per task with two-stage review) mode.
