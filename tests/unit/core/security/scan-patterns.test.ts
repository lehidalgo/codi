import { describe, it, expect } from "vitest";
import {
  INJECTION_PATTERNS,
  SCRIPT_PATTERNS,
  EXFIL_PATTERNS,
  DEPENDENCY_PATTERNS,
  EXECUTABLE_SIGNATURES,
  MAGIC_BYTES,
} from "#src/core/security/scan-patterns.js";

describe("scan-patterns", () => {
  it("INJECTION_PATTERNS is non-empty with valid entries", () => {
    expect(INJECTION_PATTERNS.length).toBeGreaterThan(0);
    for (const p of INJECTION_PATTERNS) {
      expect(p.pattern).toBeInstanceOf(RegExp);
      expect(p.severity).toBeTruthy();
      expect(p.description).toBeTruthy();
    }
  });

  it("SCRIPT_PATTERNS is non-empty with valid entries", () => {
    expect(SCRIPT_PATTERNS.length).toBeGreaterThan(0);
    for (const p of SCRIPT_PATTERNS) {
      expect(p.pattern).toBeInstanceOf(RegExp);
      expect(p.severity).toBeTruthy();
      expect(p.description).toBeTruthy();
    }
  });

  it("EXFIL_PATTERNS is non-empty with valid entries", () => {
    expect(EXFIL_PATTERNS.length).toBeGreaterThan(0);
    for (const p of EXFIL_PATTERNS) {
      expect(p.pattern).toBeInstanceOf(RegExp);
      expect(p.severity).toBeTruthy();
      expect(p.description).toBeTruthy();
    }
  });

  it("DEPENDENCY_PATTERNS is non-empty with valid entries", () => {
    expect(DEPENDENCY_PATTERNS.length).toBeGreaterThan(0);
    for (const p of DEPENDENCY_PATTERNS) {
      expect(p.pattern).toBeInstanceOf(RegExp);
      expect(p.severity).toBeTruthy();
      expect(p.description).toBeTruthy();
    }
  });

  it("EXECUTABLE_SIGNATURES has all expected formats", () => {
    expect(EXECUTABLE_SIGNATURES.length).toBe(6);
    for (const sig of EXECUTABLE_SIGNATURES) {
      expect(sig.bytes.length).toBeGreaterThan(0);
      expect(sig.name).toBeTruthy();
    }
  });

  it("MAGIC_BYTES covers common binary formats", () => {
    expect(MAGIC_BYTES[".png"]).toBeDefined();
    expect(MAGIC_BYTES[".jpg"]).toBeDefined();
    expect(MAGIC_BYTES[".pdf"]).toBeDefined();
    expect(MAGIC_BYTES[".zip"]).toBeDefined();
  });
});
