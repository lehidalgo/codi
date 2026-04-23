import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import http from "node:http";
import { once } from "node:events";
import { handleExportHtmlBundle } from "#src/templates/skills/content-factory/scripts/lib/bundle.cjs";

/** Drive handleExportHtmlBundle through a real http server so we exercise the
 *  same request lifecycle the production code sees (req stream + res.end). */
async function callBundle(ctx, bodyObj) {
  const server = http.createServer((req, res) => {
    handleExportHtmlBundle(req, res, ctx);
  });
  await new Promise((r) => server.listen(0, r));
  const { port } = server.address();
  try {
    const body = bodyObj === undefined ? "" : JSON.stringify(bodyObj);
    const req = http.request({
      hostname: "127.0.0.1",
      port,
      method: "POST",
      path: "/x",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    });
    const resultPromise = once(req, "response").then(async ([res]) => {
      const chunks = [];
      for await (const c of res) chunks.push(c);
      return { status: res.statusCode, body: Buffer.concat(chunks) };
    });
    req.end(body);
    return await resultPromise;
  } finally {
    server.close();
  }
}

describe("bundle — platform subfolder support", () => {
  let workspace, sessionDir, contentDir, deckDir;

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), "cf-bundle-"));
    sessionDir = join(workspace, "my-project");
    contentDir = join(sessionDir, "content");
    deckDir = join(contentDir, "deck");
    await mkdir(join(sessionDir, "state"), { recursive: true });
    await mkdir(deckDir, { recursive: true });
    await writeFile(
      join(deckDir, "slides.html"),
      "<!DOCTYPE html><html><body>DECK_BODY</body></html>",
    );
  });

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  it('source="session" resolves deck/slides.html preserving the subfolder', async () => {
    const ctx = {
      WORKSPACE_DIR: workspace,
      GENERATORS_DIR: "/unused",
      activeProject: null,
      discoverBrands: () => [],
    };
    const { status, body } = await callBundle(ctx, {
      source: "session",
      sessionDir,
      file: "deck/slides.html",
    });
    expect(status).toBe(200);
    expect(body.toString()).toContain("DECK_BODY");
  });

  it('source="content" resolves deck/slides.html against the active project', async () => {
    const ctx = {
      WORKSPACE_DIR: workspace,
      GENERATORS_DIR: "/unused",
      activeProject: { dir: sessionDir, contentDir, stateDir: join(sessionDir, "state") },
      discoverBrands: () => [],
    };
    const { status, body } = await callBundle(ctx, {
      source: "content",
      file: "deck/slides.html",
    });
    expect(status).toBe(200);
    expect(body.toString()).toContain("DECK_BODY");
  });

  it("empty {} body falls back to active-source (UI button default path)", async () => {
    await writeFile(
      join(sessionDir, "state", "active.json"),
      JSON.stringify({ file: "deck/slides.html", preset: null, sessionDir, timestamp: Date.now() }),
    );
    const ctx = {
      WORKSPACE_DIR: workspace,
      GENERATORS_DIR: "/unused",
      activeProject: { dir: sessionDir, contentDir, stateDir: join(sessionDir, "state") },
      discoverBrands: () => [],
    };
    const { status, body } = await callBundle(ctx, {});
    expect(status).toBe(200);
    expect(body.toString()).toContain("DECK_BODY");
  });

  it("active-source fallback uses state/active.json with subfolder path", async () => {
    await writeFile(
      join(sessionDir, "state", "active.json"),
      JSON.stringify({ file: "deck/slides.html", preset: null, sessionDir, timestamp: Date.now() }),
    );
    const ctx = {
      WORKSPACE_DIR: workspace,
      GENERATORS_DIR: "/unused",
      activeProject: { dir: sessionDir, contentDir, stateDir: join(sessionDir, "state") },
      discoverBrands: () => [],
    };
    const { status, body } = await callBundle(ctx);
    expect(status).toBe(200);
    expect(body.toString()).toContain("DECK_BODY");
  });

  it("rejects path-traversal attempts with 400", async () => {
    const ctx = {
      WORKSPACE_DIR: workspace,
      GENERATORS_DIR: "/unused",
      activeProject: null,
      discoverBrands: () => [],
    };
    const { status, body } = await callBundle(ctx, {
      source: "session",
      sessionDir,
      file: "../../../etc/passwd",
    });
    expect(status).toBe(400);
    expect(body.toString()).toContain("Could not resolve source");
  });

  it("rejects invalid JSON body with 400 (no silent fallback)", async () => {
    const ctx = {
      WORKSPACE_DIR: workspace,
      GENERATORS_DIR: "/unused",
      activeProject: null,
      discoverBrands: () => [],
    };
    const server = http.createServer((req, res) => handleExportHtmlBundle(req, res, ctx));
    await new Promise((r) => server.listen(0, r));
    const { port } = server.address();
    try {
      const raw = "this-is-not-json";
      const req = http.request({
        hostname: "127.0.0.1",
        port,
        method: "POST",
        path: "/x",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(raw) },
      });
      const p = once(req, "response").then(async ([res]) => {
        const chunks = [];
        for await (const c of res) chunks.push(c);
        return { status: res.statusCode, body: Buffer.concat(chunks) };
      });
      req.end(raw);
      const { status, body } = await p;
      expect(status).toBe(400);
      expect(body.toString()).toContain("Invalid JSON body");
    } finally {
      server.close();
    }
  });
});
