import { describe, it, expect } from "vitest";
import {
  generate,
  generateUnique,
  fingerprint,
} from "#src/templates/skills/content-factory/scripts/lib/cf-id.cjs";

const H1 = {
  tag: "h1",
  id: "",
  classes: ["hero"],
  parentTag: "article",
  text: "Your rules, your agents.",
};

describe("cf-id.generate", () => {
  it("returns a cf- prefixed 8-char hex id by default", () => {
    const id = generate(H1);
    expect(id).toMatch(/^cf-[0-9a-f]{8}$/);
  });

  it("is deterministic across calls", () => {
    expect(generate(H1)).toBe(generate(H1));
  });

  it("is stable across class reordering", () => {
    const a = generate({ ...H1, classes: ["hero", "big"] });
    const b = generate({ ...H1, classes: ["big", "hero"] });
    expect(a).toBe(b);
  });

  it("is stable across surrounding whitespace in text", () => {
    const a = generate({ ...H1, text: "Your rules, your agents." });
    const b = generate({ ...H1, text: "  Your rules,\n  your agents.  " });
    expect(a).toBe(b);
  });

  it("changes when the tag changes", () => {
    expect(generate(H1)).not.toBe(generate({ ...H1, tag: "h2" }));
  });

  it("changes when the parent tag changes", () => {
    expect(generate(H1)).not.toBe(generate({ ...H1, parentTag: "section" }));
  });

  it("changes when the text changes", () => {
    expect(generate(H1)).not.toBe(generate({ ...H1, text: "Different heading." }));
  });

  it("accepts a custom length", () => {
    expect(generate(H1, 12)).toMatch(/^cf-[0-9a-f]{12}$/);
  });
});

describe("cf-id.generateUnique", () => {
  it("returns the short id when there is no collision", () => {
    const short = generate(H1);
    expect(generateUnique(H1, new Set())).toBe(short);
  });

  it("extends to 12 chars when the short id collides", () => {
    const short = generate(H1);
    const id = generateUnique(H1, new Set([short]));
    expect(id).toMatch(/^cf-[0-9a-f]{12}$/);
  });

  it("appends a numeric suffix when even the extended id collides", () => {
    const short = generate(H1);
    const extended = generate(H1, 12);
    const id = generateUnique(H1, new Set([short, extended]));
    expect(id).toBe(extended + "-2");
  });

  it("accepts an array or a Set for the taken argument", () => {
    const short = generate(H1);
    expect(generateUnique(H1, [short])).toMatch(/^cf-[0-9a-f]{12}$/);
  });
});

describe("cf-id.fingerprint", () => {
  it("joins normalized fields with a stable separator", () => {
    const fp = fingerprint(H1);
    expect(fp).toContain("h1");
    expect(fp).toContain("hero");
    expect(fp).toContain("article");
    expect(fp).toContain("Your rules, your agents.");
  });
});
