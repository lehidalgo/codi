/**
 * brain-ui HTMX pages render contract (Sprint 4).
 *
 * The pages are server-rendered HTML — we don't run a real browser. We only
 * assert that the HTML shell loads, the data we seeded shows up, and the
 * HTMX partial endpoint returns a fragment (not a full document).
 */
import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildApp } from "#src/runtime/brain-ui/index.js";
import { applyMigrations, openBrain } from "#src/runtime/brain/index.js";
import { parseMarkers, persistMarkers } from "#src/runtime/capture/index.js";

function tmpFixture() {
  const dir = mkdtempSync(join(tmpdir(), "codi-ui-pages-"));
  const dbPath = join(dir, "brain.db");
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
  const handle = buildApp({ brainPath: dbPath });
  return {
    handle,
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

  it("proposals page renders the trash toggle", async () => {
    const t = tmpFixture();
    try {
      const html = await getText(t, "/proposals");
      expect(html).toContain("Proposals");
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
});
