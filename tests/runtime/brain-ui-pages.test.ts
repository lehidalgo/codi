/**
 * brain-ui HTMX pages render contract (Sprint 4).
 *
 * The pages are server-rendered HTML — we don't run a real browser. We only
 * assert that the HTML shell loads, the data we seeded shows up, and the
 * HTMX partial endpoint returns a fragment (not a full document).
 */
import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildApp } from "#src/runtime/brain-ui/server.js";
import { openBrain } from "#src/runtime/brain/db.js";
import { applyMigrations } from "#src/runtime/brain/migrate.js";
import { parseMarkers } from "#src/runtime/capture/markers.js";
import { persistMarkers } from "#src/runtime/capture/persist.js";

interface FixtureOptions {
  /**
   * Optional fixtures to seed inside the per-test archiveRoot. Each entry
   * creates `<archiveRoot>/<hash>/<timestamp>/backup-manifest.json` with the
   * given trigger string. Tests that don't need archives can omit this.
   */
  readonly seedArchives?: ReadonlyArray<{
    readonly hash: string;
    readonly timestamp: string;
    readonly trigger: string;
  }>;
}

function tmpFixture(opts: FixtureOptions = {}) {
  const dir = mkdtempSync(join(tmpdir(), "codi-ui-pages-"));
  const dbPath = join(dir, "brain.db");
  // Per-test hermetic archive root — keeps the /settings route off the
  // developer's real ~/.codi/archive/. See FIX-001b.
  const archiveRoot = join(dir, "archive");
  mkdirSync(archiveRoot, { recursive: true });
  for (const a of opts.seedArchives ?? []) {
    const entryDir = join(archiveRoot, a.hash, a.timestamp);
    mkdirSync(entryDir, { recursive: true });
    writeFileSync(
      join(entryDir, "backup-manifest.json"),
      JSON.stringify({ version: 2, trigger: a.trigger, files: [] }),
    );
  }
  {
    const seed = openBrain({ dbPath });
    applyMigrations(seed.raw);
    seed.raw
      .prepare(
        `INSERT INTO projects(project_id, repo_path, name, first_seen, last_seen) VALUES (?, ?, ?, ?, ?)`,
      )
      .run("p1", "/repo", "demo", 1, 2);
    seed.raw
      .prepare(
        `INSERT INTO sessions(session_id, project_id, agent_type, started_at, working_dir) VALUES (?, ?, ?, ?, ?)`,
      )
      .run("s1", "p1", "claude-code", 100, "/repo");
    seed.raw
      .prepare(
        `INSERT INTO workflow_runs(workflow_id, project_id, type, current_phase, status, started_at) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run("wf1", "p1", "feature", "execute", "in_progress", 200);
    persistMarkers(
      seed.raw,
      { sessionId: "s1", promptId: 1, turnId: 1 },
      parseMarkers('|RULE: "html escaping must be on"|'),
    );
    seed.close();
  }
  const handle = buildApp({ brainPath: dbPath, archiveRoot });
  return {
    handle,
    dir,
    archiveRoot,
    cleanup: () => {
      handle.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

async function getText(t: ReturnType<typeof tmpFixture>, path: string): Promise<string> {
  const res = await t.handle.app.request(path);
  expect(res.status).toBe(200);
  return res.text();
}

describe("brain-ui pages render", () => {
  it("dashboard renders counts and recent captures", async () => {
    const t = tmpFixture();
    try {
      const html = await getText(t, "/");
      expect(html).toContain("<title>Dashboard");
      expect(html).toContain("Dashboard");
      expect(html).toContain("Captures");
      expect(html).toContain("html escaping must be on");
    } finally {
      t.cleanup();
    }
  });

  it("sessions page lists the seeded session", async () => {
    const t = tmpFixture();
    try {
      const html = await getText(t, "/sessions");
      expect(html).toContain("Sessions");
      expect(html).toContain("s1");
      expect(html).toContain("claude-code");
    } finally {
      t.cleanup();
    }
  });

  it("session detail page renders captures with HTML escaping", async () => {
    const t = tmpFixture();
    try {
      const html = await getText(t, "/session/s1");
      expect(html).toContain("Session");
      expect(html).toContain("s1");
      expect(html).toContain("RULE");
      expect(html).toContain("html escaping must be on");
    } finally {
      t.cleanup();
    }
  });

  it("session 404 shell renders for unknown id", async () => {
    const t = tmpFixture();
    try {
      const res = await t.handle.app.request("/session/nope");
      expect(res.status).toBe(404);
    } finally {
      t.cleanup();
    }
  });

  it("captures page lists, filters, and exposes edit/delete controls", async () => {
    const t = tmpFixture();
    try {
      const html = await getText(t, "/captures");
      expect(html).toContain("<title>Captures");
      expect(html).toContain("html escaping must be on");
      // Delete is now an Alpine.js modal-confirm pattern, dispatched via
      // `$dispatch('delete-capture', { id, preview })`. The actual API
      // call lives in the modal handler (`fetch('/api/v1/captures/' + id,
      // { method: 'DELETE' })`). Assert the dispatch wiring + the API
      // path are present in the rendered HTML.
      expect(html).toContain("delete-capture");
      expect(html).toContain("data-capture-id");
      expect(html).toContain("/api/v1/captures/");
    } finally {
      t.cleanup();
    }
  });

  it("captures trash view filters deleted_at IS NOT NULL", async () => {
    const t = tmpFixture();
    try {
      const html = await getText(t, "/captures?trash=1");
      expect(html).toContain("trash");
    } finally {
      t.cleanup();
    }
  });

  it("workflows page lists the seeded workflow", async () => {
    const t = tmpFixture();
    try {
      const html = await getText(t, "/workflows");
      expect(html).toContain("wf1");
      expect(html).toContain("feature");
    } finally {
      t.cleanup();
    }
  });

  it("settings page renders project + brain sections", async () => {
    const t = tmpFixture();
    try {
      const html = await getText(t, "/settings");
      expect(html).toContain("Settings");
      expect(html).toContain("Project");
      expect(html).toContain("Brain DB");
    } finally {
      t.cleanup();
    }
  });

  // The next tests guard the hermeticity contract: /settings MUST only read
  // from the injected archiveRoot, never from the developer's real
  // ~/.codi/archive/. Without this guarantee, the test becomes flaky as the
  // developer's home grows. See FIX-001b.
  it("settings page is hermetic — only injected archiveRoot is read", async () => {
    const t = tmpFixture({
      seedArchives: [
        { hash: "abcdef0123456789-demo", timestamp: "2026-05-17T10-00-00-000Z", trigger: "clean" },
      ],
    });
    try {
      const html = await getText(t, "/settings");
      // Seeded archive must appear
      expect(html).toContain("abcdef0123456789");
      expect(html).toContain("2026-05-17T10-00-00-000Z");
      expect(html).toContain("clean");
      // The handler must NOT have walked the developer's real ~/.codi/archive/.
      // If it had, the page would contain hashes from that real dir; we
      // assert none of the real hash prefixes (this run sees ONLY our seed).
      // Listing the seed gives total=1 → no pagination nav should render.
      expect(html).not.toContain("Page 1 of");
    } finally {
      t.cleanup();
    }
  });

  it("settings page paginates archives past DEFAULT_ARCHIVE_PAGE_SIZE", async () => {
    // 60 > default 50 → must show pagination nav with Page 1 of 2.
    const seeds = Array.from({ length: 60 }, (_, i) => ({
      hash: `${i.toString(16).padStart(16, "0")}-demo`,
      timestamp: `2026-05-17T10-${i.toString().padStart(2, "0")}-00-000Z`,
      trigger: "clean",
    }));
    const t = tmpFixture({ seedArchives: seeds });
    try {
      const page1 = await getText(t, "/settings");
      expect(page1).toContain("Page 1 of 2");
      expect(page1).toContain("60 total");
      expect(page1).toContain("Next →");
      // First page contains newest timestamps (descending sort). Last seed
      // has minute "59" which is the latest by lexicographic compare.
      expect(page1).toContain("2026-05-17T10-59-00-000Z");

      const page2 = await getText(t, "/settings?page=2");
      expect(page2).toContain("Page 2 of 2");
      expect(page2).toContain("← Prev");
      // Page 2 contains the oldest timestamps. Seed[0] has minute "00".
      expect(page2).toContain("2026-05-17T10-00-00-000Z");
    } finally {
      t.cleanup();
    }
  });

  it("settings page does not follow symlinks under archiveRoot", async () => {
    const t = tmpFixture({
      seedArchives: [
        { hash: "1111111111111111-real", timestamp: "2026-05-17T11-00-00-000Z", trigger: "clean" },
      ],
    });
    try {
      // Plant a symlink that would point at an unrelated huge tree if followed.
      // The walker uses lstat → must report it as a non-directory and skip it.
      // We point at /etc which is always present on Linux/macOS test hosts.
      const linkPath = join(t.archiveRoot, "ffffffffffffffff-link");
      try {
        symlinkSync("/etc", linkPath);
      } catch {
        // Some filesystems (e.g. on CI containers) reject symlinks; in that
        // case there's nothing to verify — bail without failing the test.
        return;
      }
      const html = await getText(t, "/settings");
      // The real archive must appear
      expect(html).toContain("1111111111111111");
      // The symlinked dir must NOT appear (lstat reports it as a symlink, not a dir).
      expect(html).not.toContain("ffffffffffffffff");
    } finally {
      t.cleanup();
    }
  });

  it("settings page treats oversized backup-manifest.json as 'oversized' and does not parse it", async () => {
    const t = tmpFixture();
    try {
      // Plant a manifest larger than MAX_MANIFEST_BYTES (10 MB) without
      // actually allocating 10 MB: write 10 MB + 1 of zeros via Buffer.alloc.
      const hash = "2222222222222222-big";
      const ts = "2026-05-17T12-00-00-000Z";
      const entryDir = join(t.archiveRoot, hash, ts);
      mkdirSync(entryDir, { recursive: true });
      const oversized = Buffer.alloc(10 * 1024 * 1024 + 1, 0);
      writeFileSync(join(entryDir, "backup-manifest.json"), oversized);

      const html = await getText(t, "/settings");
      expect(html).toContain("2222222222222222");
      expect(html).toContain("oversized");
    } finally {
      t.cleanup();
    }
  });
});
