/**
 * ISSUE-009 regression: brain-ui requires a loopback Origin on every
 * mutating /api/v1/* request. The earlier `if (origin === undefined)
 * return next()` bypass let any local process (curl, npm postinstall,
 * IDE background tasks) issue mutating calls without going through a
 * browser. Origin is now mandatory.
 *
 * Read-only requests (GET / HEAD / OPTIONS) remain unauthenticated so
 * the dashboard and healthz probe continue to work.
 */

import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildApp } from "#src/runtime/brain-ui/server.js";
import { openBrain } from "#src/runtime/brain/db.js";
import { applyMigrations } from "#src/runtime/brain/migrate.js";
function tmpFixture() {
  const dir = mkdtempSync(join(tmpdir(), "codi-csrf-"));
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

describe("ISSUE-009 — brain-ui CSRF Origin enforcement", () => {
  it("rejects POST bulk-delete without Origin header (403 E_CSRF_ORIGIN)", async () => {
    const t = tmpFixture();
    try {
      const res = await t.handle.app.request("/api/v1/captures/bulk-delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: [1, 2, 3] }),
      });
      expect(res.status).toBe(403);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("E_CSRF_ORIGIN");
    } finally {
      t.cleanup();
    }
  });

  it("rejects POST bulk-delete with a non-loopback Origin", async () => {
    const t = tmpFixture();
    try {
      const res = await t.handle.app.request("/api/v1/captures/bulk-delete", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://attacker.example.com",
        },
        body: JSON.stringify({ ids: [1] }),
      });
      expect(res.status).toBe(403);
    } finally {
      t.cleanup();
    }
  });

  it("rejects DELETE /api/v1/captures/:id without Origin", async () => {
    const t = tmpFixture();
    try {
      const res = await t.handle.app.request("/api/v1/captures/1", {
        method: "DELETE",
      });
      expect(res.status).toBe(403);
    } finally {
      t.cleanup();
    }
  });

  it("rejects POST /api/v1/backups/local/:ts/restore without Origin", async () => {
    const t = tmpFixture();
    try {
      const res = await t.handle.app.request(
        "/api/v1/backups/local/2026-05-11T22-03-20-123Z/restore",
        { method: "POST" },
      );
      expect(res.status).toBe(403);
    } finally {
      t.cleanup();
    }
  });

  it("accepts mutating requests with a loopback Origin (request passes the CSRF gate)", async () => {
    const t = tmpFixture();
    try {
      const res = await t.handle.app.request("/api/v1/captures/bulk-delete", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://127.0.0.1:4477",
        },
        body: JSON.stringify({ ids: [] }),
      });
      // The CSRF check must let this through. Downstream handler is free
      // to return any non-403 status (e.g. 200 on empty bulk-delete).
      expect(res.status).not.toBe(403);
    } finally {
      t.cleanup();
    }
  });

  it("allows GET /api/v1/projects without Origin (read-only is unauthenticated by design)", async () => {
    const t = tmpFixture();
    try {
      const res = await t.handle.app.request("/api/v1/projects");
      expect(res.status).toBe(200);
    } finally {
      t.cleanup();
    }
  });

  it("allows GET /healthz without Origin (outside /api/v1/*)", async () => {
    const t = tmpFixture();
    try {
      const res = await t.handle.app.request("/healthz");
      expect(res.status).toBe(200);
    } finally {
      t.cleanup();
    }
  });
});
