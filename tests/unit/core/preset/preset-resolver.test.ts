import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { cleanupTmpDir } from "../../../helpers/fs.js";
import {
  parsePresetIdentifier,
  extractPresetName,
  resolveAndLoadPreset,
} from "../../../../src/core/preset/preset-resolver.js";
import { prefixedName, PROJECT_NAME } from "../../../../src/constants.js";

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

describe("resolveAndLoadPreset", () => {
  let tmpDir: string;
  let presetsDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(
      path.join(os.tmpdir(), `${PROJECT_NAME}-preset-res-`),
    );
    presetsDir = path.join(tmpDir, "presets");
    await fs.mkdir(presetsDir, { recursive: true });
  });

  afterEach(async () => {
    await cleanupTmpDir(tmpDir);
  });

  it("resolves builtin preset by name", async () => {
    const result = await resolveAndLoadPreset(
      prefixedName("balanced"),
      presetsDir,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.name).toBe(prefixedName("balanced"));
    }
  });

  it("returns error for non-existent local preset", async () => {
    const result = await resolveAndLoadPreset("nonexistent-preset", presetsDir);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]!.code).toContain("PRESET_NOT_FOUND");
    }
  });

  it("returns error for non-installed zip preset", async () => {
    const result = await resolveAndLoadPreset("./missing.zip", presetsDir);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]!.code).toContain("PRESET_NOT_FOUND");
    }
  });

  it("returns error for non-installed github preset", async () => {
    const result = await resolveAndLoadPreset("github:org/repo", presetsDir);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]!.code).toContain("PRESET_NOT_FOUND");
    }
  });
});
