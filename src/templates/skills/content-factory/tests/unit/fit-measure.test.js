import { describe, it, expect } from "vitest";
import {
  measureFit,
  computeRemediation,
  buildDirective,
  HIGH_OVERFLOW_PCT,
} from "#src/templates/skills/content-factory/generators/lib/fit-measure.js";

describe("measureFit", () => {
  it("reports per-page overflow and pageIndex for documents", () => {
    const result = measureFit({
      canvas: { w: 794, h: 1123 },
      pages: [
        { scrollHeight: 1100, scrollWidth: 794 },
        { scrollHeight: 1300, scrollWidth: 794 },
      ],
      type: "document",
    });
    expect(result.overflowPx).toBe(177);
    expect(result.pageIndex).toBe(2);
    expect(result.type).toBe("document");
  });

  it("returns overflowPx=0 when all pages fit", () => {
    const result = measureFit({
      canvas: { w: 794, h: 1123 },
      pages: [{ scrollHeight: 1000, scrollWidth: 794 }],
      type: "document",
    });
    expect(result.overflowPx).toBe(0);
    expect(result.pageIndex).toBeNull();
  });

  it("detects horizontal overflow", () => {
    const result = measureFit({
      canvas: { w: 794, h: 1123 },
      pages: [{ scrollHeight: 1000, scrollWidth: 900 }],
      type: "document",
    });
    expect(result.overflowPx).toBe(106);
    expect(result.pageIndex).toBe(1);
  });

  it("handles empty page lists", () => {
    const result = measureFit({
      canvas: { w: 794, h: 1123 },
      pages: [],
      type: "document",
    });
    expect(result.overflowPx).toBe(0);
    expect(result.pageIndex).toBeNull();
  });
});

describe("computeRemediation", () => {
  it("document with high overflow -> paginate", () => {
    const r = computeRemediation({ overflowPct: 25.6, type: "document" });
    expect(r.remediation).toBe("paginate");
    expect(r.options).toEqual(["paginate", "tighten"]);
  });

  it("document with low overflow -> tighten", () => {
    const r = computeRemediation({ overflowPct: 8, type: "document" });
    expect(r.remediation).toBe("tighten");
  });

  it("slides with high overflow -> split", () => {
    const r = computeRemediation({ overflowPct: 30, type: "slides" });
    expect(r.remediation).toBe("split");
    expect(r.options).toEqual(["split", "tighten"]);
  });

  it("social always -> tighten", () => {
    expect(computeRemediation({ overflowPct: 50, type: "social" }).remediation).toBe("tighten");
    expect(computeRemediation({ overflowPct: 50, type: "social" }).options).toEqual(["tighten"]);
  });

  it("boundary behaviour at HIGH_OVERFLOW_PCT", () => {
    expect(HIGH_OVERFLOW_PCT).toBe(15);
    expect(computeRemediation({ overflowPct: 15, type: "document" }).remediation).toBe("tighten");
    expect(computeRemediation({ overflowPct: 15.1, type: "document" }).remediation).toBe(
      "paginate",
    );
  });

  it("falls back to document matrix for unknown type", () => {
    const r = computeRemediation({ overflowPct: 20, type: "unknown" });
    expect(r.remediation).toBe("paginate");
  });
});

describe("buildDirective", () => {
  const base = {
    canvas: { w: 794, h: 1123 },
    overflowPx: 287,
    overflowPct: 25.6,
    pageIndex: 1,
    type: "document",
  };

  it("paginate directive names the page", () => {
    const text = buildDirective({ ...base, remediation: "paginate" });
    expect(text).toContain("Page 1");
    expect(text).toContain("287px");
    expect(text).toContain("25.6%");
    expect(text).toContain(".doc-page");
  });

  it("split directive mentions slide", () => {
    const text = buildDirective({ ...base, type: "slides", remediation: "split" });
    expect(text).toContain("Split this slide");
    expect(text).not.toContain("Page 1");
  });

  it("tighten directive gives layout guidance", () => {
    const text = buildDirective({ ...base, remediation: "tighten" });
    expect(text).toContain("Tighten");
    expect(text).toContain("padding");
  });
});
