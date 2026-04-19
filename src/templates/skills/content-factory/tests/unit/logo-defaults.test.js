import { describe, it, expect } from "vitest";
import {
  defaultLogoSize,
  LOGO_SIZE_FRACTION,
} from "#src/templates/skills/content-factory/generators/lib/logo-defaults.js";

describe("defaultLogoSize", () => {
  it("returns 8% of min dimension for the three canonical formats", () => {
    expect(defaultLogoSize({ w: 794, h: 1123 })).toBe(64);
    expect(defaultLogoSize({ w: 1080, h: 1080 })).toBe(86);
    expect(defaultLogoSize({ w: 1280, h: 720 })).toBe(58);
  });

  it("rounds to an integer", () => {
    expect(Number.isInteger(defaultLogoSize({ w: 333, h: 444 }))).toBe(true);
  });

  it("falls back to 64 for invalid input", () => {
    expect(defaultLogoSize(null)).toBe(64);
    expect(defaultLogoSize({})).toBe(64);
  });

  it("exposes the fraction as a constant", () => {
    expect(LOGO_SIZE_FRACTION).toBe(0.08);
  });
});
