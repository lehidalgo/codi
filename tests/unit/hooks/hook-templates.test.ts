import { describe, it, expect } from "vitest";
import { RUNNER_TEMPLATE } from "#src/core/hooks/hook-templates.js";

describe("RUNNER_TEMPLATE", () => {
  it("contains ENOENT blocking logic for required tools", () => {
    expect(RUNNER_TEMPLATE).toContain("required");
    expect(RUNNER_TEMPLATE).toContain("BLOCKING");
    expect(RUNNER_TEMPLATE).toContain("installHint");
    expect(RUNNER_TEMPLATE).toContain("exitCode = 1");
  });

  it("contains warning logic for non-required tools", () => {
    expect(RUNNER_TEMPLATE).toContain("WARNING");
  });

  it("is a valid shell script starting with #!/bin/sh", () => {
    expect(RUNNER_TEMPLATE.trimStart()).toMatch(/^#!\/bin\/sh/);
  });
});
