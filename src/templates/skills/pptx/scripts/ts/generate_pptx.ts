#!/usr/bin/env npx tsx
/**
 * generate_pptx.ts — Brand+theme-aware PPTX generator.
 * Usage: npx tsx generate_pptx.ts --content content.json [--tokens brand_tokens.json] [--theme dark|light] --output out.pptx
 * When --tokens is omitted, uses bundled Codi brand tokens.
 */
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

// pptxgenjs uses `export as namespace` which loses construct signatures under NodeNext.
// createRequire loads the CJS module directly, bypassing the ESM namespace wrapping.
const esmRequire = createRequire(import.meta.url);
type SlideMethod = (...args: unknown[]) => unknown;
interface ISlide {
  addText: SlideMethod;
  addShape: SlideMethod;
  addImage: SlideMethod;
  addTable: SlideMethod;
  background: { color: string };
  [key: string]: unknown;
}
interface IPres {
  layout: string;
  title: string;
  author: string;
  readonly ShapeType: Record<string, string>;
  defineLayout(layout: { name: string; width: number; height: number }): void;
  addSlide(): ISlide;
  writeFile(props: { fileName: string }): Promise<string>;
}
const _PptxRaw = esmRequire("pptxgenjs") as { new (): IPres; default?: { new (): IPres } };
const PptxGenJS = _PptxRaw.default ?? _PptxRaw;

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Types ─────────────────────────────────────────────────────────────────────

interface BrandTheme {
  background: string;
  surface: string;
  text_primary: string;
  text_secondary: string;
  primary: string;
  accent: string;
  logo: string;
}
interface BrandTokens {
  brand: string;
  version: number;
  themes: { dark: BrandTheme; light: BrandTheme };
  fonts: { headlines: string; body: string; fallback_sans: string };
  layout: {
    slide_width_in: string;
    slide_height_in: string;
    content_margin_in: string;
    accent_bar_width_in: string;
  };
  assets?: Record<string, string>;
}

interface TitleSlide {
  type: "title";
  title?: string;
  subtitle?: string;
  author?: string;
}
interface SectionSlide {
  type: "section";
  number?: string;
  label?: string;
  heading: string;
  body?: string;
  items?: string[];
  callout?: string;
}
interface QuoteSlide {
  type: "quote";
  quote: string;
  attribution?: string;
}
interface MetricsSlide {
  type: "metrics";
  heading?: string;
  metrics: { value: string; label: string }[];
}
interface ClosingSlide {
  type: "closing";
  message: string;
  contact?: string;
}

type Slide = TitleSlide | SectionSlide | QuoteSlide | MetricsSlide | ClosingSlide;

interface Content {
  title: string;
  subtitle?: string;
  author?: string;
  slides: Slide[];
}

// ── Args ──────────────────────────────────────────────────────────────────────

function parseArgs(): {
  content: string;
  tokens?: string;
  theme: "dark" | "light";
  output: string;
} {
  const argv = process.argv.slice(2);
  const get = (flag: string) => {
    const i = argv.indexOf(flag);
    return i !== -1 ? argv[i + 1] : undefined;
  };
  const content = get("--content");
  const output = get("--output");
  if (!content || !output) {
    console.error(
      "Usage: npx tsx generate_pptx.ts --content content.json [--tokens tokens.json] [--theme dark|light] --output out.pptx",
    );
    process.exit(1);
  }
  return {
    content,
    tokens: get("--tokens"),
    theme: get("--theme") === "light" ? "light" : "dark",
    output,
  };
}

// ── Setup ─────────────────────────────────────────────────────────────────────

const args = parseArgs();
const tokensPath = args.tokens
  ? resolve(process.cwd(), args.tokens)
  : join(__dirname, "../brand_tokens.json");
const tokensDir = dirname(tokensPath);
const tokens: BrandTokens = JSON.parse(readFileSync(tokensPath, "utf-8"));
const T = tokens.themes[args.theme];
const F = tokens.fonts;
const L = tokens.layout;
const W = parseFloat(L.slide_width_in);
const H = parseFloat(L.slide_height_in);
const M = parseFloat(L.content_margin_in);
const BAR = parseFloat(L.accent_bar_width_in);
const h = (c: string) => c.replace("#", "");

const content: Content = JSON.parse(readFileSync(resolve(process.cwd(), args.content), "utf-8"));

const logoRelPath = tokens.assets?.[T.logo];
const logoPath = logoRelPath ? resolve(tokensDir, logoRelPath) : null;
const logoExists = logoPath ? existsSync(logoPath) : false;

const pres = new PptxGenJS();
pres.layout = "LAYOUT_WIDE";
pres.title = content.title;
pres.author = content.author ?? tokens.brand;

type Slide2D = ReturnType<typeof pres.addSlide>;

// ── Shared helpers ────────────────────────────────────────────────────────────

function accentBar(s: Slide2D): void {
  s.addShape(pres.ShapeType.rect, {
    x: 0,
    y: 0,
    w: BAR,
    h: H,
    fill: { color: h(T.accent) },
    line: { type: "none" },
  });
}

function logo(
  s: Slide2D,
  x: number,
  y: number,
  w: number,
  ht: number,
  align: "left" | "right" = "right",
): void {
  if (logoExists && logoPath) {
    try {
      s.addImage({ path: logoPath, x, y, w, h: ht, sizing: { type: "contain", w, h: ht } });
      return;
    } catch {
      /* fall through to text fallback */
    }
  }
  s.addText(tokens.brand.toUpperCase(), {
    x,
    y,
    w,
    h: ht,
    color: h(T.accent),
    fontFace: F.fallback_sans,
    fontSize: 10,
    bold: true,
    charSpacing: 3,
    align,
  });
}

// ── Slide builders ────────────────────────────────────────────────────────────

function buildTitleSlide(slide: TitleSlide): void {
  const s = pres.addSlide();
  s.background = { color: h(T.background) };
  accentBar(s);
  logo(s, W - 1.9, 0.18, 1.5, 0.55);
  const title = slide.title ?? content.title;
  const subtitle = slide.subtitle ?? content.subtitle;
  const author = slide.author ?? content.author;
  s.addText(title, {
    x: M,
    y: H * 0.28,
    w: W - M * 2,
    h: 2.6,
    color: h(T.text_primary),
    fontFace: F.headlines,
    fontSize: 40,
    bold: true,
    wrap: true,
  });
  if (subtitle)
    s.addText(subtitle, {
      x: M,
      y: H * 0.28 + 2.7,
      w: W - M * 2,
      h: 0.8,
      color: h(T.text_secondary),
      fontFace: F.body,
      fontSize: 18,
      wrap: true,
    });
  if (author)
    s.addText(author, {
      x: M,
      y: H - 0.55,
      w: W - M * 2,
      h: 0.35,
      color: h(T.text_secondary),
      fontFace: F.body,
      fontSize: 12,
    });
}

function buildSectionSlide(slide: SectionSlide): void {
  const s = pres.addSlide();
  s.background = { color: h(T.background) };
  accentBar(s);
  logo(s, W - 1.3, H - 0.7, 0.9, 0.35);
  if (slide.number || slide.label) {
    s.addText([slide.number, slide.label].filter(Boolean).join("  ·  "), {
      x: M,
      y: 0.3,
      w: W - M * 2,
      h: 0.35,
      color: h(T.accent),
      fontFace: F.body,
      fontSize: 11,
      bold: true,
      charSpacing: 2,
    });
  }
  s.addText(slide.heading, {
    x: M,
    y: 0.9,
    w: W - M * 2,
    h: 1.4,
    color: h(T.text_primary),
    fontFace: F.headlines,
    fontSize: 32,
    bold: true,
    wrap: true,
  });
  let y = 2.5;
  if (slide.body) {
    s.addText(slide.body, {
      x: M,
      y,
      w: W - M * 2,
      h: 1.0,
      color: h(T.text_secondary),
      fontFace: F.body,
      fontSize: 16,
      wrap: true,
    });
    y += 1.15;
  }
  if (slide.items?.length) {
    const bullets = slide.items.map((item) => ({
      text: item,
      options: { bullet: { type: "bullet" as const }, color: h(T.text_primary), fontSize: 15 },
    }));
    s.addText(bullets, {
      x: M,
      y,
      w: W - M * 2,
      h: slide.items.length * 0.45 + 0.2,
      fontFace: F.body,
      wrap: true,
    });
    y += slide.items.length * 0.45 + 0.35;
  }
  if (slide.callout) {
    s.addShape(pres.ShapeType.rect, {
      x: M,
      y,
      w: W - M * 2,
      h: 0.75,
      fill: { color: h(T.surface) },
      line: { color: h(T.accent), width: 1 },
    });
    s.addText(slide.callout, {
      x: M + 0.2,
      y: y + 0.12,
      w: W - M * 2 - 0.4,
      h: 0.5,
      color: h(T.accent),
      fontFace: F.body,
      fontSize: 14,
      italic: true,
      wrap: true,
    });
  }
}

function buildQuoteSlide(slide: QuoteSlide): void {
  const s = pres.addSlide();
  s.background = { color: h(T.background) };
  accentBar(s);
  logo(s, W - 1.3, H - 0.7, 0.9, 0.35);
  s.addText("\u201C", {
    x: M,
    y: 0.35,
    w: 1.2,
    h: 1.1,
    color: h(T.accent),
    fontFace: F.headlines,
    fontSize: 96,
    bold: true,
  });
  s.addText(slide.quote, {
    x: M,
    y: 1.3,
    w: W - M * 2,
    h: H - 2.6,
    color: h(T.text_primary),
    fontFace: F.headlines,
    fontSize: 28,
    italic: true,
    wrap: true,
    valign: "middle",
  });
  if (slide.attribution) {
    s.addText(`\u2014 ${slide.attribution}`, {
      x: M,
      y: H - 0.85,
      w: W - M * 2 - 1.6,
      h: 0.4,
      color: h(T.accent),
      fontFace: F.body,
      fontSize: 14,
      align: "right",
    });
  }
}

function buildMetricsSlide(slide: MetricsSlide): void {
  const s = pres.addSlide();
  s.background = { color: h(T.background) };
  accentBar(s);
  logo(s, W - 1.3, H - 0.7, 0.9, 0.35);
  const contentX = M + BAR;
  if (slide.heading) {
    s.addText(slide.heading, {
      x: contentX,
      y: 0.3,
      w: W - contentX - M,
      h: 0.45,
      color: h(T.accent),
      fontFace: F.body,
      fontSize: 11,
      bold: true,
      charSpacing: 2,
    });
  }
  const metrics = slide.metrics.slice(0, 4);
  const gap = 0.2;
  const boxW = (W - contentX - M - gap * (metrics.length - 1)) / metrics.length;
  const boxY = slide.heading ? 1.0 : H * 0.2;
  metrics.forEach((m, i) => {
    const bx = contentX + i * (boxW + gap);
    s.addShape(pres.ShapeType.rect, {
      x: bx,
      y: boxY,
      w: boxW,
      h: 3.4,
      fill: { color: h(T.surface) },
      line: { color: h(T.accent), width: 1 },
    });
    s.addText(m.value, {
      x: bx,
      y: boxY + 0.5,
      w: boxW,
      h: 1.7,
      color: h(T.accent),
      fontFace: F.headlines,
      fontSize: 52,
      bold: true,
      align: "center",
      wrap: false,
    });
    s.addText(m.label, {
      x: bx,
      y: boxY + 2.4,
      w: boxW,
      h: 0.7,
      color: h(T.text_secondary),
      fontFace: F.body,
      fontSize: 13,
      align: "center",
      wrap: true,
    });
  });
}

function buildClosingSlide(slide: ClosingSlide): void {
  const s = pres.addSlide();
  s.background = { color: h(T.background) };
  accentBar(s);
  logo(s, W / 2 - 1.0, 0.55, 2.0, 0.8, "right");
  s.addText(slide.message, {
    x: M,
    y: H * 0.38,
    w: W - M * 2,
    h: 2.0,
    color: h(T.text_primary),
    fontFace: F.headlines,
    fontSize: 36,
    bold: true,
    align: "center",
    wrap: true,
  });
  if (slide.contact) {
    s.addText(slide.contact, {
      x: M,
      y: H * 0.38 + 2.15,
      w: W - M * 2,
      h: 0.5,
      color: h(T.accent),
      fontFace: F.body,
      fontSize: 18,
      align: "center",
    });
  }
}

// ── Dispatch ──────────────────────────────────────────────────────────────────

function buildSlide(slide: Slide): void {
  switch (slide.type) {
    case "title":
      return buildTitleSlide(slide);
    case "section":
      return buildSectionSlide(slide);
    case "quote":
      return buildQuoteSlide(slide);
    case "metrics":
      return buildMetricsSlide(slide);
    case "closing":
      return buildClosingSlide(slide);
  }
}

content.slides.forEach(buildSlide);
await pres.writeFile({ fileName: resolve(process.cwd(), args.output) });

const counts = content.slides.reduce(
  (acc, s) => {
    acc[s.type] = (acc[s.type] ?? 0) + 1;
    return acc;
  },
  {} as Record<string, number>,
);
console.log(
  `PPTX written: ${args.output} (${content.slides.length} slides — ${Object.entries(counts)
    .map(([k, v]) => `${v} ${k}`)
    .join(", ")})`,
);
