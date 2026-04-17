import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import {
  cloneTemplate,
  defaultSessionName,
} from "#src/templates/skills/content-factory/scripts/lib/template-cloner.cjs";

const TEMPLATE_HTML = `<!DOCTYPE html>
<html><head>
<meta name="codi:template" content='{"id":"clone-demo","name":"Clone Demo","type":"social","format":{"w":1080,"h":1080}}'>
</head><body>
<article class="social-card"><h1>Original heading</h1></article>
<article class="social-card"><h1>Second slide</h1></article>
</body></html>
`;

describe("template-cloner", () => {
  let root;
  let ctx;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "cf-clone-"));
    const generatorsDir = path.join(root, "generators");
    const workspaceDir = path.join(root, "workspace");
    const skillsDir = path.join(root, "skills");
    fs.mkdirSync(path.join(generatorsDir, "templates"), { recursive: true });
    fs.mkdirSync(workspaceDir, { recursive: true });
    fs.mkdirSync(skillsDir, { recursive: true });
    fs.writeFileSync(path.join(generatorsDir, "templates", "clone-demo.html"), TEMPLATE_HTML);
    ctx = { GENERATORS_DIR: generatorsDir, WORKSPACE_DIR: workspaceDir, SKILLS_DIR: skillsDir };
  });

  afterEach(() => {
    try {
      fs.rmSync(root, { recursive: true, force: true });
    } catch {}
  });

  it("clones a template into a new session with the HTML byte-equal to the source", () => {
    const { session, descriptor } = cloneTemplate({ templateId: "clone-demo" }, ctx);
    expect(descriptor).not.toBeNull();
    expect(descriptor.kind).toBe("session");
    expect(descriptor.readOnly).toBe(false);
    expect(descriptor.source.file).toBe("clone-demo.html");

    const sourceBytes = fs.readFileSync(
      path.join(ctx.GENERATORS_DIR, "templates", "clone-demo.html"),
    );
    const targetBytes = fs.readFileSync(path.join(session.contentDir, "clone-demo.html"));
    expect(targetBytes.equals(sourceBytes)).toBe(true);
  });

  it("writes a manifest with preset provenance pointing at the origin template", () => {
    const { session } = cloneTemplate({ templateId: "clone-demo" }, ctx);
    const manifest = JSON.parse(fs.readFileSync(session.manifestPath, "utf-8"));
    expect(manifest.preset).toBeDefined();
    expect(manifest.preset.id).toBe("clone-demo");
    expect(manifest.preset.name).toBe("Clone Demo");
    expect(manifest.files).toEqual(["clone-demo.html"]);
    expect(manifest.status).toBe("draft");
  });

  it("uses the provided name when one is supplied", () => {
    const { session, descriptor } = cloneTemplate(
      { templateId: "clone-demo", name: "My Campaign" },
      ctx,
    );
    expect(descriptor.name).toBe("My Campaign");
    // The session dir slug is derived from the name — verify no collision
    expect(path.basename(session.sessionDir)).toMatch(/^my-campaign/);
  });

  it("names sessions uniquely when the slug already exists", () => {
    const a = cloneTemplate({ templateId: "clone-demo", name: "Dup" }, ctx);
    const b = cloneTemplate({ templateId: "clone-demo", name: "Dup" }, ctx);
    expect(a.session.sessionDir).not.toBe(b.session.sessionDir);
    // Both should exist on disk
    expect(fs.existsSync(a.session.contentDir)).toBe(true);
    expect(fs.existsSync(b.session.contentDir)).toBe(true);
  });

  it("returns a descriptor whose cardCount matches the template", () => {
    const { descriptor } = cloneTemplate({ templateId: "clone-demo" }, ctx);
    expect(descriptor.cardCount).toBe(2); // TEMPLATE_HTML has 2 social-card articles
  });

  it("throws a 404 error for an unknown templateId", () => {
    expect(() => cloneTemplate({ templateId: "nope" }, ctx)).toThrowError(/template not found/);
  });

  it("defaultSessionName produces a time-stamped name derived from the template", () => {
    const n = defaultSessionName({ id: "foo", name: "Foo" });
    expect(n).toMatch(/^Foo · \d{4}-\d{2}-\d{2}/);
  });
});
