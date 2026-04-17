import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import * as validateRoutes from "#src/templates/skills/content-factory/scripts/routes/validate-routes.cjs";

const { _handlers, _validator, _cfgLib } = validateRoutes;

// Mock response capturing writeHead + end
function mockRes() {
  const r = {
    statusCode: null,
    body: null,
    writeHead(code) {
      r.statusCode = code;
    },
    end(payload) {
      r.body = payload != null ? payload.toString() : null;
    },
  };
  return r;
}

// Mock request with data/end event emitters
function mockReq(method, body) {
  const bodyStr = body != null ? JSON.stringify(body) : "";
  const handlers = { data: [], end: [], error: [] };
  const req = {
    method,
    on(event, fn) {
      handlers[event] = handlers[event] || [];
      handlers[event].push(fn);
      return req;
    },
    destroy() {},
  };
  setImmediate(() => {
    if (bodyStr) (handlers.data || []).forEach((fn) => fn(Buffer.from(bodyStr)));
    (handlers.end || []).forEach((fn) => fn());
  });
  return req;
}

function waitFor(res, timeoutMs = 500) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (res.body != null) {
        resolve(JSON.parse(res.body));
        return;
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error("timeout"));
        return;
      }
      setImmediate(tick);
    };
    tick();
  });
}

// Build a working session on disk
function makeSession(ws, name, cardCount = 2) {
  const dir = path.join(ws, name);
  fs.mkdirSync(path.join(dir, "content"), { recursive: true });
  fs.mkdirSync(path.join(dir, "state"), { recursive: true });
  const cards = Array.from(
    { length: cardCount },
    (_, i) =>
      `<article class="social-card"><div class="inner"><h1>Card ${i + 1}</h1></div></article>`,
  ).join("\n");
  fs.writeFileSync(
    path.join(dir, "content", "social.html"),
    `<!DOCTYPE html><html><head><style>.social-card{display:flex;align-items:center;justify-content:center;padding:16px;gap:16px;width:1080px;height:1080px;}</style></head><body>${cards}</body></html>`,
  );
  fs.writeFileSync(
    path.join(dir, "state", "manifest.json"),
    JSON.stringify(
      {
        name,
        slug: name,
        projectDir: dir,
        created: Date.now(),
        preset: { id: "x", name: "X", type: "slides" },
        files: ["social.html"],
        status: "draft",
      },
      null,
      2,
    ),
  );
  return dir;
}

// A fake renderer that returns a passing leaf tree
function fakePassRenderer() {
  return {
    renderAndExtract: async () => ({
      tag: "div",
      id: null,
      classes: [],
      path: "div",
      rect: {
        x: 0,
        y: 0,
        w: 1080,
        h: 1080,
        scrollW: 1080,
        scrollH: 1080,
        clientW: 1080,
        clientH: 1080,
        textW: 500,
        justify: "center",
        textAlign: "center",
      },
      css: {
        display: "block",
        flexDirection: "row",
        flexWrap: "nowrap",
        gridTemplateColumns: "none",
        gap: 0,
        columnGap: 0,
        rowGap: 0,
        paddingTop: 0,
        paddingRight: 0,
        paddingBottom: 0,
        paddingLeft: 0,
      },
      dataBoxGroup: null,
      textContent: "hi",
      children: [],
    }),
    closeBrowser: async () => {},
  };
}

describe("validate-routes integration", () => {
  let ws;
  let ctx;
  let projectDir;

  beforeEach(() => {
    ws = fs.mkdtempSync(path.join(os.tmpdir(), "cf-valroute-"));
    ctx = { WORKSPACE_DIR: ws };
    projectDir = makeSession(ws, "test-session", 2);
    _validator.__setRenderer(fakePassRenderer());
  });

  afterEach(() => {
    _validator.__resetRenderer();
    try {
      fs.rmSync(ws, { recursive: true, force: true });
    } catch {}
  });

  async function call(fn, req, parsed) {
    const res = mockRes();
    const result = fn(req, res, ctx, parsed);
    if (result && typeof result.then === "function") await result;
    return waitFor(res);
  }

  it("POST /api/validate-card returns pass for a clean card", async () => {
    const body = await call(
      _handlers.handleValidateCardPost,
      mockReq("POST", { project: projectDir, file: "social.html", cardIndex: 0 }),
      new URL("http://localhost/api/validate-card"),
    );
    expect(body.ok).toBe(true);
    expect(body.pass).toBe(true);
  });

  it("GET /api/validate-cards returns batch report", async () => {
    const body = await call(
      _handlers.handleValidateCardsGet,
      mockReq("GET"),
      new URL(
        `http://localhost/api/validate-cards?project=${encodeURIComponent(projectDir)}&file=social.html`,
      ),
    );
    expect(body.ok).toBe(true);
    expect(body.cards).toHaveLength(2);
  });

  it("skips with master-switch-off when enabled=false", async () => {
    _cfgLib.writeSessionConfig(projectDir, { enabled: false });
    const body = await call(
      _handlers.handleValidateCardPost,
      mockReq("POST", { project: projectDir, file: "social.html", cardIndex: 0 }),
      new URL("http://localhost/api/validate-card"),
    );
    expect(body.skipped).toBe("master-switch-off");
    expect(body.pass).toBe(true);
  });

  it("skips with endpoint-layer-off when layers.endpoint=false", async () => {
    _cfgLib.writeSessionConfig(projectDir, { layers: { endpoint: false } });
    const body = await call(
      _handlers.handleValidateCardPost,
      mockReq("POST", { project: projectDir, file: "social.html", cardIndex: 0 }),
      new URL("http://localhost/api/validate-card"),
    );
    expect(body.skipped).toBe("endpoint-layer-off");
  });

  it("GET /api/validation-config returns resolved cascade with source map", async () => {
    const body = await call(
      _handlers.handleGetConfig,
      mockReq("GET"),
      new URL(`http://localhost/api/validation-config?project=${encodeURIComponent(projectDir)}`),
    );
    expect(body.scope).toBe("session");
    expect(body.config.preset).toBe("strict"); // slides default
    expect(body.source.preset).toBe("type-default");
  });

  it("PATCH /api/validation-config persists session patch", async () => {
    const body = await call(
      _handlers.handlePatchConfig,
      mockReq("PATCH", { project: projectDir, patch: { threshold: 0.75 } }),
      new URL("http://localhost/api/validation-config"),
    );
    expect(body.ok).toBe(true);
    expect(body.config.threshold).toBe(0.75);
    // Re-read to verify persistence
    const reread = await call(
      _handlers.handleGetConfig,
      mockReq("GET"),
      new URL(`http://localhost/api/validation-config?project=${encodeURIComponent(projectDir)}`),
    );
    expect(reread.config.threshold).toBe(0.75);
  });

  it("POST /api/validation-config/toggle flips a layer", async () => {
    const body = await call(
      _handlers.handleToggle,
      mockReq("POST", { project: projectDir, layer: "badge", value: false }),
      new URL("http://localhost/api/validation-config/toggle"),
    );
    expect(body.ok).toBe(true);
    expect(body.config.layers.badge).toBe(false);
  });

  it("POST /api/validation-config/toggle rejects unknown layer", async () => {
    const res = mockRes();
    _handlers.handleToggle(
      mockReq("POST", { project: projectDir, layer: "fake-layer", value: true }),
      res,
      ctx,
    );
    await waitFor(res);
    expect(res.statusCode).toBe(400);
  });

  it("POST /api/validation-config/ignore-violation adds perFile entry", async () => {
    const body = await call(
      _handlers.handleIgnoreViolation,
      mockReq("POST", {
        project: projectDir,
        file: "social.html",
        rule: "R4",
        selector: "article > h1",
        cardIndex: 0,
      }),
      new URL("http://localhost/api/validation-config/ignore-violation"),
    );
    expect(body.ok).toBe(true);
    expect(body.config.perFile["social.html"].ignoreViolations).toHaveLength(1);
  });

  it("GET /api/validator-health returns status fields", async () => {
    const res = mockRes();
    _handlers.handleHealth(mockReq("GET"), res);
    const body = await waitFor(res);
    expect(body).toHaveProperty("degraded");
    expect(body).toHaveProperty("cacheHits");
    expect(body).toHaveProperty("cacheSize");
  });
});
