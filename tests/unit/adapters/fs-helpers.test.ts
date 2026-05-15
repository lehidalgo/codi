/**
 * CORE-006 — `fs-helpers` consolidates the six byte-identical `exists()`
 * helpers that lived in each adapter. The unit tests pin the never-throw
 * contract (callers rely on it for `detect()`) and the OR semantics of
 * `existsAny` used by `defineAdapter({ detect: { markers: [...] } })`.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { exists, existsAny, readJsonIfExists } from "#src/adapters/fs-helpers.js";

describe("fs-helpers", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = join(tmpdir(), `codi-fsh-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(tmp, { recursive: true });
  });
  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it("exists returns true when path exists", async () => {
    const p = join(tmp, "x.txt");
    await writeFile(p, "x");
    expect(await exists(p)).toBe(true);
  });

  it("exists returns false for missing path (never throws)", async () => {
    expect(await exists(join(tmp, "missing.txt"))).toBe(false);
  });

  it("exists returns true for directories too", async () => {
    expect(await exists(tmp)).toBe(true);
  });

  it("existsAny returns true if any path exists", async () => {
    const a = join(tmp, "a.txt");
    await writeFile(a, "");
    expect(await existsAny([join(tmp, "none.txt"), a])).toBe(true);
  });

  it("existsAny returns false for empty list", async () => {
    expect(await existsAny([])).toBe(false);
  });

  it("existsAny returns false when no path exists", async () => {
    expect(await existsAny([join(tmp, "a"), join(tmp, "b")])).toBe(false);
  });

  it("readJsonIfExists returns parsed object when valid", async () => {
    const p = join(tmp, "x.json");
    await writeFile(p, JSON.stringify({ a: 1 }));
    const r = await readJsonIfExists<{ a: number }>(p);
    expect(r).toEqual({ a: 1 });
  });

  it("readJsonIfExists returns null on missing file", async () => {
    expect(await readJsonIfExists(join(tmp, "missing.json"))).toBeNull();
  });

  it("readJsonIfExists returns null on malformed JSON (never throws)", async () => {
    const p = join(tmp, "bad.json");
    await writeFile(p, "{ not json");
    expect(await readJsonIfExists(p)).toBeNull();
  });
});
