import { describe, it, expect } from "vitest";
import { hashContent } from "#src/utils/hash.js";

describe("hashContent", () => {
  it("returns a 64-character hex string (SHA-256)", () => {
    const hash = hashContent("hello world");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("returns consistent hash for same input", () => {
    const hash1 = hashContent("test content");
    const hash2 = hashContent("test content");
    expect(hash1).toBe(hash2);
  });

  it("returns different hashes for different inputs", () => {
    const hash1 = hashContent("input A");
    const hash2 = hashContent("input B");
    expect(hash1).not.toBe(hash2);
  });

  it("handles empty string", () => {
    const hash = hashContent("");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
