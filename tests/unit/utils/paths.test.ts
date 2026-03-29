import { describe, it, expect } from "vitest";
import path from "node:path";
import os from "node:os";
import {
  resolveCodiDir,
  resolveUserDir,
  resolveOrgFile,
  resolveTeamFile,
  normalizePath,
} from "#src/utils/paths.js";
import { PROJECT_DIR } from "#src/constants.js";

describe("resolveCodiDir", () => {
  it("joins project root with .codi", () => {
    const result = resolveCodiDir("/my/project");
    expect(result).toBe(path.join("/my/project", PROJECT_DIR));
  });
});

describe("resolveUserDir", () => {
  it("joins homedir with .codi", () => {
    const result = resolveUserDir();
    expect(result).toBe(path.join(os.homedir(), PROJECT_DIR));
  });
});

describe("resolveOrgFile", () => {
  it("returns path to org.yaml in user dir", () => {
    const result = resolveOrgFile();
    expect(result).toBe(path.join(os.homedir(), PROJECT_DIR, "org.yaml"));
  });
});

describe("resolveTeamFile", () => {
  it("returns path to team YAML in teams subdirectory", () => {
    const result = resolveTeamFile("backend");
    expect(result).toBe(
      path.join(os.homedir(), PROJECT_DIR, "teams", "backend.yaml"),
    );
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
