import { describe, it, expect } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const r11 = require("#src/templates/skills/content-factory/scripts/lib/box-layout/rules/r11-canvas-fit.cjs");

// Synthetic tree node factory — mirrors the shape the renderer produces.
function node({ classes = [], rect = {}, children = [], path = "body", tag = "section" } = {}) {
  return {
    tag,
    path,
    classes,
    rect: {
      w: rect.w ?? 0,
      h: rect.h ?? 0,
      scrollW: rect.scrollW ?? rect.clientW ?? rect.w ?? 0,
      scrollH: rect.scrollH ?? rect.clientH ?? rect.h ?? 0,
      clientW: rect.clientW ?? rect.w ?? 0,
      clientH: rect.clientH ?? rect.h ?? 0,
    },
    children,
  };
}

// R11 measures the rendered canvas against the DECLARED format, not
// against the element's own clientH/W — the validator forces min-height
// so the element can grow with content; the element's self-dimensions
// would therefore hide overflow. Each test passes the declared canvas.
const ctx = (canvasWidth, canvasHeight) => ({ tolerance: 2, canvasWidth, canvasHeight });
const A4 = ctx(794, 1123);
const SLIDE = ctx(1280, 720);
const SOCIAL = ctx(1080, 1080);

describe("R11 · Canvas Fit", () => {
  it("emits no violation when the page fits exactly", () => {
    const tree = node({
      classes: [],
      children: [
        node({
          classes: ["doc-page"],
          rect: { clientW: 794, clientH: 1123, scrollW: 794, scrollH: 1123 },
        }),
      ],
    });
    expect(r11.check(tree, A4)).toEqual([]);
  });

  it("emits no violation for sub-tolerance overflow", () => {
    const tree = node({
      classes: [],
      children: [
        node({
          classes: ["doc-page"],
          rect: { clientW: 794, clientH: 1123, scrollW: 794, scrollH: 1124 },
        }),
      ],
    });
    expect(r11.check(tree, A4)).toEqual([]);
  });

  it("emits an error when a document page overflows vertically", () => {
    const tree = node({
      classes: [],
      children: [
        node({
          tag: "section",
          path: "body > section[0]",
          classes: ["doc-page"],
          rect: { clientW: 794, clientH: 1123, scrollW: 794, scrollH: 1410 },
        }),
      ],
    });
    const violations = r11.check(tree, A4);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("R11");
    expect(violations[0].severity).toBe("error");
    expect(violations[0].path).toBe("body > section[0]");
    expect(violations[0].message).toMatch(/287px/);
    expect(violations[0].message).toMatch(/25\.6%/);
    expect(violations[0].fix).toMatch(/paginate/);
  });

  it("emits an error when a page overflows horizontally", () => {
    const tree = node({
      classes: [],
      children: [
        node({
          classes: ["doc-page"],
          rect: { clientW: 794, clientH: 1123, scrollW: 900, scrollH: 1123 },
        }),
      ],
    });
    const violations = r11.check(tree, A4);
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toMatch(/106px/);
  });

  it("suggests paginate for document overflow > 15%", () => {
    const tree = node({
      children: [
        node({
          classes: ["doc-page"],
          rect: { clientW: 794, clientH: 1123, scrollW: 794, scrollH: 1410 }, // 25.6%
        }),
      ],
    });
    const v = r11.check(tree, A4)[0];
    expect(v.fix).toMatch(/Add a new \.doc-page/);
    expect(v.remediation).toBe("paginate");
  });

  it("suggests tighten for document overflow <= 15%", () => {
    const tree = node({
      children: [
        node({
          classes: ["doc-page"],
          rect: { clientW: 794, clientH: 1123, scrollW: 794, scrollH: 1200 }, // 6.8%
        }),
      ],
    });
    const v = r11.check(tree, A4)[0];
    expect(v.remediation).toBe("tighten");
    expect(v.fix).toMatch(/Tighten/);
  });

  it("suggests split for slide overflow > 15%", () => {
    const tree = node({
      children: [
        node({
          classes: ["slide"],
          rect: { clientW: 1280, clientH: 720, scrollW: 1280, scrollH: 1000 }, // 38.9%
        }),
      ],
    });
    const v = r11.check(tree, SLIDE)[0];
    expect(v.remediation).toBe("split");
    expect(v.fix).toMatch(/Split/);
  });

  it("always suggests tighten for social cards (no split/paginate)", () => {
    const tree = node({
      children: [
        node({
          classes: ["social-card"],
          rect: { clientW: 1080, clientH: 1080, scrollW: 1080, scrollH: 1500 }, // 38.9%
        }),
      ],
    });
    const v = r11.check(tree, SOCIAL)[0];
    expect(v.remediation).toBe("tighten");
  });

  it("reports violations for multiple overflowing pages in the same tree", () => {
    const tree = node({
      children: [
        node({
          path: "body > section[0]",
          classes: ["doc-page"],
          rect: { clientW: 794, clientH: 1123, scrollW: 794, scrollH: 1200 },
        }),
        node({
          path: "body > section[1]",
          classes: ["doc-page"],
          rect: { clientW: 794, clientH: 1123, scrollW: 794, scrollH: 1500 },
        }),
      ],
    });
    const violations = r11.check(tree, A4);
    expect(violations).toHaveLength(2);
    expect(violations[0].path).toBe("body > section[0]");
    expect(violations[1].path).toBe("body > section[1]");
  });

  it("skips elements that are not canvas-root (doc-page/slide/social-card)", () => {
    const tree = node({
      children: [
        node({
          classes: ["doc-container"],
          rect: { clientW: 794, clientH: 800, scrollW: 794, scrollH: 2000 },
        }),
      ],
    });
    expect(r11.check(tree, A4)).toEqual([]);
  });

  it("exposes the rule id and name", () => {
    expect(r11.id).toBe("R11");
    expect(r11.name).toMatch(/canvas.*fit/i);
  });
});
