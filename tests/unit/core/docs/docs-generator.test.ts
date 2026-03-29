import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  injectSections,
  validateSections,
} from "#src/core/docs/docs-generator.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "docs-gen-"));
  // Create docs/ subdirectory
  await fs.mkdir(path.join(tmpDir, "docs"), { recursive: true });
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Helper: write a doc file with markers
// ---------------------------------------------------------------------------

async function writeDoc(
  relativePath: string,
  content: string,
): Promise<string> {
  const fullPath = path.join(tmpDir, relativePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, content, "utf-8");
  return fullPath;
}

async function readDoc(relativePath: string): Promise<string> {
  return fs.readFile(path.join(tmpDir, relativePath), "utf-8");
}

// ---------------------------------------------------------------------------
// injectSections
// ---------------------------------------------------------------------------

describe("injectSections", () => {
  it("replaces content between markers", async () => {
    await writeDoc(
      "docs/test.md",
      [
        "# Test",
        "",
        "<!-- GENERATED:START:flags_table -->",
        "old content here",
        "<!-- GENERATED:END:flags_table -->",
        "",
        "Footer prose",
      ].join("\n"),
    );

    const result = await injectSections(tmpDir);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.updated).toContain("docs/test.md");

    const content = await readDoc("docs/test.md");
    expect(content).toContain("<!-- GENERATED:START:flags_table -->");
    expect(content).toContain("<!-- GENERATED:END:flags_table -->");
    expect(content).not.toContain("old content here");
    expect(content).toContain("| Flag |"); // header from renderFlagsTable
    expect(content).toContain("Footer prose"); // prose preserved
  });

  it("preserves files without markers", async () => {
    await writeDoc("docs/plain.md", "# No markers here\n\nJust text.\n");

    const result = await injectSections(tmpDir);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.unchanged).toContain("docs/plain.md");

    const content = await readDoc("docs/plain.md");
    expect(content).toBe("# No markers here\n\nJust text.\n");
  });

  it("is idempotent — running twice produces same output", async () => {
    await writeDoc(
      "docs/idem.md",
      [
        "# Idempotent test",
        "<!-- GENERATED:START:flag_modes -->",
        "placeholder",
        "<!-- GENERATED:END:flag_modes -->",
      ].join("\n"),
    );

    await injectSections(tmpDir);
    const firstRun = await readDoc("docs/idem.md");

    await injectSections(tmpDir);
    const secondRun = await readDoc("docs/idem.md");

    expect(secondRun).toBe(firstRun);
  });

  it("reports unknown markers in missing array", async () => {
    await writeDoc(
      "docs/unknown.md",
      [
        "<!-- GENERATED:START:nonexistent_section -->",
        "stuff",
        "<!-- GENERATED:END:nonexistent_section -->",
      ].join("\n"),
    );

    const result = await injectSections(tmpDir);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.missing).toEqual(
      expect.arrayContaining([expect.stringContaining("nonexistent_section")]),
    );
  });

  it("handles multiple markers in one file", async () => {
    await writeDoc(
      "docs/multi.md",
      [
        "# Multi",
        "<!-- GENERATED:START:flags_table -->",
        "old flags",
        "<!-- GENERATED:END:flags_table -->",
        "",
        "Middle prose",
        "",
        "<!-- GENERATED:START:flag_modes -->",
        "old modes",
        "<!-- GENERATED:END:flag_modes -->",
      ].join("\n"),
    );

    const result = await injectSections(tmpDir);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const content = await readDoc("docs/multi.md");
    expect(content).toContain("| Flag |");
    expect(content).toContain("| Mode |");
    expect(content).toContain("Middle prose");
    expect(content).not.toContain("old flags");
    expect(content).not.toContain("old modes");
  });

  it("processes README.md at project root", async () => {
    await writeDoc(
      "README.md",
      [
        "# Project",
        "<!-- GENERATED:START:flag_modes -->",
        "old",
        "<!-- GENERATED:END:flag_modes -->",
      ].join("\n"),
    );

    const result = await injectSections(tmpDir);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.updated).toContain("README.md");
  });
});

// ---------------------------------------------------------------------------
// validateSections
// ---------------------------------------------------------------------------

describe("validateSections", () => {
  it("returns ok when docs are in sync", async () => {
    await writeDoc(
      "docs/synced.md",
      [
        "<!-- GENERATED:START:flag_modes -->",
        "placeholder",
        "<!-- GENERATED:END:flag_modes -->",
      ].join("\n"),
    );

    // First inject to sync
    await injectSections(tmpDir);

    // Then validate
    const result = await validateSections(tmpDir);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.inSync).toBe(true);
    expect(result.data.staleFiles).toHaveLength(0);
  });

  it("returns error when docs are stale", async () => {
    await writeDoc(
      "docs/stale.md",
      [
        "<!-- GENERATED:START:flags_table -->",
        "this is definitely not the real flags table",
        "<!-- GENERATED:END:flags_table -->",
      ].join("\n"),
    );

    const result = await validateSections(tmpDir);

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.errors[0].code).toBe("W_DOCS_STALE");
    expect(result.errors[0].message).toContain("stale.md");
  });

  it("identifies which sections are stale", async () => {
    await writeDoc(
      "docs/partial.md",
      [
        "<!-- GENERATED:START:flags_table -->",
        "wrong content",
        "<!-- GENERATED:END:flags_table -->",
      ].join("\n"),
    );

    const result = await validateSections(tmpDir);

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.errors[0].message).toContain("flags_table");
  });

  it("passes for files without markers", async () => {
    await writeDoc("docs/nomarkers.md", "# Just text\n");

    const result = await validateSections(tmpDir);

    expect(result.ok).toBe(true);
  });
});
