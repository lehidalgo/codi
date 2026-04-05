import { describe, it, expect } from "vitest";
import { UnresolvableConflictError } from "#src/utils/conflict-resolver.js";

describe("UnresolvableConflictError", () => {
  it("stores file list on .files", () => {
    const err = new UnresolvableConflictError(["rules/foo", "rules/bar"]);
    expect(err.files).toEqual(["rules/foo", "rules/bar"]);
  });

  it("includes all file names in message", () => {
    const err = new UnresolvableConflictError(["rules/foo", "rules/bar"]);
    expect(err.message).toContain("rules/foo");
    expect(err.message).toContain("rules/bar");
  });

  it("sets name to UnresolvableConflictError", () => {
    const err = new UnresolvableConflictError([]);
    expect(err.name).toBe("UnresolvableConflictError");
  });

  it("is an instance of Error", () => {
    const err = new UnresolvableConflictError(["rules/x"]);
    expect(err).toBeInstanceOf(Error);
  });

  it("includes --force and --json hints in message", () => {
    const err = new UnresolvableConflictError(["rules/x"]);
    expect(err.message).toContain("--force");
    expect(err.message).toContain("--json");
  });
});
