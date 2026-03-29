import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createBrand } from "#src/core/scaffolder/brand-scaffolder.js";

describe("brand scaffolder", () => {
  let tmpDir: string;
  let codiDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "codi-brand-"));
    codiDir = path.join(tmpDir, ".codi");
    await fs.mkdir(codiDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("creates a brand directory with BRAND.md", async () => {
    const result = await createBrand({ name: "my-brand", codiDir });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data).toContain(path.join("brands", "my-brand", "BRAND.md"));
    const content = await fs.readFile(result.data, "utf-8");
    expect(content).toContain("name: my-brand");
    expect(content).toContain("managed_by: user");
    expect(content).toContain("--brand-primary");
  });

  it("creates assets and references subdirectories", async () => {
    const result = await createBrand({ name: "test-brand", codiDir });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const brandDir = path.dirname(result.data);
    const assetsDir = path.join(brandDir, "assets");
    const refsDir = path.join(brandDir, "references");

    const assetsStat = await fs.stat(assetsDir);
    const refsStat = await fs.stat(refsDir);
    expect(assetsStat.isDirectory()).toBe(true);
    expect(refsStat.isDirectory()).toBe(true);

    // .gitkeep files should exist
    await expect(
      fs.access(path.join(assetsDir, ".gitkeep")),
    ).resolves.toBeUndefined();
    await expect(
      fs.access(path.join(refsDir, ".gitkeep")),
    ).resolves.toBeUndefined();
  });

  it("replaces {{name}} placeholder in content", async () => {
    const result = await createBrand({ name: "acme-corp", codiDir });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const content = await fs.readFile(result.data, "utf-8");
    expect(content).not.toContain("{{name}}");
    expect(content).toContain("acme-corp");
    expect(content).toContain("# acme-corp — Brand Identity");
  });

  it("rejects invalid names", async () => {
    const result = await createBrand({ name: "Invalid_Name", codiDir });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]!.message).toContain("Invalid brand name");
  });

  it("fails if brand already exists", async () => {
    await createBrand({ name: "existing", codiDir });
    const result = await createBrand({ name: "existing", codiDir });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]!.message).toContain("already exists");
  });

  it("includes CSS variables block", async () => {
    const result = await createBrand({ name: "styled", codiDir });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const content = await fs.readFile(result.data, "utf-8");
    expect(content).toContain("--brand-bg");
    expect(content).toContain("--brand-text");
    expect(content).toContain("--brand-heading-font");
  });
});
