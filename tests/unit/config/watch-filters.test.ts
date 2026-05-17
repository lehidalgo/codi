/**
 * Unit tests for `isSourceArtifactChange` in
 * `src/core/config/watch-filters.ts`.
 *
 * These guard against ISSUE-004 (codi watch infinite regenerate loop): the
 * predicate must return `false` for every file the regenerate cycle writes
 * under `.codi/` (state, lock sentinels, audit log, backups, hooks…) and
 * `true` for every source artifact whose modification should kick off a
 * regenerate.
 *
 * Added 2026-05-17 with the fix for ISSUE-004 + ISSUE-005.
 */

import { describe, it, expect } from "vitest";
import { isSourceArtifactChange } from "#src/core/config/watch-filters.js";

describe("isSourceArtifactChange", () => {
  describe("source artifacts (should trigger regenerate)", () => {
    it.each([
      ["rules/my-rule.md"],
      ["skills/codi-test/SKILL.md"],
      ["skills/codi-test/scripts/helper.sh"],
      ["agents/code-reviewer.md"],
      ["mcp-servers/github.yaml"],
      ["codi.yaml"],
      ["flags.yaml"],
      ["mcp.yaml"],
    ])("returns true for %s", (p) => {
      expect(isSourceArtifactChange(p)).toBe(true);
    });

    it("normalises Windows backslashes", () => {
      expect(isSourceArtifactChange("rules\\my-rule.md")).toBe(true);
      expect(isSourceArtifactChange("skills\\codi-test\\SKILL.md")).toBe(true);
    });
  });

  describe("derived / generated files (must NOT trigger regenerate)", () => {
    it.each([
      // The exact paths that caused ISSUE-004
      ["state/state.json"],
      ["state/state.json.lock"],
      ["state/state.json.tmp.abc123"],
      ["state/operations.json"],
      ["state/artifact-manifest.json"],
      // Generated subdirs
      ["backups/2026-05-17T10-00-00-000Z/CLAUDE.md"],
      ["backups/2026-05-17T10-00-00-000Z/backup-manifest.json"],
      ["hooks/codi-skill-tracker.cjs"],
      ["hooks/_run-node"],
      [".session/heartbeat.json"],
      ["feedback/2026-05-17.jsonl"],
      // Top-level audit log
      ["audit.jsonl"],
      // preset-lock.json — tracked output, not source
      ["preset-lock.json"],
    ])("returns false for %s", (p) => {
      expect(isSourceArtifactChange(p)).toBe(false);
    });
  });

  describe("defensive edge cases", () => {
    it.each([
      [undefined],
      [null],
      [""],
      [".."],
      ["../escape.md"],
      ["../../escape.md"],
    ])("returns false for %s", (p) => {
      expect(isSourceArtifactChange(p)).toBe(false);
    });

    it("returns false for unknown top-level files", () => {
      expect(isSourceArtifactChange("README.md")).toBe(false);
      expect(isSourceArtifactChange("notes.txt")).toBe(false);
    });

    it("returns false for unknown top-level dirs", () => {
      expect(isSourceArtifactChange("something-new/file.md")).toBe(false);
      expect(isSourceArtifactChange("cache/data.bin")).toBe(false);
    });
  });
});
