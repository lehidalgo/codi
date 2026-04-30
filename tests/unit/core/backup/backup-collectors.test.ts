import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { cleanupTmpDir } from "#tests/helpers/fs.js";
import { collectSourceFiles, collectPreExistingFiles } from "#src/core/backup/backup-collectors.js";
import { PROJECT_NAME, PROJECT_DIR } from "#src/constants.js";

describe("collectSourceFiles", () => {
  let tmp: string;
  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), `${PROJECT_NAME}-bc-`));
  });
  afterEach(() => cleanupTmpDir(tmp));

  it("walks .codi/ recursively and returns relative paths", async () => {
    const cfg = path.join(tmp, PROJECT_DIR);
    await fs.mkdir(path.join(cfg, "rules"), { recursive: true });
    await fs.writeFile(path.join(cfg, "codi.yaml"), "name: t\n");
    await fs.writeFile(path.join(cfg, "rules", "a.md"), "# a\n");
    const files = await collectSourceFiles(tmp);
    expect(files.sort()).toEqual([".codi/codi.yaml", ".codi/rules/a.md"]);
  });

  it("excludes .codi/backups/, .codi/.session/, .codi/feedback/ recursively", async () => {
    const cfg = path.join(tmp, PROJECT_DIR);
    await fs.mkdir(path.join(cfg, "backups", "old"), { recursive: true });
    await fs.mkdir(path.join(cfg, ".session"), { recursive: true });
    await fs.mkdir(path.join(cfg, "feedback", "deep"), { recursive: true });
    await fs.writeFile(path.join(cfg, "codi.yaml"), "name: t\n");
    await fs.writeFile(path.join(cfg, "backups", "old", "x.md"), "x");
    await fs.writeFile(path.join(cfg, ".session", "active.json"), "{}");
    await fs.writeFile(path.join(cfg, "feedback", "deep", "f.json"), "{}");
    const files = await collectSourceFiles(tmp);
    expect(files).toEqual([".codi/codi.yaml"]);
  });

  it("does NOT exclude similarly-named dirs (.codi/feedback-archive/)", async () => {
    const cfg = path.join(tmp, PROJECT_DIR);
    await fs.mkdir(path.join(cfg, "feedback-archive"), { recursive: true });
    await fs.writeFile(path.join(cfg, "feedback-archive", "x.md"), "x");
    const files = await collectSourceFiles(tmp);
    expect(files).toContain(".codi/feedback-archive/x.md");
  });
});

describe("collectPreExistingFiles", () => {
  let tmp: string;
  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), `${PROJECT_NAME}-bp-`));
  });
  afterEach(() => cleanupTmpDir(tmp));

  it("returns CLAUDE.md and AGENTS.md at the repo root when present and not in state", async () => {
    await fs.writeFile(path.join(tmp, "CLAUDE.md"), "# user-written\n");
    await fs.writeFile(path.join(tmp, "AGENTS.md"), "# user-written\n");
    const files = await collectPreExistingFiles(tmp, {});
    expect(files).toContain("CLAUDE.md");
    expect(files).toContain("AGENTS.md");
  });

  it("excludes files already tracked in state.agents", async () => {
    await fs.writeFile(path.join(tmp, "CLAUDE.md"), "# tracked\n");
    const files = await collectPreExistingFiles(tmp, {
      "claude-code": [{ path: "CLAUDE.md" }],
    });
    expect(files).not.toContain("CLAUDE.md");
  });
});
