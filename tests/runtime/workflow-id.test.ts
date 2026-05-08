import { describe, it, expect } from "vitest";
import { buildWorkflowId, dateStamp, disambiguate, slugify } from "../lib/workflow-id.js";

describe("workflow-id", () => {
  describe("slugify", () => {
    it("lowercases and kebab-cases", () => {
      expect(slugify("Add Dark Mode")).toBe("add-dark-mode");
    });
    it("strips diacritics", () => {
      expect(slugify("Café Niño")).toBe("cafe-nino");
    });
    it("collapses non-alphanumeric runs", () => {
      expect(slugify("foo, bar! / baz...")).toBe("foo-bar-baz");
    });
    it("trims leading and trailing dashes", () => {
      expect(slugify("---hello---")).toBe("hello");
    });
    it("truncates long input to ~30 chars without trailing dash", () => {
      const long = "this is a very long task description that goes on and on";
      const result = slugify(long);
      expect(result.length).toBeLessThanOrEqual(30);
      expect(result.endsWith("-")).toBe(false);
    });
    it("returns empty for input with no alphanumerics", () => {
      expect(slugify("---")).toBe("");
      expect(slugify("///")).toBe("");
    });
  });

  describe("dateStamp", () => {
    it("formats UTC date as YYYYMMDD", () => {
      const d = new Date(Date.UTC(2026, 4, 1, 12, 0, 0));
      expect(dateStamp(d)).toBe("20260501");
    });
    it("zero-pads month and day", () => {
      const d = new Date(Date.UTC(2026, 0, 5, 12, 0, 0));
      expect(dateStamp(d)).toBe("20260105");
    });
  });

  describe("buildWorkflowId", () => {
    const date = new Date(Date.UTC(2026, 4, 1));
    it("composes type-prefix + slug + date", () => {
      expect(buildWorkflowId("feature", "Add dark mode", date)).toBe("feat-add-dark-mode-20260501");
    });
    it("uses fix prefix for bug-fix", () => {
      expect(buildWorkflowId("bug-fix", "Fix login", date)).toBe("fix-fix-login-20260501");
    });
    it("uses refactor prefix", () => {
      expect(buildWorkflowId("refactor", "Decouple modules", date)).toBe(
        "refactor-decouple-modules-20260501",
      );
    });
    it("uses mig prefix for migration", () => {
      expect(buildWorkflowId("migration", "Drop column", date)).toBe("mig-drop-column-20260501");
    });
    it("uses 'untitled' when task slug is empty", () => {
      expect(buildWorkflowId("feature", "---", date)).toBe("feat-untitled-20260501");
    });
  });

  describe("disambiguate", () => {
    it("returns base when not exists", () => {
      expect(disambiguate("base", () => false)).toBe("base");
    });
    it("appends -2 on first collision", () => {
      const taken = new Set(["base"]);
      expect(disambiguate("base", (id) => taken.has(id))).toBe("base-2");
    });
    it("appends incremental numbers on multiple collisions", () => {
      const taken = new Set(["base", "base-2", "base-3"]);
      expect(disambiguate("base", (id) => taken.has(id))).toBe("base-4");
    });
  });
});
