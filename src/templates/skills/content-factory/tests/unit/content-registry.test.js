import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import * as registry from "#src/templates/skills/content-factory/scripts/lib/content-registry.cjs";

// A minimal fake card HTML that the counter and meta extractor can read.
const CARD_HTML = `<!DOCTYPE html>
<html><head>
<meta name="codi:template" content='{"id":"demo-preset","name":"Demo Preset","type":"slides","format":{"w":1280,"h":720}}'>
</head><body>
<article class="social-card" data-index="01"><h1>One</h1></article>
<article class="social-card" data-index="02"><h1>Two</h1></article>
<article class="social-card" data-index="03"><h1>Three</h1></article>
</body></html>
`;

const SESSION_CARD_HTML = `<article class="social-card"><h1>Cover</h1></article>
<article class="social-card"><h1>Body</h1></article>
`;

describe("content-registry.extractTemplateMeta", () => {
  it("parses the JSON from a codi:template meta tag", () => {
    expect(registry.extractTemplateMeta(CARD_HTML)).toEqual({
      id: "demo-preset",
      name: "Demo Preset",
      type: "slides",
      format: { w: 1280, h: 720 },
    });
  });

  it("returns an empty object when no meta tag is present", () => {
    expect(registry.extractTemplateMeta("<html><body></body></html>")).toEqual({});
  });
});

describe("content-registry.countCards", () => {
  it('counts every <article class="social-card">', () => {
    expect(registry.countCards(CARD_HTML)).toBe(3);
  });

  it("returns 1 for HTML without any social-card articles (defensive)", () => {
    expect(registry.countCards("<p>no cards here</p>")).toBe(1);
  });
});

describe("content-registry descriptor shape parity", () => {
  let workspaceDir;
  let skillsDir;
  let generatorsDir;
  let ctx;
  let sessionDir;

  beforeEach(() => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "cf-registry-"));
    workspaceDir = path.join(root, "workspace");
    skillsDir = path.join(root, "skills");
    generatorsDir = path.join(root, "generators");

    // Template fixture
    const templatesDir = path.join(generatorsDir, "templates");
    fs.mkdirSync(templatesDir, { recursive: true });
    fs.writeFileSync(path.join(templatesDir, "demo-preset.html"), CARD_HTML);

    // Session fixture
    sessionDir = path.join(workspaceDir, "my-demo-session");
    fs.mkdirSync(path.join(sessionDir, "content"), { recursive: true });
    fs.mkdirSync(path.join(sessionDir, "state"), { recursive: true });
    fs.writeFileSync(path.join(sessionDir, "content", "social.html"), SESSION_CARD_HTML);
    fs.writeFileSync(
      path.join(sessionDir, "state", "manifest.json"),
      JSON.stringify({
        name: "My Demo Session",
        slug: "my-demo-session",
        created: 1700000000000,
        preset: { type: "social", format: { w: 1080, h: 1080 } },
        status: "draft",
      }),
    );

    fs.mkdirSync(skillsDir, { recursive: true });
    ctx = { GENERATORS_DIR: generatorsDir, SKILLS_DIR: skillsDir, WORKSPACE_DIR: workspaceDir };
  });

  it("produces a template descriptor with every unified field populated", () => {
    const d = registry.getDescriptor("template", "demo-preset", ctx);
    expect(d).not.toBeNull();
    expect(d.kind).toBe("template");
    expect(d.id).toBe("demo-preset");
    expect(d.name).toBe("Demo Preset");
    expect(d.type).toBe("slides");
    expect(d.format).toEqual({ w: 1280, h: 720 });
    expect(d.cardCount).toBe(3);
    expect(d.status).toBeNull();
    expect(d.readOnly).toBe(true);
    expect(d.source.file).toBe("demo-preset.html");
    expect(d.source.templateId).toBe("demo-preset");
    expect(typeof d.createdAt).toBe("number");
    expect(typeof d.modifiedAt).toBe("number");
  });

  it("produces a session descriptor with every unified field populated", () => {
    const d = registry.getDescriptor("session", "my-demo-session", ctx);
    expect(d).not.toBeNull();
    expect(d.kind).toBe("session");
    expect(d.id).toBe("my-demo-session");
    expect(d.name).toBe("My Demo Session");
    expect(d.type).toBe("social");
    expect(d.format).toEqual({ w: 1080, h: 1080 });
    expect(d.cardCount).toBe(2);
    expect(d.status).toBe("draft");
    expect(d.readOnly).toBe(false);
    expect(d.source.file).toBe("social.html");
    expect(d.source.sessionDir).toBe(sessionDir);
    expect(typeof d.createdAt).toBe("number");
  });

  it("template and session descriptors have exactly the same top-level keys", () => {
    const t = registry.getDescriptor("template", "demo-preset", ctx);
    const s = registry.getDescriptor("session", "my-demo-session", ctx);
    expect(Object.keys(t).sort()).toEqual(Object.keys(s).sort());
  });

  it("returns null for an unknown id", () => {
    expect(registry.getDescriptor("template", "nope", ctx)).toBeNull();
    expect(registry.getDescriptor("session", "nope", ctx)).toBeNull();
  });

  it("returns null for an unknown kind", () => {
    expect(registry.getDescriptor("banana", "demo-preset", ctx)).toBeNull();
  });

  it("listAll returns templates and sessions with the same shape", () => {
    const all = registry.listAll(ctx);
    expect(all.length).toBeGreaterThanOrEqual(2);
    const keyshapes = new Set(all.map((x) => JSON.stringify(Object.keys(x).sort())));
    expect(keyshapes.size).toBe(1); // every descriptor has the same key set
  });
});
