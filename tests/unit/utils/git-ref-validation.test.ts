/**
 * ISSUE-010 regression: validateGitRef rejects refs that could be parsed
 * as git flags (CVE-2017-1000117 class) or path-traversal sequences.
 */

import { describe, it, expect } from "vitest";
import { validateGitRef } from "#src/utils/git.js";

describe("validateGitRef — argv-injection hardening (ISSUE-010)", () => {
  describe("rejects flag-injection payloads", () => {
    for (const bad of [
      "--upload-pack=/tmp/evil.sh",
      "--exec=touch /tmp/pwn",
      "-c core.editor=evil",
      "-h",
      "--help",
    ]) {
      it(`rejects ${JSON.stringify(bad)}`, () => {
        expect(() => validateGitRef(bad)).toThrow();
      });
    }
  });

  describe("rejects path-traversal sequences", () => {
    for (const bad of ["..", "../etc", "../../etc/passwd", "refs/../../", "feature/..hidden"]) {
      it(`rejects ${JSON.stringify(bad)}`, () => {
        expect(() => validateGitRef(bad)).toThrow();
      });
    }
  });

  describe("rejects dotfile / hidden / lock variants", () => {
    for (const bad of [".hidden", ".git/config", "branch.lock", "trailing.", "trailing/"]) {
      it(`rejects ${JSON.stringify(bad)}`, () => {
        expect(() => validateGitRef(bad)).toThrow();
      });
    }
  });

  describe("rejects reflog / git-meta expressions", () => {
    for (const bad of ["HEAD@{-1}", "main@{1.day.ago}"]) {
      it(`rejects ${JSON.stringify(bad)}`, () => {
        expect(() => validateGitRef(bad)).toThrow();
      });
    }
  });

  describe("rejects empty / non-string / oversize", () => {
    it("rejects empty string", () => {
      expect(() => validateGitRef("")).toThrow();
    });
    it("rejects 256+ char ref", () => {
      expect(() => validateGitRef("a".repeat(256))).toThrow();
    });
  });

  describe("accepts valid refs", () => {
    for (const ok of [
      "main",
      "develop",
      "master",
      "v1.2.3",
      "v1.0.0-rc1",
      "release+rc1",
      "feature/auth-flow",
      "release/2026-05",
      "0a1b2c3d4e5f6789abcdef0123456789abcdef01",
      "feature/foo/v1.2.3",
    ]) {
      it(`accepts ${JSON.stringify(ok)}`, () => {
        expect(validateGitRef(ok)).toBe(ok);
      });
    }
  });
});
