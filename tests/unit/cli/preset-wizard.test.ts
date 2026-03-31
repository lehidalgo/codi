import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { cleanupTmpDir } from "../../helpers/fs.js";
import { PROJECT_NAME, PROJECT_DIR } from "../../../src/constants.js";

vi.mock("@clack/prompts", () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  cancel: vi.fn(),
  multiselect: vi.fn(),
  select: vi.fn(),
  text: vi.fn(),
  confirm: vi.fn(),
  isCancel: vi.fn().mockReturnValue(false),
}));

import * as p from "@clack/prompts";
import { runPresetWizard } from "../../../src/cli/preset-wizard.js";
import { Logger } from "../../../src/core/output/logger.js";

describe("runPresetWizard", () => {
  let tmpDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(p.isCancel).mockReturnValue(false);
    tmpDir = await fs.mkdtemp(
      path.join(os.tmpdir(), `${PROJECT_NAME}-preset-wiz-`),
    );
    await fs.mkdir(path.join(tmpDir, PROJECT_DIR), { recursive: true });
    Logger.init({ level: "error", mode: "human", noColor: true });
  });

  afterEach(async () => {
    await cleanupTmpDir(tmpDir);
  });

  it("creates preset directory and manifest for dir output", async () => {
    vi.mocked(p.text)
      .mockResolvedValueOnce("my-preset" as never) // name
      .mockResolvedValueOnce("A test preset" as never) // description
      .mockResolvedValueOnce("1.0.0" as never) // version
      .mockResolvedValueOnce("web,node" as never); // tags

    vi.mocked(p.select)
      .mockResolvedValueOnce("" as never) // extends: none
      .mockResolvedValueOnce("dir" as never); // output format

    vi.mocked(p.multiselect)
      .mockResolvedValueOnce(["security"] as never) // rules
      .mockResolvedValueOnce(["code-review"] as never) // skills
      .mockResolvedValueOnce([]); // agents

    const result = await runPresetWizard(tmpDir);

    expect(result).not.toBeNull();
    expect(result!.name).toBe("my-preset");
    expect(result!.description).toBe("A test preset");
    expect(result!.tags).toEqual(["web", "node"]);
    expect(result!.rules).toEqual(["security"]);
    expect(result!.outputFormat).toBe("dir");

    // Verify files were created on disk
    const presetDir = path.join(tmpDir, PROJECT_DIR, "presets", "my-preset");
    const stat = await fs.stat(presetDir);
    expect(stat.isDirectory()).toBe(true);

    const manifest = await fs.readFile(
      path.join(presetDir, "preset.yaml"),
      "utf-8",
    );
    expect(manifest).toContain("name: my-preset");
    expect(manifest).toContain("security");
  });

  it("returns null when name is cancelled", async () => {
    vi.mocked(p.text).mockResolvedValueOnce(Symbol("cancel") as never);
    vi.mocked(p.isCancel).mockReturnValueOnce(true);

    const result = await runPresetWizard(tmpDir);
    expect(result).toBeNull();
    expect(p.cancel).toHaveBeenCalled();
  });

  it("includes extends field when base preset selected", async () => {
    vi.mocked(p.text)
      .mockResolvedValueOnce("ext-preset" as never)
      .mockResolvedValueOnce("desc" as never)
      .mockResolvedValueOnce("1.0.0" as never)
      .mockResolvedValueOnce("" as never);

    vi.mocked(p.select)
      .mockResolvedValueOnce("balanced" as never) // extends balanced
      .mockResolvedValueOnce("dir" as never);

    vi.mocked(p.multiselect)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never);

    const result = await runPresetWizard(tmpDir);

    expect(result).not.toBeNull();
    expect(result!.extends).toBe("balanced");
  });

  it("omits extends when none selected", async () => {
    vi.mocked(p.text)
      .mockResolvedValueOnce("no-base" as never)
      .mockResolvedValueOnce("" as never)
      .mockResolvedValueOnce("1.0.0" as never)
      .mockResolvedValueOnce("" as never);

    vi.mocked(p.select)
      .mockResolvedValueOnce("" as never) // no extends
      .mockResolvedValueOnce("dir" as never);

    vi.mocked(p.multiselect)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never);

    const result = await runPresetWizard(tmpDir);

    expect(result).not.toBeNull();
    expect(result!.extends).toBeUndefined();
  });

  it("handles github output format", async () => {
    vi.mocked(p.text)
      .mockResolvedValueOnce("gh-preset" as never)
      .mockResolvedValueOnce("github desc" as never)
      .mockResolvedValueOnce("2.0.0" as never)
      .mockResolvedValueOnce("" as never);

    vi.mocked(p.select)
      .mockResolvedValueOnce("" as never)
      .mockResolvedValueOnce("github" as never);

    vi.mocked(p.multiselect)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never);

    const result = await runPresetWizard(tmpDir);

    expect(result).not.toBeNull();
    expect(result!.outputFormat).toBe("github");
    expect(result!.version).toBe("2.0.0");
  });
});
