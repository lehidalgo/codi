import { describe, it, expect } from "vitest";
import { VERSION_VERIFY_PRE_PUSH_TEMPLATE } from "#src/core/hooks/version-verify-pre-push-template.js";

describe("VERSION_VERIFY_PRE_PUSH_TEMPLATE", () => {
  it("starts with the node shebang", () => {
    expect(VERSION_VERIFY_PRE_PUSH_TEMPLATE.startsWith("#!/usr/bin/env node")).toBe(true);
  });

  it("reads pre-push args from stdin", () => {
    expect(VERSION_VERIFY_PRE_PUSH_TEMPLATE).toContain("process.stdin");
  });

  it("declares ZERO_OID for new-branch detection", () => {
    expect(VERSION_VERIFY_PRE_PUSH_TEMPLATE).toContain("0000000000000000000000000000000000000000");
    expect(VERSION_VERIFY_PRE_PUSH_TEMPLATE).toMatch(/ZERO_OID/);
  });

  it("handles branch deletion (skips when localOid is zero)", () => {
    expect(VERSION_VERIFY_PRE_PUSH_TEMPLATE).toMatch(/localOid === ZERO_OID/);
  });

  it("snapshot matches", () => {
    expect(VERSION_VERIFY_PRE_PUSH_TEMPLATE).toMatchSnapshot();
  });
});
