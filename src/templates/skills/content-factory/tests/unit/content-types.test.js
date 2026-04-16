import { describe, it, expect } from "vitest";
import * as ct from "#src/templates/skills/content-factory/scripts/lib/content-types.cjs";

describe("content-types registry", () => {
  it("exports exactly 3 valid types", () => {
    expect(ct.VALID_TYPES).toEqual(["social", "slides", "document"]);
  });

  it("isValidType accepts valid types and rejects invalid", () => {
    expect(ct.isValidType("social")).toBe(true);
    expect(ct.isValidType("slides")).toBe(true);
    expect(ct.isValidType("document")).toBe(true);
    expect(ct.isValidType("carousel")).toBe(false);
    expect(ct.isValidType("")).toBe(false);
    expect(ct.isValidType(null)).toBe(false);
    expect(ct.isValidType(undefined)).toBe(false);
  });

  it("assertType throws for invalid types", () => {
    expect(() => ct.assertType("social")).not.toThrow();
    expect(() => ct.assertType("carousel")).toThrow(/Invalid content type/);
    expect(() => ct.assertType(null)).toThrow(/Invalid content type/);
  });

  it("cardClassForType returns the correct class", () => {
    expect(ct.cardClassForType("social")).toBe("social-card");
    expect(ct.cardClassForType("slides")).toBe("slide");
    expect(ct.cardClassForType("document")).toBe("doc-page");
  });

  it("canvasForType returns default dimensions", () => {
    expect(ct.canvasForType("social")).toEqual({ w: 1080, h: 1080 });
    expect(ct.canvasForType("slides")).toEqual({ w: 1920, h: 1080 });
    expect(ct.canvasForType("document")).toEqual({ w: 1240, h: 1754 });
  });

  it("typeForCardClass reverse-maps class to type", () => {
    expect(ct.typeForCardClass("social-card")).toBe("social");
    expect(ct.typeForCardClass("slide")).toBe("slides");
    expect(ct.typeForCardClass("doc-page")).toBe("document");
    expect(ct.typeForCardClass("unknown")).toBeNull();
  });

  it("allCardClasses returns all card classes", () => {
    expect(ct.allCardClasses()).toEqual(["social-card", "slide", "doc-page"]);
  });
});
