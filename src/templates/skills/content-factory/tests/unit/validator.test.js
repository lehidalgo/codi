import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import * as validator from "#src/templates/skills/content-factory/scripts/lib/validator.cjs";

// Fake renderer — returns a synthetic annotated tree without using
// playwright. Lets us unit-test the wrapper logic (cache, degrade,
// queue) without a real browser.
function fakeRenderer(treeBuilder) {
  return {
    renderAndExtract: async ({ html, width, height }) => {
      return treeBuilder({ html, width, height });
    },
    closeBrowser: async () => {},
  };
}

function leafTree(text = "hi") {
  return {
    tag: "div",
    id: null,
    classes: [],
    path: "div",
    rect: {
      x: 0,
      y: 0,
      w: 100,
      h: 50,
      scrollW: 100,
      scrollH: 50,
      clientW: 100,
      clientH: 50,
      textW: 40,
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
    textContent: text,
    children: [],
  };
}

function emptyChildTree() {
  // Empty leaf — triggers R7
  return {
    tag: "div",
    id: null,
    classes: [],
    path: "div",
    rect: {
      x: 0,
      y: 0,
      w: 100,
      h: 50,
      scrollW: 100,
      scrollH: 50,
      clientW: 100,
      clientH: 50,
      textW: 0,
      justify: "flex-start",
      textAlign: "left",
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
    textContent: "",
    children: [],
  };
}

describe("validator wrapper", () => {
  beforeEach(() => {
    validator.__resetRenderer();
  });

  afterEach(() => {
    validator.__resetRenderer();
  });

  it("returns degraded response when renderer is unavailable", async () => {
    validator.__setRenderer({ renderAndExtract: null });
    const r = await validator.validateHtml("<html></html>", { width: 1080, height: 1080 });
    expect(r.ok).toBe(true);
    expect(r.skipped).toBe("playwright-missing");
    expect(r.valid).toBe(true);
    const h = validator.getHealth();
    expect(h.degraded).toBe(true);
  });

  it("returns degraded response when probePlaywright reports false", async () => {
    validator.__setRenderer({
      renderAndExtract: async () => leafTree(),
      probePlaywright: async () => false,
    });
    const r = await validator.validateHtml("<html></html>", { width: 1080, height: 1080 });
    expect(r.ok).toBe(true);
    expect(r.skipped).toBe("playwright-missing");
    expect(r.installHint).toMatch(/setup-validation/);
    expect(validator.getHealth().degraded).toBe(true);
  });

  it("catches late playwright failure and flips to degraded", async () => {
    // probePlaywright says OK, but renderAndExtract throws the install error
    // — this simulates playwright vanishing between probe and render call.
    validator.__setRenderer({
      probePlaywright: async () => true,
      renderAndExtract: async () => {
        throw new Error("playwright not installed. Run: bash scripts/setup-validation.sh");
      },
    });
    const r = await validator.validateHtml("<x/>", { width: 1080, height: 1080 });
    expect(r.ok).toBe(true);
    expect(r.skipped).toBe("playwright-missing");
    expect(validator.getHealth().degraded).toBe(true);
  });

  it("runs validation with a fake renderer and returns a pass report", async () => {
    validator.__setRenderer(fakeRenderer(() => leafTree("centered text")));
    const r = await validator.validateHtml("<x/>", { width: 1080, height: 1080 });
    expect(r.ok).toBe(true);
    expect(r.pass).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(0.85);
    expect(Array.isArray(r.violations)).toBe(true);
  });

  it("returns a fail report when rule violations occur", async () => {
    // Empty childless leaf → R7 error
    validator.__setRenderer(fakeRenderer(() => emptyChildTree()));
    const r = await validator.validateHtml("<x/>", { width: 1080, height: 1080 });
    expect(r.ok).toBe(true);
    expect(r.pass).toBe(false);
    expect(r.violations.length).toBeGreaterThan(0);
    expect(r.violations[0].rule).toBe("R7");
    expect(r.summary.errors).toBeGreaterThan(0);
  });

  it("caches repeated calls with identical input", async () => {
    let renderCount = 0;
    validator.__setRenderer(
      fakeRenderer(() => {
        renderCount += 1;
        return leafTree();
      }),
    );
    await validator.validateHtml("<x/>", { width: 1080, height: 1080 });
    await validator.validateHtml("<x/>", { width: 1080, height: 1080 });
    await validator.validateHtml("<x/>", { width: 1080, height: 1080 });
    expect(renderCount).toBe(1);
    const h = validator.getHealth();
    expect(h.cacheHits).toBe(2);
    expect(h.cacheMisses).toBe(1);
  });

  it("cache key changes when dimensions change", async () => {
    let renderCount = 0;
    validator.__setRenderer(
      fakeRenderer(() => {
        renderCount += 1;
        return leafTree();
      }),
    );
    await validator.validateHtml("<x/>", { width: 1080, height: 1080 });
    await validator.validateHtml("<x/>", { width: 794, height: 1123 });
    expect(renderCount).toBe(2);
  });

  it("clearCache resets counters", async () => {
    validator.__setRenderer(fakeRenderer(() => leafTree()));
    await validator.validateHtml("<x/>", {});
    await validator.validateHtml("<x/>", {});
    expect(validator.getHealth().cacheHits).toBe(1);
    validator.clearCache();
    expect(validator.getHealth().cacheHits).toBe(0);
    expect(validator.getHealth().cacheSize).toBe(0);
  });

  it("serializes concurrent validations through the queue", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    validator.__setRenderer({
      renderAndExtract: async () => {
        inFlight += 1;
        if (inFlight > maxInFlight) maxInFlight = inFlight;
        await new Promise((r) => setTimeout(r, 5));
        inFlight -= 1;
        return leafTree();
      },
    });
    // Fire 4 different inputs so cache misses all queue.
    await Promise.all([
      validator.validateHtml("<x/>", { width: 100, height: 100 }),
      validator.validateHtml("<x/>", { width: 101, height: 100 }),
      validator.validateHtml("<x/>", { width: 102, height: 100 }),
      validator.validateHtml("<x/>", { width: 103, height: 100 }),
    ]);
    expect(maxInFlight).toBe(1);
  });

  it("extracts all card classes: social-card, slide, doc-page", async () => {
    const captured = [];
    validator.__setRenderer({
      renderAndExtract: async ({ html, width, height }) => {
        // Scope class detection to the <body> so the canvas-root
        // normalization rule injected in <head> (which names all three
        // classes) does not create false positives.
        const body = (html.match(/<body>([\s\S]*)<\/body>/i) || [, ""])[1];
        captured.push({
          width,
          height,
          hasSocial: /social-card/.test(body),
          hasSlide: /class="slide/.test(body),
          hasDoc: /doc-page/.test(body),
        });
        return leafTree();
      },
      closeBrowser: async () => {},
    });
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cf-extract-"));
    const project = path.join(tmp, "sess");
    fs.mkdirSync(path.join(project, "content"), { recursive: true });

    // social
    fs.writeFileSync(
      path.join(project, "content", "social.html"),
      `<!DOCTYPE html><html><body>
        <article class="social-card"><div>A</div></article>
        <article class="social-card"><div>B</div></article>
      </body></html>`,
    );
    const s = await validator.validateAllCards(project, "social.html", {});
    expect(s.cards).toHaveLength(2);

    // slides
    fs.writeFileSync(
      path.join(project, "content", "slides.html"),
      `<!DOCTYPE html><html><body>
        <article class="slide slide--cover"><h1>One</h1></article>
        <article class="slide"><h1>Two</h1></article>
        <article class="slide"><h1>Three</h1></article>
      </body></html>`,
    );
    const sl = await validator.validateAllCards(project, "slides.html", {});
    expect(sl.cards).toHaveLength(3);

    // docs
    fs.writeFileSync(
      path.join(project, "content", "doc.html"),
      `<!DOCTYPE html><html><body>
        <section class="doc-page"><p>Page 1</p></section>
        <section class="doc-page"><p>Page 2</p></section>
      </body></html>`,
    );
    const d = await validator.validateAllCards(project, "doc.html", {});
    expect(d.cards).toHaveLength(2);

    // Default canvas sizes applied when cfg.format is absent
    const slideRender = captured.find((c) => c.hasSlide && !c.hasSocial);
    expect(slideRender).toBeDefined();
    expect(slideRender.width).toBe(1280);
    expect(slideRender.height).toBe(720);
    const docRender = captured.find((c) => c.hasDoc);
    expect(docRender.width).toBe(1240);
    expect(docRender.height).toBe(1754);
    const socialRender = captured.find((c) => c.hasSocial);
    expect(socialRender.width).toBe(1080);
    expect(socialRender.height).toBe(1080);

    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("cfg.format override wins over default canvas sizes", async () => {
    const sizes = [];
    validator.__setRenderer({
      renderAndExtract: async ({ width, height }) => {
        sizes.push({ width, height });
        return leafTree();
      },
      closeBrowser: async () => {},
    });
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cf-extract-"));
    const project = path.join(tmp, "sess");
    fs.mkdirSync(path.join(project, "content"), { recursive: true });
    fs.writeFileSync(
      path.join(project, "content", "slides.html"),
      `<article class="slide"><h1>A</h1></article>`,
    );
    await validator.validateAllCards(project, "slides.html", { format: { w: 800, h: 600 } });
    expect(sizes[0]).toEqual({ width: 800, height: 600 });
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("returns an error response (not cached) when renderer throws", async () => {
    let attempt = 0;
    validator.__setRenderer({
      renderAndExtract: async () => {
        attempt += 1;
        if (attempt === 1) throw new Error("boom");
        return leafTree();
      },
    });
    const r1 = await validator.validateHtml("<x/>", {});
    expect(r1.ok).toBe(false);
    expect(r1.error).toBe("boom");
    // Retry should not hit cache — it re-runs and succeeds
    const r2 = await validator.validateHtml("<x/>", {});
    expect(r2.ok).toBe(true);
  });
});
