import { describe, it, expect } from "vitest";
import { VERSION_BUMP_TEMPLATE } from "#src/core/hooks/version-bump-template.js";

describe("VERSION_BUMP_TEMPLATE", () => {
  it("starts with the node shebang", () => {
    expect(VERSION_BUMP_TEMPLATE.startsWith("#!/usr/bin/env node")).toBe(true);
  });
  it("snapshot pins script bytes", () => {
    expect(VERSION_BUMP_TEMPLATE).toMatchSnapshot();
  });
});
