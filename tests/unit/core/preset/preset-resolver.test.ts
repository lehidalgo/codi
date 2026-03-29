import { describe, it, expect } from "vitest";
import {
  parsePresetIdentifier,
  extractPresetName,
} from "../../../../src/core/preset/preset-resolver.js";
import { prefixedName } from "../../../../src/constants.js";

describe("parsePresetIdentifier", () => {
  it("identifies builtin presets", () => {
    const result = parsePresetIdentifier(prefixedName("balanced"));

    expect(result.type).toBe("builtin");
    expect(result.identifier).toBe(prefixedName("balanced"));
  });

  it("identifies zip files", () => {
    const result = parsePresetIdentifier("./my-preset.zip");

    expect(result.type).toBe("zip");
    expect(result.identifier).toBe("./my-preset.zip");
  });

  it("identifies absolute zip paths", () => {
    const result = parsePresetIdentifier("/abs/path/preset.zip");

    expect(result.type).toBe("zip");
    expect(result.identifier).toBe("/abs/path/preset.zip");
  });

  it("identifies github shorthand", () => {
    const result = parsePresetIdentifier("github:org/repo");

    expect(result.type).toBe("github");
    expect(result.identifier).toBe("org/repo");
  });

  it("identifies github shorthand with tag", () => {
    const result = parsePresetIdentifier("github:org/repo@v1.0");

    expect(result.type).toBe("github");
    expect(result.identifier).toBe("org/repo");
    expect(result.version).toBe("v1.0");
    expect(result.ref).toBe("v1.0");
  });

  it("identifies github shorthand with branch", () => {
    const result = parsePresetIdentifier("github:org/repo#develop");

    expect(result.type).toBe("github");
    expect(result.identifier).toBe("org/repo");
    expect(result.ref).toBe("develop");
    expect(result.version).toBeUndefined();
  });

  it("identifies github URLs", () => {
    const result = parsePresetIdentifier("https://github.com/org/repo");

    expect(result.type).toBe("github");
    expect(result.identifier).toBe("org/repo");
  });

  it("identifies github URLs with .git suffix", () => {
    const result = parsePresetIdentifier("https://github.com/org/repo.git");

    expect(result.type).toBe("github");
    expect(result.identifier).toBe("org/repo");
  });

  it("treats unknown identifiers as local", () => {
    const result = parsePresetIdentifier("my-custom-preset");

    expect(result.type).toBe("local");
    expect(result.identifier).toBe("my-custom-preset");
  });
});

describe("extractPresetName", () => {
  it("extracts name from zip descriptor", () => {
    const name = extractPresetName({
      type: "zip",
      identifier: "./my-preset.zip",
    });

    expect(name).toBe("my-preset");
  });

  it("extracts repo name from github descriptor", () => {
    const name = extractPresetName({
      type: "github",
      identifier: "org/my-repo",
    });

    expect(name).toBe("my-repo");
  });

  it("returns identifier for local descriptor", () => {
    const name = extractPresetName({
      type: "local",
      identifier: "custom-preset",
    });

    expect(name).toBe("custom-preset");
  });

  it("returns identifier for builtin descriptor", () => {
    const name = extractPresetName({
      type: "builtin",
      identifier: prefixedName("balanced"),
    });

    expect(name).toBe(prefixedName("balanced"));
  });
});
