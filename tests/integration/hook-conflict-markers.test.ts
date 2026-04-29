import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { cleanupTmpDir } from "#tests/helpers/fs.js";
import { CONFLICT_MARKER_CHECK_TEMPLATE } from "#src/core/hooks/conflict-marker-template.js";

describe("conflict-marker hook script", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "codi-cm-hook-"));
    const scriptPath = path.join(tmp, "check.mjs");
    await fs.writeFile(scriptPath, CONFLICT_MARKER_CHECK_TEMPLATE, "utf-8");
    await fs.chmod(scriptPath, 0o755);
  });

  afterEach(async () => {
    await cleanupTmpDir(tmp);
  });

  function runScript(files: string[]): { status: number; stderr: string } {
    const scriptPath = path.join(tmp, "check.mjs");
    const result = spawnSync(process.execPath, [scriptPath, ...files], {
      encoding: "utf-8",
    });
    return { status: result.status ?? -1, stderr: result.stderr ?? "" };
  }

  it("exits 0 when no files have markers", async () => {
    const cleanFile = path.join(tmp, "clean.txt");
    await fs.writeFile(cleanFile, "hello world\n");
    const { status } = runScript([cleanFile]);
    expect(status).toBe(0);
  });

  it("exits 1 when a staged file contains a marker", async () => {
    const dirty = path.join(tmp, "dirty.md");
    await fs.writeFile(dirty, "intro\n<<<<<<< HEAD\nA\n=======\nB\n>>>>>>> br\n");
    const { status, stderr } = runScript([dirty]);
    expect(status).toBe(1);
    expect(stderr).toContain("Git merge-conflict markers detected");
    expect(stderr).toMatch(/dirty\.md:2/);
  });

  it("skips binary file extensions", async () => {
    const png = path.join(tmp, "image.png");
    await fs.writeFile(png, "<<<<<<< HEAD\n");
    const { status } = runScript([png]);
    expect(status).toBe(0);
  });

  it("detects 3-way diff3 ||||||| markers", async () => {
    const f = path.join(tmp, "diff3.txt");
    await fs.writeFile(f, "<<<<<<< HEAD\nours\n||||||| anc\nbase\n=======\ntheirs\n>>>>>>> br\n");
    const { status, stderr } = runScript([f]);
    expect(status).toBe(1);
    expect(stderr).toMatch(/diff3\.txt/);
  });
});
