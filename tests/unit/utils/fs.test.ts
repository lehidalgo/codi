import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileExists, safeRm } from "#src/utils/fs.js";

describe("fileExists", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "codi-fs-exists-"));
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("returns true for an existing file", async () => {
    const file = path.join(tmp, "exists.txt");
    await fs.writeFile(file, "hi", "utf-8");
    expect(await fileExists(file)).toBe(true);
  });

  it("returns true for an existing directory", async () => {
    expect(await fileExists(tmp)).toBe(true);
  });

  it("returns false for a missing path", async () => {
    expect(await fileExists(path.join(tmp, "nope.txt"))).toBe(false);
  });
});

describe("safeRm", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "codi-fs-rm-"));
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
  });

  it("returns true after removing an existing directory tree", async () => {
    const target = path.join(tmp, "to-remove");
    await fs.mkdir(target, { recursive: true });
    await fs.writeFile(path.join(target, "file.txt"), "x", "utf-8");

    const ok = await safeRm(target);
    expect(ok).toBe(true);
    expect(await fileExists(target)).toBe(false);
  });

  it("returns true when path does not exist (force: true)", async () => {
    // safeRm uses force: true so missing paths succeed silently.
    const result = await safeRm(path.join(tmp, "never-existed"));
    expect(result).toBe(true);
  });

  it("returns false when fs.rm throws — exercises the catch branch", async () => {
    // fs.rm against a non-string argument throws synchronously inside the
    // promise. Casting forces the error path that safeRm catches and
    // returns false for. This covers the catch branch on line 24.
    const result = await safeRm(null as unknown as string);
    expect(result).toBe(false);
  });
});
