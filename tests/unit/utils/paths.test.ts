import { describe, it, expect } from "vitest";
import path from "node:path";
import os from "node:os";
import {
  resolveProjectDir,
  resolveUserDir,
  normalizePath,
} from "#src/utils/paths.js";
import { PROJECT_DIR } from "#src/constants.js";

describe("resolveProjectDir", () => {
  it(`joins project root with ${PROJECT_DIR}`, () => {
    const result = resolveProjectDir("/my/project");
    expect(result).toBe(path.join("/my/project", PROJECT_DIR));
  });
});

describe("resolveUserDir", () => {
  it(`joins homedir with ${PROJECT_DIR}`, () => {
    const result = resolveUserDir();
    expect(result).toBe(path.join(os.homedir(), PROJECT_DIR));
  });
});

describe("normalizePath", () => {
  it("normalizes platform separators to forward slashes", () => {
    // On any platform, joining with path.sep then normalizing should yield forward slashes
    const input = ["src", "core", "config"].join(path.sep);
    expect(normalizePath(input)).toBe("src/core/config");
  });

  it("preserves forward slashes", () => {
    expect(normalizePath("src/core/config")).toBe("src/core/config");
  });

  it("handles empty string", () => {
    expect(normalizePath("")).toBe("");
  });
});
