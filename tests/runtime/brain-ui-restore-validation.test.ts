/**
 * Path-traversal regression tests for brain-ui backup restore endpoints.
 *
 * Covers ISSUE-001: validates that `:hash` and `:ts` path params on
 *   - POST /api/v1/backups/local/:ts/restore
 *   - POST /api/v1/backups/archive/:hash/:ts/restore
 *   - GET  /backup/local/:ts
 *   - GET  /backup/archive/:hash/:ts
 * reject any value that does not match the canonical formats produced
 * by `core/backup/backup-manager.ts` (TS_RE / HASH_RE).
 *
 * A regression here would re-open the path-traversal hole that lets a
 * same-origin or Origin-undefined caller overwrite arbitrary directories
 * under $HOME via `restoreFromBackupDir`.
 */

import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildApp } from "#src/runtime/brain-ui/index.js";
import { applyMigrations, openBrain } from "#src/runtime/brain/index.js";

function tmpFixture() {
  const dir = mkdtempSync(join(tmpdir(), "codi-restore-"));
  const dbPath = join(dir, "brain.db");
  const seed = openBrain({ dbPath });
  applyMigrations(seed.raw);
  seed.close();
  const handle = buildApp({ brainPath: dbPath });
  return {
    handle,
    cleanup: () => {
      handle.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

const VALID_TS = "2026-05-11T22-03-20-123Z";
const VALID_HASH = "abcdef0123456789-myproject";

describe("brain-ui restore validation — POST /api/v1/backups/local/:ts/restore", () => {
  it("rejects dot-dot traversal in ts with 400 bad_request", async () => {
    const t = tmpFixture();
    try {
      const res = await t.handle.app.request("/api/v1/backups/local/..%2F..%2Fetc/restore", {
        method: "POST",
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("bad_request");
    } finally {
      t.cleanup();
    }
  });

  it("rejects a ts that does not match the writer format with 400", async () => {
    const t = tmpFixture();
    try {
      // openBackup() format is 2026-05-11T22-03-20-123Z; bare ISO without ms-Z is rejected.
      const res = await t.handle.app.request("/api/v1/backups/local/2026-05-11T22:03:20Z/restore", {
        method: "POST",
      });
      expect(res.status).toBe(400);
    } finally {
      t.cleanup();
    }
  });

  it("accepts a well-formed ts and proceeds to restore (404/restore_failed is OK)", async () => {
    const t = tmpFixture();
    try {
      const res = await t.handle.app.request(`/api/v1/backups/local/${VALID_TS}/restore`, {
        method: "POST",
      });
      // Either 200 (impossible without setup), 400 restore_failed (no such backup dir),
      // both prove the regex passed. What we MUST NOT see is a bad_request from regex.
      if (res.status === 400) {
        const body = (await res.json()) as { error: { code: string } };
        expect(body.error.code).not.toBe("bad_request");
      } else {
        expect(res.status).toBe(200);
      }
    } finally {
      t.cleanup();
    }
  });
});

describe("brain-ui restore validation — POST /api/v1/backups/archive/:hash/:ts/restore", () => {
  it("rejects dot-dot in hash with 400 bad_request", async () => {
    const t = tmpFixture();
    try {
      const res = await t.handle.app.request(
        `/api/v1/backups/archive/..%2F..%2Fetc/${VALID_TS}/restore`,
        { method: "POST" },
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("bad_request");
    } finally {
      t.cleanup();
    }
  });

  it("rejects dot-dot in ts with 400 bad_request", async () => {
    const t = tmpFixture();
    try {
      const res = await t.handle.app.request(
        `/api/v1/backups/archive/${VALID_HASH}/..%2F..%2Fetc/restore`,
        { method: "POST" },
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("bad_request");
    } finally {
      t.cleanup();
    }
  });

  it("rejects pure-hex hash without slug suffix (writer always emits hash-slug)", async () => {
    const t = tmpFixture();
    try {
      const res = await t.handle.app.request(
        `/api/v1/backups/archive/abcdef0123456789/${VALID_TS}/restore`,
        { method: "POST" },
      );
      expect(res.status).toBe(400);
    } finally {
      t.cleanup();
    }
  });

  it("rejects hash with uppercase hex (writer emits lowercase)", async () => {
    const t = tmpFixture();
    try {
      const res = await t.handle.app.request(
        `/api/v1/backups/archive/ABCDEF0123456789-x/${VALID_TS}/restore`,
        { method: "POST" },
      );
      expect(res.status).toBe(400);
    } finally {
      t.cleanup();
    }
  });

  it("accepts a well-formed hash and ts (regex passes; restore can fail on missing dir)", async () => {
    const t = tmpFixture();
    try {
      const res = await t.handle.app.request(
        `/api/v1/backups/archive/${VALID_HASH}/${VALID_TS}/restore`,
        { method: "POST" },
      );
      if (res.status === 400) {
        const body = (await res.json()) as { error: { code: string } };
        // Allowed: restore_failed because the backup dir does not exist in our fixture.
        // Forbidden: bad_request from regex — that would mean the regex rejects a legitimate ID.
        expect(body.error.code).not.toBe("bad_request");
      } else {
        expect(res.status).toBe(200);
      }
    } finally {
      t.cleanup();
    }
  });
});

describe("brain-ui restore validation — GET /backup/{local,archive}/...", () => {
  it("rejects dot-dot in GET archive params with 400 HTML", async () => {
    const t = tmpFixture();
    try {
      const res = await t.handle.app.request(`/backup/archive/..%2F..%2Fetc/${VALID_TS}`);
      expect(res.status).toBe(400);
      const body = await res.text();
      expect(body).toContain("Invalid backup ID");
    } finally {
      t.cleanup();
    }
  });

  it("rejects malformed ts in GET local with 400 HTML", async () => {
    const t = tmpFixture();
    try {
      const res = await t.handle.app.request("/backup/local/..%2F..%2Fetc");
      expect(res.status).toBe(400);
      const body = await res.text();
      expect(body).toContain("Invalid backup ID");
    } finally {
      t.cleanup();
    }
  });
});
