import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { cleanupTmpDir } from "#tests/helpers/fs.js";
import { readManifest, writeManifest } from "#src/core/backup/backup-manifest.js";

describe("manifest read/write", () => {
  let tmp: string;
  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "codi-bm-"));
  });
  afterEach(() => cleanupTmpDir(tmp));

  it("writes a v2 manifest with all required fields", async () => {
    await writeManifest(tmp, {
      version: 2,
      timestamp: "2026-04-30T19-20-15-123Z",
      trigger: "init-customize",
      codiVersion: "2.14.2",
      files: [
        { path: ".codi/rules/x.md", scope: "source" },
        { path: "CLAUDE.md", scope: "output", preExisting: true },
      ],
    });
    const m = await readManifest(tmp);
    expect(m.ok).toBe(true);
    if (!m.ok) return;
    expect(m.data.version).toBe(2);
    expect(m.data.trigger).toBe("init-customize");
    expect(m.data.files).toHaveLength(2);
  });

  it("reads a legacy v1 manifest as v2 with scope=output, trigger=generate", async () => {
    await fs.writeFile(
      path.join(tmp, "backup-manifest.json"),
      JSON.stringify({
        timestamp: "2026-04-29T10-00-00-000Z",
        files: ["CLAUDE.md", ".cursor/rules/a.md"],
      }),
    );
    const m = await readManifest(tmp);
    expect(m.ok).toBe(true);
    if (!m.ok) return;
    expect(m.data.version).toBe(2);
    expect(m.data.trigger).toBe("generate");
    expect(m.data.codiVersion).toBe("<unknown>");
    expect(m.data.files).toEqual([
      { path: "CLAUDE.md", scope: "output" },
      { path: ".cursor/rules/a.md", scope: "output" },
    ]);
  });

  it("returns Err when manifest is missing", async () => {
    const m = await readManifest(tmp);
    expect(m.ok).toBe(false);
    if (m.ok) return;
    expect(m.errors).toBe("incomplete");
  });

  it("returns Err when manifest JSON is malformed", async () => {
    await fs.writeFile(path.join(tmp, "backup-manifest.json"), "not json");
    const m = await readManifest(tmp);
    expect(m.ok).toBe(false);
    if (m.ok) return;
    expect(m.errors).toBe("malformed");
  });
});
