import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import * as contentRoutes from "#src/templates/skills/content-factory/scripts/routes/content-routes.cjs";

const TEMPLATE_HTML = `<!DOCTYPE html>
<html><head>
<meta name="codi:template" content='{"id":"clone-route-demo","name":"Clone Route Demo","type":"social","format":{"w":1080,"h":1080}}'>
</head><body>
<article class="social-card"><h1>Original</h1></article>
</body></html>
`;

function mockReq(method, pathname, body) {
  const bodyStr = body != null ? JSON.stringify(body) : "";
  const handlers = { data: [], end: [], error: [] };
  const req = {
    method,
    url: pathname,
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

function waitForRes(res, timeoutMs = 500) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (res.body != null) {
        resolve(JSON.parse(res.body));
        return;
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error("response timeout"));
        return;
      }
      setImmediate(tick);
    };
    tick();
  });
}

describe("POST /api/clone-template-to-session", () => {
  let root;
  let ctx;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "cf-clone-route-"));
    const generatorsDir = path.join(root, "generators");
    const workspaceDir = path.join(root, "workspace");
    const skillsDir = path.join(root, "skills");
    fs.mkdirSync(path.join(generatorsDir, "templates"), { recursive: true });
    fs.mkdirSync(workspaceDir);
    fs.mkdirSync(skillsDir);
    fs.writeFileSync(path.join(generatorsDir, "templates", "clone-route-demo.html"), TEMPLATE_HTML);
    ctx = { GENERATORS_DIR: generatorsDir, WORKSPACE_DIR: workspaceDir, SKILLS_DIR: skillsDir };
  });

  afterEach(() => {
    try {
      fs.rmSync(root, { recursive: true, force: true });
    } catch {}
  });

  async function invoke(body) {
    const req = mockReq("POST", "/api/clone-template-to-session", body);
    const res = mockRes();
    const parsed = new URL("http://localhost/api/clone-template-to-session");
    const handled = contentRoutes.handle(req, res, parsed, ctx);
    expect(handled).toBe(true);
    return waitForRes(res);
  }

  it("clones a template and returns a unified session descriptor", async () => {
    const body = await invoke({ templateId: "clone-route-demo", name: "my-campaign" });
    expect(body.ok).toBe(true);
    expect(body.session.kind).toBe("session");
    expect(body.session.readOnly).toBe(false);
    expect(body.session.source.sessionDir).toBe(body.sessionDir);
    expect(body.file).toBe("clone-route-demo.html");

    // Verify the file was actually copied
    const copied = path.join(body.sessionDir, "content", "clone-route-demo.html");
    expect(fs.existsSync(copied)).toBe(true);
    expect(fs.readFileSync(copied, "utf-8")).toBe(TEMPLATE_HTML);
  });

  it("returns 400 when templateId is missing", async () => {
    const req = mockReq("POST", "/api/clone-template-to-session", {});
    const res = mockRes();
    const parsed = new URL("http://localhost/api/clone-template-to-session");
    contentRoutes.handle(req, res, parsed, ctx);
    const body = await waitForRes(res);
    expect(res.statusCode).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error).toContain("templateId");
  });

  it("returns 404 when the templateId does not resolve", async () => {
    const req = mockReq("POST", "/api/clone-template-to-session", { templateId: "nope" });
    const res = mockRes();
    const parsed = new URL("http://localhost/api/clone-template-to-session");
    contentRoutes.handle(req, res, parsed, ctx);
    const body = await waitForRes(res);
    expect(res.statusCode).toBe(404);
    expect(body.ok).toBe(false);
  });
});
