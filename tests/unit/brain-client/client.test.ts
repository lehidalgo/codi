import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createBrainClient } from "#src/brain-client/index.js";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());

describe("BrainClient", () => {
  let tmp: string;
  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "codi-brain-client-"));
  });
  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("createNote POSTs to /notes and returns NoteResponse", async () => {
    server.use(
      http.post("http://brain.test/notes", async ({ request }) => {
        const body = (await request.json()) as { title: string };
        expect(body.title).toBe("t");
        return HttpResponse.json(
          {
            id: "n-abc",
            url: "/notes/n-abc",
            vault_path: "decisions/t.md",
            session_id: null,
            warnings: [],
          },
          { status: 201 },
        );
      }),
    );
    const c = createBrainClient({
      url: "http://brain.test",
      token: "t",
      projectRoot: tmp,
      sessionId: "s1",
    });
    const r = await c.createNote({
      kind: "decision",
      title: "t",
      body: "b",
      tags: [],
      links: [],
      session_id: null,
    });
    expect(r.id).toBe("n-abc");
  });

  it("enqueues to outbox on network failure when enableOutbox=true", async () => {
    const c = createBrainClient({
      url: "http://127.0.0.1:1",
      token: "t",
      projectRoot: tmp,
      sessionId: "s1",
      enableOutbox: true,
      maxRetries: 0,
    });
    const result = await c.createNote({
      kind: "decision",
      title: "t",
      body: "b",
      tags: [],
      links: [],
      session_id: null,
    });
    expect(result.id).toBe("queued");
    const files = await fs.readdir(path.join(tmp, ".codi/brain-outbox"));
    expect(files.length).toBe(1);
  });

  it("searchNotes forwards query params to /notes/search", async () => {
    server.use(
      http.get("http://brain.test/notes/search", ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("q")).toBe("gemini");
        expect(url.searchParams.get("limit")).toBe("5");
        return HttpResponse.json({ results: [] });
      }),
    );
    const c = createBrainClient({
      url: "http://brain.test",
      token: "t",
      projectRoot: tmp,
      sessionId: "s1",
    });
    await c.searchNotes({ q: "gemini", limit: 5 });
  });

  it("putHot + getHot round-trip", async () => {
    let stored = "";
    server.use(
      http.put("http://brain.test/hot", async ({ request }) => {
        const body = (await request.json()) as { body: string };
        stored = body.body;
        return HttpResponse.json({ body: stored, updated_at: "2026-04-23" });
      }),
      http.get("http://brain.test/hot", () =>
        HttpResponse.json({ body: stored, updated_at: "2026-04-23" }),
      ),
    );
    const c = createBrainClient({
      url: "http://brain.test",
      token: "t",
      projectRoot: tmp,
      sessionId: "s1",
    });
    await c.putHot("hot state text");
    const r = await c.getHot();
    expect(r.body).toBe("hot state text");
  });
});
