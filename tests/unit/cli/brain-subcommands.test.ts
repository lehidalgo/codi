import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  brainSearchHandler,
  brainDecideHandler,
  brainHotHandler,
  brainOutboxHandler,
  brainUndoSessionHandler,
} from "#src/cli/brain.js";
import { writeToOutbox } from "#src/brain-client/outbox.js";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());

describe("codi brain CLI subcommand handlers", () => {
  let tmp: string;
  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "codi-brain-cli-"));
    process.env.BRAIN_URL = "http://brain.test";
    process.env.BRAIN_BEARER_TOKEN = "tok";
  });
  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
    delete process.env.BRAIN_URL;
    delete process.env.BRAIN_BEARER_TOKEN;
  });

  describe("search", () => {
    it("returns hits for a query with forwarded params", async () => {
      server.use(
        http.get("http://brain.test/notes/search", ({ request }) => {
          const url = new URL(request.url);
          expect(url.searchParams.get("q")).toBe("gemini");
          expect(url.searchParams.get("limit")).toBe("5");
          return HttpResponse.json({
            results: [
              {
                id: "n1",
                kind: "decision",
                title: "Use Gemini",
                body: "",
                tags: [],
                created_at: "",
                vault_path: "",
                score: 0.9,
              },
            ],
          });
        }),
      );
      const r = await brainSearchHandler({
        projectRoot: tmp,
        q: "gemini",
        limit: 5,
      });
      expect(r.success).toBe(true);
      expect(r.data.hits).toHaveLength(1);
    });

    it("reports unconfigured when no token", async () => {
      delete process.env.BRAIN_BEARER_TOKEN;
      const r = await brainSearchHandler({ projectRoot: tmp, q: "x" });
      expect(r.success).toBe(false);
      expect(r.data.error).toContain("BRAIN_BEARER_TOKEN");
    });
  });

  describe("decide", () => {
    it("POSTs a decision note with right shape", async () => {
      let posted: { title?: string; tags?: string[] } = {};
      server.use(
        http.post("http://brain.test/notes", async ({ request }) => {
          posted = (await request.json()) as {
            title?: string;
            tags?: string[];
          };
          return HttpResponse.json(
            {
              id: "n1",
              url: "/notes/n1",
              vault_path: "decisions/t.md",
              session_id: null,
              warnings: [],
            },
            { status: 201 },
          );
        }),
      );
      const r = await brainDecideHandler({
        projectRoot: tmp,
        title: "t",
        body: "b",
        tags: ["a", "b"],
      });
      expect(r.success).toBe(true);
      expect(r.data.id).toBe("n1");
      expect(posted.title).toBe("t");
      expect(posted.tags).toEqual(["a", "b"]);
    });
  });

  describe("hot", () => {
    it("--set updates hot state", async () => {
      let put: { body?: string } = {};
      server.use(
        http.put("http://brain.test/hot", async ({ request }) => {
          put = (await request.json()) as { body?: string };
          return HttpResponse.json({
            body: put.body,
            updated_at: "2026-04-23",
          });
        }),
      );
      const r = await brainHotHandler({
        projectRoot: tmp,
        set: "focus today",
      });
      expect(r.success).toBe(true);
      expect(put.body).toBe("focus today");
    });

    it("GETs hot when --set absent", async () => {
      server.use(
        http.get("http://brain.test/hot", () =>
          HttpResponse.json({ body: "current hot", updated_at: "2026-04-23" }),
        ),
      );
      const r = await brainHotHandler({ projectRoot: tmp });
      expect(r.data.hot?.body).toBe("current hot");
    });
  });

  describe("outbox", () => {
    it("without --flush reports count", async () => {
      await writeToOutbox(tmp, {
        method: "POST",
        path: "/notes",
        body: { x: 1 },
        sessionId: "s",
      });
      const r = await brainOutboxHandler({ projectRoot: tmp });
      expect(r.success).toBe(true);
      expect(r.data.count).toBe(1);
    });

    it("with --flush drains the outbox against live brain", async () => {
      await writeToOutbox(tmp, {
        method: "POST",
        path: "/notes",
        body: {
          kind: "decision",
          title: "q",
          body: "",
          tags: [],
          links: [],
          session_id: null,
        },
        sessionId: "s",
      });
      server.use(
        http.post("http://brain.test/notes", () =>
          HttpResponse.json(
            {
              id: "n1",
              url: "",
              vault_path: "",
              session_id: null,
              warnings: [],
            },
            { status: 201 },
          ),
        ),
      );
      const r = await brainOutboxHandler({ projectRoot: tmp, flush: true });
      expect(r.success).toBe(true);
      expect(r.data.drained).toBe(1);
    });
  });

  describe("undo-session", () => {
    it("reconciles vault_paths of auto-extract-<id> tagged notes", async () => {
      server.use(
        http.get("http://brain.test/notes/search", ({ request }) => {
          const url = new URL(request.url);
          if (url.searchParams.get("tag") === "auto-extract-sess-x") {
            return HttpResponse.json({
              results: [
                {
                  id: "n1",
                  kind: "decision",
                  title: "t",
                  body: "",
                  tags: ["auto-extract-sess-x"],
                  created_at: "",
                  vault_path: "decisions/t.md",
                  score: 1,
                },
              ],
            });
          }
          return HttpResponse.json({ results: [] });
        }),
        http.post("http://brain.test/vault/reconcile", () =>
          HttpResponse.json({
            trigger: "manual",
            scanned: 1,
            created: 0,
            updated: 0,
            tombstoned: 1,
            orphans_cleaned: 0,
            errors: [],
          }),
        ),
      );
      const r = await brainUndoSessionHandler({
        projectRoot: tmp,
        sessionId: "sess-x",
      });
      expect(r.success).toBe(true);
      expect(r.data.tombstoned).toBe(1);
    });
  });
});
