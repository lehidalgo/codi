import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
// inspect-routes re-exports the exact elementStore instance its handlers
// close over via `_elementStore`. Importing it via this wrapper (rather
// than a separate direct import of element-store.cjs) guarantees the
// test and the route operate on the same singleton — no createRequire
// needed.
import {
  _handlers,
  _elementStore as elementStore,
} from "#src/templates/skills/content-factory/scripts/routes/inspect-routes.cjs";
import {
  listStyleRules,
  readFileSafe,
} from "#src/templates/skills/content-factory/scripts/lib/card-source.cjs";

// Mock response object that captures what the route handlers send.
function mockRes() {
  const r = {
    statusCode: null,
    headers: null,
    body: null,
    writeHead(code, headers) {
      r.statusCode = code;
      r.headers = headers;
    },
    end(payload) {
      r.body = payload != null ? payload.toString() : null;
    },
  };
  return r;
}

function parseBody(res) {
  return res.body ? JSON.parse(res.body) : null;
}

const CARD_HTML = `<article class="social-card" data-type="cover">
  <style>
    .social-card { background: #000; color: #fff; padding: 40px; }
    h1 { font-size: 48px; color: #fff; }
  </style>
  <h1>Your rules, your agents.</h1>
  <p>One config. All AI tools. In sync.</p>
</article>
`;

describe("persist-style integration", () => {
  let projectDir;
  let filePath;

  beforeEach(() => {
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "cf-persist-"));
    const contentDir = path.join(projectDir, "content");
    fs.mkdirSync(contentDir);
    filePath = path.join(contentDir, "social.html");
    fs.writeFileSync(filePath, CARD_HTML);
    // Reset server-side selection state between tests
    elementStore.clearSelection();
    elementStore.clearSet();
  });

  afterEach(() => {
    try {
      fs.rmSync(projectDir, { recursive: true, force: true });
    } catch {}
    elementStore.clearSelection();
    elementStore.clearSet();
  });

  it("assigns a cf-id, writes the rule, and confirms via the list endpoint", async () => {
    const res = mockRes();
    _handlers.handlePersistStyle(res, {
      project: projectDir,
      file: "social.html",
      targetSelector: "article > h1",
      patches: { color: "#000", "font-weight": "900" },
      snapshot: {
        tag: "h1",
        classes: [],
        parentTag: "article",
        text: "Your rules, your agents.",
      },
    });
    const body = parseBody(res);
    expect(res.statusCode).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.cfId).toMatch(/^cf-[0-9a-f]{8}/);
    expect(body.rule).toContain("color: #000");
    expect(body.rule).toContain("font-weight: 900");
    expect(body.sourceModified).toBe(true);

    // Source file contains the new rule and data-cf-id
    const html = readFileSafe(filePath);
    expect(html).toContain("/* === cf:user-edits === */");
    expect(html).toContain('[data-cf-id="' + body.cfId + '"]');
    expect(html).toContain("color: #000");
    expect(html).toContain('data-cf-id="' + body.cfId + '"');

    // List endpoint confirms
    const res2 = mockRes();
    _handlers.handlePersistStyleList(res2, {
      project: projectDir,
      file: "social.html",
    });
    const list = parseBody(res2);
    expect(list.count).toBe(1);
    expect(list.rules[0].selector).toBe('[data-cf-id="' + body.cfId + '"]');
  });

  it("is idempotent — re-applying the same edit does not change the file", () => {
    const res1 = mockRes();
    _handlers.handlePersistStyle(res1, {
      project: projectDir,
      file: "social.html",
      targetSelector: "article > h1",
      patches: { color: "#000" },
      snapshot: { tag: "h1", classes: [], parentTag: "article", text: "Your rules, your agents." },
    });
    const htmlAfterFirst = readFileSafe(filePath);

    const res2 = mockRes();
    _handlers.handlePersistStyle(res2, {
      project: projectDir,
      file: "social.html",
      targetSelector: "article > h1",
      patches: { color: "#000" },
      snapshot: { tag: "h1", classes: [], parentTag: "article", text: "Your rules, your agents." },
    });
    const htmlAfterSecond = readFileSafe(filePath);
    expect(htmlAfterSecond).toBe(htmlAfterFirst);
    const body = parseBody(res2);
    expect(body.sourceModified).toBe(false);
  });

  it("reverts a rule and strips the data-cf-id attribute", () => {
    const res1 = mockRes();
    _handlers.handlePersistStyle(res1, {
      project: projectDir,
      file: "social.html",
      targetSelector: "article > h1",
      patches: { color: "#000" },
      snapshot: { tag: "h1", classes: [], parentTag: "article", text: "Your rules, your agents." },
    });
    const { cfId } = parseBody(res1);

    const res2 = mockRes();
    _handlers.handlePersistStyleRevert(res2, {
      project: projectDir,
      file: "social.html",
      cfId,
    });
    expect(parseBody(res2).ok).toBe(true);

    const html = readFileSafe(filePath);
    expect(html).not.toContain("data-cf-id");
    const rules = listStyleRules(html);
    expect(rules).toHaveLength(0);
  });

  it("returns 409 on selector drift", () => {
    const res = mockRes();
    _handlers.handlePersistStyle(res, {
      project: projectDir,
      file: "social.html",
      targetSelector: "article > h99",
      patches: { color: "red" },
    });
    expect(res.statusCode).toBe(409);
    const body = parseBody(res);
    expect(body.ok).toBe(false);
    expect(body.error).toContain("source changed");
  });

  it("rejects requests without project or file", () => {
    const res = mockRes();
    _handlers.handlePersistStyle(res, {
      targetSelector: "h1",
      patches: { color: "red" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("reuses an existing data-cf-id attribute instead of generating a new one", () => {
    // Pre-seed the card with a data-cf-id
    const seeded = CARD_HTML.replace("<h1>", '<h1 data-cf-id="cf-preset01">');
    fs.writeFileSync(filePath, seeded);

    const res = mockRes();
    _handlers.handlePersistStyle(res, {
      project: projectDir,
      file: "social.html",
      targetSelector: "article > h1",
      patches: { color: "#000" },
    });
    expect(parseBody(res).cfId).toBe("cf-preset01");
  });

  it("uses the active selection context when body omits project+file (legacy shape)", () => {
    elementStore.setSelection(
      {
        seq: 1,
        selector: "article > h1",
        tag: "h1",
        classes: [],
        text: "Your rules, your agents.",
      },
      { project: projectDir, file: "social.html", cardIndex: 0, templateId: null },
    );

    const res = mockRes();
    _handlers.handlePersistStyle(res, {
      targetSelector: "article > h1",
      patches: { color: "#000" },
    });
    const body = parseBody(res);
    expect(res.statusCode).toBe(200);
    expect(body.ok).toBe(true);
  });

  it("uses the new unified context shape (kind/id/sessionDir/readOnly)", () => {
    elementStore.setSelection(
      { seq: 1, selector: "article > h1", tag: "h1", classes: [], text: "Your rules." },
      {
        kind: "session",
        id: "my-session",
        name: "My Session",
        file: "social.html",
        sessionDir: projectDir,
        cardIndex: 0,
        readOnly: false,
      },
    );

    const res = mockRes();
    _handlers.handlePersistStyle(res, {
      targetSelector: "article > h1",
      patches: { color: "#000" },
    });
    const body = parseBody(res);
    expect(res.statusCode).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.cfId).toMatch(/^cf-/);
    const html = readFileSafe(filePath);
    expect(html).toContain('data-cf-id="' + body.cfId + '"');
  });

  it("returns 409 when the unified context says readOnly=true", () => {
    elementStore.setSelection(
      { seq: 2, selector: "article > h1", tag: "h1", classes: [], text: "Template heading" },
      {
        kind: "template",
        id: "my-template",
        name: "Template Name",
        file: "tpl.html",
        templateId: "my-template",
        cardIndex: 0,
        readOnly: true,
      },
    );

    const res = mockRes();
    _handlers.handlePersistStyle(res, {
      targetSelector: "article > h1",
      patches: { color: "#000" },
    });
    expect(res.statusCode).toBe(409);
    const body = parseBody(res);
    expect(body.ok).toBe(false);
    expect(body.error).toContain("template");
    expect(body.templateId).toBe("my-template");
  });

  it("returns 409 when the selection came from a template (no project)", () => {
    elementStore.setSelection(
      { seq: 2, selector: "article > h1", tag: "h1", classes: [], text: "Template heading" },
      { project: null, file: null, cardIndex: 0, templateId: "social-editorial-dark" },
    );

    const res = mockRes();
    _handlers.handlePersistStyle(res, {
      targetSelector: "article > h1",
      patches: { color: "#000" },
    });
    expect(res.statusCode).toBe(409);
    const body = parseBody(res);
    expect(body.ok).toBe(false);
    expect(body.error).toContain("template");
    expect(body.suggestion).toContain("save");
    expect(body.templateId).toBe("social-editorial-dark");
  });

  it("prefers explicit body project+file over stale selection context", () => {
    // Selection has context pointing at a DIFFERENT project — agent
    // explicitly overrides with body args.
    elementStore.setSelection(
      { seq: 3, selector: "article > h1", tag: "h1", classes: [], text: "stale" },
      {
        project: "/tmp/nonexistent-stale-project",
        file: "ghost.html",
        cardIndex: 0,
        templateId: null,
      },
    );

    const res = mockRes();
    _handlers.handlePersistStyle(res, {
      project: projectDir,
      file: "social.html",
      targetSelector: "article > h1",
      patches: { color: "#000" },
    });
    expect(res.statusCode).toBe(200);
    // Explicit body args win, write lands in the correct (real) project.
    const html = readFileSafe(filePath);
    expect(html).toContain("/* === cf:user-edits === */");
  });

  it("uses a real id attribute when present instead of assigning cf-id", () => {
    const seeded = CARD_HTML.replace("<h1>", '<h1 id="hero-title">');
    fs.writeFileSync(filePath, seeded);

    const res = mockRes();
    _handlers.handlePersistStyle(res, {
      project: projectDir,
      file: "social.html",
      targetSelector: "article > h1",
      patches: { color: "#000" },
    });
    const body = parseBody(res);
    expect(body.cfId).toBeNull();
    expect(body.selector).toBe("#hero-title");
    const html = readFileSafe(filePath);
    expect(html).toContain("#hero-title { color: #000; }");
    expect(html).not.toContain("data-cf-id");
  });
});
