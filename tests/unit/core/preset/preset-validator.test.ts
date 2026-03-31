import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { cleanupTmpDir } from "#tests/helpers/fs.js";
import { stringify as yamlStringify } from "yaml";
import { PROJECT_NAME } from "#src/constants.js";
import {
  validatePreset,
  detectCircularExtends,
} from "#src/core/preset/preset-validator.js";

function makeTmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), `${PROJECT_NAME}-val-test-`));
}

describe("validatePreset", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await makeTmpDir();
  });

  afterEach(async () => {
    await cleanupTmpDir(tmpDir);
  });

  it("valid preset passes validation", async () => {
    const manifest = {
      name: "valid-preset",
      version: "1.0.0",
      description: "A valid preset",
    };
    await fs.writeFile(
      path.join(tmpDir, "preset.yaml"),
      yamlStringify(manifest),
      "utf-8",
    );

    const result = await validatePreset(tmpDir);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.manifest.name).toBe("valid-preset");
      expect(result.data.manifest.version).toBe("1.0.0");
    }
  });

  it("fails when preset.yaml is missing", async () => {
    const result = await validatePreset(tmpDir);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it("fails when name is missing from manifest", async () => {
    const manifest = { version: "1.0.0" };
    await fs.writeFile(
      path.join(tmpDir, "preset.yaml"),
      yamlStringify(manifest),
      "utf-8",
    );

    const result = await validatePreset(tmpDir);

    expect(result.ok).toBe(false);
  });

  it("fails when name has invalid format", async () => {
    const manifest = { name: "INVALID_NAME!!" };
    await fs.writeFile(
      path.join(tmpDir, "preset.yaml"),
      yamlStringify(manifest),
      "utf-8",
    );

    const result = await validatePreset(tmpDir);

    expect(result.ok).toBe(false);
  });

  it("warns on invalid version format", async () => {
    const manifest = { name: "test-preset", version: "not-semver" };
    await fs.writeFile(
      path.join(tmpDir, "preset.yaml"),
      yamlStringify(manifest),
      "utf-8",
    );

    const result = await validatePreset(tmpDir);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.warnings.length).toBeGreaterThan(0);
    }
  });

  it("counts artifacts in subdirectories", async () => {
    const manifest = { name: "with-artifacts", version: "1.0.0" };
    await fs.writeFile(
      path.join(tmpDir, "preset.yaml"),
      yamlStringify(manifest),
      "utf-8",
    );

    const rulesDir = path.join(tmpDir, "rules");
    await fs.mkdir(rulesDir, { recursive: true });
    await fs.writeFile(
      path.join(rulesDir, "rule-one.md"),
      "---\ndescription: test\n---\nContent",
      "utf-8",
    );
    await fs.writeFile(
      path.join(rulesDir, "rule-two.md"),
      "---\ndescription: test2\n---\nMore content",
      "utf-8",
    );

    const result = await validatePreset(tmpDir);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.artifactCounts.rules).toBe(2);
      expect(result.data.artifactCounts.skills).toBe(0);
    }
  });

  it("fails when YAML is invalid", async () => {
    await fs.writeFile(
      path.join(tmpDir, "preset.yaml"),
      "{{invalid yaml: [}",
      "utf-8",
    );

    const result = await validatePreset(tmpDir);

    expect(result.ok).toBe(false);
  });

  it("accepts preset without version", async () => {
    const manifest = { name: "no-version" };
    await fs.writeFile(
      path.join(tmpDir, "preset.yaml"),
      yamlStringify(manifest),
      "utf-8",
    );

    const result = await validatePreset(tmpDir);

    expect(result.ok).toBe(true);
  });

  it("accepts valid category field", async () => {
    const manifest = { name: "with-category", category: "engineering" };
    await fs.writeFile(
      path.join(tmpDir, "preset.yaml"),
      yamlStringify(manifest),
      "utf-8",
    );

    const result = await validatePreset(tmpDir);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.manifest.category).toBe("engineering");
    }
  });

  it("rejects invalid category value", async () => {
    const manifest = { name: "bad-category", category: "invalid-category" };
    await fs.writeFile(
      path.join(tmpDir, "preset.yaml"),
      yamlStringify(manifest),
      "utf-8",
    );

    const result = await validatePreset(tmpDir);

    expect(result.ok).toBe(false);
  });

  it("reports error for rule with broken YAML frontmatter", async () => {
    const manifest = { name: "bad-rules" };
    await fs.writeFile(
      path.join(tmpDir, "preset.yaml"),
      yamlStringify(manifest),
      "utf-8",
    );

    const rulesDir = path.join(tmpDir, "rules");
    await fs.mkdir(rulesDir, { recursive: true });
    await fs.writeFile(
      path.join(rulesDir, "broken.md"),
      "---\n{{invalid yaml: [}\n---\nContent",
      "utf-8",
    );

    const result = await validatePreset(tmpDir);

    expect(result.ok).toBe(false);
  });
});

describe("detectCircularExtends", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await makeTmpDir();
  });

  afterEach(async () => {
    await cleanupTmpDir(tmpDir);
  });

  it("returns ok for preset without extends", async () => {
    const presetDir = path.join(tmpDir, "simple");
    await fs.mkdir(presetDir, { recursive: true });
    await fs.writeFile(
      path.join(presetDir, "preset.yaml"),
      yamlStringify({ name: "simple", version: "1.0.0" }),
      "utf-8",
    );

    const result = await detectCircularExtends("simple", tmpDir);

    expect(result.ok).toBe(true);
  });

  it("detects direct circular reference", async () => {
    const presetA = path.join(tmpDir, "a");
    const presetB = path.join(tmpDir, "b");
    await fs.mkdir(presetA, { recursive: true });
    await fs.mkdir(presetB, { recursive: true });
    await fs.writeFile(
      path.join(presetA, "preset.yaml"),
      yamlStringify({ name: "a", extends: "b" }),
      "utf-8",
    );
    await fs.writeFile(
      path.join(presetB, "preset.yaml"),
      yamlStringify({ name: "b", extends: "a" }),
      "utf-8",
    );

    const result = await detectCircularExtends("a", tmpDir);

    expect(result.ok).toBe(false);
  });

  it("returns ok for valid extends chain", async () => {
    const presetA = path.join(tmpDir, "child");
    const presetB = path.join(tmpDir, "parent");
    await fs.mkdir(presetA, { recursive: true });
    await fs.mkdir(presetB, { recursive: true });
    await fs.writeFile(
      path.join(presetA, "preset.yaml"),
      yamlStringify({ name: "child", extends: "parent" }),
      "utf-8",
    );
    await fs.writeFile(
      path.join(presetB, "preset.yaml"),
      yamlStringify({ name: "parent" }),
      "utf-8",
    );

    const result = await detectCircularExtends("child", tmpDir);

    expect(result.ok).toBe(true);
  });
});
