import { describe, expect, it } from "vitest";
import { parse as yamlParse } from "yaml";
import { fmStr } from "#src/utils/yaml-serialize.js";

/** Round-trip helper: value serialized via fmStr must parse back to the trimmed input. */
function roundTrip(value: string): unknown {
  const key = `k: ${fmStr(value)}`;
  return (yamlParse(key) as { k: unknown }).k;
}

describe("fmStr", () => {
  describe("plain scalar (no quoting)", () => {
    it("leaves simple identifiers unquoted", () => {
      expect(fmStr("codi-mobile-development")).toBe("codi-mobile-development");
    });

    it("leaves kebab-case names unquoted", () => {
      expect(fmStr("codi-skill-creator")).toBe("codi-skill-creator");
    });

    it("leaves alphanumeric with spaces unquoted", () => {
      expect(fmStr("Hello world")).toBe("Hello world");
    });
  });

  describe("single-quoted scalar (no backslash-escape)", () => {
    it("quotes strings containing double quotes without backslash-escape", () => {
      const result = fmStr('Activate for "iOS app", "Android app"');
      expect(result).toBe(`'Activate for "iOS app", "Android app"'`);
      expect(result).not.toContain("\\");
    });

    it("quotes strings containing colons", () => {
      expect(fmStr("foo: bar")).toBe(`'foo: bar'`);
    });

    it("quotes strings containing hash", () => {
      expect(fmStr("issue #11495")).toBe(`'issue #11495'`);
    });

    it("quotes strings containing flow indicators", () => {
      expect(fmStr("a, b, c")).toBe(`'a, b, c'`);
      expect(fmStr("[foo]")).toBe(`'[foo]'`);
      expect(fmStr("{foo}")).toBe(`'{foo}'`);
    });

    it("doubles single quotes per YAML spec", () => {
      expect(fmStr("don't use")).toBe(`'don''t use'`);
    });

    it("handles both double and single quotes together", () => {
      const result = fmStr(`It's "great"`);
      expect(result).toBe(`'It''s "great"'`);
      expect(result).not.toContain("\\");
    });

    it("preserves backslashes literally (no escape processing)", () => {
      expect(fmStr("use \\* for glob")).toBe(`'use \\* for glob'`);
    });

    it("quotes YAML reserved keywords", () => {
      expect(fmStr("true")).toBe(`'true'`);
      expect(fmStr("false")).toBe(`'false'`);
      expect(fmStr("null")).toBe(`'null'`);
      expect(fmStr("yes")).toBe(`'yes'`);
      expect(fmStr("no")).toBe(`'no'`);
      expect(fmStr("~")).toBe(`'~'`);
    });

    it("quotes number-like strings", () => {
      expect(fmStr("42")).toBe(`'42'`);
      expect(fmStr("3.14")).toBe(`'3.14'`);
      expect(fmStr("-1e5")).toBe(`'-1e5'`);
    });

    it("quotes strings starting with reserved indicators", () => {
      expect(fmStr("- item")).toBe(`'- item'`);
      expect(fmStr("? key")).toBe(`'? key'`);
      expect(fmStr("@mention")).toBe(`'@mention'`);
    });
  });

  describe("normalization", () => {
    it("flattens newlines to spaces", () => {
      expect(fmStr("line1\nline2")).toBe("line1 line2");
    });

    it("collapses consecutive newlines to a single space", () => {
      expect(fmStr("line1\n\n\nline2")).toBe("line1 line2");
    });

    it("trims leading and trailing whitespace", () => {
      expect(fmStr("  hello  ")).toBe("hello");
    });
  });

  describe("round-trip identity", () => {
    const cases: [string, string][] = [
      ["simple", "hello world"],
      ["double quotes", 'phrases like "iOS app" and "SwiftUI view"'],
      ["apostrophes", "don't use when it isn't applicable"],
      ["mixed quotes", `It's "great" — really`],
      ["backslashes", "use `glob \\*` syntax"],
      ["em dashes", "foo — bar – baz"],
      ["unicode", "café naïve résumé"],
      ["brackets", "array[0] and object{foo: bar}"],
      ["colons", "time: 10:30"],
      ["reserved word", "yes"],
      ["number-like", "2.10.1"],
    ];

    for (const [label, input] of cases) {
      it(`preserves "${label}"`, () => {
        expect(roundTrip(input)).toBe(input);
      });
    }
  });

  describe("Codex-safe guarantee", () => {
    it("never emits backslash-escape sequences for realistic descriptions", () => {
      const descriptions = [
        'Mobile dev for iOS (SwiftUI / UIKit). Also activate for phrases like "iOS app", "Android app", "@Observable".',
        `Use when user wants to "create" or "edit" docs. Don't activate for code review.`,
        `Webapp testing via Playwright. Skip when user says "don't test" or "skip tests".`,
      ];
      for (const d of descriptions) {
        const out = fmStr(d);
        expect(out).not.toContain("\\");
        expect(out.startsWith("'") && out.endsWith("'")).toBe(true);
      }
    });
  });
});
