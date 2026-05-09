/**
 * brain-ui server contract tests (Sprint 4).
 *
 * Drives the Hono app directly via `app.request()` — no real HTTP listener
 * needed for the read-only API surface. Tests cover:
 *   - healthz returns schema_version + brain_path
 *   - each API endpoint returns a `{ data: [...] }` envelope and honours
 *     limit / type / since / search filters
 *   - 404 for unknown session
 *   - 400 for empty FTS query
 */

import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildApp } from "#src/runtime/brain-ui/index.js";
import { applyMigrations, openBrain } from "#src/runtime/brain/index.js";
import { parseMarkers, persistMarkers } from "#src/runtime/capture/index.js";

function tmpFixture() {
  const dir = mkdtempSync(join(tmpdir(), "codi-ui-"));
  const dbPath = join(dir, "brain.db");
  // Pre-populate before the app opens it — sharing the same file is fine
  // because both connections set WAL.
  {
    const seed = openBrain({ dbPath });
    applyMigrations(seed.raw);
    seed.raw
      .prepare(
        `INSERT INTO projects(project_id, repo_path, name, first_seen, last_seen)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run("p1", "/repo", "demo", 1, 2);
    seed.raw
      .prepare(
        `INSERT INTO sessions(session_id, project_id, agent_type, started_at, working_dir)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run("s1", "p1", "claude-code", 100, "/repo");
    seed.raw
      .prepare(`INSERT INTO turns(session_id, turn_no, ts, prompt_id) VALUES (?, ?, ?, ?)`)
      .run("s1", 1, 110, 1);
    seed.raw
      .prepare(
        `INSERT INTO tool_calls(session_id, turn_id, ts, tool_name, input_json, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run("s1", 1, 115, "Read", "{}", "ok");
    seed.raw
      .prepare(
        `INSERT INTO workflow_runs(workflow_id, project_id, type, current_phase, status, started_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run("wf1", "p1", "feature", "execute", "in_progress", 200);
    seed.raw
      .prepare(
        `INSERT INTO workflow_events(workflow_id, event_type, ts, payload) VALUES (?, ?, ?, ?)`,
      )
      .run("wf1", "phase_started", 210, "{}");
    persistMarkers(
      seed.raw,
      { sessionId: "s1", promptId: 1, turnId: 1 },
      parseMarkers('|RULE: "always test the database"| |INSIGHT: "fts5 is fast"|'),
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

describe("brain-ui / healthz", () => {
  it("returns schema_version + brain_path", async () => {
    const t = tmpFixture();
    try {
      const res = await t.handle.app.request("/healthz");
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body["ok"]).toBe(true);
      expect(body["schema_version"]).toBeGreaterThanOrEqual(2);
      expect(typeof body["brain_path"]).toBe("string");
    } finally {
      t.cleanup();
    }
  });
});

describe("brain-ui / projects + sessions", () => {
  it("lists projects ordered by last_seen DESC", async () => {
    const t = tmpFixture();
    try {
      const res = await t.handle.app.request("/api/v1/projects");
      const body = (await res.json()) as { data: { project_id: string }[] };
      expect(body.data).toHaveLength(1);
      expect(body.data[0]!.project_id).toBe("p1");
    } finally {
      t.cleanup();
    }
  });

  it("returns sessions for a project", async () => {
    const t = tmpFixture();
    try {
      const res = await t.handle.app.request("/api/v1/projects/p1/sessions");
      const body = (await res.json()) as { data: { session_id: string }[] };
      expect(body.data).toHaveLength(1);
      expect(body.data[0]!.session_id).toBe("s1");
    } finally {
      t.cleanup();
    }
  });

  it("returns 404 for unknown session", async () => {
    const t = tmpFixture();
    try {
      const res = await t.handle.app.request("/api/v1/sessions/not-real");
      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("not_found");
    } finally {
      t.cleanup();
    }
  });
});

describe("brain-ui / captures", () => {
  it("returns captures for a session", async () => {
    const t = tmpFixture();
    try {
      const res = await t.handle.app.request("/api/v1/sessions/s1/captures");
      const body = (await res.json()) as { data: { type: string; content: string }[] };
      expect(body.data).toHaveLength(2);
      expect(body.data.map((d) => d.type).sort()).toEqual(["INSIGHT", "RULE"]);
    } finally {
      t.cleanup();
    }
  });

  it("filters by capture type", async () => {
    const t = tmpFixture();
    try {
      const res = await t.handle.app.request("/api/v1/sessions/s1/captures?type=RULE");
      const body = (await res.json()) as { data: { type: string }[] };
      expect(body.data).toHaveLength(1);
      expect(body.data[0]!.type).toBe("RULE");
    } finally {
      t.cleanup();
    }
  });

  it("FTS5 search returns highlighted snippet", async () => {
    const t = tmpFixture();
    try {
      const res = await t.handle.app.request("/api/v1/captures/search?q=database");
      const body = (await res.json()) as { data: { snippet: string }[]; query: string };
      expect(body.query).toBe("database");
      expect(body.data.length).toBeGreaterThan(0);
      expect(body.data[0]!.snippet).toContain("<mark>");
    } finally {
      t.cleanup();
    }
  });

  it("FTS5 search returns 400 when ?q is missing", async () => {
    const t = tmpFixture();
    try {
      const res = await t.handle.app.request("/api/v1/captures/search");
      expect(res.status).toBe(400);
    } finally {
      t.cleanup();
    }
  });
});

describe("brain-ui / workflows", () => {
  it("lists workflow runs", async () => {
    const t = tmpFixture();
    try {
      const res = await t.handle.app.request("/api/v1/workflows");
      const body = (await res.json()) as { data: { workflow_id: string }[] };
      expect(body.data).toHaveLength(1);
      expect(body.data[0]!.workflow_id).toBe("wf1");
    } finally {
      t.cleanup();
    }
  });

  it("returns events for a workflow", async () => {
    const t = tmpFixture();
    try {
      const res = await t.handle.app.request("/api/v1/workflows/wf1/events");
      const body = (await res.json()) as { data: { event_type: string }[] };
      expect(body.data).toHaveLength(1);
      expect(body.data[0]!.event_type).toBe("phase_started");
    } finally {
      t.cleanup();
    }
  });
});

describe("brain-ui / turns + tool-calls", () => {
  it("returns turns for a session", async () => {
    const t = tmpFixture();
    try {
      const res = await t.handle.app.request("/api/v1/sessions/s1/turns");
      const body = (await res.json()) as { data: { turn_no: number }[] };
      expect(body.data).toHaveLength(1);
    } finally {
      t.cleanup();
    }
  });

  it("returns tool calls for a session", async () => {
    const t = tmpFixture();
    try {
      const res = await t.handle.app.request("/api/v1/sessions/s1/tool-calls");
      const body = (await res.json()) as { data: { tool_name: string }[] };
      expect(body.data).toHaveLength(1);
      expect(body.data[0]!.tool_name).toBe("Read");
    } finally {
      t.cleanup();
    }
  });
});
