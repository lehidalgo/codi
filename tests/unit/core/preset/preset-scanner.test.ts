import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { stringify as stringifyYaml } from "yaml";
import { cleanupTmpDir } from "../../../helpers/fs.js";
import { scanForPresets } from "#src/core/preset/preset-scanner.js";
import { Logger } from "#src/core/output/logger.js";
import { PROJECT_NAME, PRESET_MANIFEST_FILENAME } from "#src/constants.js";

describe("scanForPresets", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(
      path.join(os.tmpdir(), `${PROJECT_NAME}-scanner-`),
    );
    Logger.init({ level: "error", mode: "human", noColor: true });
  });

  afterEach(async () => {
    await cleanupTmpDir(tmpDir);
  });

  it("discovers presets in subfolders", async () => {
    const presetDir = path.join(tmpDir, "my-preset");
    await fs.mkdir(presetDir, { recursive: true });
    await fs.writeFile(
      path.join(presetDir, PRESET_MANIFEST_FILENAME),
      stringifyYaml({
        name: "my-preset",
        version: "1.0.0",
        description: "Test",
      }),
    );

    const results = await scanForPresets(tmpDir);
    expect(results).toHaveLength(1);
    expect(results[0]!.name).toBe("my-preset");
    expect(results[0]!.description).toBe("Test");
    expect(results[0]!.version).toBe("1.0.0");
  });

  it("discovers multiple presets", async () => {
    for (const name of ["preset-a", "preset-b", "preset-c"]) {
      const dir = path.join(tmpDir, name);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(
        path.join(dir, PRESET_MANIFEST_FILENAME),
        stringifyYaml({ name, version: "1.0.0" }),
      );
    }

    const results = await scanForPresets(tmpDir);
    expect(results).toHaveLength(3);
    const names = results.map((r) => r.name).sort();
    expect(names).toEqual(["preset-a", "preset-b", "preset-c"]);
  });

  it("ignores root-level preset.yaml", async () => {
    // Root preset (should be ignored)
    await fs.writeFile(
      path.join(tmpDir, PRESET_MANIFEST_FILENAME),
      stringifyYaml({ name: "root-preset" }),
    );
    // Subfolder preset (should be found)
    const subDir = path.join(tmpDir, "valid-preset");
    await fs.mkdir(subDir, { recursive: true });
    await fs.writeFile(
      path.join(subDir, PRESET_MANIFEST_FILENAME),
      stringifyYaml({ name: "valid-preset" }),
    );

    const results = await scanForPresets(tmpDir);
    expect(results).toHaveLength(1);
    expect(results[0]!.name).toBe("valid-preset");
  });

  it("returns empty for directory with no presets", async () => {
    await fs.mkdir(path.join(tmpDir, "not-a-preset"), { recursive: true });
    await fs.writeFile(path.join(tmpDir, "not-a-preset", "README.md"), "hi");

    const results = await scanForPresets(tmpDir);
    expect(results).toHaveLength(0);
  });

  it("skips hidden directories", async () => {
    const hidden = path.join(tmpDir, ".hidden-preset");
    await fs.mkdir(hidden, { recursive: true });
    await fs.writeFile(
      path.join(hidden, PRESET_MANIFEST_FILENAME),
      stringifyYaml({ name: "hidden" }),
    );

    const results = await scanForPresets(tmpDir);
    expect(results).toHaveLength(0);
  });
});
