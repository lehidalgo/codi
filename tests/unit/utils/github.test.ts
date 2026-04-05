import { describe, it, expect } from "vitest";
import { normalizeGithubRepo } from "#src/utils/github.js";

describe("normalizeGithubRepo", () => {
  describe("short owner/repo format", () => {
    it("returns slug unchanged", () => {
      expect(normalizeGithubRepo("owner/repo")).toBe("owner/repo");
    });

    it("handles hyphens and dots", () => {
      expect(normalizeGithubRepo("my-org/my.repo")).toBe("my-org/my.repo");
    });

    it("trims surrounding whitespace", () => {
      expect(normalizeGithubRepo("  owner/repo  ")).toBe("owner/repo");
    });
  });

  describe("full GitHub URL", () => {
    it("extracts owner/repo from HTTPS URL", () => {
      expect(normalizeGithubRepo("https://github.com/owner/repo")).toBe("owner/repo");
    });

    it("strips .git suffix", () => {
      expect(normalizeGithubRepo("https://github.com/owner/repo.git")).toBe("owner/repo");
    });

    it("strips /tree/branch path", () => {
      expect(normalizeGithubRepo("https://github.com/owner/repo/tree/main")).toBe("owner/repo");
    });

    it("strips arbitrary trailing path segments", () => {
      expect(normalizeGithubRepo("https://github.com/owner/repo/pulls")).toBe("owner/repo");
    });

    it("accepts HTTP URL", () => {
      expect(normalizeGithubRepo("http://github.com/owner/repo")).toBe("owner/repo");
    });

    it("trims surrounding whitespace from URL", () => {
      expect(normalizeGithubRepo("  https://github.com/owner/repo  ")).toBe("owner/repo");
    });
  });

  describe("invalid inputs", () => {
    it("returns null for empty string", () => {
      expect(normalizeGithubRepo("")).toBeNull();
    });

    it("returns null for name without slash", () => {
      expect(normalizeGithubRepo("just-a-name")).toBeNull();
    });

    it("returns null for non-GitHub URL", () => {
      expect(normalizeGithubRepo("https://gitlab.com/owner/repo")).toBeNull();
    });

    it("returns null for three-segment path", () => {
      expect(normalizeGithubRepo("a/b/c")).toBeNull();
    });

    it("returns null for github: shorthand prefix", () => {
      expect(normalizeGithubRepo("github:org/repo")).toBeNull();
    });
  });
});
