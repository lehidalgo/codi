import { describe, it, expect } from "vitest";
import {
  SENTINEL,
  upsertRule,
  deleteRule,
  listRules,
  findUserEditsRegion,
} from "#src/templates/skills/content-factory/scripts/lib/css-patch.cjs";

const AUTHORED = `.social-card { background: #000; color: #fff; }
h1 { font-size: 48px; }
`;

function styleWithRegion(regionBody) {
  return AUTHORED + SENTINEL + regionBody;
}

describe("css-patch.findUserEditsRegion", () => {
  it("returns null when sentinel is absent", () => {
    expect(findUserEditsRegion(AUTHORED)).toBeNull();
  });

  it("splits prefix and body around the sentinel", () => {
    const text = styleWithRegion('\n[data-cf-id="cf-1"] { color: red; }\n');
    const region = findUserEditsRegion(text);
    expect(region).not.toBeNull();
    expect(region.prefix).toBe(AUTHORED);
    expect(region.sentinel).toBe(SENTINEL);
    expect(region.body).toBe('\n[data-cf-id="cf-1"] { color: red; }\n');
  });
});

describe("css-patch.upsertRule", () => {
  it("adds the sentinel and a new rule when the region does not exist", () => {
    const out = upsertRule(AUTHORED, '[data-cf-id="cf-abc"]', { color: "#000" });
    expect(out).toContain(SENTINEL);
    expect(out).toContain('[data-cf-id="cf-abc"] { color: #000; }');
    // Authored CSS above the sentinel is preserved byte-for-byte
    const [prefix] = out.split(SENTINEL);
    expect(prefix).toBe(AUTHORED);
  });

  it("inserts a new rule when the region exists but the selector is new", () => {
    const start = styleWithRegion('\n[data-cf-id="cf-1"] { color: red; }\n');
    const out = upsertRule(start, '[data-cf-id="cf-2"]', { "font-weight": "900" });
    expect(out).toContain('[data-cf-id="cf-1"] { color: red; }');
    expect(out).toContain('[data-cf-id="cf-2"] { font-weight: 900; }');
  });

  it("merges declarations into an existing rule (replace + append)", () => {
    const start = styleWithRegion('\n[data-cf-id="cf-1"] { color: red; font-size: 16px; }\n');
    const out = upsertRule(start, '[data-cf-id="cf-1"]', {
      color: "#000",
      "font-weight": "900",
    });
    // color replaced, font-size kept, font-weight appended
    const region = findUserEditsRegion(out);
    const rules = listRules(out);
    expect(rules).toHaveLength(1);
    expect(rules[0].selector).toBe('[data-cf-id="cf-1"]');
    const decls = Object.fromEntries(rules[0].declarations.map((d) => [d.property, d.value]));
    expect(decls).toEqual({
      color: "#000",
      "font-size": "16px",
      "font-weight": "900",
    });
    // Prefix unchanged
    expect(region.prefix).toBe(AUTHORED);
  });

  it("is idempotent — applying the same upsert twice equals applying it once", () => {
    const out1 = upsertRule(AUTHORED, '[data-cf-id="cf-1"]', { color: "#000" });
    const out2 = upsertRule(out1, '[data-cf-id="cf-1"]', { color: "#000" });
    expect(out2).toBe(out1);
  });

  it("removes a declaration when its value is null or empty", () => {
    const start = styleWithRegion('\n[data-cf-id="cf-1"] { color: red; font-weight: 900; }\n');
    const out = upsertRule(start, '[data-cf-id="cf-1"]', { color: null });
    const rules = listRules(out);
    expect(rules[0].declarations).toEqual([{ property: "font-weight", value: "900" }]);
  });

  it("removes the rule entirely when the last declaration is cleared", () => {
    const start = styleWithRegion('\n[data-cf-id="cf-1"] { color: red; }\n');
    const out = upsertRule(start, '[data-cf-id="cf-1"]', { color: "" });
    expect(listRules(out)).toHaveLength(0);
  });

  it("preserves authored CSS above the sentinel byte-for-byte across many writes", () => {
    let text = AUTHORED;
    text = upsertRule(text, '[data-cf-id="cf-1"]', { color: "#111" });
    text = upsertRule(text, '[data-cf-id="cf-2"]', { color: "#222" });
    text = upsertRule(text, '[data-cf-id="cf-1"]', { "font-weight": "900" });
    text = deleteRule(text, '[data-cf-id="cf-2"]');
    const [prefix] = text.split(SENTINEL);
    expect(prefix).toBe(AUTHORED);
  });
});

describe("css-patch.deleteRule", () => {
  it("is a no-op when the region does not exist", () => {
    expect(deleteRule(AUTHORED, '[data-cf-id="cf-gone"]')).toBe(AUTHORED);
  });

  it("removes only the named rule and leaves the rest intact", () => {
    const start = styleWithRegion(
      '\n[data-cf-id="cf-1"] { color: red; }\n[data-cf-id="cf-2"] { color: blue; }\n',
    );
    const out = deleteRule(start, '[data-cf-id="cf-1"]');
    const rules = listRules(out);
    expect(rules).toHaveLength(1);
    expect(rules[0].selector).toBe('[data-cf-id="cf-2"]');
  });
});

describe("css-patch.listRules", () => {
  it("returns an empty list when the region is missing", () => {
    expect(listRules(AUTHORED)).toEqual([]);
  });

  it("returns parsed rules from the region", () => {
    const start = styleWithRegion('\n[data-cf-id="cf-1"] { color: red; font-weight: 900; }\n');
    expect(listRules(start)).toEqual([
      {
        selector: '[data-cf-id="cf-1"]',
        declarations: [
          { property: "color", value: "red" },
          { property: "font-weight", value: "900" },
        ],
      },
    ]);
  });
});

describe("css-patch round-trip", () => {
  it("parses and re-serializes a multi-rule region into canonical form", () => {
    const start = styleWithRegion(
      '\n[data-cf-id="cf-1"] { color: red; }\n[data-cf-id="cf-2"] { color: blue; }\n',
    );
    // Upserting with no-op patches should canonicalize but keep content equivalent
    const out = upsertRule(start, '[data-cf-id="cf-1"]', {});
    const rulesBefore = listRules(start);
    const rulesAfter = listRules(out);
    expect(rulesAfter).toEqual(rulesBefore);
  });
});
