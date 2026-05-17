/**
 * Unit tests for `listProjectArchives` in core/backup/backup-manager.ts.
 *
 * The function walks `<archiveRoot>/<hash>/<timestamp>/backup-manifest.json`,
 * paginates results, refuses to follow symlinks (lstat-only), and caps the
 * size of each manifest it parses. These tests cover those guarantees in
 * isolation from the brain-ui consumer.
 *
 * Added with FIX-001 (audit 2026-05-17).
 */

import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  listProjectArchives,
  DEFAULT_ARCHIVE_PAGE_SIZE,
  MAX_ARCHIVE_PAGE_SIZE,
  MAX_MANIFEST_BYTES,
  defaultArchiveRoot,
} from "#src/core/backup/backup-manager.js";

function mkRoot(): { root: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "codi-archive-test-"));
  return { root: dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

function seedEntry(
  root: string,
  hash: string,
  ts: string,
  manifest: { trigger?: string; files?: Array<{ path: string }> } | "skip" = {},
): string {
  const dir = join(root, hash, ts);
  mkdirSync(dir, { recursive: true });
  if (manifest !== "skip") {
    writeFileSync(
      join(dir, "backup-manifest.json"),
      JSON.stringify({ version: 2, ...manifest }),
    );
  }
  return dir;
}

describe("listProjectArchives", () => {
  it("returns empty result when archiveRoot does not exist", () => {
    const result = listProjectArchives({ archiveRoot: "/nonexistent/path/never/exists" });
    expect(result.entries).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.limit).toBe(DEFAULT_ARCHIVE_PAGE_SIZE);
  });

  it("lists archives sorted by timestamp descending", () => {
    const { root, cleanup } = mkRoot();
    try {
      seedEntry(root, "1111111111111111-a", "2026-05-01T10-00-00-000Z", { trigger: "old" });
      seedEntry(root, "2222222222222222-b", "2026-05-17T10-00-00-000Z", { trigger: "new" });
      seedEntry(root, "3333333333333333-c", "2026-05-10T10-00-00-000Z", { trigger: "mid" });

      const result = listProjectArchives({ archiveRoot: root });
      expect(result.total).toBe(3);
      expect(result.entries.map((e) => e.trigger)).toEqual(["new", "mid", "old"]);
    } finally {
      cleanup();
    }
  });

  it("honours pagination via offset + limit", () => {
    const { root, cleanup } = mkRoot();
    try {
      for (let i = 0; i < 12; i++) {
        seedEntry(
          root,
          `${i.toString(16).padStart(16, "0")}-x`,
          `2026-05-17T10-${i.toString().padStart(2, "0")}-00-000Z`,
          { trigger: `t${i}` },
        );
      }
      const page1 = listProjectArchives({ archiveRoot: root, limit: 5, offset: 0 });
      const page2 = listProjectArchives({ archiveRoot: root, limit: 5, offset: 5 });
      const page3 = listProjectArchives({ archiveRoot: root, limit: 5, offset: 10 });

      expect(page1.total).toBe(12);
      expect(page1.entries).toHaveLength(5);
      expect(page2.entries).toHaveLength(5);
      expect(page3.entries).toHaveLength(2);

      // No overlap between pages
      const all = [...page1.entries, ...page2.entries, ...page3.entries].map((e) => e.timestamp);
      const unique = new Set(all);
      expect(unique.size).toBe(12);
    } finally {
      cleanup();
    }
  });

  it("clamps requested limit to MAX_ARCHIVE_PAGE_SIZE", () => {
    const { root, cleanup } = mkRoot();
    try {
      const result = listProjectArchives({ archiveRoot: root, limit: 999999 });
      expect(result.limit).toBe(MAX_ARCHIVE_PAGE_SIZE);
    } finally {
      cleanup();
    }
  });

  it("treats invalid limit values as default", () => {
    const { root, cleanup } = mkRoot();
    try {
      const r1 = listProjectArchives({ archiveRoot: root, limit: -1 });
      expect(r1.limit).toBe(1); // clamped to min
      const r2 = listProjectArchives({ archiveRoot: root, limit: Number.NaN });
      expect(r2.limit).toBe(DEFAULT_ARCHIVE_PAGE_SIZE);
    } finally {
      cleanup();
    }
  });

  it("does NOT follow symlinks under archiveRoot", () => {
    const { root, cleanup } = mkRoot();
    try {
      // Real entry that should be listed
      seedEntry(root, "1111111111111111-real", "2026-05-17T10-00-00-000Z", { trigger: "ok" });
      // Symlink — the walker uses lstat, so this looks like a non-directory
      // and is skipped. Verifies that a malicious symlink in the archive root
      // cannot cause us to enumerate an arbitrary tree.
      try {
        symlinkSync("/etc", join(root, "ffffffffffffffff-link"));
      } catch {
        // Symlinks unsupported on this fs — skip the assertion below by
        // returning early; the rest of the test would be meaningless.
        return;
      }
      const result = listProjectArchives({ archiveRoot: root });
      expect(result.total).toBe(1);
      expect(result.entries[0]?.hash).toBe("1111111111111111-real");
    } finally {
      cleanup();
    }
  });

  it("flags oversized backup-manifest.json as trigger='oversized' and does not parse it", () => {
    const { root, cleanup } = mkRoot();
    try {
      const dir = join(root, "2222222222222222-big", "2026-05-17T10-00-00-000Z");
      mkdirSync(dir, { recursive: true });
      // 10 MB + 1 = past MAX_MANIFEST_BYTES — parser must NOT try JSON.parse.
      const oversized = Buffer.alloc(MAX_MANIFEST_BYTES + 1, 0);
      writeFileSync(join(dir, "backup-manifest.json"), oversized);

      const result = listProjectArchives({ archiveRoot: root });
      expect(result.total).toBe(1);
      expect(result.entries[0]?.trigger).toBe("oversized");
    } finally {
      cleanup();
    }
  });

  it("tolerates missing/unreadable manifest with best-effort placeholder", () => {
    const { root, cleanup } = mkRoot();
    try {
      // Dir exists but no manifest at all
      seedEntry(root, "3333333333333333-bare", "2026-05-17T10-00-00-000Z", "skip");
      // Dir with malformed manifest
      const dir2 = seedEntry(root, "4444444444444444-bad", "2026-05-17T11-00-00-000Z", "skip");
      writeFileSync(join(dir2, "backup-manifest.json"), "this is not json {{{");

      const result = listProjectArchives({ archiveRoot: root });
      expect(result.total).toBe(2);
      for (const e of result.entries) {
        expect(e.trigger).toBe("unknown");
        expect(e.size).toBe(0);
      }
    } finally {
      cleanup();
    }
  });

  it("ignores files at the top level of archiveRoot", () => {
    const { root, cleanup } = mkRoot();
    try {
      seedEntry(root, "1111111111111111-real", "2026-05-17T10-00-00-000Z", { trigger: "ok" });
      writeFileSync(join(root, "stray.txt"), "not an archive");
      const result = listProjectArchives({ archiveRoot: root });
      expect(result.total).toBe(1);
    } finally {
      cleanup();
    }
  });

  it("defaultArchiveRoot returns ~/.codi/archive", () => {
    const root = defaultArchiveRoot();
    expect(root).toMatch(/\.codi[/\\]archive$/);
  });
});
