import { describe, it, expect } from "vitest";
import {
  cardFormat,
  buildCardDoc,
  buildThumbDoc,
  computeCardSize,
} from "#src/templates/skills/content-factory/generators/lib/card-builder.js";

describe("cardFormat", () => {
  it("returns card.format when width is 794 (A4 document)", () => {
    const card = { format: { w: 794, h: 1123 } };
    const stateFormat = { w: 1080, h: 1080 };
    expect(cardFormat(card, stateFormat)).toEqual({ w: 794, h: 1123 });
  });

  it("returns stateFormat when card.format is null", () => {
    const card = { format: null };
    const stateFormat = { w: 1080, h: 1350 };
    expect(cardFormat(card, stateFormat)).toEqual({ w: 1080, h: 1350 });
  });

  it("returns stateFormat when card has non-A4 format", () => {
    const card = { format: { w: 1280, h: 720 } };
    const stateFormat = { w: 1080, h: 1080 };
    expect(cardFormat(card, stateFormat)).toEqual({ w: 1080, h: 1080 });
  });

  it("returns stateFormat when card is null", () => {
    const stateFormat = { w: 1080, h: 1080 };
    expect(cardFormat(null, stateFormat)).toEqual(stateFormat);
  });
});

describe("buildCardDoc", () => {
  const baseCard = {
    html: '<article class="social-card"><p>@handle text</p></article>',
    styleText: ".social-card{color:red}",
    linkTags: '<link rel="stylesheet" href="https://fonts.example.com/font.css">',
    format: null,
  };
  const fmt = { w: 1080, h: 1080 };

  it("replaces @handle placeholder with the given handle", () => {
    const doc = buildCardDoc(baseCard, fmt, null, "myuser");
    expect(doc).toContain("@myuser");
    expect(doc).not.toContain("@handle");
  });

  it("includes card styleText in the output", () => {
    const doc = buildCardDoc(baseCard, fmt);
    expect(doc).toContain(".social-card{color:red}");
  });

  it("injects format dimensions into CSS custom properties", () => {
    const doc = buildCardDoc(baseCard, fmt);
    expect(doc).toContain("--w:1080px");
    expect(doc).toContain("--h:1080px");
  });

  it("sets html/body width and height from fmt", () => {
    const doc = buildCardDoc(baseCard, fmt);
    expect(doc).toContain("width:1080px");
    expect(doc).toContain("height:1080px");
  });

  it("includes linkTags in the output", () => {
    const doc = buildCardDoc(baseCard, fmt);
    expect(doc).toContain("fonts.example.com/font.css");
  });

  it("sets overflow:hidden on body when not forExport", () => {
    const doc = buildCardDoc(baseCard, fmt, null, "handle", false);
    expect(doc).toContain("overflow:hidden");
  });

  it("sets overflow:visible on body when forExport is true", () => {
    const doc = buildCardDoc(baseCard, fmt, null, "handle", true);
    expect(doc).toContain("overflow:visible");
  });

  it("injects logo SVG when forExport and logo.visible", () => {
    const logo = { visible: true, x: 50, y: 90, size: 24 };
    const doc = buildCardDoc(baseCard, fmt, logo, "handle", true);
    expect(doc).toContain("<svg");
    expect(doc).toContain("codi</text>");
  });

  it("does not inject logo SVG when logo.visible is false", () => {
    const logo = { visible: false, x: 50, y: 90, size: 24 };
    const doc = buildCardDoc(baseCard, fmt, logo, "handle", true);
    expect(doc).not.toContain("<svg");
  });

  it("does not inject logo SVG when not forExport", () => {
    const logo = { visible: true, x: 50, y: 90, size: 24 };
    const doc = buildCardDoc(baseCard, fmt, logo, "handle", false);
    expect(doc).not.toContain("<svg");
  });

  it("uses logo.svg when provided (project/brand logo)", () => {
    const logo = {
      visible: true,
      x: 50,
      y: 90,
      size: 24,
      svg: '<svg id="brand-mark"><circle r="10"/></svg>',
    };
    const doc = buildCardDoc(baseCard, fmt, logo, "handle", true);
    expect(doc).toContain('id="brand-mark"');
    expect(doc).not.toContain("codi</text>");
  });

  it("falls back to built-in default when logo.svg is missing or invalid", () => {
    const logo = { visible: true, x: 50, y: 90, size: 24, svg: "not-an-svg" };
    const doc = buildCardDoc(baseCard, fmt, logo, "handle", true);
    expect(doc).toContain("codi</text>");
  });

  it("overrides .social-card dimensions with !important", () => {
    const doc = buildCardDoc(baseCard, fmt);
    expect(doc).toContain(".social-card{width:1080px!important;height:1080px!important}");
  });
});

describe("buildThumbDoc", () => {
  const card = {
    html: '<article class="social-card">@handle content</article>',
    styleText: ".social-card{background:blue}",
    linkTags: '<link rel="stylesheet" href="https://fonts.example.com/f.css">',
  };
  const fmt = { w: 1080, h: 1080 };

  it("replaces @handle with @preview", () => {
    const doc = buildThumbDoc(card, fmt);
    expect(doc).toContain("@preview");
    expect(doc).not.toContain("@handle");
  });

  it("sets html/body dimensions from fmt", () => {
    const doc = buildThumbDoc(card, fmt);
    expect(doc).toContain("width:1080px");
    expect(doc).toContain("height:1080px");
  });

  it("includes card styleText", () => {
    const doc = buildThumbDoc(card, fmt);
    expect(doc).toContain(".social-card{background:blue}");
  });

  it("handles missing linkTags gracefully", () => {
    const cardNoLinks = { html: "<p>x</p>", styleText: "", linkTags: "" };
    const doc = buildThumbDoc(cardNoLinks, fmt);
    expect(doc).toContain("<!DOCTYPE html>");
  });
});

describe("computeCardSize", () => {
  const fmt = { w: 1080, h: 1080 };

  it("returns scale, fmt, displayW, and displayH", () => {
    const result = computeCardSize(fmt, { canvasW: 800, canvasH: 600, zoom: 1, viewMode: "grid" });
    expect(result).toHaveProperty("scale");
    expect(result).toHaveProperty("fmt", fmt);
    expect(result).toHaveProperty("displayW");
    expect(result).toHaveProperty("displayH");
  });

  it("displayW equals Math.round(fmt.w * scale)", () => {
    const result = computeCardSize(fmt, { canvasW: 800, canvasH: 600, zoom: 1, viewMode: "grid" });
    expect(result.displayW).toBe(Math.round(fmt.w * result.scale));
  });

  it("uses a clamped minimum canvas size when canvasW is too small", () => {
    const result = computeCardSize(fmt, { canvasW: 100, canvasH: 100, zoom: 1, viewMode: "grid" });
    expect(result.scale).toBeGreaterThan(0);
  });

  it("applies zoom multiplier in grid mode", () => {
    const r1 = computeCardSize(fmt, { canvasW: 800, canvasH: 600, zoom: 1, viewMode: "grid" });
    const r2 = computeCardSize(fmt, { canvasW: 800, canvasH: 600, zoom: 2, viewMode: "grid" });
    expect(r2.scale).toBeGreaterThan(r1.scale);
  });

  it("uses app-mode fitting logic when viewMode is app", () => {
    const gridResult = computeCardSize(fmt, {
      canvasW: 800,
      canvasH: 600,
      zoom: 1,
      viewMode: "grid",
    });
    const appResult = computeCardSize(fmt, {
      canvasW: 800,
      canvasH: 600,
      zoom: 1,
      viewMode: "app",
    });
    expect(gridResult.scale).not.toBe(appResult.scale);
  });
});
