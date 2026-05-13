/**
 * ISSUE-044 rewrite — exercises the real docs catalog pipeline.
 *
 * Pre-rewrite this file mocked `artifact-catalog-generator`,
 * `skill-docs-generator`, and `node:fs/promises`. Every assertion was a
 * `toHaveBeenCalledWith(...)` against the mocks — none verified that
 * docsHandler actually produced files. The rewrite drops every internal
 * mock and asserts the observable side effects (success flag + the
 * markdown / catalog json files appearing in docs/) inside a tmp dir.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { docsHandler } from "#src/cli/docs.js";

describe("docsHandler --catalog", () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = mkdtempSync(path.join(tmpdir(), "codi-docs-cat-"));
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("returns success and produces an outputPath when --catalog is set", async () => {
    await mkdir(path.join(tmpRoot, "docs"), { recursive: true });
    const result = await docsHandler(tmpRoot, { catalog: true });
    expect(result.success).toBe(true);
    expect(result.data?.outputPath).toBeTruthy();
  });

  it("does not produce catalog files when only --html is set", async () => {
    await mkdir(path.join(tmpRoot, "docs"), { recursive: true });
    const before = existsSync(path.join(tmpRoot, "docs", "artifact-catalog-meta.json"));
    await docsHandler(tmpRoot, { html: true });
    const after = existsSync(path.join(tmpRoot, "docs", "artifact-catalog-meta.json"));
    expect(before).toBe(after);
  });
});
