// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  parseCards,
  parseTemplate,
} from "#src/templates/skills/content-factory/generators/lib/cards.js";

describe("parseCards", () => {
  it("parses .social-card elements", () => {
    const html = `<!DOCTYPE html><html><body>
      <article class="social-card" data-type="cover" data-index="01"><p>A</p></article>
      <article class="social-card" data-type="content" data-index="02"><p>B</p></article>
    </body></html>`;
    const cards = parseCards(html);
    expect(cards).toHaveLength(2);
    expect(cards[0].dataType).toBe("cover");
    expect(cards[1].dataIdx).toBe("02");
  });

  it("parses .doc-page elements (document templates)", () => {
    const html = `<!DOCTYPE html><html><body>
      <article class="doc-page" data-type="cover" data-index="01"></article>
    </body></html>`;
    const cards = parseCards(html);
    expect(cards).toHaveLength(1);
    expect(cards[0].dataType).toBe("cover");
  });

  it("parses .slide elements (slides templates)", () => {
    const html = `<!DOCTYPE html><html><body>
      <section class="slide" data-type="title" data-index="01"></section>
      <section class="slide" data-type="content" data-index="02"></section>
    </body></html>`;
    const cards = parseCards(html);
    expect(cards).toHaveLength(2);
  });

  it("returns empty array when no card elements found", () => {
    const html = `<!DOCTYPE html><html><body><p>nothing</p></body></html>`;
    expect(parseCards(html)).toHaveLength(0);
  });

  it("extracts shared styleText from all <style> tags", () => {
    const html = `<!DOCTYPE html><html><head>
      <style>.a{color:red}</style><style>.b{color:blue}</style>
    </head><body>
      <article class="social-card" data-type="cover" data-index="01"></article>
    </body></html>`;
    const cards = parseCards(html);
    expect(cards[0].styleText).toContain(".a{color:red}");
    expect(cards[0].styleText).toContain(".b{color:blue}");
  });

  it("extracts linkTags from <link rel=stylesheet> elements", () => {
    const html = `<!DOCTYPE html><html><head>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit&display=swap">
    </head><body>
      <article class="social-card" data-type="cover" data-index="01"></article>
    </body></html>`;
    const cards = parseCards(html);
    expect(cards[0].linkTags).toContain("fonts.googleapis.com");
  });

  it("sets format to null on every parsed card", () => {
    const html = `<article class="social-card" data-type="cover" data-index="01"></article>`;
    const cards = parseCards(html);
    expect(cards[0].format).toBeNull();
  });
});

describe("parseTemplate", () => {
  it("reads id, name, type, and format from codi:template meta tag", () => {
    const meta = JSON.stringify({
      id: "dark-editorial",
      name: "Dark Editorial",
      type: "social",
      format: { w: 1080, h: 1080 },
    });
    const html = `<!DOCTYPE html><html><head>
      <meta name="codi:template" content='${meta}'>
    </head><body>
      <article class="social-card" data-type="cover" data-index="01"></article>
    </body></html>`;
    const t = parseTemplate(html, "dark-editorial.html");
    expect(t.id).toBe("dark-editorial");
    expect(t.name).toBe("Dark Editorial");
    expect(t.type).toBe("social");
    expect(t.format).toEqual({ w: 1080, h: 1080 });
  });

  it("falls back to filename-derived id when no meta tag", () => {
    const html = `<body><article class="social-card" data-type="cover" data-index="01"></article></body>`;
    const t = parseTemplate(html, "my-custom-template.html");
    expect(t.id).toBe("my-custom-template");
  });

  it("falls back to social type and 1080x1080 format when no meta tag", () => {
    const html = `<body><article class="social-card" data-type="cover" data-index="01"></article></body>`;
    const t = parseTemplate(html, "foo.html");
    expect(t.type).toBe("social");
    expect(t.format).toEqual({ w: 1080, h: 1080 });
  });

  it("reads type from legacy <meta name=template-type> when codi:template is absent", () => {
    const html = `<!DOCTYPE html><html><head>
      <meta name="template-type" content="slides">
    </head><body>
      <article class="social-card" data-type="cover" data-index="01"></article>
    </body></html>`;
    const t = parseTemplate(html, "clean-slides.html");
    expect(t.type).toBe("slides");
  });

  it("reads format from legacy <meta name=template-format> when codi:template is absent", () => {
    const html = `<!DOCTYPE html><html><head>
      <meta name="template-format" content="1280x720">
    </head><body>
      <article class="social-card" data-type="cover" data-index="01"></article>
    </body></html>`;
    const t = parseTemplate(html, "clean-slides.html");
    expect(t.format).toEqual({ w: 1280, h: 720 });
  });

  it("uses <title> tag as name fallback when codi:template is absent", () => {
    const html = `<!DOCTYPE html><html><head>
      <title>Codi — Social Content Series</title>
    </head><body>
      <article class="social-card" data-type="cover" data-index="01"></article>
    </body></html>`;
    const t = parseTemplate(html, "social.html");
    expect(t.name).toBe("Codi");
  });

  it("strips the dash-separated suffix from the title tag", () => {
    const html = `<html><head><title>Clean Slides — Template</title></head><body>
      <section class="slide" data-type="title" data-index="01"></section>
    </body></html>`;
    const t = parseTemplate(html, "clean-slides.html");
    expect(t.name).toBe("Clean Slides");
  });

  it("includes parsed cards in template object", () => {
    const meta = JSON.stringify({
      id: "t",
      name: "T",
      type: "social",
      format: { w: 1080, h: 1080 },
    });
    const html = `<html><head><meta name="codi:template" content='${meta}'></head><body>
      <article class="social-card" data-type="cover" data-index="01"></article>
      <article class="social-card" data-type="cta" data-index="02"></article>
    </body></html>`;
    const t = parseTemplate(html, "t.html");
    expect(t.cards).toHaveLength(2);
  });
});

describe("parseCards — nativeFormat and elementType propagation", () => {
  // Fixed-pixel slide/document decks author internal CSS for ONE canvas.
  // parseCards must propagate the <meta name="codi:template">.format and
  // the per-card element type so cardFormat() can honor the authored
  // canvas during preview (avoid distortion when sidebar ≠ native).
  it("reads nativeFormat from codi:template meta and attaches to every slide", () => {
    const meta = JSON.stringify({
      id: "d",
      name: "Deck",
      type: "slides",
      format: { w: 1600, h: 900 },
    });
    const html = `<!DOCTYPE html><html><head><meta name="codi:template" content='${meta}'></head><body>
      <section class="slide" data-type="cover" data-index="01"></section>
      <section class="slide" data-type="content" data-index="02"></section>
    </body></html>`;
    const cards = parseCards(html);
    expect(cards).toHaveLength(2);
    expect(cards[0].nativeFormat).toEqual({ w: 1600, h: 900 });
    expect(cards[1].nativeFormat).toEqual({ w: 1600, h: 900 });
  });

  it("derives elementType from class (slide / document / social)", () => {
    const meta = JSON.stringify({
      id: "mixed",
      name: "Mixed",
      type: "slides",
      format: { w: 1600, h: 900 },
    });
    const html = `<!DOCTYPE html><html><head><meta name="codi:template" content='${meta}'></head><body>
      <section class="slide" data-type="cover" data-index="01"></section>
      <article class="doc-page" data-type="body" data-index="02"></article>
      <article class="social-card" data-type="content" data-index="03"></article>
    </body></html>`;
    const cards = parseCards(html);
    expect(cards[0].elementType).toBe("slide");
    expect(cards[1].elementType).toBe("document");
    expect(cards[2].elementType).toBe("social");
  });

  it("sets nativeFormat to null when no meta is present (graceful)", () => {
    const html = `<!DOCTYPE html><html><body>
      <section class="slide" data-type="cover" data-index="01"></section>
    </body></html>`;
    const cards = parseCards(html);
    expect(cards[0].nativeFormat).toBeNull();
    expect(cards[0].elementType).toBe("slide");
  });

  it("tolerates malformed meta JSON without throwing", () => {
    const html = `<!DOCTYPE html><html><head><meta name="codi:template" content='{not valid json'></head><body>
      <section class="slide" data-type="cover" data-index="01"></section>
    </body></html>`;
    const cards = parseCards(html);
    expect(cards[0].nativeFormat).toBeNull();
    expect(cards[0].elementType).toBe("slide");
  });
});
