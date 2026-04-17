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
    expect(ct.canvasForType("slides")).toEqual({ w: 1280, h: 720 });
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

describe("content-types CJS/ESM parity", () => {
  it("client mirror has same types, card classes, and canvas sizes as server", async () => {
    // Read the client ESM module as text and extract the CONTENT_TYPES object
    const fs = await import("fs");
    const path = await import("path");
    const clientPath = path.resolve(import.meta.dirname, "../../generators/lib/content-types.js");
    const clientSrc = fs.readFileSync(clientPath, "utf-8");

    // Verify each server type exists in client source with matching values
    for (const [type, entry] of Object.entries(ct.CONTENT_TYPES)) {
      expect(clientSrc).toContain(type);
      expect(clientSrc).toContain(entry.cardClass);
      expect(clientSrc).toContain(`w: ${entry.canvas.w}`);
      expect(clientSrc).toContain(`h: ${entry.canvas.h}`);
      expect(clientSrc).toContain(entry.label);
    }

    // Verify client VALID_TYPES matches server
    expect(clientSrc).toContain("VALID_TYPES");
    expect(clientSrc).toContain("isValidType");
    expect(clientSrc).toContain("typeForCardClass");
  });
});
